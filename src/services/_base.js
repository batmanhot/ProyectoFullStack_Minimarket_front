import axios from 'axios'
import { APP_CONFIG } from '../config/app'
import { useStore } from '../store/index'

export const USE_API = APP_CONFIG.useApi

export const api = axios.create({ baseURL: APP_CONFIG.apiUrl })

// Extrae el tenantSlug de la URL actual como fallback cuando el usuario
// aún no tiene sesión iniciada (ej: al resolver el tenant en TenantContext).
const _slugFromUrl = () =>
  window.location.pathname.match(/\/app\/([^/]+)/)?.[1] ?? null

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Identificación de tenant en cada request al backend.
  // El backend usa X-Tenant-Id para filtrar datos y X-Tenant-Slug como alias legible.
  const currentUser  = useStore.getState().currentUser
  const tenantId     = currentUser?.tenantId
  const tenantSlug   = currentUser?.tenantSlug ?? _slugFromUrl()

  if (tenantId)   config.headers['X-Tenant-Id']   = tenantId
  if (tenantSlug) config.headers['X-Tenant-Slug'] = tenantSlug

  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mm_token')
      useStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export const ok    = (data, total) => ({ data, meta: { total: total ?? (Array.isArray(data) ? data.length : 1) }, error: null })
export const fail  = (msg)         => ({ data: null, meta: null, error: msg })
export const gs    = ()            => useStore.getState()
export const delay = (ms = 260)   => new Promise(r => setTimeout(r, ms))
