<script setup lang="ts">
const { log } = usePet()
const icon = { decision: '•', lesson: '💡', owner: '🧑' } as const
const rating = (s?: number) => (s === undefined ? '' : ['😣', '😕', '😐', '🙂', '😄'][Math.round(s)])
</script>

<template>
  <section class="card">
    <h2>Memory</h2>
    <p v-if="!log.length" class="empty">Nothing yet. Press “Tick now”.</p>
    <ol>
      <li v-for="m in log" :key="m.id" :class="m.kind">
        <span class="icon">{{ icon[m.kind] }}</span>
        <span class="tick">{{ m.tick }}</span>
        <span>{{ m.text }}</span>
        <span>{{ rating(m.score) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
ol { list-style: none; padding: 0; margin: 0; max-height: 28rem; overflow-y: auto; }
li { display: grid; grid-template-columns: 1.5rem 2rem 1fr auto; gap: .25rem; padding: .25rem 0; border-bottom: 1px solid var(--line); font-size: .9rem; }
li.lesson { font-weight: 600; }
li.owner { color: var(--muted); }
.tick { color: var(--muted); font-variant-numeric: tabular-nums; }
.empty { color: var(--muted); }
</style>
