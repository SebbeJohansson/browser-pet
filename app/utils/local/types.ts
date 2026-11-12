// A small model running in the browser. Used for pet dialogue and, without Jev, for decisions.

export type LocalKind = 'gemini-nano' | 'webllm'

export interface LocalModel {
  readonly kind: LocalKind
  readonly label: string
  /** Free text, for dialogue. */
  generate(system: string, prompt: string): Promise<string>
  /**
   * Probability for each option label. Options are answered by their label only.
   * Small models are not calibrated: use the result as a ranking, not a percentage.
   */
  choose(system: string, prompt: string, labels: string[]): Promise<Record<string, number>>
  /** Free GPU memory. */
  unload?(): Promise<void>
}

export type Progress = (fraction: number, text: string) => void
