import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminLogin(form);
      if (res.data?.token) {
        localStorage.setItem('admin_token', res.data.token);
      }
      if (res.data?.user) {
        localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      }
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center">
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>
      <div className="container animate-slide-up" style={{ maxWidth: 420 }}>
        <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <BrandLogo size="lg" variant="hero" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>
            Institutional Control Center
          </h2>
          <p className="text-muted text-sm">Super Admin & Faculty Assessment Portal</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error mb-2">⚠️ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-username">Username or Staff Email</label>
              <input
                id="admin-username"
                className="form-input"
                type="text"
                placeholder="admin or faculty@logicwhilelire.com"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" htmlFor="admin-password" style={{ marginBottom: 0 }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--color-primary, #f59e0b)', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="admin-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
            </div>
            <button
              id="admin-login-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? <><div className="btn-spinner" />Signing in...</> : '🔑 Sign In'}
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--color-text-muted, #94a3b8)',
            }}
          >
            Are you a student?{' '}
            <Link to="/enter-exam" style={{ color: 'var(--color-primary, #2B7FFF)', fontWeight: 600 }}>
              Enter Assessment &rarr;
            </Link>
          </div>
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.74rem', color: 'var(--color-text-faint, #64748b)' }}>
            LogicWhileLiRE • <em>"Logic. While. LiRE."</em> • Developed by R. Charan Sai • © 2026 All rights reserved.
          </div>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
