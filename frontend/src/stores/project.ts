import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/client'

export interface Project {
  id: string
  name: string
  state: string
  color_count?: number
  palette?: number[][]
  layer_order?: number[]
  layer_count?: number
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const current = ref<Project | null>(null)
  const loading = ref(false)
  const imageVersion = ref(0)

  async function fetchProjects() {
    projects.value = await api.listProjects()
  }

  async function loadProject(id: string) {
    loading.value = true
    try {
      current.value = await api.getProject(id)
    } finally {
      loading.value = false
    }
  }

  async function createProject(name: string, image: File) {
    const project = await api.createProject(name, image)
    current.value = project
    return project
  }

  async function deleteProject(id: string) {
    await api.deleteProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
    if (current.value?.id === id) current.value = null
  }

  async function cropImage(x: number, y: number, width: number, height: number) {
    if (!current.value) return
    loading.value = true
    try {
      current.value = await api.cropImage(current.value.id, x, y, width, height)
      imageVersion.value++
    } finally {
      loading.value = false
    }
  }

  async function quantize(colorCount: number) {
    if (!current.value) return
    loading.value = true
    try {
      current.value = await api.quantize(current.value.id, colorCount)
      imageVersion.value++
    } finally {
      loading.value = false
    }
  }

  async function updatePalette(palette: number[][]) {
    if (!current.value) return
    current.value = await api.updatePalette(current.value.id, palette)
    imageVersion.value++
  }

  async function createLayers(order?: number[]) {
    if (!current.value) return
    loading.value = true
    try {
      current.value = await api.createLayers(current.value.id, order)
    } finally {
      loading.value = false
    }
  }

  return { projects, current, loading, imageVersion, fetchProjects, loadProject, createProject, deleteProject, cropImage, quantize, updatePalette, createLayers }
})
