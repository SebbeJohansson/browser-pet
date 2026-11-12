<script setup lang="ts">
const { start } = usePet()
onMounted(start)
</script>

<template>
  <main>
    <h1>Browser Pet</h1>
    <div class="grid">
      <PetView />
      <div class="side">
        <SettingsPanel />
        <MemoryLog />
      </div>
    </div>
  </main>
</template>

<style>
:root {
  --bg: #faf7f2; --card: #fff; --text: #222; --muted: #6b6b6b; --line: #eee;
  --accent: #f59e42; --warn: #c2410c; --bubble: #fff3e3;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #17161a; --card: #222127; --text: #eee; --muted: #9a9aa2; --line: #333; --bubble: #3a2e22; --warn: #fb923c; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 1rem; }
h1 { margin: .5rem 0 1rem; }
h2 { font-size: 1.05rem; margin: 1rem 0 .5rem; }
h2:first-child { margin-top: 0; }
h3 { font-size: .95rem; margin: 1rem 0 .25rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
@media (min-width: 860px) { .grid { grid-template-columns: 1fr 1fr; align-items: start; } }
.side { display: grid; gap: 1rem; }
.card { background: var(--card); border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px #0001; }
button { font: inherit; padding: .4rem .8rem; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: inherit; cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: .5; cursor: default; }
input { font: inherit; padding: .35rem .5rem; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: inherit; }
code { font-size: .85em; }
</style>
