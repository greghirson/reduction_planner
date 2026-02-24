const BASE = '/api'

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res
}

export async function listProjects() {
  const res = await request('/projects')
  return res.json()
}

export async function createProject(name: string, image: File) {
  const form = new FormData()
  form.append('name', name)
  form.append('image', image)
  const res = await request('/projects', { method: 'POST', body: form })
  return res.json()
}

export async function getProject(id: string) {
  const res = await request(`/projects/${id}`)
  return res.json()
}

export async function deleteProject(id: string) {
  await request(`/projects/${id}`, { method: 'DELETE' })
}

export async function quantize(id: string, colorCount: number) {
  const res = await request(`/projects/${id}/quantize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color_count: colorCount }),
  })
  return res.json()
}

export async function updatePalette(id: string, palette: number[][]) {
  const res = await request(`/projects/${id}/palette`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ palette }),
  })
  return res.json()
}

export async function createLayers(id: string, order?: number[]) {
  const res = await request(`/projects/${id}/layers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: order ?? null }),
  })
  return res.json()
}

export function imageUrl(id: string, filename: string) {
  return `${BASE}/projects/${id}/images/${filename}`
}

export function exportUrl(id: string) {
  return `${BASE}/projects/${id}/export`
}
