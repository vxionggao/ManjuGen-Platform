import { notifyAssetUpdate } from '../events'

async function j(path: string, init?: RequestInit) {
  const token = localStorage.getItem('token')
  const headers: any = { 
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    // Inject Gateway API Key
    'Authorization': 'Bearer 8q28-oQ2wDTrSqQTTHHH1gAxBhEi3YxMJab7',
    ...(init?.headers||{}) 
  }
  
  if (!(init?.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
  }

  if (token) {
    // Use X-App-Token to avoid conflict with Gateway Authorization header
    headers['X-App-Token'] = token
    console.log('Injecting X-App-Token:', token)
  }
  console.log('Sending request to:', path, 'with headers:', headers)
  const r = await fetch(path, { ...init, headers })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export async function login(username: string, password: string) {
  return j('/api/users/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export async function me() { return j('/api/users/me') }

export async function createTask(payload: any) { return j('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }) }

export async function listTasks() { return j('/api/tasks') }

export async function clearTasks(type?: string) {
    const url = type ? `/api/tasks?type=${type}` : '/api/tasks'
    return j(url, { method: 'DELETE' })
}

export async function deleteTask(taskId: string) {
  return j(`/api/tasks/${taskId}`, { method: 'DELETE' })
}

export async function listModels(forceRefresh = false) { 
    return j('/api/admin/models', { 
        headers: forceRefresh ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {} 
    }) 
}

export async function createModel(payload: any) { return j('/api/admin/models', { method: 'POST', body: JSON.stringify(payload) }) }

export async function updateModel(id: number, payload: any) { return j(`/api/admin/models/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }

export async function listSystemConfigs() { return j('/api/admin/system-configs') }

export async function updateSystemConfig(payload: any) { return j('/api/admin/system-configs', { method: 'POST', body: JSON.stringify(payload) }) }

export async function uploadAsset(file: File, type: string = 'script') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    const res = await j('/api/assets/upload', { method: 'POST', body: formData })
    notifyAssetUpdate()
    return res
}

export async function listAssets(type?: string) {
    const params = type ? `?type=${type}` : ''
    return j(`/api/assets${params}`)
}

export async function searchAssets(query: string, type?: string, topk: number = 10) {
    const params = new URLSearchParams({ q: query, topk: topk.toString() })
    if (type) {
        params.append('type', type)
    }
    return j(`/api/assets/search?${params.toString()}`)
}

export async function getAsset(assetId: string) {
    return j(`/api/assets/${assetId}`)
}

export async function ingestAsset(assetData: any) {
    const res = await j('/api/assets/ingest', { method: 'POST', body: JSON.stringify(assetData) })
    notifyAssetUpdate()
    return res
}

export async function deleteAsset(assetId: string) {
    const res = await j(`/api/assets/${assetId}`, { method: 'DELETE' })
    notifyAssetUpdate()
    return res
}

export async function resolvePrompt(prompt: string) {
    return j('/api/prompt/resolve', { method: 'POST', body: JSON.stringify({ prompt }) })
}

export async function searchMaterials(query: string, limit: number = 10) {
    return j('/api/materials/search', { method: 'POST', body: JSON.stringify({ query, limit }) })
}

export async function importMaterial(item: any) {
    const res = await j('/api/materials/import_from_vikingdb', { method: 'POST', body: JSON.stringify(item) })
    notifyAssetUpdate()
    return res
}

export async function optimizeBadcase(payload: { prompt: string, image_url: string, reference_url?: string }) {
    return j('/api/badcase/optimize', { method: 'POST', body: JSON.stringify(payload) })
}

export async function listBestPractices(category?: string) {
    const params = category ? `?category=${category}` : ''
    return j(`/api/best_practices${params}`)
}

export async function createBestPractice(payload: any) {
    return j('/api/best_practices', { method: 'POST', body: JSON.stringify(payload) })
}

export async function uploadBestPracticeImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return j('/api/best_practices/upload', { method: 'POST', body: formData })
}

export async function deleteBestPractice(id: number) {
    return j(`/api/best_practices/${id}`, { method: 'DELETE' })
}

export async function createProject(payload: any) {
    return j('/api/projects', { method: 'POST', body: JSON.stringify(payload) })
}

export async function listProjects() {
    return j('/api/projects')
}

export async function getProject(id: string) {
    return j(`/api/projects/${id}`)
}

export async function updateProject(id: string, payload: any) {
    return j(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export async function deleteProject(id: string) {
    return j(`/api/projects/${id}`, { method: 'DELETE' })
}

