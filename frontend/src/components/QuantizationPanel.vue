<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
const colorCount = ref(5)
const editingIndex = ref<number | null>(null)
const pendingPalette = ref<number[][] | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const palette = computed(() => store.current?.palette ?? [])

// The palette to display: pending edits if active, otherwise the stored palette
const displayPalette = computed(() => pendingPalette.value ?? palette.value)

function rgbStyle(color: number[]) {
  return { backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }
}

function rgbToHex(color: number[]) {
  return '#' + color.map(c => c.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function onSwatchClick(index: number) {
  editingIndex.value = index
  pendingPalette.value = palette.value.map(c => [...c])
}

function onColorInput(index: number, event: Event) {
  const hex = (event.target as HTMLInputElement).value
  if (!pendingPalette.value) {
    pendingPalette.value = palette.value.map(c => [...c])
  }
  pendingPalette.value[index] = hexToRgb(hex)

  // Debounce the API call for live image preview
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (pendingPalette.value) {
      store.updatePalette(pendingPalette.value.map(c => [...c]))
    }
  }, 150)
}

async function confirmColor() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (pendingPalette.value) {
    await store.updatePalette(pendingPalette.value)
  }
  editingIndex.value = null
  pendingPalette.value = null
}

async function doQuantize() {
  editingIndex.value = null
  pendingPalette.value = null
  await store.quantize(colorCount.value)
}

// Reset editing state when palette changes externally (e.g. re-quantize)
watch(palette, () => {
  if (editingIndex.value !== null && !pendingPalette.value) {
    editingIndex.value = null
  }
})
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
    <div v-if="displayPalette.length" class="palette">
      <div
        v-for="(color, i) in displayPalette"
        :key="i"
        class="swatch"
        :class="{ editing: editingIndex === i }"
        :style="rgbStyle(color)"
        :title="`RGB(${color[0]}, ${color[1]}, ${color[2]}) — click to change`"
        @click="onSwatchClick(i)"
      />
    </div>
    <div v-if="editingIndex !== null" class="color-editor">
      <label class="picker-label">
        Pick color:
        <input
          type="color"
          :value="editingIndex !== null ? rgbToHex(displayPalette[editingIndex]!) : '#000000'"
          @input="onColorInput(editingIndex, $event)"
        />
      </label>
      <button class="primary" @click="confirmColor">OK</button>
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
  cursor: pointer;
}
.swatch:hover {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.swatch.editing {
  outline: 3px solid #2563eb;
  outline-offset: 1px;
}
.color-editor {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.picker-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.picker-label input[type="color"] {
  width: 48px;
  height: 32px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
</style>
