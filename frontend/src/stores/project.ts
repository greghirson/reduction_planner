import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import * as storage from '../services/storage'
import type { ProjectRecord } from '../services/storage'
import { cropImage as cropBlob } from '../services/cropper'
import { flipImage as flipBlob } from '../services/flipper'
import { quantize as runQuantize, replacePalette as runReplacePalette } from '../services/quantizer'

export interface Project {
  id: string
  name: string
  state: string
  color_count?: number
  palette?: number[][]
  layer_order?: number[]
  layer_count?: number
  h_flip?: boolean | null
  v_flip?: boolean | null
}

function projectFromRecord(r: ProjectRecord): Project {
  return {
    id: r.id,
    name: r.name,
    state: r.state,
    color_count: r.color_count,
    palette: r.palette,
    layer_order: r.layer_order,
    layer_count: r.images.layers?.length,
    h_flip: r.h_flip,
    v_flip: r.v_flip,
  }
}

function loadImageAsBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to convert image to blob'))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const current = ref<Project | null>(null)
  const currentRecord = shallowRef<ProjectRecord | null>(null)
  const loading = ref(false)

  const blobUrls = shallowRef<Record<string, string>>({})

  const imageUrls = computed(() => {
    return blobUrls.value
  })

  function revokeBlobUrls() {
    for (const url of Object.values(blobUrls.value)) {
      URL.revokeObjectURL(url)
    }
    blobUrls.value = {}
  }

  function buildBlobUrls(record: ProjectRecord) {
    revokeBlobUrls()
    const urls: Record<string, string> = {}
    if (record.images.original) {
      urls.original = URL.createObjectURL(record.images.original)
    }
    if (record.images.cropped) {
      urls.cropped = URL.createObjectURL(record.images.cropped)
    }
    if (record.images.quantized) {
      urls.quantized = URL.createObjectURL(record.images.quantized)
    }
    if (record.images.flipped) {
      urls.flipped = URL.createObjectURL(record.images.flipped)
    }
    if (record.images.layers) {
      record.images.layers.forEach((blob, i) => {
        urls[`layer_${i}`] = URL.createObjectURL(blob)
      })
    }
    blobUrls.value = urls
  }

  async function fetchProjects() {
    projects.value = (await storage.listProjects()).map(p => ({
      ...p,
      color_count: undefined,
      palette: undefined,
      layer_order: undefined,
      layer_count: undefined,
      h_flip: undefined,
      v_flip: undefined,
    }))
  }

  async function loadProject(id: string) {
    loading.value = true
    try {
      const record = await storage.getProject(id)
      if (record) {
        currentRecord.value = record
        current.value = projectFromRecord(record)
        buildBlobUrls(record)
      }
    } finally {
      loading.value = false
    }
  }

  async function createProject(name: string, image: File) {
    loading.value = true
    try {
      const blob = await loadImageAsBlob(image)
      const id = crypto.randomUUID().replace(/-/g, '')
      const record: ProjectRecord = {
        id,
        name,
        state: 'uploaded',
        images: { original: blob },
      }
      await storage.saveProject(record)
      currentRecord.value = record
      current.value = projectFromRecord(record)
      buildBlobUrls(record)
      return current.value
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(id: string) {
    await storage.deleteProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
    if (current.value?.id === id) {
      current.value = null
      currentRecord.value = null
      revokeBlobUrls()
    }
  }

  async function saveAndRefresh(record: ProjectRecord) {
    await storage.saveProject(record)
    currentRecord.value = record
    current.value = projectFromRecord(record)
    buildBlobUrls(record)
  }

  // --- Processing stubs (implemented in later phases) ---

  async function cropImage(x: number, y: number, width: number, height: number) {
    if (!currentRecord.value) return
    loading.value = true
    try {
      const source = currentRecord.value.images.original!
      const cropped = await cropBlob(source, x, y, width, height)
      const record: ProjectRecord = {
        ...currentRecord.value,
        state: 'cropped',
        color_count: undefined,
        palette: undefined,
        layer_order: undefined,
        h_flip: undefined,
        v_flip: undefined,
        labels: undefined,
        images: {
          original: currentRecord.value.images.original,
          cropped,
        },
      }
      await saveAndRefresh(record)
    } finally {
      loading.value = false
    }
  }

  async function quantize(colorCount: number) {
    if (!currentRecord.value) return
    loading.value = true
    try {
      const source = currentRecord.value.images.cropped ?? currentRecord.value.images.original!
      const result = await runQuantize(source, colorCount)

      const record: ProjectRecord = {
        ...currentRecord.value,
        state: 'quantized',
        color_count: colorCount,
        palette: result.palette,
        layer_order: undefined,
        h_flip: undefined,
        v_flip: undefined,
        labels: result.labels,
        imageWidth: result.width,
        imageHeight: result.height,
        images: {
          original: currentRecord.value.images.original,
          cropped: currentRecord.value.images.cropped,
          quantized: result.quantizedBlob,
        },
      }
      await saveAndRefresh(record)
    } finally {
      loading.value = false
    }
  }

  async function updatePalette(palette: number[][]) {
    if (!currentRecord.value || !currentRecord.value.labels) return
    const quantizedBlob = await runReplacePalette(
      currentRecord.value.labels,
      palette,
      currentRecord.value.imageWidth!,
      currentRecord.value.imageHeight!,
    )

    const record: ProjectRecord = {
      ...currentRecord.value,
      palette,
      images: {
        ...currentRecord.value.images,
        quantized: quantizedBlob,
      },
    }
    // Clear layers on palette change
    delete record.images.layers
    delete record.images.flipped
    if (record.state === 'layers_created') {
      record.state = 'quantized'
      record.layer_order = undefined
    }
    await saveAndRefresh(record)
  }

  async function flipImage(horizontal: boolean, vertical: boolean) {
    if (!currentRecord.value) return
    loading.value = true
    try {
      const record = { ...currentRecord.value, images: { ...currentRecord.value.images } }

      if (!horizontal && !vertical) {
        delete record.images.flipped
        record.h_flip = undefined
        record.v_flip = undefined
      } else {
        if (!record.images.quantized) {
          throw new Error('No quantized image to flip')
        }
        record.images.flipped = await flipBlob(record.images.quantized, horizontal, vertical)
        record.h_flip = horizontal
        record.v_flip = vertical
      }

      // Clear layers when flip changes
      delete record.images.layers
      if (record.state === 'layers_created') {
        record.state = 'quantized'
        record.layer_order = undefined
      }

      await saveAndRefresh(record)
    } finally {
      loading.value = false
    }
  }

  async function createLayers(_order?: number[]) {
    if (!currentRecord.value) return
    loading.value = true
    try {
      throw new Error('Layer building not yet implemented — coming in Phase 4')
    } finally {
      loading.value = false
    }
  }

  return {
    projects,
    current,
    currentRecord,
    loading,
    imageUrls,
    fetchProjects,
    loadProject,
    createProject,
    deleteProject,
    saveAndRefresh,
    cropImage,
    quantize,
    updatePalette,
    flipImage,
    createLayers,
  }
})
