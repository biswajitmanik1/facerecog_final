// Use empty string so API calls go through Vite proxy → backend at :5000
// This avoids cross-origin issues in the browser
export const API_BASE = ''

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('authToken')
}

/**
 * Wraps fetch() for calls to the FastAPI backend: prefixes API_BASE and attaches
 * the signed-in user's Authorization: Bearer token automatically.
 */
export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = new Headers(options.headers || {})

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers })
}
