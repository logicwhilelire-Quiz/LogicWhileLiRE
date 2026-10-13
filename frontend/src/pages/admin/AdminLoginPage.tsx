import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { adminLogin } from '../../lib/api';
import { API_BASE_URL } from '../../lib/config';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: localStorage.getItem('last_admin_user') || 'admin',
    password: '',
    totp_code: '',
  });
  const [requireTotp, setRequireTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warmUpSeconds, setWarmUpSeconds] = useState(0);
  const [error, setError] = useState('');
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  // Track warm-up elapsed time to give real-time reassuring feedback if cloud server is sleeping
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setWarmUpSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setWarmUpSeconds(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

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
    // Remember username for seamless subsequent logins
    if (form.username.trim()) {
      localStorage.setItem('last_admin_user', form.username.trim());
    }
    navigate('/admin/dashboard');
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter your admin username and password.');
      return;
    }

    setLoading(true);
    setError('');
    setIsWarmingUp(false);

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
        setError('Cloud server was sleeping and is spinning up. Click "Wake Server & Retry" below to connect.');
        setIsWarmingUp(true);
      } else {
        setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Login failed. Invalid admin credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleWakeAndRetry() {
    setError('');
    setLoading(true);
    try {
      // Ping backend health endpoint first to awaken instance
      await axios.get(`${API_BASE_URL}/api/health`, { timeout: 30000 });
      // Retry authentication
      await handleSubmit();
    } catch (_) {
      // If ping failed or timed out, attempt login anyway
      await handleSubmit();
    }
  }

  return (
    <AnimatedPage>
      <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
            </Link>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
              Admin Control Center
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Institutional control &amp; master exam management
            </p>
          </div>

          {/* Portal Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(9, 14, 31, 0.75)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: 16,
              gap: 4,
            }}
          >
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 8px',
                borderRadius: 7,
                fontSize: '0.8rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.12) 100%)',
                color: '#FBBF24',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                cursor: 'default',
              }}
            >
              👑 Admin
            </div>
            <Link
              to="/faculty/login"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 8px',
                borderRadius: 7,
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#94A3B8',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#34D399';
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              👨‍🏫 Faculty
            </Link>
            <Link
              to="/inspector"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 8px',
                borderRadius: 7,
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#94A3B8',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#38BDF8';
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94A3B8';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              🛡️ Inspector
            </Link>
          </div>

          {/* Cyber-Glass Card */}
          <div
            style={{
              background: 'rgba(14, 22, 44, 0.92)',
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
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#FCA5A5',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  marginBottom: 16,
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isWarmingUp ? 8 : 0 }}>
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
                {isWarmingUp && (
                  <button
                    type="button"
                    onClick={handleWakeAndRetry}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #F59E0B',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#FBBF24',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⚡</span>
                    <span>Wake Server &amp; Retry Now</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#FBBF24',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
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
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#FBBF24',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
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
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#FBBF24',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
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

              {/* Server Warm-Up Progress Bar if request takes > 2.5s */}
              {loading && warmUpSeconds >= 3 && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#FBBF24', fontWeight: 600 }}>
                    <span>⚡</span>
                    <span>
                      {warmUpSeconds < 8
                        ? 'Connecting to secure server...'
                        : `Waking up cloud server instance (${warmUpSeconds}s)... almost ready!`}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(245, 158, 11, 0.2)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(95, warmUpSeconds * 5)}%`,
                        background: '#F59E0B',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <span>Authenticating...</span>
                    {warmUpSeconds > 0 && <span style={{ opacity: 0.85 }}>({warmUpSeconds}s)</span>}
                  </>
                ) : (
                  'Sign In as Admin'
                )}
              </button>
            </form>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                fontSize: '0.78rem',
                color: '#94A3B8',
              }}
            >
              Invigilator / Room Proctor?{' '}
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
