<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { imageUrl } from '../api/client'

const store = useProjectStore()

const project = computed(() => store.current)
const layerCount = computed(() => project.value?.layer_count ?? 0)

async function generateLayers() {
  await store.createLayers()
}
</script>

<template>
  <div class="layer-viewer">
    <button class="primary" @click="generateLayers" :disabled="store.loading">
      {{ store.loading ? 'Generating...' : layerCount > 0 ? 'Regenerate Layers' : 'Generate Layers' }}
    </button>

    <div v-if="project && layerCount > 0" class="layers-grid">
      <div v-for="i in layerCount" :key="i" class="layer-card">
        <h4>Layer {{ i - 1 }}</h4>
        <img
          :src="imageUrl(project.id, `layer_${i - 1}.png`) + '?t=' + Date.now()"
          :alt="`Layer ${i - 1}`"
          class="layer-img"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.layers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}
.layer-card {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.75rem;
}
.layer-card h4 {
  margin: 0 0 0.5rem;
}
.layer-img {
  width: 100%;
  border-radius: 2px;
}
</style>
