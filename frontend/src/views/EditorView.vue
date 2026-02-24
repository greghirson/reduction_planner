<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { imageUrl } from '../api/client'
import CropPanel from '../components/CropPanel.vue'
import QuantizationPanel from '../components/QuantizationPanel.vue'
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
const previewImage = computed(() =>
  hasCropped.value ? 'cropped.png' : 'original.png'
)

const cropOpen = ref(true)

// Auto-collapse crop panel once cropped
watch(hasCropped, (val) => {
  if (val) cropOpen.value = false
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
          <h4>{{ hasCropped ? 'Cropped' : 'Original' }}</h4>
          <img :src="imageUrl(project.id, previewImage) + '?v=' + store.imageVersion" :alt="hasCropped ? 'Cropped' : 'Original'" class="preview" />
        </div>
        <div v-if="hasQuantized">
          <h4>Quantized ({{ project.color_count }} colors)</h4>
          <img :src="imageUrl(project.id, 'quantized.png') + '?v=' + store.imageVersion" alt="Quantized" class="preview" />
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
      <h3>Quantization</h3>
      <QuantizationPanel />
    </section>

    <section v-if="hasQuantized" class="panel">
      <h3>Layers</h3>
      <LayerViewer />
    </section>

    <section v-if="hasLayers" class="panel">
      <h3>Export</h3>
      <ExportPanel />
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
