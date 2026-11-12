import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Action, PetState } from './world'

export type MemoryKind = 'decision' | 'lesson' | 'owner'

export interface Memory {
  id?: number
  tick: number
  time: number
  kind: MemoryKind
  action?: Action
  text: string
  /** Outcome judgment, 0..4 (2 = neutral). */
  score?: number
  success?: boolean
}

interface PetDB extends DBSchema {
  pet: { key: string; value: PetState }
  memories: { key: number; value: Memory; indexes: { byTick: number } }
}

let dbPromise: Promise<IDBPDatabase<PetDB>> | null = null

function db() {
  dbPromise ??= openDB<PetDB>('browser-pet', 1, {
    upgrade(d) {
      d.createObjectStore('pet')
      const m = d.createObjectStore('memories', { keyPath: 'id', autoIncrement: true })
      m.createIndex('byTick', 'tick')
    },
  })
  return dbPromise
}

export async function loadPet() {
  return (await db()).get('pet', 'current')
}

export async function savePet(pet: PetState) {
  await (await db()).put('pet', structuredClone(pet), 'current')
}

export async function addMemory(m: Memory) {
  const id = await (await db()).add('memories', m)
  return { ...m, id }
}

export async function updateMemory(m: Memory) {
  await (await db()).put('memories', m)
}

/** Newest first. */
export async function recentMemories(limit: number, kind?: MemoryKind) {
  const out: Memory[] = []
  let cursor = await (await db()).transaction('memories').store.index('byTick').openCursor(null, 'prev')
  while (cursor && out.length < limit) {
    if (!kind || cursor.value.kind === kind) out.push(cursor.value)
    cursor = await cursor.continue()
  }
  return out
}

export async function allMemories() {
  return (await db()).getAll('memories')
}

// ---- Backup ----

export interface Backup {
  format: 'browser-pet'
  version: 1
  exportedAt: string
  pet: PetState
  memories: Memory[]
}

export async function exportBackup(): Promise<Backup> {
  const pet = await loadPet()
  if (!pet) throw new Error('No pet to export')
  return { format: 'browser-pet', version: 1, exportedAt: new Date().toISOString(), pet, memories: await allMemories() }
}

export async function importBackup(data: unknown) {
  const b = data as Partial<Backup>
  if (b?.format !== 'browser-pet' || b.version !== 1 || !b.pet || !Array.isArray(b.memories)) {
    throw new Error('Not a browser-pet backup file')
  }
  const tx = (await db()).transaction(['pet', 'memories'], 'readwrite')
  await tx.objectStore('memories').clear()
  for (const m of b.memories) await tx.objectStore('memories').put(m)
  await tx.objectStore('pet').put(b.pet, 'current')
  await tx.done
}

export async function resetAll() {
  const tx = (await db()).transaction(['pet', 'memories'], 'readwrite')
  await tx.objectStore('memories').clear()
  await tx.objectStore('pet').clear()
  await tx.done
}
