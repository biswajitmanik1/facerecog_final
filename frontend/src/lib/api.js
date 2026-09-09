export const API_BASE = 'http://127.0.0.1:5000'

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('authToken')
}

/**
 * Wraps fetch() for calls to the Flask API: prefixes API_BASE and attaches
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
