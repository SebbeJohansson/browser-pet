import { createJevBrain, JevError } from '~/utils/brain/jev'
import { createLocalBrain } from '~/utils/brain/local'
import type { Brain } from '~/utils/brain/types'
import { geminiNanoAvailability, loadGeminiNano } from '~/utils/local/gemini-nano'
import type { LocalKind, LocalModel } from '~/utils/local/types'
import { loadWebLLM, webgpuStatus } from '~/utils/local/webllm'
import * as store from '~/utils/db'
import type { Memory } from '~/utils/db'
import { lineFor, thinkWithBrain, thinkWithRules, type Mood, type Plan } from '~/utils/mind'
import { act, ACTION_INFO, learn, newPet, ownerFeed, ownerPet, ownerPlay, type Outcome, type PetState } from '~/utils/world'

export type BrainMode = 'jev' | 'local' | 'rules'
export type LocalChoice = 'auto' | LocalKind

interface Settings {
  brain: BrainMode
  rememberKey: boolean
  tickSeconds: number
  running: boolean
  /** Which in-browser model to load. 'auto' prefers Gemini Nano, then WebLLM. */
  localModel: LocalChoice
  /** Load the local model on page open (set after the first successful load). */
  localAutoLoad: boolean
  /** Let the local model write the pet's lines. */
  dialogue: boolean
}

const SETTINGS_KEY = 'browser-pet.settings'
const KEY_KEY = 'browser-pet.jevKey'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* storage blocked: settings stay in memory */ }
}

// Module-level singletons: one pet per tab.
const pet = ref<PetState | null>(null)
const log = ref<Memory[]>([])
const mood = ref<Mood>('content')
const speech = ref('')
const lastPlan = ref<Plan | null>(null)
const thinking = ref(false)
const error = ref('')
const persisted = ref<boolean | null>(null)
const calls = reactive({ count: 0, inputTokens: 0 })
const jevKey = ref('')
const settings = reactive<Settings>({
  brain: 'rules', rememberKey: false, tickSeconds: 15, running: true,
  localModel: 'auto', localAutoLoad: false, dialogue: true,
})

const local = shallowRef<LocalModel | null>(null)
const localBrain = shallowRef<Brain | null>(null)
const localStatus = reactive({
  geminiNano: 'checking' as string,
  webgpu: 'checking' as 'checking' | 'yes' | 'software' | 'none',
  loading: false,
  progress: 0,
  text: '',
  error: '',
})

let pending: { outcome: Outcome; memory: Memory } | null = null
let timer: ReturnType<typeof setInterval> | null = null
let started = false

const jev: Brain = createJevBrain(() => jevKey.value, (tokens) => {
  calls.count += 1
  calls.inputTokens += tokens
})

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms)
    work.then(resolve, reject).finally(() => clearTimeout(t))
  })
}

async function refreshLog() {
  log.value = await store.recentMemories(30)
}

async function save() {
  if (pet.value) await store.savePet(toRaw(pet.value))
}

async function tick() {
  if (!pet.value || thinking.value) return
  thinking.value = true
  try {
    const p = pet.value
    const memories = await store.recentMemories(8, 'decision')
    const lessons = await store.recentMemories(5, 'lesson')

    // Fallback order: Jev (if picked and keyed) → local model (if loaded) → coded rules.
    const chain: Brain[] = []
    if (settings.brain === 'jev' && jevKey.value) chain.push(jev)
    if (settings.brain !== 'rules' && localBrain.value) chain.push(localBrain.value)
    let plan: Plan | null = null
    const errors: string[] = []
    for (const brain of chain) {
      try {
        plan = await withTimeout(
          thinkWithBrain(brain, p, pending?.outcome ?? null, memories, lessons),
          brain === jev ? 20_000 : 60_000,
          `${brain.name} took too long`,
        )
        break
      } catch (e) {
        errors.push(e instanceof JevError && e.status === 401 ? 'Jev rejected the key (401)' : `${brain.name} failed: ${(e as Error).message}`)
      }
    }
    plan ??= thinkWithRules(p, pending?.outcome ?? null, memories)
    error.value = errors.length ? `${errors.join('; ')}. Used ${plan.source}.` : ''

    // 1. Learn from the previous outcome.
    if (pending && plan.judgment !== undefined) {
      const { outcome, memory } = pending
      memory.score = plan.judgment
      await store.updateMemory(memory)
      learn(p, outcome.action, plan.judgment)
      if (plan.lessonWorthy) {
        const verdict = plan.judgment >= 2 ? 'worked out' : 'went badly'
        await store.addMemory({
          tick: memory.tick,
          time: Date.now(),
          kind: 'lesson',
          action: outcome.action,
          score: plan.judgment,
          text: `${ACTION_INFO[outcome.action].label} when ${outcome.context}: ${verdict} (${outcome.text}).`,
        })
      }
    }

    // 2. Act.
    const outcome = act(p, plan.action)
    const memory = await store.addMemory({
      tick: p.tick,
      time: Date.now(),
      kind: 'decision',
      action: outcome.action,
      success: outcome.success,
      text: `${p.name} ${outcome.text}`,
    })
    pending = { outcome, memory }
    lastPlan.value = plan
    mood.value = plan.mood
    speech.value = lineFor(outcome)
    void speak(p, outcome, plan.mood)

    await save()
    await refreshLog()
  } finally {
    thinking.value = false
  }
}

/** Replace the canned line with one from the local model, if it answers before the next tick. */
async function speak(p: PetState, outcome: Outcome, m: Mood) {
  const model = local.value
  if (!model || !settings.dialogue) return
  const tickAtStart = p.tick
  try {
    const raw = await model.generate(
      `You are ${p.name}, a small, cute virtual pet. You speak in short, playful first-person sentences.`,
      `You feel ${m}. You just ${outcome.text}. Say one short sentence, at most 12 words, as the pet. Output only the sentence.`,
    )
    const line = raw.trim().split('\n')[0]!.replace(/^["']|["']$/g, '').slice(0, 120)
    if (line && pet.value?.tick === tickAtStart) speech.value = line
  } catch { /* keep the canned line */ }
}

async function detectLocal() {
  const [gpu, nano] = await Promise.all([webgpuStatus(), geminiNanoAvailability()])
  localStatus.webgpu = gpu
  localStatus.geminiNano = nano
  if (nano === 'downloading') watchNanoDownload()
}

/** Which model 'auto' (or the user's pick) resolves to on this device, or null. */
// Auto prefers a Gemini Nano that is already on disk, then Qwen (small, quick download),
// and only then a Gemini Nano that still needs Chrome's multi-GB download.
function resolveLocal(): LocalKind | null {
  const nanoReady = localStatus.geminiNano === 'available'
  const nanoPossible = nanoReady || localStatus.geminiNano === 'downloadable' || localStatus.geminiNano === 'downloading'
  const gpu = localStatus.webgpu === 'yes'
  if (settings.localModel === 'gemini-nano') return nanoPossible ? 'gemini-nano' : null
  if (settings.localModel === 'webllm') return gpu ? 'webllm' : null
  return nanoReady ? 'gemini-nano' : gpu ? 'webllm' : nanoPossible ? 'gemini-nano' : null
}

let loadId = 0
let abortLoad: AbortController | null = null

async function loadLocal() {
  const kind = resolveLocal()
  if (!kind || localStatus.loading) return
  const id = ++loadId
  abortLoad = new AbortController()
  localStatus.loading = true
  localStatus.error = ''
  localStatus.progress = 0
  localStatus.text = ''
  try {
    const onProgress = (f: number, t: string) => {
      if (id !== loadId) return
      localStatus.progress = f
      localStatus.text = t
    }
    const model = kind === 'gemini-nano' ? await loadGeminiNano(onProgress, abortLoad.signal) : await loadWebLLM(onProgress)
    if (id !== loadId) {
      // Cancelled while loading: drop it.
      await model.unload?.()
      return
    }
    local.value = model
    localBrain.value = createLocalBrain(model)
    settings.localAutoLoad = true
  } catch (e) {
    if (id === loadId) localStatus.error = (e as Error).message
  } finally {
    if (id === loadId) localStatus.loading = false
  }
}

/** Stop waiting for the current load. A Gemini Nano download may continue inside Chrome. */
function cancelLocal() {
  loadId++
  abortLoad?.abort()
  localStatus.loading = false
  localStatus.text = ''
  settings.localAutoLoad = false
}

async function unloadLocal() {
  const model = local.value
  local.value = null
  localBrain.value = null
  settings.localAutoLoad = false
  await model?.unload?.()
}

// Chrome downloads Gemini Nano in the background; refresh its status so the menu shows when it is ready.
let nanoPoll: ReturnType<typeof setInterval> | null = null
function watchNanoDownload() {
  if (nanoPoll) return
  nanoPoll = setInterval(async () => {
    localStatus.geminiNano = await geminiNanoAvailability()
    if (localStatus.geminiNano === 'available' || localStatus.geminiNano === 'unavailable') {
      clearInterval(nanoPoll!)
      nanoPoll = null
    }
  }, 15_000)
}

function restartTimer() {
  if (timer) clearInterval(timer)
  timer = null
  if (settings.running) timer = setInterval(tick, Math.max(3, settings.tickSeconds) * 1000)
}

async function owner(kind: 'feed' | 'pet' | 'play') {
  if (!pet.value) return
  const p = pet.value
  const text = {
    feed: () => (ownerFeed(p), 'You filled the food bowl.'),
    pet: () => (ownerPet(p), `You petted ${p.name}.`),
    play: () => (ownerPlay(p), `You played with ${p.name}.`),
  }[kind]()
  await store.addMemory({ tick: p.tick, time: Date.now(), kind: 'owner', text })
  await save()
  await refreshLog()
}

async function start() {
  if (started) return
  started = true
  Object.assign(settings, readLocal(SETTINGS_KEY, settings))
  try {
    const k = localStorage.getItem(KEY_KEY)
    if (k) jevKey.value = k
  } catch { /* ignore */ }

  watch(settings, (s) => {
    writeLocal(SETTINGS_KEY, JSON.stringify(s))
    if (!s.rememberKey) writeLocal(KEY_KEY, null)
    else if (jevKey.value) writeLocal(KEY_KEY, jevKey.value)
    restartTimer()
  })
  watch(jevKey, (k) => {
    if (settings.rememberKey) writeLocal(KEY_KEY, k || null)
  })

  persisted.value = (await navigator.storage?.persist?.()) ?? false
  await detectLocal()
  if (settings.localAutoLoad) void loadLocal()
  pet.value = (await store.loadPet()) ?? newPet()
  await save()
  await refreshLog()
  restartTimer()
}

async function exportFile() {
  const data = await store.exportBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${data.pet.name.toLowerCase()}-${data.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function importFile(file: File) {
  await store.importBackup(JSON.parse(await file.text()))
  pending = null
  pet.value = (await store.loadPet()) ?? newPet()
  await refreshLog()
}

async function reset(name: string) {
  await store.resetAll()
  pending = null
  pet.value = newPet(name || 'Pip')
  speech.value = ''
  await save()
  await refreshLog()
}

export function usePet() {
  return {
    pet, log, mood, speech, lastPlan, thinking, error, persisted, calls, jevKey, settings,
    local, localStatus, resolveLocal, loadLocal, cancelLocal, unloadLocal, watchNanoDownload,
    start, tick, owner, exportFile, importFile, reset,
  }
}
