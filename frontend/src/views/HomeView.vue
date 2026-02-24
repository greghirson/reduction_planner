<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import ImageUploader from '../components/ImageUploader.vue'

const store = useProjectStore()
const router = useRouter()

onMounted(() => store.fetchProjects())

async function onCreated(project: { id: string }) {
  router.push(`/project/${project.id}`)
}

async function onDelete(id: string) {
  if (confirm('Delete this project?')) {
    await store.deleteProject(id)
  }
}
</script>

<template>
  <div class="home">
    <p class="intro">
      Plan your reduction block prints from start to finish. Upload a photo or image, reduce it to a limited color palette, arrange your layers, and export print-ready separations.
    </p>

    <section class="upload-section">
      <h2>New Project</h2>
      <ImageUploader @created="onCreated" />
    </section>

    <section class="projects-section">
      <h2>Projects</h2>
      <div v-if="store.projects.length === 0" class="empty">No projects yet.</div>
      <ul class="project-list">
        <li v-for="p in store.projects" :key="p.id" class="project-item">
          <router-link :to="`/project/${p.id}`" class="project-link">
            <strong>{{ p.name }}</strong>
            <span class="state">{{ p.state }}</span>
          </router-link>
          <button class="danger" @click.prevent="onDelete(p.id)">Delete</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.intro {
  color: #555;
  line-height: 1.6;
  margin: 0;
}
.upload-section, .projects-section {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}
h2 {
  margin-top: 0;
}
.project-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.project-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
}
.project-link {
  flex: 1;
  text-decoration: none;
  color: inherit;
  display: flex;
  gap: 1rem;
  align-items: center;
}
.state {
  color: #666;
  font-size: 0.85rem;
}
.empty {
  color: #999;
}
</style>
