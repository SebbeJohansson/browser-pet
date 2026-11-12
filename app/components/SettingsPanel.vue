<script setup lang="ts">
const {
  settings, jevKey, calls, error, persisted, exportFile, importFile, reset, pet,
  local, localStatus, resolveLocal, loadLocal, cancelLocal, unloadLocal, watchNanoDownload,
} = usePet()

function cancel() {
  const wasNano = resolved.value === 'gemini-nano'
  cancelLocal()
  if (wasNano) {
    localStatus.geminiNano = 'downloading'
    watchNanoDownload()
  }
}

const fileInput = ref<HTMLInputElement>()
const status = ref('')
const newName = ref('')

const NANO_TEXT: Record<string, string> = {
  checking: 'checking…',
  available: 'ready on this device',
  downloadable: 'supported, needs a one-time download',
  downloading: 'Chrome is downloading it (several GB, can take a long time)',
  unavailable: 'not available in this browser',
}
const GPU_TEXT = { checking: 'checking…', yes: 'yes', software: 'software only (too slow)', none: 'no' } as const
const resolved = computed(() => resolveLocal())
const resolvedLabel = computed(() =>
  resolved.value === 'gemini-nano'
    ? localStatus.geminiNano === 'available' ? 'Gemini Nano' : 'Gemini Nano (several GB download, managed by Chrome)'
    : resolved.value === 'webllm' ? 'Qwen 0.5B via WebLLM (~400 MB download)' : 'none',
)

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
  <div>
    <h2>Brain</h2>
    <p class="hint">Who decides what the pet does. If the chosen brain fails, the pet falls back to the local model, then coded rules.</p>
    <label class="row"><input v-model="settings.brain" type="radio" value="rules"> Coded rules (free, instant)</label>
    <label class="row">
      <input v-model="settings.brain" type="radio" value="local"> Local model (free, runs in your browser)
    </label>
    <label class="row"><input v-model="settings.brain" type="radio" value="jev"> Jev (your TypeSafe key)</label>

    <template v-if="settings.brain === 'jev'">
      <input v-model="jevKey" type="password" placeholder="TypeSafe API key" autocomplete="off" class="wide">
      <label class="row"><input v-model="settings.rememberKey" type="checkbox"> Remember key in this browser</label>
      <p class="hint">
        Calls are billed to your key. Use a key with a spending limit.
        The key goes only to this site's <code>/api/jev</code> proxy, which forwards it to TypeSafe and never stores it.
      </p>
      <p v-if="!jevKey" class="warn">No key yet: the pet uses the next brain in line until you paste one.</p>
      <p class="hint">Jev calls this session: <strong>{{ calls.count }}</strong> · input tokens: <strong>{{ calls.inputTokens }}</strong></p>
    </template>
    <p v-if="settings.brain === 'local' && !local" class="warn">Load a local model below, or the pet uses coded rules.</p>
    <p v-if="error" class="warn">{{ error }}</p>

    <h2>Local model</h2>
    <p class="hint">
      Gemini Nano: <strong>{{ NANO_TEXT[localStatus.geminiNano] ?? localStatus.geminiNano }}</strong> ·
      WebGPU: <strong>{{ GPU_TEXT[localStatus.webgpu] }}</strong>
    </p>
    <label class="row">
      Use
      <select v-model="settings.localModel" :disabled="!!local || localStatus.loading">
        <option value="auto">Auto (Gemini Nano, else Qwen 0.5B)</option>
        <option value="gemini-nano">Gemini Nano</option>
        <option value="webllm">Qwen 0.5B (WebLLM)</option>
      </select>
    </label>

    <div v-if="local" class="row">
      <span class="ok">✓ {{ local.label }} loaded</span>
      <button @click="unloadLocal">Unload</button>
    </div>
    <p v-if="local?.kind === 'webllm' && localStatus.geminiNano === 'available'" class="hint">
      Gemini Nano has finished downloading. Unload, pick it under “Use”, and load it if you prefer it.
    </p>
    <template v-if="!local">
      <p class="hint">Will load: <strong>{{ resolvedLabel }}</strong></p>
      <div class="row">
        <button :disabled="!resolved || localStatus.loading" @click="loadLocal">
          {{ localStatus.loading ? 'Loading…' : 'Load model' }}
        </button>
        <button v-if="localStatus.loading" @click="cancel">Cancel</button>
      </div>
      <div v-if="localStatus.loading" class="progress">
        <progress :value="localStatus.progress" max="1" />
        <small>{{ localStatus.text }}</small>
      </div>
    </template>
    <p v-if="localStatus.error" class="warn">{{ localStatus.error }}</p>
    <label class="row"><input v-model="settings.dialogue" type="checkbox"> Let the local model write the pet's lines</label>
    <p class="hint">Small models judge worse than Jev. Treat their picks as a rough guess.</p>

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
      <input v-model="newName" placeholder="New pet name" class="wide">
      <button class="danger" @click="onReset">Start over</button>
    </div>
    <p v-if="status" class="hint">{{ status }}</p>
  </div>
</template>

<style scoped>
.row { display: flex; gap: .5rem; align-items: center; margin: .35rem 0; flex-wrap: wrap; }
.wide { width: 100%; max-width: 22rem; }
.num { width: 4.5rem; }
.hint { color: var(--muted); font-size: .875rem; margin: .35rem 0; }
.warn { color: var(--warn); font-size: .875rem; }
.ok { color: var(--ok); font-weight: 600; }
.danger { border-color: var(--warn); color: var(--warn); }
.progress { display: grid; gap: .25rem; margin-top: .5rem; }
.progress progress { width: 100%; }
select { font: inherit; padding: .3rem; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: inherit; }
</style>
