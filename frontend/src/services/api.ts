async function j(path: string, init?: RequestInit) {
  const token = localStorage.getItem('token')
  const headers: any = { 
    'Content-Type': 'application/json', 
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(init?.headers||{}) 
  }
  if (token) headers['Authorization'] = token
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

export async function listModels(forceRefresh = false) { 
    return j('/api/admin/models', { 
        headers: forceRefresh ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {} 
    }) 
}

export async function createModel(payload: any) { return j('/api/admin/models', { method: 'POST', body: JSON.stringify(payload) }) }

export async function updateModel(id: number, payload: any) { return j(`/api/admin/models/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }

export async function listSystemConfigs() { return j('/api/admin/system-configs') }

export async function updateSystemConfig(payload: any) { return j('/api/admin/system-configs', { method: 'POST', body: JSON.stringify(payload) }) }
