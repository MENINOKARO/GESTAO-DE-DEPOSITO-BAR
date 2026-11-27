import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização capturado:', error, info);
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
            padding: 24,
            background: '#050812',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 24,
              borderRadius: 16,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              textAlign: 'center'
            }}
          >
            <h2 style={{ marginBottom: 10, fontSize: 18 }}>Ops! Ocorreu um erro na tela</h2>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 16, wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Recarregar Sistema
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  try {
                    localStorage.removeItem('gn360_session_v2');
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
              >
                Voltar ao Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
