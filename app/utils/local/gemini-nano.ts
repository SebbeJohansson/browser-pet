import type { LocalModel, Progress } from './types'

// Minimal typing for Chrome's built-in Prompt API (Gemini Nano).
type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'
interface LMSession {
  prompt(input: string, opts?: { responseConstraint?: object }): Promise<string>
  clone(): Promise<LMSession>
  destroy(): void
}
interface LMStatic {
  availability(opts?: object): Promise<Availability>
  create(opts?: {
    initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[]
    expectedInputs?: { type: 'text'; languages: string[] }[]
    expectedOutputs?: { type: 'text'; languages: string[] }[]
    monitor?: (m: EventTarget) => void
    signal?: AbortSignal
  }): Promise<LMSession>
}

const LANG = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }], expectedOutputs: [{ type: 'text' as const, languages: ['en'] }] }

function api(): LMStatic | undefined {
  return (globalThis as { LanguageModel?: LMStatic }).LanguageModel
}

export async function geminiNanoAvailability(): Promise<Availability> {
  const lm = api()
  if (!lm) return 'unavailable'
  try {
    return await lm.availability(LANG)
  } catch {
    return 'unavailable'
  }
}

/** Must be called from a user gesture the first time, because it may start a download. */
/**
 * Must be called from a user gesture the first time, because it may start a download.
 * Aborting stops waiting here; Chrome may keep downloading the model in the background.
 */
export async function loadGeminiNano(onProgress: Progress, signal?: AbortSignal): Promise<LocalModel> {
  const lm = api()
  if (!lm) throw new Error('Gemini Nano is not available in this browser')
  const base = await lm.create({
    ...LANG,
    signal,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        const loaded = (e as Event & { loaded: number }).loaded
        onProgress(loaded, `Downloading Gemini Nano… ${Math.round(loaded * 100)}%`)
      })
    },
  })
  base.destroy() // only created to trigger and await the model download
  onProgress(1, 'Gemini Nano ready')

  // Each call gets a fresh session so earlier prompts do not leak into later answers.
  async function once(system: string, prompt: string, constraint?: object) {
    const s = await lm!.create({ ...LANG, initialPrompts: [{ role: 'system', content: system }] })
    try {
      return await s.prompt(prompt, constraint ? { responseConstraint: constraint } : undefined)
    } finally {
      s.destroy()
    }
  }

  return {
    kind: 'gemini-nano',
    label: 'Gemini Nano',
    generate: (system, prompt) => once(system, prompt),
    async choose(system, prompt, labels) {
      // The Prompt API exposes no token probabilities, so we get one constrained answer.
      const raw = await once(system, prompt, { type: 'string', enum: labels })
      let pick: string
      try {
        pick = JSON.parse(raw)
      } catch {
        pick = raw.trim()
      }
      return Object.fromEntries(labels.map(l => [l, l === pick ? 1 : 0]))
    },
  }

}
