<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
const imgRef = ref<HTMLImageElement | null>(null)
let cropper: Cropper | null = null

const aspectRatio = ref<number>(NaN)
const customWidth = ref<number>(4)
const customHeight = ref<number>(5)

const presets = [
  { label: 'Free', value: NaN },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
]

function initCropper() {
  if (!imgRef.value) return
  cropper?.destroy()
  cropper = new Cropper(imgRef.value, {
    viewMode: 1,
    autoCropArea: 1,
    aspectRatio: aspectRatio.value,
  })
}

function setPreset(value: number) {
  aspectRatio.value = value
  cropper?.setAspectRatio(value)
}

function applyCustomRatio() {
  if (customWidth.value > 0 && customHeight.value > 0) {
    const ratio = customWidth.value / customHeight.value
    aspectRatio.value = ratio
    cropper?.setAspectRatio(ratio)
  }
}

async function doCrop() {
  if (!cropper) return
  const data = cropper.getData(true)
  await store.cropImage(data.x, data.y, data.width, data.height)
}

onMounted(() => {
  // Wait for image to load before initializing cropper
  if (imgRef.value) {
    if (imgRef.value.complete) {
      initCropper()
    } else {
      imgRef.value.addEventListener('load', initCropper, { once: true })
    }
  }
})

onBeforeUnmount(() => {
  cropper?.destroy()
  cropper = null
})

// Reinitialize cropper when project changes (e.g. new upload)
watch(
  () => store.current?.id,
  () => {
    cropper?.destroy()
    cropper = null
    // nextTick to wait for new image src
    setTimeout(() => {
      if (imgRef.value) {
        if (imgRef.value.complete && imgRef.value.naturalWidth > 0) {
          initCropper()
        } else {
          imgRef.value.addEventListener('load', initCropper, { once: true })
        }
      }
    }, 0)
  }
)
</script>

<template>
  <div class="crop-panel">
    <div class="crop-container">
      <img
        v-if="store.current"
        ref="imgRef"
        :src="store.imageUrls.original"
        alt="Crop source"
        class="crop-image"
      />
    </div>

    <div class="crop-controls">
      <div class="ratio-presets">
        <span class="label">Aspect ratio:</span>
        <button
          v-for="preset in presets"
          :key="preset.label"
          :class="{ active: String(aspectRatio) === String(preset.value) }"
          @click="setPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="custom-ratio">
        <span class="label">Custom:</span>
        <input type="number" v-model.number="customWidth" min="1" max="100" class="ratio-input" />
        <span>:</span>
        <input type="number" v-model.number="customHeight" min="1" max="100" class="ratio-input" />
        <button @click="applyCustomRatio">Apply</button>
      </div>

      <button class="primary" @click="doCrop" :disabled="store.loading">
        {{ store.loading ? 'Cropping...' : 'Crop' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.crop-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.crop-container {
  max-width: 100%;
  max-height: 500px;
}
.crop-container img {
  display: block;
  max-width: 100%;
}
.crop-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.ratio-presets {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ratio-presets .label,
.custom-ratio .label {
  font-weight: 500;
  margin-right: 0.25rem;
}
.ratio-presets button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.ratio-presets button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.custom-ratio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ratio-input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
