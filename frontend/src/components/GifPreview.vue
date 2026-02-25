<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { buildLayerGif } from '../services/gifBuilder'
import { triggerDownload } from '../services/exporter'

const store = useProjectStore()
const generating = ref(false)
const gifUrl = ref<string | null>(null)
const delay = ref(500)
const sourceWidth = computed(() => store.currentRecord?.imageWidth ?? 1200)
const gifWidth = ref(500)

function cleanup() {
  if (gifUrl.value) {
    URL.revokeObjectURL(gifUrl.value)
    gifUrl.value = null
  }
}

async function generate() {
  const record = store.currentRecord
  if (!record?.images.layers) return

  generating.value = true
  cleanup()
  try {
    const blob = await buildLayerGif(record.images.layers, delay.value, gifWidth.value)
    gifUrl.value = URL.createObjectURL(blob)
  } finally {
    generating.value = false
  }
}

function download() {
  if (!gifUrl.value || !store.currentRecord) return
  // Fetch the blob from the object URL to pass to triggerDownload
  fetch(gifUrl.value)
    .then(r => r.blob())
    .then(blob => {
      const name = store.currentRecord!.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      triggerDownload(blob, `${name}_layers.gif`)
    })
}

onUnmounted(cleanup)
</script>

<template>
  <div class="gif-panel">
    <div class="controls">
      <label class="speed-control">
        Speed:
        <input type="range" min="200" max="2000" step="100" v-model.number="delay" />
        <span class="delay-label">{{ delay }}ms</span>
      </label>
      <label class="speed-control">
        Width:
        <input type="range" min="100" :max="sourceWidth" step="50" v-model.number="gifWidth" />
        <span class="delay-label">{{ gifWidth }}px</span>
      </label>
      <button class="primary" @click="generate" :disabled="generating">
        {{ generating ? 'Generating...' : gifUrl ? 'Regenerate GIF' : 'Generate GIF' }}
      </button>
    </div>
    <div v-if="gifUrl" class="preview-area">
      <img :src="gifUrl" alt="Layer build-up animation" class="gif-preview" />
      <button @click="download">Download GIF</button>
    </div>
  </div>
</template>

<style scoped>
.gif-panel {
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
.speed-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.delay-label {
  min-width: 4em;
  font-variant-numeric: tabular-nums;
}
.preview-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}
.gif-preview {
  max-width: 500px;
  max-height: 400px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
}
.preview-area button {
  cursor: pointer;
}
</style>
