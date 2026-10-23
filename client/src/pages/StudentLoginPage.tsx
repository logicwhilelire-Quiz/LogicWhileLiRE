import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { studentLogin } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import { findAdminRosterStudent, type AdminRosterStudent } from '../lib/adminRosterStore';

/* ── Animated background ── */
function GridBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,99,235,0.22) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 65%)', filter: 'blur(70px)', animation: 'slOrb1 20s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 65%)', filter: 'blur(60px)', animation: 'slOrb2 26s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '40%', right: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)', filter: 'blur(50px)', animation: 'slOrb3 18s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'linear-gradient(rgba(56,189,248,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.06) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <style>{`
        @keyframes slOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.1)} 66%{transform:translate(-30px,30px) scale(0.9)} }
        @keyframes slOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-50px,40px) scale(1.08)} 70%{transform:translate(30px,-20px) scale(0.95)} }
        @keyframes slOrb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-50px) scale(1.12)} }
        @keyframes slPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes slSpin { to { transform: rotate(360deg); } }
      `}</style>
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
function PortalTab({ label, icon, active, to }: { label: PortalKey; icon: string; active?: boolean; to: string }) {
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
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      cursor: active ? 'default' : 'pointer',
    }}>
      <span>{icon}</span><span>{label}</span>
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
  const [notice, setNotice] = useState(registeredRoll ? '✓ Account verified! Enter your password to sign in.' : '');
  const [focused, setFocused] = useState<string | null>(null);
  const [dots, setDots] = useState('');

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const loginQuery = form.login.trim();
    if (!loginQuery) { setError('Please enter your hall ticket or email'); return; }
    if (!form.password) { setError('Please enter your password'); return; }
    setLoading(true); setError('');
    try {
      const res = await studentLogin({ login: loginQuery, password: form.password });
      if (res.data?.token) localStorage.setItem('student_token', res.data.token);
      if (res.data?.student) localStorage.setItem('student_user', JSON.stringify(res.data.student));
      navigate(redirectTarget);
      return;
    } catch (err: any) {
      const matchedAdminStudent = findAdminRosterStudent(loginQuery);
      if (matchedAdminStudent && matchedAdminStudent.is_verified !== false && matchedAdminStudent.status === 'approved') {
        loginWithAdminStudent(matchedAdminStudent);
        return;
      }
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.message?.includes('Network Error')) {
        setError('Server is warming up or temporarily unreachable. Please retry in a few moments.');
      } else {
        const resp = err?.response?.data;
        setError(resp?.error || 'Invalid hall ticket number or password.');
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
            <PortalTab label="Student" icon="🎓" active to="/login" />
            <PortalTab label="Faculty" icon="👨‍🏫" to="/faculty/login" />
            <PortalTab label="Admin" icon="👑" to="/admin" />
            <PortalTab label="Inspector" icon="🛡️" to="/inspector" />
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
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.38)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.81rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span><span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>🎫 Hall Ticket / Email</label>
                <input id="student-login-input" type="text" required placeholder="e.g. 22B91A0501" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} onFocus={() => setFocused('login')} onBlur={() => setFocused(null)} autoComplete="username" autoFocus style={inputStyle('login')} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <label style={{ fontSize: '0.71rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>🔑 Password</label>
                  <Link to="/forgot-password" style={{ fontSize: '0.74rem', color: '#FBBF24', textDecoration: 'none', fontWeight: 700 }}>Forgot password?</Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input id="student-password-input" type={showPassword ? 'text' : 'password'} required placeholder="Enter your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} autoComplete="current-password" style={{ ...inputStyle('password'), paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem', padding: 4 }}>
                    {showPassword ? '👁️' : '👁️\u200d🗨️'}
                  </button>
                </div>
              </div>
              <button id="student-login-btn" type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: loading ? 'rgba(37,99,235,0.45)' : 'linear-gradient(135deg,#1D4ED8 0%,#2563EB 45%,#38BDF8 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 24px rgba(37,99,235,0.5)', transition: 'all 0.25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.65)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 24px rgba(37,99,235,0.5)'; }}
              >
                {loading ? (<><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'slSpin 0.7s linear infinite' }} /><span>Signing in{dots}</span></>) : (<><span>🎓</span><span>Sign In as Student</span></>)}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748B', marginBottom: 10 }}>
                Don't have an account?{' '}<Link to="/register" id="student-login-register-link" style={{ color: '#38BDF8', fontWeight: 800, textDecoration: 'none' }}>Register Now →</Link>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Link to="/enter-exam" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FBBF24', fontWeight: 700, textDecoration: 'none', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: '0.8rem', transition: 'all 0.2s ease' }}>
                  🎟️ Have an exam code? Enter directly
                </Link>
              </div>
            </div>
          </motion.div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.75rem', color: '#334155' }}>
            LogicWhile LiRE • Created by <strong style={{ color: '#38BDF8', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
