<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import CropPanel from '../components/CropPanel.vue'
import QuantizationPanel from '../components/QuantizationPanel.vue'
import FlipPanel from '../components/FlipPanel.vue'
import LayerViewer from '../components/LayerViewer.vue'
import ExportPanel from '../components/ExportPanel.vue'

const props = defineProps<{ id: string }>()
const store = useProjectStore()

onMounted(() => store.loadProject(props.id))

const project = computed(() => store.current)
const hasCropped = computed(() =>
  project.value && ['cropped', 'quantized', 'layers_created'].includes(project.value.state)
)
const hasQuantized = computed(() =>
  project.value && ['quantized', 'layers_created'].includes(project.value.state)
)
const hasLayers = computed(() => project.value?.state === 'layers_created')
const hasFlip = computed(() => project.value?.h_flip || project.value?.v_flip)
const previewUrl = computed(() =>
  store.imageUrls.cropped ?? store.imageUrls.original
)

const cropOpen = ref(true)
const quantizeOpen = ref(false)
const flipOpen = ref(false)
const layersOpen = ref(false)
const exportOpen = ref(false)

// Auto-collapse completed steps and open the next one
watch(hasCropped, (val) => {
  if (val) {
    cropOpen.value = false
    quantizeOpen.value = true
  }
})
watch(hasQuantized, (val) => {
  if (val) {
    quantizeOpen.value = false
    flipOpen.value = true
  }
})
watch(hasLayers, (val) => {
  if (val) {
    layersOpen.value = false
    exportOpen.value = true
  }
})
</script>

<template>
  <div v-if="store.loading && !project" class="loading">Loading...</div>
  <div v-else-if="project" class="editor">
    <h2>{{ project.name }}</h2>

    <section class="panel">
      <h3>Images</h3>
      <div class="image-row">
        <div>
          <h4>{{ store.imageUrls.cropped ? 'Cropped' : 'Original' }}</h4>
          <img :src="previewUrl" :alt="store.imageUrls.cropped ? 'Cropped' : 'Original'" class="preview" />
        </div>
        <div v-if="hasQuantized">
          <h4>Quantized ({{ project.color_count }} colors)</h4>
          <img :src="store.imageUrls.quantized" alt="Quantized" class="preview" />
        </div>
        <div v-if="hasFlip">
          <h4>Flipped</h4>
          <img :src="store.imageUrls.flipped" alt="Flipped" class="preview" />
        </div>
      </div>
    </section>

    <section class="panel">
      <h3 class="accordion-header" @click="cropOpen = !cropOpen">
        <span class="accordion-arrow" :class="{ open: cropOpen }">&#9654;</span>
        Crop
        <span v-if="hasCropped && !cropOpen" class="accordion-badge">Cropped</span>
      </h3>
      <div v-show="cropOpen" class="accordion-body">
        <CropPanel />
      </div>
    </section>

    <section class="panel">
      <h3 class="accordion-header" @click="quantizeOpen = !quantizeOpen">
        <span class="accordion-arrow" :class="{ open: quantizeOpen }">&#9654;</span>
        Quantization
        <span v-if="hasQuantized && !quantizeOpen" class="accordion-badge">{{ project.color_count }} colors</span>
      </h3>
      <div v-show="quantizeOpen" class="accordion-body">
        <QuantizationPanel />
      </div>
    </section>

    <section v-if="hasQuantized" class="panel">
      <h3 class="accordion-header" @click="flipOpen = !flipOpen">
        <span class="accordion-arrow" :class="{ open: flipOpen }">&#9654;</span>
        Flip / Mirror
        <span v-if="hasFlip && !flipOpen" class="accordion-badge">Flipped</span>
      </h3>
      <div v-show="flipOpen" class="accordion-body">
        <FlipPanel />
      </div>
    </section>

    <section v-if="hasQuantized" class="panel">
      <h3 class="accordion-header" @click="layersOpen = !layersOpen">
        <span class="accordion-arrow" :class="{ open: layersOpen }">&#9654;</span>
        Layers
        <span v-if="hasLayers && !layersOpen" class="accordion-badge">Ready</span>
      </h3>
      <div v-show="layersOpen" class="accordion-body">
        <LayerViewer />
      </div>
    </section>

    <section v-if="hasLayers" class="panel">
      <h3 class="accordion-header" @click="exportOpen = !exportOpen">
        <span class="accordion-arrow" :class="{ open: exportOpen }">&#9654;</span>
        Export
      </h3>
      <div v-show="exportOpen" class="accordion-body">
        <ExportPanel />
      </div>
    </section>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.panel {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}
.panel h3 {
  margin-top: 0;
}
.image-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.preview {
  max-width: 500px;
  max-height: 400px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
h4 {
  margin: 0 0 0.5rem;
}
.loading {
  color: #666;
}
.accordion-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.accordion-arrow {
  font-size: 0.75rem;
  transition: transform 0.2s;
  display: inline-block;
}
.accordion-arrow.open {
  transform: rotate(90deg);
}
.accordion-badge {
  font-size: 0.75rem;
  font-weight: normal;
  color: #16a34a;
  margin-left: auto;
}
.accordion-body {
  margin-top: 1rem;
}
</style>
