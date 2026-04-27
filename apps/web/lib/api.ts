// Vacío = rutas relativas → Next.js rewrite las proxea a la API interna
const API = process.env.NEXT_PUBLIC_API_URL || ''

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de servidor' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string)                   => apiFetch<T>(path),
  post:   <T>(path: string, body: unknown)    => apiFetch<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)    => apiFetch<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)    => apiFetch<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T = { ok: boolean }>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
