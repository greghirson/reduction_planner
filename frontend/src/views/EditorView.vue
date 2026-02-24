<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { imageUrl } from '../api/client'
import QuantizationPanel from '../components/QuantizationPanel.vue'
import LayerViewer from '../components/LayerViewer.vue'
import ExportPanel from '../components/ExportPanel.vue'

const props = defineProps<{ id: string }>()
const store = useProjectStore()

onMounted(() => store.loadProject(props.id))

const project = computed(() => store.current)
const hasQuantized = computed(() =>
  project.value && ['quantized', 'layers_created'].includes(project.value.state)
)
const hasLayers = computed(() => project.value?.state === 'layers_created')
</script>

<template>
  <div v-if="store.loading && !project" class="loading">Loading...</div>
  <div v-else-if="project" class="editor">
    <h2>{{ project.name }}</h2>

    <section class="panel">
      <h3>Original Image</h3>
      <div class="image-row">
        <div>
          <img :src="imageUrl(project.id, 'original.png')" alt="Original" class="preview" />
        </div>
        <div v-if="hasQuantized">
          <h4>Quantized ({{ project.color_count }} colors)</h4>
          <img :src="imageUrl(project.id, 'quantized.png') + '?t=' + Date.now()" alt="Quantized" class="preview" />
        </div>
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
</style>
