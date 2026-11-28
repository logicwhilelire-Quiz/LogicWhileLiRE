import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from '../../lib/api';
import { API_BASE_URL } from '../../lib/config';
import PortalAuthShell from '../../components/PortalAuthShell';
import ServerWakeupModal from '../../components/ServerWakeupModal';
import { IconAlert, IconEye, IconFlash, IconShield } from '../../components/icons/HumanIcons';

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

  // Proactive warm-up ping on mount to awaken Render cloud instance
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`, { method: 'GET', keepalive: true }).catch(() => {});
  }, []);

  // Track warm-up elapsed time and auto-activate wakeup modal if request takes > 4.5s
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      interval = setInterval(() => setWarmUpSeconds((prev) => prev + 1), 1000);
      timer = setTimeout(() => setIsWarmingUp(true), 4500);
    } else {
      setWarmUpSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
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
        setIsWarmingUp(false);
        return;
      }

      setIsWarmingUp(false);
      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      const isColdStart =
        err?.code === 'ECONNABORTED' ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('Network Error') ||
        (err?.response && [502, 503, 504].includes(err.response.status));

      if (isColdStart) {
        setIsWarmingUp(true);
        setError('');
      } else {
        setIsWarmingUp(false);
        setError(err?.response?.data?.error || err?.response?.data?.message || 'Invalid admin username or password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalAuthShell
      activePortal="Admin"
      badgeText="Master Governance Console"
      title="Super Admin Sign In"
      subtitle="Institutional authority across LogicWhile · LiRE assessment nodes"
      capabilities={['College Governance', 'RBAC & Audit Ledger', 'Exam & Bank Control']}
      accentColor="#FFB400"
      accentGlow="rgba(255, 180, 0, 0.25)"
    >
      {error && !isWarmingUp && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.38)',
            color: '#FCA5A5',
            borderRadius: 10,
            padding: '11px 14px',
            fontSize: '0.82rem',
            marginBottom: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconAlert size={16} color="#FCA5A5" />
          <span>{error}</span>
        </div>
      )}

      <ServerWakeupModal
        isOpen={isWarmingUp}
        onRetry={handleSubmit}
        onClose={() => setIsWarmingUp(false)}
      />

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="admin-username-input"
            style={{
              display: 'block',
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#FFD000',
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
              fontSize: '0.92rem',
              borderRadius: 10,
              border: '1.5px solid rgba(255, 180, 0, 0.28)',
              background: 'rgba(5, 11, 34, 0.78)',
              color: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#FFD000';
              e.target.style.boxShadow = '0 0 0 3px rgba(255, 180, 0, 0.22)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 180, 0, 0.28)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: requireTotp ? 14 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label
              htmlFor="admin-password-input"
              style={{
                display: 'block',
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#FFD000',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
              }}
            >
              Password
            </label>
            <Link to="/forgot-password?portal=admin" style={{ fontSize: '0.74rem', color: '#FFD000', textDecoration: 'none', fontWeight: 700 }}>
              Forgot ID / Password?
            </Link>
          </div>
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
                padding: '11px 42px 11px 14px',
                fontSize: '0.92rem',
                borderRadius: 10,
                border: '1.5px solid rgba(255, 180, 0, 0.28)',
                background: 'rgba(5, 11, 34, 0.78)',
                color: '#F8FAFC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#FFD000';
                e.target.style.boxShadow = '0 0 0 3px rgba(255, 180, 0, 0.22)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 180, 0, 0.28)';
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
              }}
            >
              <IconEye size={16} color={showPassword ? '#FFD000' : '#94A3B8'} />
            </button>
          </div>
        </div>

        {requireTotp && (
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="admin-totp-input"
              style={{
                display: 'block',
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#FFD000',
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
                borderRadius: 10,
                border: '1.5px solid #FFB400',
                background: 'rgba(255, 180, 0, 0.1)',
                color: '#FFD000',
                outline: 'none',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            />
          </div>
        )}

        {loading && warmUpSeconds >= 3 && (
          <div
            style={{
              background: 'rgba(255, 180, 0, 0.1)',
              border: '1px solid rgba(255, 180, 0, 0.35)',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#FFD000', fontWeight: 600 }}>
              <IconFlash size={14} color="#FFD000" />
              <span>
                {warmUpSeconds < 8
                  ? 'Connecting to secure LogicWhile API...'
                  : `Waking up cloud engine instance (${warmUpSeconds}s)...`}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255, 180, 0, 0.2)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(95, warmUpSeconds * 5)}%`,
                  background: 'linear-gradient(90deg, #FF7A00, #FFD000)',
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
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #FF7A00 0%, #FFB400 55%, #FFD000 100%)',
            color: '#07134B',
            fontWeight: 900,
            fontSize: '0.94rem',
            letterSpacing: '0.02em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 24px rgba(255, 180, 0, 0.38)',
            transition: 'all 0.2s ease',
            opacity: loading ? 0.72 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <IconShield size={16} color="#07134B" />
          {loading ? (
            <>
              <span>Authenticating...</span>
              {warmUpSeconds > 0 && <span style={{ opacity: 0.85 }}>({warmUpSeconds}s)</span>}
            </>
          ) : (
            'Sign In as Super Admin'
          )}
        </button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.79rem', color: '#94A3B8' }}>
        <span>Room Invigilator?</span>
        <Link to="/inspector" style={{ color: '#A78BFA', fontWeight: 800, textDecoration: 'none' }}>Inspector Desk →</Link>
      </div>
    </PortalAuthShell>
  );
}
