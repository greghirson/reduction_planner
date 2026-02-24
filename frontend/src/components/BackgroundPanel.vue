<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useProjectStore } from '../stores/project'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ done: [] }>()

const store = useProjectStore()

const tolerance = ref(32)
const mode = ref<'white' | 'color'>('white')
const fillColor = ref('#ffffff')

// Undo stack: stores Blobs of previous backgroundRemoved states (or null for "no bg removal")
const undoStack = ref<(Blob | null)[]>([])

const canvasRef = ref<HTMLCanvasElement | null>(null)
let canvasCtx: CanvasRenderingContext2D | null = null

const sourceUrl = computed(() =>
  store.imageUrls.backgroundRemoved ?? store.imageUrls.cropped ?? store.imageUrls.original
)

const hasBackgroundRemoved = computed(() => !!store.currentRecord?.images.backgroundRemoved)

function drawImage() {
  const canvas = canvasRef.value
  if (!canvas || !sourceUrl.value) return
  const img = new Image()
  img.onload = () => {
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvasCtx = canvas.getContext('2d')!
    canvasCtx.drawImage(img, 0, 0)
  }
  img.src = sourceUrl.value
}

watch(sourceUrl, () => {
  if (props.visible) drawImage()
})

watch(() => props.visible, (val) => {
  if (val) {
    undoStack.value = []
    setTimeout(drawImage, 0)
  }
})

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

async function handleCanvasClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas || store.loading) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = Math.round((e.clientX - rect.left) * scaleX)
  const y = Math.round((e.clientY - rect.top) * scaleY)

  // Push current state to undo stack
  const currentBg = store.currentRecord?.images.backgroundRemoved ?? null
  undoStack.value = [...undoStack.value, currentBg]

  const color = mode.value === 'color' ? hexToRgb(fillColor.value) : undefined
  await store.removeBackground(x, y, tolerance.value, color)
}

async function undo() {
  if (undoStack.value.length === 0 || !store.currentRecord) return

  const stack = [...undoStack.value]
  const prev = stack.pop()!
  undoStack.value = stack

  const record = {
    ...store.currentRecord,
    images: {
      ...store.currentRecord.images,
      backgroundRemoved: prev ?? undefined,
      quantized: undefined,
      flipped: undefined,
      layers: undefined,
    },
    state: store.currentRecord.images.cropped ? 'cropped' : 'uploaded',
    color_count: undefined as number | undefined,
    palette: undefined as number[][] | undefined,
    layer_order: undefined as number[] | undefined,
    h_flip: undefined as boolean | undefined,
    v_flip: undefined as boolean | undefined,
    labels: undefined as Uint8Array | undefined,
  }
  await store.saveAndRefresh(record)
}

async function reset() {
  undoStack.value = []
  await store.resetBackground()
}

function done() {
  emit('done')
}

onBeforeUnmount(() => {
  undoStack.value = []
})
</script>

<template>
  <div class="background-panel">
    <p class="hint">Click on areas of the image to fill them with a flat color, simplifying the background before quantization.</p>

    <div class="canvas-container">
      <canvas
        ref="canvasRef"
        class="background-canvas"
        @click="handleCanvasClick"
        :class="{ clickable: !store.loading }"
      />
    </div>

    <div class="controls">
      <div class="control-row">
        <label class="label">Tolerance:</label>
        <input type="range" v-model.number="tolerance" min="0" max="100" step="1" />
        <span class="tolerance-value">{{ tolerance }}</span>
      </div>

      <div class="control-row">
        <label class="label">Fill mode:</label>
        <button :class="{ active: mode === 'white' }" @click="mode = 'white'">White</button>
        <button :class="{ active: mode === 'color' }" @click="mode = 'color'">Color</button>
        <input v-if="mode === 'color'" type="color" v-model="fillColor" class="color-picker" />
      </div>

      <div class="control-row actions">
        <button @click="undo" :disabled="undoStack.length === 0 || store.loading">Undo</button>
        <button @click="reset" :disabled="!hasBackgroundRemoved || store.loading">Reset</button>
        <button class="primary" @click="done" :disabled="store.loading">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.background-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hint {
  margin: 0;
  color: #666;
  font-size: 0.875rem;
}
.canvas-container {
  max-width: 100%;
  overflow: hidden;
}
.background-canvas {
  display: block;
  max-width: 100%;
  max-height: 500px;
  border: 1px solid #ddd;
  border-radius: 4px;
  object-fit: contain;
}
.background-canvas.clickable {
  cursor: crosshair;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.control-row .label {
  font-weight: 500;
  min-width: 5rem;
}
.tolerance-value {
  min-width: 2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.control-row button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.control-row button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.control-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.color-picker {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
.actions {
  gap: 0.5rem;
}
</style>
