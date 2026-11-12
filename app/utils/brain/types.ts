// One interface for every judgment backend (Jev now, a local model later).
// The pet code only talks to Brain, so it never knows which one answers.

export type Question =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } | null }
  | { type: 'score'; instructions: string; criteria: string[] }

export type ChoiceAnswer = { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
export type NoulAnswer = { type: 'noul'; noul: number }
export type ScoreAnswer = { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> }
export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer

export interface Brain {
  readonly name: string
  /** Ask every question for one tick in a single batch. */
  decide(state: unknown, questions: Record<string, Question>): Promise<Record<string, Answer>>
}
