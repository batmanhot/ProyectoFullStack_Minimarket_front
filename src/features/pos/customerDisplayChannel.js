const CHANNEL_NAME = 'pos_customer_display'

export function broadcastToCustomerDisplay(event) {
  try {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage({ ...event, ts: Date.now() })
    channel.close()
  } catch {
    // BroadcastChannel no está disponible en este navegador.
  }
}

export function openCustomerDisplay() {
  const url = window.location.pathname.replace(/\/[^/]*$/, '/customer-display')
  const display = window.open(url, 'customer_display', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no')
  if (!display) alert('Activa las ventanas emergentes para abrir la pantalla del cliente')
  return display
}

export { CHANNEL_NAME }
