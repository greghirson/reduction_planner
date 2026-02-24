<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/project'

const emit = defineEmits<{ created: [project: { id: string }] }>()

const store = useProjectStore()
const name = ref('')
const file = ref<File | null>(null)
const uploading = ref(false)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function submit() {
  if (!name.value || !file.value) return
  uploading.value = true
  try {
    const project = await store.createProject(name.value, file.value)
    emit('created', project)
    name.value = ''
    file.value = null
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit" class="uploader">
    <input v-model="name" placeholder="Project name" required />
    <input type="file" accept="image/*" @change="onFileChange" required />
    <button class="primary" type="submit" :disabled="uploading || !name || !file">
      {{ uploading ? 'Uploading...' : 'Create Project' }}
    </button>
  </form>
</template>

<style scoped>
.uploader {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}
</style>
