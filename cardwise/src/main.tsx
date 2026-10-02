import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { StoreProvider } from './store/store'
import { registerSW } from 'virtual:pwa-register'

// Service worker: offline shell + background alert checks. No-op in dev.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
