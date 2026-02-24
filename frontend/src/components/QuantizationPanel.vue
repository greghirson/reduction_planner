<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
const colorCount = ref(5)

const palette = computed(() => store.current?.palette ?? [])

function rgbStyle(color: number[]) {
  return { backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }
}

async function doQuantize() {
  await store.quantize(colorCount.value)
}
</script>

<template>
  <div class="quant-panel">
    <div class="controls">
      <label>
        Colors: <strong>{{ colorCount }}</strong>
        <input type="range" min="2" max="12" v-model.number="colorCount" />
      </label>
      <button class="primary" @click="doQuantize" :disabled="store.loading">
        {{ store.loading ? 'Quantizing...' : 'Quantize' }}
      </button>
    </div>
    <div v-if="palette.length" class="palette">
      <div
        v-for="(color, i) in palette"
        :key="i"
        class="swatch"
        :style="rgbStyle(color)"
        :title="`RGB(${color[0]}, ${color[1]}, ${color[2]})`"
      />
    </div>
  </div>
</template>

<style scoped>
.quant-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.controls label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
input[type="range"] {
  width: 200px;
}
.palette {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.swatch {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid #ccc;
}
</style>
