<script setup lang="ts">
const { settings, jevKey, calls, error, persisted, exportFile, importFile, reset, pet } = usePet()

const fileInput = ref<HTMLInputElement>()
const status = ref('')
const newName = ref('')

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await importFile(file)
    status.value = `Imported ${file.name}.`
  } catch (err) {
    status.value = `Import failed: ${(err as Error).message}`
  }
  if (fileInput.value) fileInput.value.value = ''
}

async function onReset() {
  await reset(newName.value.trim())
  status.value = `New pet: ${pet.value?.name}.`
}
</script>

<template>
  <section class="card">
    <h2>Brain</h2>
    <label class="row">
      <input v-model="settings.brain" type="radio" value="rules"> Coded rules (free, no key)
    </label>
    <label class="row">
      <input v-model="settings.brain" type="radio" value="jev"> Jev (your TypeSafe key)
    </label>

    <template v-if="settings.brain === 'jev'">
      <input v-model="jevKey" type="password" placeholder="TypeSafe API key" autocomplete="off" class="key">
      <label class="row"><input v-model="settings.rememberKey" type="checkbox"> Remember key in this browser</label>
      <p class="hint">
        Calls are billed to your key. Use a key with a spending limit.
        The key goes only to this site's <code>/api/jev</code> proxy, which forwards it to TypeSafe and never stores it.
      </p>
      <p v-if="!jevKey" class="warn">No key yet: the pet uses coded rules until you paste one.</p>
    </template>

    <p class="stat">Jev calls this session: <strong>{{ calls.count }}</strong> · input tokens: <strong>{{ calls.inputTokens }}</strong></p>
    <p v-if="error" class="warn">{{ error }}</p>

    <h2>Clock</h2>
    <label class="row"><input v-model="settings.running" type="checkbox"> Live (tick automatically)</label>
    <label class="row">Every <input v-model.number="settings.tickSeconds" type="number" min="3" max="600" class="num"> seconds</label>

    <h2>Backup</h2>
    <p class="hint">
      Browsers can delete site data. Export a backup now and then.
      Persistent storage: <strong>{{ persisted === null ? '…' : persisted ? 'granted' : 'not granted' }}</strong>
    </p>
    <div class="row">
      <button @click="exportFile">⬇ Export</button>
      <button @click="fileInput?.click()">⬆ Import</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport">
    </div>
    <div class="row">
      <input v-model="newName" placeholder="New pet name" class="name">
      <button class="danger" @click="onReset">Start over</button>
    </div>
    <p v-if="status" class="hint">{{ status }}</p>
  </section>
</template>

<style scoped>
.row { display: flex; gap: .5rem; align-items: center; margin: .35rem 0; flex-wrap: wrap; }
.key, .name { width: 100%; max-width: 22rem; }
.num { width: 4.5rem; }
.hint { color: var(--muted); font-size: .875rem; }
.warn { color: var(--warn); font-size: .875rem; }
.stat { font-size: .875rem; }
.danger { border-color: var(--warn); color: var(--warn); }
</style>
