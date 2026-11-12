// The text world: needs, traits, actions and their coded outcomes.
// The brain only picks actions and judges outcomes; code decides what actually happens.

export const NEEDS = ['fullness', 'energy', 'fun', 'affection'] as const
export type Need = (typeof NEEDS)[number]
export type Needs = Record<Need, number> // 0 = desperate, 100 = fully satisfied

export const TRAITS = ['appetite', 'laziness', 'playfulness', 'curiosity', 'clinginess'] as const
export type Trait = (typeof TRAITS)[number]
export type Traits = Record<Trait, number> // 0..1

export const ACTIONS = ['eat', 'nap', 'play', 'explore', 'beg', 'idle'] as const
export type Action = (typeof ACTIONS)[number]

export const ACTION_INFO: Record<Action, { label: string; emoji: string; description: string; need: Need | null; trait: Trait | null }> = {
  eat: { label: 'Eat', emoji: '🍖', description: 'Go to the food bowl and eat, if there is food in it.', need: 'fullness', trait: 'appetite' },
  nap: { label: 'Nap', emoji: '💤', description: 'Curl up and sleep for a while to regain energy.', need: 'energy', trait: 'laziness' },
  play: { label: 'Play', emoji: '🧶', description: 'Play with the yarn ball. Needs some energy.', need: 'fun', trait: 'playfulness' },
  explore: { label: 'Explore', emoji: '🧭', description: 'Wander around the room looking for something interesting. Can be fun or scary.', need: 'fun', trait: 'curiosity' },
  beg: { label: 'Ask for attention', emoji: '🥺', description: 'Go to the owner and ask for attention. Works only if the owner is around.', need: 'affection', trait: 'clinginess' },
  idle: { label: 'Do nothing', emoji: '…', description: 'Sit still and watch the world.', need: null, trait: null },
}

export const LEARNING_STEP = 0.04 // max trait change per judged outcome
export const TRAIT_MIN = 0.05
export const TRAIT_MAX = 0.95

export interface PetState {
  name: string
  tick: number
  needs: Needs
  traits: Traits
  food: number // portions in the bowl
  lastOwnerTick: number // last tick the owner interacted
  createdAt: number
}

export interface Outcome {
  action: Action
  text: string
  success: boolean
  /** The condition that decided the result, for lessons. */
  context: string
  before: Needs
  after: Needs
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

export function newPet(name = 'Pip'): PetState {
  const traits = Object.fromEntries(TRAITS.map(t => [t, 0.4 + Math.random() * 0.2])) as Traits
  return {
    name,
    tick: 0,
    needs: { fullness: 70, energy: 70, fun: 60, affection: 60 },
    traits,
    food: 2,
    lastOwnerTick: -100,
    createdAt: Date.now(),
  }
}

export function ownerPresent(pet: PetState): boolean {
  return pet.tick - pet.lastOwnerTick <= 3
}

/** Apply one action. Mutates pet, returns what happened. */
export function act(pet: PetState, action: Action): Outcome {
  const before = { ...pet.needs }
  const n = pet.needs
  const context = {
    eat: pet.food > 0 ? 'there was food in the bowl' : 'the bowl was empty',
    nap: n.energy < 40 ? 'it was tired' : 'it was not tired',
    play: n.energy > 20 ? 'it had energy' : 'it was exhausted',
    explore: 'it went exploring',
    beg: ownerPresent(pet) ? 'the owner was nearby' : 'the owner was away',
    idle: 'it had nothing to do',
  }[action]
  let text: string
  let success = true

  // Time passes.
  n.fullness -= 4
  n.energy -= 3
  n.fun -= 3
  n.affection -= 2

  switch (action) {
    case 'eat':
      if (pet.food > 0) {
        pet.food -= 1
        n.fullness += 30
        text = 'ate a portion from the bowl'
      } else {
        n.fun -= 5
        success = false
        text = 'found the bowl empty'
      }
      break
    case 'nap':
      n.energy += 30
      n.fun -= 2
      text = 'took a nap'
      break
    case 'play':
      if (n.energy > 20) {
        n.fun += 25
        n.energy -= 10
        text = 'chased the yarn ball around'
      } else {
        n.fun -= 5
        success = false
        text = 'tried to play but was too tired'
      }
      break
    case 'explore': {
      n.energy -= 8
      const r = Math.random()
      if (r < 0.55) {
        n.fun += 18
        text = 'found a sunny spot behind the couch'
      } else if (r < 0.8) {
        text = 'wandered around and found nothing'
      } else {
        n.fun -= 10
        n.affection -= 5
        success = false
        text = 'got scared by the vacuum cleaner'
      }
      break
    }
    case 'beg':
      if (ownerPresent(pet)) {
        n.affection += 25
        text = 'got cuddles from the owner'
      } else {
        n.affection -= 5
        success = false
        text = 'asked for attention but nobody came'
      }
      break
    case 'idle':
      text = 'sat and watched the world'
      break
  }

  for (const k of NEEDS) n[k] = clamp(n[k])
  pet.tick += 1
  return { action, text, success, context, before, after: { ...n } }
}

/** Coded judgment of an outcome on the same 0..4 scale Jev uses. */
export function ruleJudge(o: Outcome): number {
  const gain = NEEDS.reduce((s, k) => s + (o.after[k] - o.before[k]), 0)
  return clamp(2 + gain / 15, 0, 4)
}

/** Nudge the trait tied to an action. score is 0..4, 2 = neutral. Returns the change. */
export function learn(pet: PetState, action: Action, score: number): number {
  const trait = ACTION_INFO[action].trait
  if (!trait) return 0
  const delta = ((score - 2) / 2) * LEARNING_STEP
  const old = pet.traits[trait]
  pet.traits[trait] = clamp(old + delta, TRAIT_MIN, TRAIT_MAX)
  return pet.traits[trait] - old
}

// Owner interactions.
export function ownerFeed(pet: PetState) {
  pet.food = 3
  pet.lastOwnerTick = pet.tick
}
export function ownerPet(pet: PetState) {
  pet.needs.affection = clamp(pet.needs.affection + 20)
  pet.lastOwnerTick = pet.tick
}
export function ownerPlay(pet: PetState) {
  pet.needs.fun = clamp(pet.needs.fun + 20)
  pet.needs.energy = clamp(pet.needs.energy - 5)
  pet.lastOwnerTick = pet.tick
}
