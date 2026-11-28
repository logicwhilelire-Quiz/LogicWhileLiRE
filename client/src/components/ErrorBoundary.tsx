import { Component, type ReactNode, type ErrorInfo } from 'react';
import BrandLogo from './BrandLogo';
import { IconAlert } from './icons/HumanIcons';

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
    try {
      const path = window.location.pathname || '';
      if (path.startsWith('/admin') && localStorage.getItem('admin_token')) {
        window.location.href = '/admin/dashboard';
        return;
      }
      if (path.startsWith('/inspector') && localStorage.getItem('inspector_token')) {
        window.location.href = '/inspector/console';
        return;
      }
      if (localStorage.getItem('student_token')) {
        window.location.href = '/student/dashboard';
        return;
      }
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="page-center" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0A1C68 0%, #050B22 65%)' }}>
          <div className="card text-center animate-slide-up" style={{ maxWidth: 460, background: 'rgba(8, 18, 50, 0.94)', border: '1px solid rgba(255, 180, 0, 0.28)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <BrandLogo size="md" themeOverride="dark" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <IconAlert size={40} color="#FFB400" />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 8, color: '#FFFFFF' }}>
              Refreshing View Safely
            </h2>
            <p className="text-muted text-sm mb-6" style={{ color: '#94A3B8', lineHeight: 1.6 }}>
              Your active session and any saved responses remain secure on the server. Click below to reload cleanly or return to your portal.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={this.handleGoHome}>
                Return to Portal
              </button>
              <button className="btn btn-primary" onClick={this.handleReload} style={{ background: '#FFB400', color: '#050B22', fontWeight: 700 }}>
                Reload View
              </button>
            </div>

            <div style={{ marginTop: 24, fontSize: '0.78rem', color: '#64748B' }}>
              LogicWhile LiRE • Elevating Coding Knowledge • © 2026 LogicWhile. All rights reserved.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
