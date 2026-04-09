import { useState, useEffect } from 'react'

// Temas disponibles: 'light' | 'dark' | 'ocean' | 'forest'
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pos_theme') || 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    // Limpiar todos los atributos de tema anteriores
    root.classList.remove('dark')
    root.removeAttribute('data-theme')

    root.setAttribute('data-theme', theme)
    if (theme === 'dark') root.classList.add('dark')

    localStorage.setItem('pos_theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => {
    const order = ['light', 'dark', 'ocean', 'forest']
    return order[(order.indexOf(t) + 1) % order.length]
  })
  const setDirect = (t) => setTheme(t)

  return { theme, toggle, setDirect }
}
