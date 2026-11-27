import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { studentLogin } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import PortalAuthShell from '../components/PortalAuthShell';
import ServerWakeupModal from '../components/ServerWakeupModal';
import { IconUsers, IconEye, IconKey, IconCheck, IconAlert } from '../components/icons/HumanIcons';

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
  const [notice] = useState(registeredRoll ? 'Account verified! Enter your password to sign in.' : '');
  const [focused, setFocused] = useState<string | null>(null);
  const [dots, setDots] = useState('');
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  // Proactive warm-up ping on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`, { method: 'GET', keepalive: true }).catch(() => {});
  }, []);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => setIsWarmingUp(true), 4500);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      setDots('');
      return;
    }
    const iv = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const loginQuery = form.login.trim();
    if (!loginQuery) {
      setError('Please enter your hall ticket or email');
      return;
    }
    if (!form.password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await studentLogin({ login: loginQuery, password: form.password });
      if (res.data?.token) localStorage.setItem('student_token', res.data.token);
      if (res.data?.student) localStorage.setItem('student_user', JSON.stringify(res.data.student));
      setIsWarmingUp(false);
      navigate(redirectTarget);
      return;
    } catch (err: any) {
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
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 14px',
    fontSize: '0.94rem',
    borderRadius: 10,
    border: `1.5px solid ${focused === field ? '#60A5FA' : 'rgba(96, 165, 250, 0.28)'}`,
    background: focused === field ? 'rgba(37, 99, 235, 0.10)' : 'rgba(5, 11, 34, 0.78)',
    color: '#F8FAFC',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    boxShadow: focused === field ? '0 0 0 3px rgba(59, 130, 246, 0.22)' : 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  });

  return (
    <PortalAuthShell
      activePortal="Student"
      badgeText="Candidate Assessment Portal"
      title="Student Sign In"
      subtitle="Enter with Hall Ticket number or registered institutional email"
      capabilities={['Single-Session Lock', '5-Sector Arena', 'Performance Dossiers']}
      accentColor="#60A5FA"
      accentGlow="rgba(37, 99, 235, 0.28)"
    >
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.38)',
              color: '#6EE7B7',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: '0.81rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconCheck size={14} color="#6EE7B7" />
            <span>{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && !isWarmingUp && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.38)',
              color: '#FCA5A5',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: '0.81rem',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <IconAlert size={14} color="#FCA5A5" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <button
                type="button"
                onClick={() => navigate(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFD000',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  padding: 0,
                }}
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
          <label
            htmlFor="student-login-input"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#93C5FD',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 7,
            }}
          >
            Hall Ticket / Email
          </label>
          <input
            id="student-login-input"
            type="text"
            required
            placeholder="e.g. 22B91A0501"
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
            onFocus={() => setFocused('login')}
            onBlur={() => setFocused(null)}
            autoComplete="username"
            autoFocus
            style={inputStyle('login')}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <label
              htmlFor="student-password-input"
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#93C5FD',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <IconKey size={13} color="#93C5FD" /> Password
            </label>
            <Link to="/forgot-password?portal=student" style={{ fontSize: '0.74rem', color: '#FFD000', textDecoration: 'none', fontWeight: 700 }}>
              Forgot ID / Password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="student-password-input"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              autoComplete="current-password"
              style={{ ...inputStyle('password'), paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
              }}
            >
              <IconEye size={16} color={showPassword ? '#FFD000' : '#94A3B8'} />
            </button>
          </div>
        </div>

        <button
          id="student-login-btn"
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'rgba(29, 78, 216, 0.45)' : 'linear-gradient(135deg, #0A1C68 0%, #1D4ED8 45%, #FF7A00 100%)',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: '0.95rem',
            letterSpacing: '0.02em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 6px 24px rgba(29, 78, 216, 0.45)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'slSpin 0.7s linear infinite',
                }}
              />
              <span>Signing in{dots}</span>
            </>
          ) : (
            <>
              <IconUsers size={16} color="#FFFFFF" />
              <span>Sign In as Student</span>
            </>
          )}
        </button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#94A3B8', marginBottom: 10 }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" id="student-login-register-link" style={{ color: '#FFB400', fontWeight: 800, textDecoration: 'none' }}>
            Register Now →
          </Link>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link
            to="/enter-exam"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#FFD000',
              fontWeight: 700,
              textDecoration: 'none',
              background: 'rgba(255, 180, 0, 0.1)',
              border: '1px solid rgba(255, 180, 0, 0.35)',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: '0.8rem',
              transition: 'all 0.2s ease',
            }}
          >
            Have an exam code? Enter directly &rarr;
          </Link>
        </div>
      </div>
    </PortalAuthShell>
  );
}
