import type { LocalModel, Progress } from './types'

const MODEL_F16 = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
const MODEL_F32 = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC'
const FLOOR = 1e-4 // probability for options outside WebLLM's top 5

interface Adapter { features: { has(name: string): boolean }; info?: { isFallbackAdapter?: boolean } }

async function adapter(): Promise<Adapter | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu
  try {
    return (await gpu?.requestAdapter()) ?? null
  } catch {
    return null
  }
}

/** 'software' means a CPU-emulated GPU (e.g. SwiftShader): WebLLM works but is far too slow. */
export async function webgpuStatus(): Promise<'yes' | 'software' | 'none'> {
  const a = await adapter()
  if (!a) return 'none'
  return a.info?.isFallbackAdapter ? 'software' : 'yes'
}

async function pickModel(): Promise<string> {
  const a = await adapter()
  if (!a) throw new Error('No WebGPU adapter')
  return a.features.has('shader-f16') ? MODEL_F16 : MODEL_F32
}

/** Downloads ~300–500 MB the first time (cached by the browser afterwards). */
export async function loadWebLLM(onProgress: Progress): Promise<LocalModel> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
  const model = await pickModel()
  const engine = await CreateMLCEngine(model, {
    initProgressCallback: r => onProgress(r.progress, r.text),
  })
  onProgress(1, 'Qwen 0.5B ready')

  return {
    kind: 'webllm',
    label: 'Qwen 0.5B (WebLLM)',
    unload: () => engine.unload(),
    async generate(system, prompt) {
      const r = await engine.chat.completions.create({
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        max_tokens: 40,
        temperature: 0.9,
      })
      return r.choices[0]?.message.content ?? ''
    },
    async choose(system, prompt, labels) {
      // Read the first answer token's top log-probabilities instead of generating text.
      const r = await engine.chat.completions.create({
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        max_tokens: 1,
        temperature: 0,
        logprobs: true,
        top_logprobs: 5,
      })
      const top = r.choices[0]?.logprobs?.content?.[0]?.top_logprobs ?? []
      const probs: Record<string, number> = Object.fromEntries(labels.map(l => [l, FLOOR]))
      for (const t of top) {
        const tok = t.token.trim().toUpperCase()
        const label = labels.find(l => l.toUpperCase() === tok)
        if (label) probs[label] = Math.max(probs[label]!, Math.exp(t.logprob))
      }
      const sum = Object.values(probs).reduce((s, p) => s + p, 0)
      for (const l of labels) probs[l] = probs[l]! / sum
      return probs
    },
  }
}
