import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Global error boundary — catches any unhandled React render exception
 * and shows a clean branded fallback instead of a blank white page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HELPAMART] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f5f0',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <p
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#b77a22',
                marginBottom: '1rem',
              }}
            >
              HELPAMART
            </p>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#071a35',
                marginBottom: '0.75rem',
                lineHeight: 1.3,
              }}
            >
              Something went wrong.
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
              We're sorry — something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#071a35',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
