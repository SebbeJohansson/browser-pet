import type { Brain, Question } from './brain/types'
import type { Memory } from './db'
import { ACTIONS, ACTION_INFO, NEEDS, ownerPresent, ruleJudge, type Action, type Needs, type Outcome, type PetState } from './world'

export const MOODS = ['content', 'hungry', 'sleepy', 'bored', 'lonely', 'curious', 'grumpy'] as const
export type Mood = (typeof MOODS)[number]

export interface Plan {
  /** Which brain decided: 'rules', 'Jev', or a local model's label. */
  source: string
  action: Action
  /** Jev's probability for the chosen action, if Jev decided. */
  confidence?: number
  mood: Mood
  /** Judgment of the previous outcome, 0..4. */
  judgment?: number
  lessonWorthy?: boolean
}

const JUDGE_LEVELS = [
  'Bad: the pet ended up clearly worse off, the action failed or hurt it',
  'Disappointing: the action did not get what the pet wanted',
  'Neutral: nothing much changed',
  'Good: the action helped with what the pet needed',
  'Great: the action clearly satisfied an urgent need',
]

function describeNeeds(n: Needs) {
  return Object.fromEntries(NEEDS.map(k => [k, `${Math.round(n[k])}/100`]))
}

function memoryLine(m: Memory) {
  const rating = m.score === undefined ? '' : ` (felt ${['bad', 'disappointing', 'neutral', 'good', 'great'][Math.round(m.score)]})`
  return `tick ${m.tick}: ${m.text}${rating}`
}

export function buildState(pet: PetState, pending: Outcome | null, memories: Memory[], lessons: Memory[]) {
  return {
    pet: {
      name: pet.name,
      needs: describeNeeds(pet.needs),
      needs_note: '0 means desperate, 100 means fully satisfied.',
      personality: Object.fromEntries(Object.entries(pet.traits).map(([k, v]) => [k, Number(v.toFixed(2))])),
      personality_note: 'Trait values go from 0 (not at all) to 1 (very strongly).',
    },
    room: {
      food_portions_in_bowl: pet.food,
      owner_nearby: ownerPresent(pet),
    },
    last_action: pending
      ? {
          action: pending.action,
          what_happened: `${pet.name} ${pending.text}`,
          needs_before: describeNeeds(pending.before),
          needs_after: describeNeeds(pending.after),
        }
      : null,
    recent_memories: memories.map(memoryLine),
    lessons_learned: lessons.map(m => m.text),
  }
}

function buildQuestions(pending: Outcome | null): Record<string, Question> {
  const q: Record<string, Question> = {
    action: {
      type: 'choice',
      instructions:
        'Which action would `pet` most likely choose next? Weigh its most urgent needs, its personality, what is available in `room`, and what it learned in `lessons_learned` and `recent_memories`.',
      criteria: Object.fromEntries(ACTIONS.map(a => [a, ACTION_INFO[a].description])),
    },
    mood: {
      type: 'choice',
      instructions: 'Which word best describes how `pet` feels right now, given its needs?',
      criteria: Object.fromEntries(MOODS.map(m => [m, null])),
    },
  }
  if (pending) {
    q.judge = {
      type: 'score',
      instructions: 'How did `last_action` turn out for the pet? Compare `last_action.needs_before` with `last_action.needs_after` and read `last_action.what_happened`.',
      criteria: JUDGE_LEVELS,
    }
    q.lesson = {
      type: 'noul',
      instructions:
        'Is `last_action` worth remembering as a lesson for future decisions? True for a clear success or clear failure that tells the pet when this action works or not. False for routine results.',
    }
  }
  return q
}

export async function thinkWithBrain(brain: Brain, pet: PetState, pending: Outcome | null, memories: Memory[], lessons: Memory[]): Promise<Plan> {
  const answers = await brain.decide(buildState(pet, pending, memories, lessons), buildQuestions(pending))
  const action = answers.action
  const mood = answers.mood
  const judge = answers.judge
  const lesson = answers.lesson
  if (action?.type !== 'choice' || mood?.type !== 'choice') throw new Error('Brain returned unexpected answers')
  if (!ACTIONS.includes(action.choice as Action)) throw new Error(`Unknown action ${action.choice}`)
  return {
    source: brain.name,
    action: action.choice as Action,
    confidence: action.probabilities[action.choice],
    mood: (MOODS as readonly string[]).includes(mood.choice) ? (mood.choice as Mood) : 'content',
    judgment: judge?.type === 'score' ? judge.score : undefined,
    lessonWorthy: lesson?.type === 'noul' ? lesson.noul >= 0.6 : undefined,
  }
}

/** Fallback with no model: weighted random by need urgency, trait strength and remembered outcomes. */
export function thinkWithRules(pet: PetState, pending: Outcome | null, memories: Memory[]): Plan {
  const weights = ACTIONS.map((a) => {
    const info = ACTION_INFO[a]
    if (!info.need || !info.trait) return 0.1
    const urgency = (100 - pet.needs[info.need]) / 100
    const past = memories.filter(m => m.action === a && m.score !== undefined)
    const avg = past.length ? past.reduce((s, m) => s + m.score!, 0) / past.length : 2
    return (urgency + 0.15) * (0.3 + pet.traits[info.trait]) * (0.5 + avg / 4)
  })
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  let action: Action = 'idle'
  for (let i = 0; i < ACTIONS.length; i++) {
    r -= weights[i]!
    if (r <= 0) {
      action = ACTIONS[i]!
      break
    }
  }

  const judgment = pending ? ruleJudge(pending) : undefined
  return {
    source: 'rules',
    action,
    mood: ruleMood(pet.needs),
    judgment,
    lessonWorthy: judgment !== undefined ? Math.abs(judgment - 2) >= 1 : undefined,
  }
}

function ruleMood(n: Needs): Mood {
  const [lowest, value] = Object.entries(n).sort((a, b) => a[1] - b[1])[0]! as [keyof Needs, number]
  if (value > 60) return 'content'
  return ({ fullness: 'hungry', energy: 'sleepy', fun: 'bored', affection: 'lonely' } as const)[lowest]
}

const LINES: Record<Action, [string, string]> = {
  eat: ['Nom nom nom!', 'Hey… where is my food?'],
  nap: ['Zzz…', 'Zzz…'],
  play: ['Got it! Got it!', 'Too… sleepy… to play.'],
  explore: ['Ooh, what is over here?', 'EEK! The loud monster!'],
  beg: ['Pet me pet me pet me!', 'Hello? Anyone?'],
  idle: ['…', '…'],
}

export function lineFor(o: Outcome) {
  return LINES[o.action][o.success ? 0 : 1]
}
