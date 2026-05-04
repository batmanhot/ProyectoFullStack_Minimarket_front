/**
 * useBarcodeScanner.js — Hook global de Barcode Scanner HID
 * Ruta: src/shared/hooks/useBarcodeScanner.js
 *
 * CÓMO FUNCIONA:
 * Un lector de código de barras USB (HID) envía los caracteres del código
 * en ráfaga (<50ms entre teclas) y finaliza con Enter.
 * El hook distingue el escaneo del tipeo manual midiendo el intervalo entre teclas.
 *
 * PARÁMETROS:
 *   onScan(barcode)  → callback cuando se detecta un código válido
 *   enabled          → activar/desactivar el listener (ej: false cuando hay modal abierto)
 *   minLength        → longitud mínima para considerar un código válido (default: 3)
 *   maxInterval      → ms máximo entre teclas para considerar escaneo (default: 50ms)
 *
 * USO EN POS:
 *   useBarcodeScanner({
 *     onScan: (barcode) => handleBarcodeScanned(barcode),
 *     enabled: !showPayment && !showTicket,
 *   })
 */

import { useEffect, useRef, useCallback } from 'react'

const DEFAULT_MIN_LENGTH  = 3
const DEFAULT_MAX_INTERVAL = 50  // ms — los scanners envían en ~10-30ms

export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength  = DEFAULT_MIN_LENGTH,
  maxInterval = DEFAULT_MAX_INTERVAL,
} = {}) {
  const bufferRef   = useRef('')
  const lastTimeRef = useRef(0)
  const timerRef    = useRef(null)

  const flush = useCallback(() => {
    const code = bufferRef.current.trim()
    bufferRef.current = ''
    lastTimeRef.current = 0

    if (code.length >= minLength && typeof onScan === 'function') {
      onScan(code)
    }
  }, [minLength, onScan])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      // Ignorar si el foco está en un input/textarea/select (el cajero está escribiendo)
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Ignorar modificadores solos
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return

      const now = Date.now()
      const interval = now - lastTimeRef.current

      // Si el intervalo es mayor al máximo → nueva secuencia (tipeo manual o nuevo scan)
      if (lastTimeRef.current > 0 && interval > maxInterval) {
        bufferRef.current = ''
      }

      lastTimeRef.current = now

      if (e.key === 'Enter') {
        // Enter termina el scan
        e.preventDefault()
        clearTimeout(timerRef.current)
        flush()
        return
      }

      // Acumular carácter imprimible
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Seguridad: auto-flush si el buffer supera 50 caracteres (código extremadamente largo)
        if (bufferRef.current.length > 50) {
          clearTimeout(timerRef.current)
          flush()
          return
        }

        // Timer de seguridad: si no llega Enter en 100ms, flushar igual
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timerRef.current)
      bufferRef.current = ''
    }
  }, [enabled, maxInterval, flush])
}
