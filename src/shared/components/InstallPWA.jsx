// src/shared/components/InstallPWA.jsx
import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Monitor } from 'lucide-react'

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Detectar si ya está instalado
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://')
    setIsStandalone(standalone)

    // Si ya está instalado, no mostrar nada
    if (standalone) {
      return
    }

    // Capturar el evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Mostrar banner después de 30 segundos (dar tiempo al usuario de explorar)
      setTimeout(() => {
        const alreadyDismissed = localStorage.getItem('pwa-install-dismissed')
        if (!alreadyDismissed) {
          setShowInstallPrompt(true)
        }
      }, 30000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt()

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice
    
    console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`)

    // Limpiar
    setDeferredPrompt(null)
    setShowInstallPrompt(false)

    if (outcome === 'accepted') {
      localStorage.removeItem('pwa-install-dismissed')
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // No mostrar si ya está instalado
  if (isStandalone) {
    return null
  }

  // Banner de instalación para iOS
  if (isIOS && !isStandalone) {
    return showInstallPrompt ? (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl z-50 animate-slide-up">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <Smartphone className="w-6 h-6 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">
                Instalar POS en tu iPhone/iPad
              </h3>
              <ol className="text-sm space-y-1 opacity-90">
                <li>1. Toca el botón de compartir <span className="inline-block">⎙</span></li>
                <li>2. Selecciona "Añadir a pantalla de inicio"</li>
                <li>3. Toca "Añadir"</li>
              </ol>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    ) : null
  }

  // Banner de instalación para Android/Desktop
  if (!deferredPrompt) {
    return null
  }

  return showInstallPrompt ? (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl z-50 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          {/* Icono adaptativo */}
          <div className="hidden sm:flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl backdrop-blur">
            {window.innerWidth > 768 ? (
              <Monitor className="w-6 h-6" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>

          {/* Contenido */}
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              Instalar Sistema POS
            </h3>
            <p className="text-sm opacity-90">
              Accede más rápido y trabaja sin conexión instalando la app
            </p>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null
}
