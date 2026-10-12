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
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
            </Link>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
              Admin Control Center
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Institutional control &amp; master exam management
            </p>
          </div>

          {/* Cyber-Glass Card */}
          <div
            style={{
              background: 'rgba(14, 22, 44, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 16,
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 35px rgba(245, 158, 11, 0.15)',
            }}
          >
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#FCA5A5',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  marginBottom: 16,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
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
                    padding: '11px 14px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1.5px solid rgba(245, 158, 11, 0.25)',
                    background: 'rgba(9, 14, 31, 0.75)',
                    color: '#F8FAFC',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#FBBF24';
                    e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: requireTotp ? 14 : 20 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
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
                      padding: '11px 40px 11px 14px',
                      fontSize: '0.9rem',
                      borderRadius: 8,
                      border: '1.5px solid rgba(245, 158, 11, 0.25)',
                      background: 'rgba(9, 14, 31, 0.75)',
                      color: '#F8FAFC',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#FBBF24';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: 4,
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {requireTotp && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
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
                      padding: '11px 14px',
                      fontSize: '1rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.25em',
                      borderRadius: 8,
                      border: '1.5px solid #F59E0B',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#FBBF24',
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
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
                  color: '#090E1F',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  letterSpacing: '0.02em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In as Admin'}
              </button>
            </form>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
              Invigilator?{' '}
              <Link to="/inspector" style={{ color: '#00D2FF', fontWeight: 800, textDecoration: 'none' }}>
                Go to Inspector Login →
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
            LogicWhile LiRE • Created by <strong style={{ color: '#FBBF24', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
