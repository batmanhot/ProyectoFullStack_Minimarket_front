import axios from 'axios'
import { APP_CONFIG } from '../config/app'
import { STORAGE_KEYS } from '../config/storageKeys'
import { useStore } from '../store/index'

export const USE_API      = APP_CONFIG.useApi
export const USE_FACTUAPI = APP_CONFIG.useFactuApi

export const api = axios.create({ baseURL: APP_CONFIG.apiUrl })

// Extrae el tenantSlug de la URL actual como fallback cuando el usuario
// aún no tiene sesión iniciada (ej: al resolver el tenant en TenantContext).
const _slugFromUrl = () =>
  window.location.pathname.match(/\/app\/([^/]+)/)?.[1] ?? null

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken)
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
      localStorage.removeItem(STORAGE_KEYS.authToken)
      useStore.getState().logout()
    }
    // Normaliza el mensaje: el backend puede usar 'message' o 'error'
    if (err.response?.data) {
      err.message = err.response.data.message || err.response.data.error || err.message
    }
    return Promise.reject(err)
  }
)

export const ok    = (data, total) => ({ ok: true,  data, meta: { total: total ?? (Array.isArray(data) ? data.length : 1) }, error: null })
export const fail  = (msg)         => ({ ok: false, data: null, meta: null, error: msg || 'Error desconocido' })
export const gs    = ()            => useStore.getState()
// En modo API no hay delay real — el tiempo lo gestiona la red.
// Solo se activa en modo localStorage para simular latencia y dar feedback visual.
export const delay = (ms = 260) => USE_API ? Promise.resolve() : new Promise(r => setTimeout(r, ms))
