import { useState, useEffect } from 'react'

const THEMES = ['light', 'dark', 'ocean', 'forest', 'sunset', 'midnight', 'nature']

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('pos_theme') || 'light'
    return THEMES.includes(saved) ? saved : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    // Limpiar todo
    root.classList.remove('dark')
    // Aplicar data-theme para TODOS los temas (el CSS lo consume)
    root.setAttribute('data-theme', theme)
    // Agregar clase .dark solo para dark/ocean/forest/sunset/midnight/nature
    if (theme !== 'light') {
      root.classList.add('dark')
    }
    localStorage.setItem('pos_theme', theme)
  }, [theme])

  const toggle   = () => setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length])
  const setDirect = (t) => setTheme(THEMES.includes(t) ? t : 'light')

  return { theme, toggle, setDirect }
}
