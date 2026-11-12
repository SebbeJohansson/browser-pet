<script setup lang="ts">
const { start, settings, jevKey } = usePet()
onMounted(start)

const menu = ref<HTMLDialogElement>()
const brainLabel = computed(() => {
  if (settings.brain === 'jev' && jevKey.value) return 'Jev'
  return 'Coded rules'
})
</script>

<template>
  <main>
    <header>
      <h1>Browser Pet</h1>
      <span class="chip" title="Current brain">🧠 {{ brainLabel }}</span>
      <button class="menu-btn" aria-label="Settings" @click="menu?.showModal()">⚙ Settings</button>
    </header>

    <div class="grid">
      <PetView />
      <MemoryLog />
    </div>

    <dialog ref="menu" class="menu" @click.self="menu?.close()">
      <div class="menu-body">
        <div class="menu-head">
          <strong>Settings</strong>
          <button aria-label="Close settings" @click="menu?.close()">✕</button>
        </div>
        <SettingsPanel />
      </div>
    </dialog>
  </main>
</template>

<style>
:root {
  --bg: #faf7f2; --card: #fff; --text: #222; --muted: #6b6b6b; --line: #e6e2dc;
  --accent: #f59e42; --warn: #c2410c; --ok: #15803d; --bubble: #fff3e3;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #17161a; --card: #222127; --text: #eee; --muted: #9a9aa2; --line: #36343c; --bubble: #3a2e22; --warn: #fb923c; --ok: #4ade80; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 1rem; }
header { display: flex; align-items: center; gap: .75rem; margin: .5rem 0 1rem; flex-wrap: wrap; }
header h1 { margin: 0; margin-right: auto; }
.chip { font-size: .875rem; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: .2rem .7rem; }
h2 { font-size: 1.05rem; margin: 1.25rem 0 .25rem; }
h2:first-child { margin-top: 0; }
h3 { font-size: .95rem; margin: 1rem 0 .25rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
@media (min-width: 860px) { .grid { grid-template-columns: 1fr 1fr; align-items: start; } }
.card { background: var(--card); border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px #0001; }
button { font: inherit; padding: .4rem .8rem; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: inherit; cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: .5; cursor: default; }
input { font: inherit; padding: .35rem .5rem; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: inherit; }
code { font-size: .85em; }

/* Settings menu: slides in from the right, full width on phones. */
.menu {
  margin: 0 0 0 auto; height: 100dvh; max-height: none; width: min(420px, 100vw);
  border: 0; padding: 0; background: var(--card); color: var(--text);
}
.menu::backdrop { background: #0006; }
.menu-body { padding: 1rem; overflow-y: auto; height: 100%; }
.menu-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
</style>
