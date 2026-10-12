import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', totp_code: '' });
  const [requireTotp, setRequireTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function completeAuth(token?: string, user?: any) {
    if (user && (user.role === 'inspector' || user.role === 'college_admin')) {
      setError('Access Denied: College Inspectors must log in at the Inspector Portal (/inspector).');
      return;
    }
    if (token) localStorage.setItem('admin_token', token);
    if (user) {
      localStorage.setItem('admin_user', JSON.stringify(user));
      if (user.role === 'faculty') {
        navigate('/admin/exams');
        return;
      }
    }
    navigate('/admin/dashboard');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter your admin username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await adminLogin({
        username: form.username.trim(),
        password: form.password,
        totp_code: form.totp_code ? form.totp_code.trim() : undefined,
      });

      if (res.data?.require_2fa && !form.totp_code) {
        setRequireTotp(true);
        setError('');
        setLoading(false);
        return;
      }

      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.message?.includes('Network Error')) {
        setError('Server is warming up or temporarily unreachable. Please retry in a few moments.');
      } else {
        setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Login failed. Invalid admin credentials.');
      }
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
              Admin Login
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.8rem', margin: '4px 0 0' }}>
              Institutional control &amp; exam management
            </p>
          </div>

          {/* Minimal Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #EAA812',
              borderRadius: 12,
              padding: '24px 20px',
              boxShadow: '0 8px 24px rgba(234, 168, 18, 0.12)',
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
                  Username / Email
                </label>
                <input
                  id="admin-username-input"
                  type="text"
                  required
                  placeholder="admin"
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

              <div style={{ marginBottom: requireTotp ? 14 : 18 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password-input"
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

              {requireTotp && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                    Authenticator 2FA Code
                  </label>
                  <input
                    id="admin-totp-input"
                    type="text"
                    required
                    placeholder="6-digit code"
                    maxLength={6}
                    value={form.totp_code}
                    onChange={(e) => setForm({ ...form, totp_code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.92rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.2em',
                      borderRadius: 6,
                      border: '1.5px solid #F59E0B',
                      background: '#FFFBEB',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  />
                </div>
              )}

              <button
                id="admin-login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#EAA812',
                  color: '#002147',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(234, 168, 18, 0.3)',
                  transition: 'opacity 0.15s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In as Admin'}
              </button>
            </form>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
              Invigilator?{' '}
              <Link to="/inspector" style={{ color: '#002147', fontWeight: 700, textDecoration: 'none' }}>
                Go to Inspector Login →
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
