export const API_URL =(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

let accessToken = null
let socketId = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function setSocketId(id) {
  socketId = id || null
}

async function request(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (socketId) headers['X-Socket-Id'] = socketId

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`)
  }
  return data
}

const enc = encodeURIComponent

export const getBoard = () => request('GET', '/api/board')
export const clearBoard = () => request('DELETE', '/api/board')

export const createTask = (task) => request('POST', '/api/tasks', task)
export const updateTask = (id, fields) => request('PATCH', `/api/tasks/${enc(id)}`, fields)
export const deleteTask = (id) => request('DELETE', `/api/tasks/${enc(id)}`)
export const reorderTasks = (items) => request('PATCH', '/api/tasks/reorder', items)

export const createCategory = (category) => request('POST', '/api/categories', category)
export const updateCategory = (name, fields) =>
  request('PATCH', `/api/categories/${enc(name)}`, fields)
export const deleteCategory = (name) => request('DELETE', `/api/categories/${enc(name)}`)
