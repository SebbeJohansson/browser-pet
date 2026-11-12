<script setup lang="ts">
import { ACTION_INFO, NEEDS, TRAITS } from '~/utils/world'

const { pet, mood, speech, lastPlan, thinking, owner, tick } = usePet()

const face = computed(() => ({
  content: '◕‿◕', hungry: '◕﹏◕', sleepy: '－ω－', bored: '¬_¬', lonely: '╥﹏╥', curious: '◉o◉', grumpy: '◣_◢',
}[mood.value]))
</script>

<template>
  <section v-if="pet" class="card pet">
    <div class="stage">
      <p v-if="speech" class="bubble">{{ speech }}</p>
      <div class="blob" :class="[lastPlan?.action, { thinking }]">
        <span class="face">{{ face }}</span>
      </div>
      <p class="name">{{ pet.name }} <small>· {{ mood }} · tick {{ pet.tick }}</small></p>
      <p v-if="lastPlan" class="doing">
        {{ ACTION_INFO[lastPlan.action].emoji }} {{ ACTION_INFO[lastPlan.action].label }}
        <small>
          decided by {{ lastPlan.source }}<template v-if="lastPlan.confidence !== undefined"> ({{ Math.round(lastPlan.confidence * 100) }}%)</template>
        </small>
      </p>
    </div>

    <div class="owner">
      <button @click="owner('feed')">🥣 Fill bowl ({{ pet.food }})</button>
      <button @click="owner('pet')">🤚 Pet</button>
      <button @click="owner('play')">🧶 Play</button>
      <button :disabled="thinking" @click="tick()">⏭ Tick now</button>
    </div>

    <h3>Needs</h3>
    <div v-for="n in NEEDS" :key="n" class="bar">
      <span>{{ n }}</span>
      <meter min="0" max="100" low="25" high="60" optimum="100" :value="pet.needs[n]" />
      <span class="num">{{ Math.round(pet.needs[n]) }}</span>
    </div>

    <h3>Personality <small>(learned)</small></h3>
    <div v-for="t in TRAITS" :key="t" class="bar">
      <span>{{ t }}</span>
      <meter min="0" max="1" :value="pet.traits[t]" />
      <span class="num">{{ pet.traits[t].toFixed(2) }}</span>
    </div>
  </section>
</template>

<style scoped>
.stage { text-align: center; padding: 1rem 0; }
.bubble {
  display: inline-block; background: var(--bubble); padding: .4rem .8rem; border-radius: 1rem;
  margin: 0 0 .75rem; min-height: 1.5em;
}
.blob {
  width: 120px; height: 100px; margin: 0 auto; border-radius: 50% 50% 45% 45%;
  background: radial-gradient(circle at 35% 30%, #ffd9a8, #f59e42);
  display: grid; place-items: center; animation: bob 2.5s ease-in-out infinite;
  box-shadow: 0 10px 20px -10px #0005;
}
.blob.nap { animation-duration: 5s; filter: saturate(.6); }
.blob.play, .blob.explore { animation: hop .6s ease-in-out infinite; }
.blob.thinking { outline: 3px dashed var(--accent); outline-offset: 6px; }
.face { font-size: 1.4rem; color: #422; }
.name { font-weight: 600; margin: .75rem 0 .25rem; }
.doing { margin: 0; }
small { color: var(--muted); font-weight: 400; }
.owner { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; margin-bottom: 1rem; }
.bar { display: grid; grid-template-columns: 7rem 1fr 2.5rem; gap: .5rem; align-items: center; }
.bar meter { width: 100%; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
@keyframes bob { 50% { transform: translateY(-6px); } }
@keyframes hop { 50% { transform: translateY(-16px) rotate(4deg); } }
</style>
