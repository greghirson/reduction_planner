<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { exportUrl } from '../api/client'

const store = useProjectStore()
const project = computed(() => store.current)
</script>

<template>
  <div v-if="project" class="export-panel">
    <a :href="exportUrl(project.id)" download>
      <button class="primary">Download ZIP</button>
    </a>
  </div>
</template>

<style scoped>
.export-panel a {
  text-decoration: none;
}
</style>
