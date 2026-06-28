import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeMonitoring, SentryErrorBoundary } from './lib/monitoring'

// Initialize error tracking and monitoring
initializeMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<div style={{ padding: '20px', color: '#ccc' }}>Something went wrong. Our team has been notified.</div>}>
      <App />
    </SentryErrorBoundary>
  </StrictMode>,
)
