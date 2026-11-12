import { createJevBrain, JevError } from '~/utils/brain/jev'
import type { Brain } from '~/utils/brain/types'
import * as store from '~/utils/db'
import type { Memory } from '~/utils/db'
import { lineFor, thinkWithBrain, thinkWithRules, type Mood, type Plan } from '~/utils/mind'
import { act, ACTION_INFO, learn, newPet, ownerFeed, ownerPet, ownerPlay, type Outcome, type PetState } from '~/utils/world'

export type BrainMode = 'jev' | 'rules'

interface Settings {
  brain: BrainMode
  rememberKey: boolean
  tickSeconds: number
  running: boolean
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
const settings = reactive<Settings>({ brain: 'rules', rememberKey: false, tickSeconds: 15, running: true })

let pending: { outcome: Outcome; memory: Memory } | null = null
let timer: ReturnType<typeof setInterval> | null = null
let started = false

const jev: Brain = createJevBrain(() => jevKey.value, (tokens) => {
  calls.count += 1
  calls.inputTokens += tokens
})

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

    let plan: Plan
    if (settings.brain === 'jev' && jevKey.value) {
      try {
        plan = await thinkWithBrain(jev, p, pending?.outcome ?? null, memories, lessons)
        error.value = ''
      } catch (e) {
        error.value = e instanceof JevError && e.status === 401 ? 'Jev rejected the key (401). Using rules.' : `Jev failed, using rules: ${(e as Error).message}`
        plan = thinkWithRules(p, pending?.outcome ?? null, memories)
      }
    } else {
      plan = thinkWithRules(p, pending?.outcome ?? null, memories)
    }

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

    await save()
    await refreshLog()
  } finally {
    thinking.value = false
  }
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
    start, tick, owner, exportFile, importFile, reset,
  }
}
