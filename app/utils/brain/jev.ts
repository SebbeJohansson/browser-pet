import type { Answer, Brain, Question } from './types'

export class JevError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Jev via our /api/jev proxy. `onCall` lets the UI count billable calls. */
export function createJevBrain(getKey: () => string, onCall: (inputTokens: number) => void): Brain {
  return {
    name: 'Jev',
    async decide(state, questions: Record<string, Question>) {
      const res = await fetch('/api/jev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-jev-key': getKey() },
        body: JSON.stringify({ state, questions }),
      })
      const text = await res.text()
      if (!res.ok) throw new JevError(res.status, `Jev ${res.status}: ${text.slice(0, 300)}`)
      const data = JSON.parse(text) as { answers: Record<string, Answer>; usage?: { input_tokens?: number } }
      onCall(data.usage?.input_tokens ?? 0)
      return data.answers
    },
  }
}
