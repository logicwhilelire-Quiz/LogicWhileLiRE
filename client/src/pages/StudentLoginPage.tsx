import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { studentLogin } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import BrandLogo from '../components/BrandLogo';
import ServerWakeupModal from '../components/ServerWakeupModal';
import { findAdminRosterStudent, type AdminRosterStudent } from '../lib/adminRosterStore';
import { IconUsers, IconAward, IconShield, IconRadio, IconEye, IconKey } from '../components/icons/HumanIcons';

/* ── Animated background ── */
function GridBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 15%, rgba(59,130,246,0.08) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.22, backgroundImage: 'linear-gradient(rgba(59,130,246,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.08) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
  );
}

/* ── Portal role tab ── */
type PortalKey = 'Student' | 'Faculty' | 'Admin' | 'Inspector';
const PORTAL_COLORS: Record<PortalKey, { text: string; bg: string; border: string; glow: string }> = {
  Student:   { text: '#60A5FA', bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.5)', glow: 'rgba(59,130,246,0.3)' },
  Faculty:   { text: '#34D399', bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.5)', glow: 'rgba(16,185,129,0.3)' },
  Admin:     { text: '#FBBF24', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.5)', glow: 'rgba(245,158,11,0.3)' },
  Inspector: { text: '#A78BFA', bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.5)', glow: 'rgba(139,92,246,0.3)' },
};
function PortalTab({ label, icon, active, to }: { label: PortalKey; icon: React.ReactNode; active?: boolean; to: string }) {
  const [hov, setHov] = useState(false);
  const c = PORTAL_COLORS[label];
  return (
    <Link to={to} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 800,
      color: active || hov ? c.text : '#475569',
      background: active ? c.bg : hov ? c.bg.replace('0.18','0.08') : 'transparent',
      border: `1px solid ${active ? c.border : 'transparent'}`,
      boxShadow: active ? `0 0 12px ${c.glow}` : 'none',
      textDecoration: 'none', transition: 'all 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: active ? 'default' : 'pointer',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span><span>{label}</span>
    </Link>
  );
}

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/student/dashboard';
  const registeredRoll = searchParams.get('registered') || searchParams.get('roll') || '';

  const [form, setForm] = useState({ login: registeredRoll, password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState(registeredRoll ? '✓ Account verified! Enter your password to sign in.' : '');
  const [focused, setFocused] = useState<string | null>(null);
  const [dots, setDots] = useState('');
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  // Proactive warm-up ping on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`, { method: 'GET', keepalive: true }).catch(() => {});
  }, []);

  // Track warm-up elapsed time and auto-activate wakeup modal if taking > 4.5s
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setIsWarmingUp(true);
      }, 4500);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) { setDots(''); return; }
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(iv);
  }, [loading]);

  function loginWithAdminStudent(student: AdminRosterStudent) {
    if (student.is_blocked) { setError('Account suspended by administration.'); return; }
    if (student.is_verified === false || student.status === 'pending_clearance') {
      setError('Account pending clearance from administrator.'); return;
    }
    const studentUser = {
      id: student.id, name: student.name,
      first_name: student.first_name || student.name.split(' ')[0],
      last_name: student.last_name || student.name.split(' ')[1] || '',
      email: student.email,
      roll_number: student.hall_ticket || student.roll_number,
      hall_ticket: student.hall_ticket || student.roll_number,
      college_id: student.college_id || 1, college_name: student.college_name,
      branch_code: student.branch || student.branch_code || 'CSE',
      section: student.section,
      section_id: student.section_id || `sec-${(student.branch || 'cse').toLowerCase()}-${student.section.toLowerCase()}`,
      year_of_passing: student.passout_year, passout_year: student.passout_year, batch: student.batch,
    };
    localStorage.setItem('student_token', `token-admin-roster-${student.id}`);
    localStorage.setItem('student_user', JSON.stringify(studentUser));
    navigate(redirectTarget);
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const loginQuery = form.login.trim();
    if (!loginQuery) { setError('Please enter your hall ticket or email'); return; }
    if (!form.password) { setError('Please enter your password'); return; }
    setLoading(true); setError('');
    try {
      const res = await studentLogin({ login: loginQuery, password: form.password });
      if (res.data?.token) localStorage.setItem('student_token', res.data.token);
      if (res.data?.student) localStorage.setItem('student_user', JSON.stringify(res.data.student));
      setIsWarmingUp(false);
      navigate(redirectTarget);
      return;
    } catch (err: any) {
      const matchedAdminStudent = findAdminRosterStudent(loginQuery);
      if (matchedAdminStudent && matchedAdminStudent.is_verified !== false && matchedAdminStudent.status === 'approved') {
        setIsWarmingUp(false);
        loginWithAdminStudent(matchedAdminStudent);
        return;
      }
      const isColdStart =
        err?.code === 'ECONNABORTED' ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('Network Error') ||
        (err?.response && [502, 503, 504].includes(err.response.status));

      if (isColdStart) {
        setIsWarmingUp(true);
        setError('');
        setUnverifiedEmail(null);
      } else {
        setIsWarmingUp(false);
        const resp = err?.response?.data;
        setError(resp?.error || 'Invalid hall ticket number or password.');
        if (resp?.requires_verification && resp?.email) {
          setUnverifiedEmail(resp.email);
        } else {
          setUnverifiedEmail(null);
        }
      }
    } finally { setLoading(false); }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', padding: '13px 14px', fontSize: '0.94rem', borderRadius: 10,
    border: `1.5px solid ${focused === field ? 'rgba(56,189,248,0.65)' : 'rgba(59,130,246,0.2)'}`,
    background: focused === field ? 'rgba(56,189,248,0.05)' : 'rgba(9,14,31,0.65)',
    color: '#F8FAFC', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s ease',
    boxShadow: focused === field ? '0 0 0 3px rgba(56,189,248,0.15)' : 'none',
    fontFamily: "'Plus Jakarta Sans',sans-serif",
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#060B1A 0%,#080D22 50%,#050918 100%)', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
      <GridBackground />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }} style={{ width: '100%', maxWidth: 420 }}>
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 16, padding: '10px 20px', boxShadow: '0 4px 20px rgba(37,99,235,0.18)' }}>
                <BrandLogo size="sm" variant="standard" showTagline={true} />
              </div>
            </Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.28)', borderRadius: 20, padding: '4px 14px', marginBottom: 10, fontSize: '0.71rem', fontWeight: 800, color: '#60A5FA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', animation: 'slPulse 2.5s ease-in-out infinite' }} />
              Candidate Assessment Portal
            </div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 900, margin: '0 0 5px', color: '#FFFFFF', letterSpacing: '-0.025em', fontFamily: "'Rajdhani',sans-serif" }}>Student Sign In</h1>
            <p style={{ color: '#64748B', fontSize: '0.82rem', margin: 0 }}>Enter with Hall Ticket or registered email</p>
          </div>

          {/* Portal Switcher */}
          <div style={{ display: 'flex', background: 'rgba(9,14,31,0.8)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 18, gap: 3, backdropFilter: 'blur(12px)' }}>
            <PortalTab label="Student" icon={<IconUsers size={13} color="currentColor" />} active to="/login" />
            <PortalTab label="Faculty" icon={<IconAward size={13} color="currentColor" />} to="/faculty/login" />
            <PortalTab label="Admin" icon={<IconShield size={13} color="currentColor" />} to="/admin" />
            <PortalTab label="Inspector" icon={<IconRadio size={13} color="currentColor" />} to="/inspector" />
          </div>

          {/* Glass Login Card */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }} style={{ background: 'rgba(10,18,40,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1.5px solid rgba(59,130,246,0.28)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.6),0 0 40px rgba(37,99,235,0.1),inset 0 1px 0 rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
            {/* Top glow line */}
            <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(56,189,248,0.75),transparent)' }} />

            <AnimatePresence>
              {notice && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.38)', color: '#6EE7B7', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.81rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✓</span><span>{notice}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {error && !isWarmingUp && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.38)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.81rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flexShrink: 0 }}>⚠️</span><span>{error}</span>
                  </div>
                  {unverifiedEmail && (
                    <button
                      type="button"
                      onClick={() => navigate(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                      style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: '#38BDF8', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.81rem', fontWeight: 700, padding: 0 }}
                    >
                      Verify Account &amp; Activate Now →
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <ServerWakeupModal
              isOpen={isWarmingUp}
              onRetry={handleSubmit}
              onClose={() => setIsWarmingUp(false)}
            />

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Hall Ticket / Email</label>
                <input id="student-login-input" type="text" required placeholder="e.g. 22B91A0501" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} onFocus={() => setFocused('login')} onBlur={() => setFocused(null)} autoComplete="username" autoFocus style={inputStyle('login')} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: '0.71rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <IconKey size={13} color="#38BDF8" /> Password
                  </label>
                  <Link to="/forgot-password" style={{ fontSize: '0.74rem', color: '#FBBF24', textDecoration: 'none', fontWeight: 700 }}>Forgot password?</Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input id="student-password-input" type={showPassword ? 'text' : 'password'} required placeholder="Enter your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} autoComplete="current-password" style={{ ...inputStyle('password'), paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
                    <IconEye size={16} color={showPassword ? '#38BDF8' : '#475569'} />
                  </button>
                </div>
              </div>
              <button id="student-login-btn" type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: loading ? 'rgba(37,99,235,0.45)' : 'linear-gradient(135deg,#1D4ED8 0%,#2563EB 45%,#38BDF8 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 24px rgba(37,99,235,0.5)', transition: 'all 0.25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.65)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 24px rgba(37,99,235,0.5)'; }}
              >
                {loading ? (<><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'slSpin 0.7s linear infinite' }} /><span>Signing in{dots}</span></>) : (<><IconUsers size={16} color="#FFFFFF" /><span>Sign In as Student</span></>)}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748B', marginBottom: 10 }}>
                Don't have an account?{' '}<Link to="/register" id="student-login-register-link" style={{ color: '#38BDF8', fontWeight: 800, textDecoration: 'none' }}>Register Now →</Link>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link to="/enter-exam" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FBBF24', fontWeight: 700, textDecoration: 'none', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: '0.8rem', transition: 'all 0.2s ease' }}>
                  Have an exam code? Enter directly &rarr;
                </Link>
              </div>
            </div>
          </motion.div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
            LogicWhile • Institutional Assessment Platform
          </div>
        </motion.div>
      </div>
    </div>
  );
}
