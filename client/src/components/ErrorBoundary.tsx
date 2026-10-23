import { Component, type ReactNode, type ErrorInfo } from 'react';
import BrandLogo from './BrandLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
    const msg = error?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('dynamically imported module')
    ) {
      const lastReload = sessionStorage.getItem('chunk_error_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 8000) {
        sessionStorage.setItem('chunk_error_reload', String(now));
        if ('caches' in window) {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
        }
        window.location.href = window.location.pathname + '?_t=' + now;
      }
    }
  }

  public handleReload = async () => {
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {}
    }
    window.location.href = window.location.pathname + '?_t=' + Date.now();
  };

  public handleGoHome = () => {
    window.location.href = '/admin';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="page-center">
          <div className="hero-bg">
            <div className="hero-orb hero-orb-1" />
            <div className="hero-orb hero-orb-2" />
          </div>
          <div className="card text-center animate-slide-up" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <BrandLogo size="md" />
            </div>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8, color: 'var(--color-text)' }}>
              An Unexpected Error Occurred
            </h2>
            <p className="text-muted text-sm mb-3">
              We encountered a glitch while rendering this screen. Your exam progress and answers remain safely recorded on the server.
            </p>

            {this.state.error?.message && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: '#f87171',
                  marginBottom: 20,
                  textAlign: 'left',
                  maxHeight: 100,
                  overflowY: 'auto',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={this.handleGoHome}>
                🏠 Return Home
              </button>
              <button className="btn btn-primary" onClick={this.handleReload}>
                🔄 Reload Page
              </button>
            </div>

            <div style={{ marginTop: 24, fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>
              LogicWhile LiRE • Elevating Coding Knowledge • © 2026 LogicWhile LiRE. All rights reserved.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
