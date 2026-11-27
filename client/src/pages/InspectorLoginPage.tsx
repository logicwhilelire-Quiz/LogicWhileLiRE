import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import PortalAuthShell from '../components/PortalAuthShell';
import ServerWakeupModal from '../components/ServerWakeupModal';
import { IconAlert, IconEye, IconFlash, IconRadio } from '../components/icons/HumanIcons';

export default function InspectorLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: localStorage.getItem('last_inspector_user') || 'inspector',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warmUpSeconds, setWarmUpSeconds] = useState(0);
  const [error, setError] = useState('');
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  // Proactive warm-up ping on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`, { method: 'GET', keepalive: true }).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    let timer: any;
    if (loading) {
      interval = setInterval(() => setWarmUpSeconds((prev) => prev + 1), 1000);
      timer = setTimeout(() => setIsWarmingUp(true), 4500);
    } else {
      setWarmUpSeconds(0);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [loading]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
        setIsWarmingUp(false);
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

      if (form.username.trim()) {
        localStorage.setItem('last_inspector_user', form.username.trim());
      }

      setIsWarmingUp(false);
      navigate('/admin/inspector');
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
        setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Invalid inspector credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalAuthShell
      activePortal="Inspector"
      badgeText="Live Invigilation Bridge"
      title="Inspector Sign In"
      subtitle="Synchronous lobby release, strike controls & proctor telemetry"
      capabilities={['Waiting Hall Queue', 'Sync Clock Dispatch', '1-10 Strike Control']}
      accentColor="#A78BFA"
      accentGlow="rgba(139, 92, 246, 0.25)"
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
            htmlFor="inspector-username-input"
            style={{
              display: 'block',
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#C4B5FD',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            Inspector Username / ID
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
              padding: '11px 14px',
              fontSize: '0.92rem',
              borderRadius: 10,
              border: '1.5px solid rgba(167, 139, 250, 0.3)',
              background: 'rgba(5, 11, 34, 0.78)',
              color: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#A78BFA';
              e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.24)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(167, 139, 250, 0.3)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label
              htmlFor="inspector-password-input"
              style={{
                display: 'block',
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#C4B5FD',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
              }}
            >
              Password
            </label>
            <Link to="/forgot-password?portal=inspector" style={{ fontSize: '0.74rem', color: '#C4B5FD', textDecoration: 'none', fontWeight: 700 }}>
              Forgot ID / Password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="inspector-password-input"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Enter inspector password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '11px 42px 11px 14px',
                fontSize: '0.92rem',
                borderRadius: 10,
                border: '1.5px solid rgba(167, 139, 250, 0.3)',
                background: 'rgba(5, 11, 34, 0.78)',
                color: '#F8FAFC',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#A78BFA';
                e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.24)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(167, 139, 250, 0.3)';
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
              <IconEye size={16} color={showPassword ? '#A78BFA' : '#94A3B8'} />
            </button>
          </div>
        </div>

        {loading && warmUpSeconds >= 3 && (
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#C4B5FD', fontWeight: 600 }}>
              <IconFlash size={14} color="#C4B5FD" />
              <span>
                {warmUpSeconds < 8
                  ? 'Connecting to secure LogicWhile API...'
                  : `Waking up cloud engine instance (${warmUpSeconds}s)...`}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(139, 92, 246, 0.2)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(95, warmUpSeconds * 5)}%`,
                  background: 'linear-gradient(90deg, #7C3AED, #FFB400)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}

        <button
          id="inspector-login-btn"
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 50%, #A78BFA 100%)',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: '0.94rem',
            letterSpacing: '0.02em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 24px rgba(139, 92, 246, 0.38)',
            transition: 'all 0.2s ease',
            opacity: loading ? 0.72 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <IconRadio size={16} color="#FFFFFF" />
          {loading ? (
            <>
              <span>Authenticating...</span>
              {warmUpSeconds > 0 && <span style={{ opacity: 0.85 }}>({warmUpSeconds}s)</span>}
            </>
          ) : (
            'Sign In as Inspector'
          )}
        </button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.79rem', color: '#94A3B8' }}>
        <span>Super Administrator?</span>
        <Link to="/admin" style={{ color: '#FFD000', fontWeight: 800, textDecoration: 'none' }}>Admin Hub →</Link>
      </div>
    </PortalAuthShell>
  );
}
