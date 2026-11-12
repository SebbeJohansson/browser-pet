import type { LocalModel } from '../local/types'
import type { Answer, Brain, Question } from './types'

const SYSTEM = 'You answer multiple-choice questions about a virtual pet. Reply with the letter of one option and nothing else.'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Imitates Jev with a small local model: every question becomes a lettered
 * multiple-choice prompt, answered one at a time.
 */
export function createLocalBrain(model: LocalModel): Brain {
  async function ask(state: string, instructions: string, options: string[]) {
    const labels = options.map((_, i) => LETTERS[i]!)
    const prompt = [
      `Situation (JSON):\n${state}`,
      `Question: ${instructions}`,
      'Options:',
      ...options.map((o, i) => `${labels[i]}. ${o}`),
      'Answer with one letter.',
    ].join('\n')
    const byLabel = await model.choose(SYSTEM, prompt, labels)
    return options.map((_, i) => byLabel[labels[i]!] ?? 0)
  }

  return {
    name: model.label,
    async decide(state, questions: Record<string, Question>) {
      const s = JSON.stringify(state)
      const answers: Record<string, Answer> = {}
      // Sequential: a local model cannot run questions in parallel like Jev.
      for (const [id, q] of Object.entries(questions)) {
        if (q.type === 'choice') {
          const keys = Object.keys(q.criteria)
          const p = await ask(s, q.instructions, keys.map(k => (q.criteria[k] ? `${k}: ${q.criteria[k]}` : k)))
          const best = p.indexOf(Math.max(...p))
          answers[id] = {
            type: 'choice',
            choice: keys[best]!,
            confidence: p[best]!,
            probabilities: Object.fromEntries(keys.map((k, i) => [k, p[i]!])),
          }
        } else if (q.type === 'noul') {
          const p = await ask(s, q.instructions, ['yes', 'no'])
          answers[id] = { type: 'noul', noul: p[0]! }
        } else {
          const p = await ask(s, q.instructions, q.criteria)
          const score = p.reduce((sum, pi, i) => sum + pi * i, 0)
          answers[id] = {
            type: 'score',
            score,
            confidence: Math.max(...p),
            probabilities: Object.fromEntries(p.map((pi, i) => [String(i), pi])),
          }
        }
      }
      return answers
    },
  }
}
