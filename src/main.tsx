import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { I18nProvider } from '@/i18n'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import './index.css'

// Capture any uncaught JS errors (e.g. chunk load failures)
window.addEventListener('error', (e) => {
  console.error('[HELPAMART] Global error:', e.message, e.filename, e.error)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[HELPAMART] Unhandled promise rejection:', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
