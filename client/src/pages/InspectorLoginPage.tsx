import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function InspectorLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter your inspector username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await adminLogin({
        username: form.username.trim(),
        password: form.password,
      });
      const user = res.data?.user;
      const token = res.data?.token;

      if (user && user.role !== 'inspector' && user.role !== 'college_admin' && user.role !== 'super_admin') {
        setError('Access Denied: This portal is exclusively for College Inspectors.');
        return;
      }

      if (token) {
        localStorage.setItem('inspector_token', token);
        localStorage.setItem('admin_token', token);
      }
      if (user) {
        localStorage.setItem('inspector_user', JSON.stringify(user));
        localStorage.setItem('admin_user', JSON.stringify(user));
      }

      navigate('/admin/inspector');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid inspector credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 350 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#002147' }}>
              Inspector Login
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.8rem', margin: '4px 0 0' }}>
              Live invigilation &amp; telemetry monitoring
            </p>
          </div>

          {/* Minimal Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #002147',
              borderRadius: 12,
              padding: '24px 20px',
              boxShadow: '0 8px 24px rgba(0, 33, 71, 0.08)',
            }}
          >
            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  Inspector Username / Email
                </label>
                <input
                  id="inspector-username-input"
                  type="text"
                  required
                  placeholder="inspector"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.88rem',
                    borderRadius: 6,
                    border: '1.5px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="inspector-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 6,
                      border: '1.5px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      padding: 4,
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                id="inspector-login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#002147',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 33, 71, 0.25)',
                  transition: 'opacity 0.15s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In as Inspector'}
              </button>
            </form>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
              Super Administrator?{' '}
              <Link to="/admin" style={{ color: '#EAA812', fontWeight: 800, textDecoration: 'none' }}>
                Go to Admin Login →
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
            It is developed by <strong style={{ color: '#002147', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
