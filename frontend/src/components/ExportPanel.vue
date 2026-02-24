<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { exportZip, triggerDownload } from '../services/exporter'

const store = useProjectStore()
const project = computed(() => store.current)
const exporting = ref(false)

async function downloadZip() {
  if (!store.currentRecord) return
  exporting.value = true
  try {
    const blob = await exportZip(store.currentRecord)
    const name = store.currentRecord.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    triggerDownload(blob, `${name}_layers.zip`)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div v-if="project" class="export-panel">
    <button class="primary" @click="downloadZip" :disabled="exporting">
      {{ exporting ? 'Exporting...' : 'Download ZIP' }}
    </button>
  </div>
</template>

<style scoped>
.export-panel a {
  text-decoration: none;
}
</style>
