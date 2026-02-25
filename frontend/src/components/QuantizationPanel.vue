<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
const colorCount = ref(5)
const simplification = ref(50)
const editingIndex = ref<number | null>(null)
const pendingPalette = ref<number[][] | null>(null)
const error = ref<string | null>(null)
const mergeMode = ref(false)
const mergeSelection = ref<number[]>([])

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
  if (mergeMode.value) {
    onMergeSwatchClick(index)
    return
  }
  editingIndex.value = index
  pendingPalette.value = palette.value.map(c => [...c])
}


function onMergeSwatchClick(index: number) {
  const pos = mergeSelection.value.indexOf(index)
  if (pos !== -1) {
    // Deselect
    mergeSelection.value = mergeSelection.value.filter(i => i !== index)
  } else if (mergeSelection.value.length < 2) {
    mergeSelection.value = [...mergeSelection.value, index]
  }
}

function startMergeMode() {
  // Exit color editing mode
  editingIndex.value = null
  pendingPalette.value = null
  if (debounceTimer) clearTimeout(debounceTimer)
  mergeMode.value = true
  mergeSelection.value = []
}

function cancelMerge() {
  mergeMode.value = false
  mergeSelection.value = []
}

async function doMerge() {
  if (mergeSelection.value.length !== 2) return
  const [keepIndex, removeIndex] = mergeSelection.value
  mergeMode.value = false
  mergeSelection.value = []
  error.value = null
  try {
    await store.mergeColors(keepIndex!, removeIndex!)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
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
  mergeMode.value = false
  mergeSelection.value = []
  error.value = null
  try {
    await store.quantize(colorCount.value, simplification.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// Reset editing state when palette changes externally (e.g. re-quantize)
watch(palette, () => {
  if (editingIndex.value !== null && !pendingPalette.value) {
    editingIndex.value = null
  }
  mergeMode.value = false
  mergeSelection.value = []
})
</script>

<template>
  <div class="quant-panel">
    <div class="controls">
      <label>
        Colors: <strong>{{ colorCount }}</strong>
        <input type="range" min="2" max="12" v-model.number="colorCount" />
      </label>
      <label>
        Simplification: <strong>{{ simplification }}</strong>
        <input type="range" min="0" max="100" v-model.number="simplification" />
      </label>
      <button class="primary" @click="doQuantize" :disabled="store.loading">
        {{ store.loading ? 'Quantizing...' : 'Quantize' }}
      </button>
    </div>
    <div v-if="error" style="color: red; font-size: 0.9rem;">Error: {{ error }}</div>
    <div v-if="displayPalette.length" class="palette">
      <div
        v-for="(color, i) in displayPalette"
        :key="i"
        class="swatch"
        :class="{
          editing: editingIndex === i && !mergeMode,
          'merge-selected': mergeSelection.includes(i),
          'merge-keep': mergeSelection[0] === i,
          'merge-remove': mergeSelection[1] === i,
        }"
        :style="rgbStyle(color)"
        :title="mergeMode
          ? mergeSelection.includes(i)
            ? 'Click to deselect'
            : mergeSelection.length < 2
              ? 'Click to select for merge'
              : 'Two colors already selected'
          : `RGB(${color[0]}, ${color[1]}, ${color[2]}) — click to change`"
        @click="onSwatchClick(i)"
      />
    </div>
    <div v-if="editingIndex !== null && !mergeMode" class="color-editor">
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
    <div v-if="displayPalette.length >= 3" class="merge-controls">
      <template v-if="!mergeMode">
        <button @click="startMergeMode" :disabled="store.loading">Merge Colors</button>
      </template>
      <template v-else>
        <span v-if="mergeSelection.length === 0" class="merge-hint">Select the color to keep</span>
        <span v-else-if="mergeSelection.length === 1" class="merge-hint">Select the color to merge into it</span>
        <button
          v-if="mergeSelection.length === 2"
          class="primary"
          @click="doMerge"
          :disabled="store.loading"
        >Merge</button>
        <button class="link-btn" @click="cancelMerge">Cancel</button>
      </template>
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
.swatch.merge-keep {
  outline: 3px solid #16a34a;
  outline-offset: 1px;
}
.swatch.merge-remove {
  outline: 3px solid #dc2626;
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
.merge-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.merge-hint {
  font-size: 0.9rem;
  color: #666;
}
.link-btn {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  padding: 0;
}
.link-btn:hover {
  color: #1d4ed8;
}
</style>
