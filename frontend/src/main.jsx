import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pwa.css'
import App from './App.jsx'
import { applySavedTheme } from './utils/theme'

applySavedTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// App instalable: el service worker solo se registra en producción (npm run build) y en conexión segura (HTTPS o localhost)
if ('serviceWorker' in navigator && import.meta.env.PROD && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin soporte: la app funciona igual en el navegador */ })
  })
}
