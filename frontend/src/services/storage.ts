import { get, set, del, keys, createStore } from 'idb-keyval'

const store = createStore('reduction-planner', 'projects')

export interface ProjectRecord {
  id: string
  name: string
  state: string
  color_count?: number
  palette?: number[][]
  layer_order?: number[]
  h_flip?: boolean
  v_flip?: boolean
  images: {
    original?: Blob
    cropped?: Blob
    quantized?: Blob
    flipped?: Blob
    layers?: Blob[]
  }
  labels?: Uint8Array
  imageWidth?: number
  imageHeight?: number
}

export async function listProjects(): Promise<{ id: string; name: string; state: string }[]> {
  const allKeys = await keys<string>(store)
  const projects: { id: string; name: string; state: string }[] = []
  for (const key of allKeys) {
    const record = await get<ProjectRecord>(key, store)
    if (record) {
      projects.push({ id: record.id, name: record.name, state: record.state })
    }
  }
  return projects
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return get<ProjectRecord>(id, store)
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  await set(project.id, project, store)
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, store)
}
