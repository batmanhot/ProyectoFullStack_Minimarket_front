import { useState } from 'react'
import { useStore } from '../../store/index'
import { authService } from '../../services/index'
import { ROLES } from '../../config/app'
import toast from 'react-hot-toast'

const DEMO_ROLES = [
  { role: 'admin',      icon: '🛡️' },
  { role: 'gerente',    icon: '👔' },
  { role: 'supervisor', icon: '👁️' },
  { role: 'cajero',     icon: '🖥️' },
]

export default function Login() {
  const { setCurrentUser, businessConfig } = useStore()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')

  const handleDemoLogin = async (role) => {
    setLoading(true)
    const result = await authService.login(role)
    if (result.data) {
      setCurrentUser(result.data)
      toast.success(`Bienvenido, ${result.data.fullName}`)
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  const handleManualLogin = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    const result = await authService.loginWithCredentials(username.trim())
    if (result.data) {
      setCurrentUser(result.data)
      toast.success(`Bienvenido, ${result.data.fullName}`)
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3 text-2xl">🛒</div>
          <h1 className="text-xl font-semibold text-gray-800">{businessConfig?.name || 'Sistema POS'}</h1>
          <p className="text-sm text-gray-400 mt-1">Ingresa con tus credenciales</p>
        </div>

        {/* Acceso rápido demo */}
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 text-center">Acceso rápido — Demo</p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {DEMO_ROLES.map(({ role, icon }) => {
            const cfg = ROLES[role]
            return (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${cfg.color} border-current border-opacity-30`}
              >
                <span className="text-base">{icon}</span>
                {cfg.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o ingresa tu usuario</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleManualLogin} className="space-y-4">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="admin, cajero1, supervisor..."
            autoComplete="username"
          />
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Ingresando...</>
            ) : 'Ingresar al sistema'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">Sistema POS Demo — Solo presentaciones comerciales</p>
      </div>
    </div>
  )
}
