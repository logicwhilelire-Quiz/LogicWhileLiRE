import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { adminLogin } from '../../lib/api';
import { API_BASE_URL } from '../../lib/config';
import BrandLogo from '../../components/BrandLogo';

function AdminGridBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,0.2) 0%,transparent 65%)', filter: 'blur(80px)', animation: 'agOrb1 22s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(234,88,12,0.15) 0%,transparent 65%)', filter: 'blur(70px)', animation: 'agOrb2 28s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '50%', left: '25%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(251,191,36,0.1) 0%,transparent 65%)', filter: 'blur(50px)', animation: 'agOrb3 16s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: 'linear-gradient(rgba(245,158,11,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.06) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <style>{`
        @keyframes agOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-50px,40px) scale(1.08)} 65%{transform:translate(30px,-30px) scale(0.92)} }
        @keyframes agOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(60px,-45px) scale(1.1)} 70%{transform:translate(-25px,25px) scale(0.94)} }
        @keyframes agOrb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,50px) scale(1.15)} }
        @keyframes agPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes agSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

type AGPortalKey = 'Admin' | 'Faculty' | 'Inspector' | 'Student';
const AG_PORTAL_COLORS: Record<AGPortalKey, {text:string;bg:string;border:string}> = {
  Admin:     { text: '#FBBF24', bg: 'rgba(245,158,11,0.2)',   border: 'rgba(245,158,11,0.55)' },
  Faculty:   { text: '#34D399', bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.5)' },
  Inspector: { text: '#A78BFA', bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.5)' },
  Student:   { text: '#60A5FA', bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.5)' },
};
function AGPortalTab({ label, icon, active, to }: { label: AGPortalKey; icon: string; active?: boolean; to: string }) {
  const [hov, setHov] = useState(false);
  const c = AG_PORTAL_COLORS[label];
  return (
    <Link to={to} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 800,
      color: active || hov ? c.text : '#475569',
      background: active ? c.bg : hov ? c.bg.replace(/0\.\d+\)$/,'0.08)') : 'transparent',
      border: `1px solid ${active ? c.border : 'transparent'}`,
      boxShadow: active ? `0 0 14px ${c.bg}` : 'none',
      textDecoration: 'none', transition: 'all 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      cursor: active ? 'default' : 'pointer',
    }}>
      <span>{icon}</span><span>{label}</span>
    </Link>
  );
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: localStorage.getItem('last_admin_user') || '',
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
      setError('Access Denied: College Inspectors must log in at the Inspector Portal (/inspector/login).');
      return;
    }
    if (user && user.role === 'faculty') {
      setError('Access Denied: Faculty members must log in at the Faculty Portal (/faculty/login).');
      return;
    }
    if (token) {
      localStorage.removeItem('faculty_token');
      localStorage.removeItem('faculty_user');
      sessionStorage.removeItem('faculty_token');
      sessionStorage.removeItem('faculty_user');
      localStorage.removeItem('inspector_token');
      localStorage.removeItem('inspector_user');
      sessionStorage.removeItem('inspector_token');
      sessionStorage.removeItem('inspector_user');
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_user');
      sessionStorage.removeItem('student_token');
      sessionStorage.removeItem('student_user');
      localStorage.removeItem('logicwhilelire_attempt');
      localStorage.removeItem('candidate_gate_pass');
      localStorage.setItem('admin_token', token);
    }
    if (user) {
      localStorage.setItem('admin_user', JSON.stringify(user));
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#060B1A 0%,#09100A 40%,#0A0800 100%)', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
      <AdminGridBg />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }} style={{ width: '100%', maxWidth: 420 }}>
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: '10px 20px', boxShadow: '0 4px 20px rgba(245,158,11,0.15)' }}>
                <BrandLogo size="sm" variant="standard" showTagline={true} />
              </div>
            </Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 20, padding: '4px 14px', marginBottom: 10, fontSize: '0.71rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', animation: 'agPulse 2.5s ease-in-out infinite' }} />
              Admin Control Center
            </div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 900, margin: '0 0 5px', color: '#FFFFFF', letterSpacing: '-0.025em', fontFamily: "'Rajdhani',sans-serif" }}>Super Admin Sign In</h1>
            <p style={{ color: '#64748B', fontSize: '0.82rem', margin: 0 }}>Institutional control &amp; master exam management</p>
          </div>

          {/* Portal Switcher */}
          <div style={{ display: 'flex', background: 'rgba(9,14,31,0.8)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 18, gap: 3, backdropFilter: 'blur(12px)' }}>
            <AGPortalTab label="Admin" icon="👑" active to="/admin" />
            <AGPortalTab label="Faculty" icon="👨‍🏫" to="/faculty/login" />
            <AGPortalTab label="Inspector" icon="🛡️" to="/inspector" />
            <AGPortalTab label="Student" icon="🎓" to="/login" />
          </div>

          {/* Glass Card */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }} style={{ background: 'rgba(10,18,40,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.6),0 0 40px rgba(245,158,11,0.1),inset 0 1px 0 rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(251,191,36,0.75),transparent)' }} />
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

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
              Invigilator / Room Proctor?{' '}
              <Link to="/inspector" style={{ color: '#A78BFA', fontWeight: 800, textDecoration: 'none' }}>Inspector Portal →</Link>
            </div>
          </motion.div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
            LogicWhile LiRE • Developed by <strong style={{ color: '#EAA812', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
