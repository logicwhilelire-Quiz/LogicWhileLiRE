import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { adminLogin, enrollInit2FA, enrollConfirm2FA } from '../../lib/api';
import { API_BASE_URL } from '../../lib/config';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';
import ParallaxGlowOrbs from '../../components/3d/ParallaxGlowOrbs';

type LoginStep = 'credentials' | '2fa' | '2fa_setup' | 'email_otp';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [form, setForm] = useState({ username: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [enrollmentData, setEnrollmentData] = useState<{
    secret?: string;
    qr_code?: string;
    otpauth_url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function completeAuth(token?: string, user?: any) {
    if (token) {
      localStorage.setItem('admin_token', token);
    }
    if (user) {
      localStorage.setItem('admin_user', JSON.stringify(user));
      if (user.role === 'inspector' || user.role === 'college_admin') {
        navigate('/admin/inspector');
        return;
      }
      if (user.role === 'faculty') {
        navigate('/admin/exams');
        return;
      }
    }
    navigate('/admin/dashboard');
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await adminLogin(form);
      if (res.data?.require_email_otp) {
        setStep('email_otp');
        setNotice(res.data?.message || 'A 6-digit login verification OTP has been sent to your registered email address.');
        if (res.data?.dev_otp) {
          setTotpCode(res.data.dev_otp);
        }
        return;
      }
      if (res.data?.require_2fa) {
        setStep('2fa');
        setNotice('Enter the 6-digit authentication code from your authenticator app (Google Authenticator, Authy) or enter a backup recovery code.');
        return;
      }
      if (res.data?.require_2fa_setup) {
        const token = res.data.enrollment_token;
        setEnrollmentToken(token);
        setStep('2fa_setup');
        // Fetch QR code & secret
        try {
          const initRes = await enrollInit2FA(token);
          setEnrollmentData(initRes.data);
        } catch (initErr: any) {
          setError(initErr?.response?.data?.error || 'Failed to initialize 2FA setup');
        }
        return;
      }
      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handle2faSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totpCode.trim()) {
      setError('Please enter your 6-digit TOTP code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminLogin({ ...form, totp_code: totpCode.trim() });
      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid 2FA code. Please check your authenticator clock.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!totpCode.trim()) {
      setError('Please enter the 6-digit code shown in your authenticator app');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await enrollConfirm2FA(enrollmentToken, totpCode.trim());
      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to verify 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totpCode.trim()) {
      setError('Please enter the 6-digit OTP code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/verify-login-otp`, {
        username: form.username.trim(),
        otp: totpCode.trim(),
      });
      completeAuth(res.data?.token, res.data?.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemoAdminLogin() {
    const demoAdmin = {
      id: 'st000000-0000-0000-0000-000000000001',
      name: 'R. Charan Sai (Super Admin)',
      email: 'admin@logicwhilelire.com',
      role: 'super_admin',
    };
    completeAuth('demo-admin-token-2026', demoAdmin);
  }

  function handleQuickDemoInspectorLogin() {
    const demoInspector = {
      id: 'st000000-0000-0000-0000-000000000004',
      name: 'Dr. K. V. Rao (Principal / Inspector)',
      email: 'inspector@logicwhilelire.com',
      role: 'inspector',
      college_id: 1,
    };
    completeAuth('demo-inspector-token-2026', demoInspector);
  }

  function handleQuickDemoFacultyLogin() {
    const demoFaculty = {
      id: 'st000000-0000-0000-0000-000000000002',
      name: 'Dr. Suresh Kumar (Faculty CSM-A)',
      email: 'faculty@logicwhilelire.com',
      role: 'faculty',
      college_id: 1,
    };
    completeAuth('demo-faculty-token-2026', demoFaculty);
  }

  return (
    <AnimatedPage>
      <ParallaxGlowOrbs />
      <div className="page-center" style={{ position: 'relative', zIndex: 1 }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>
        <div className="container animate-slide-up" style={{ maxWidth: 440 }}>
          <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <BrandLogo size="lg" variant="hero" />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>
              Institutional Control Center
            </h2>
            <p className="text-muted text-sm">Super Admin & Faculty Assessment Portal</p>
          </div>

          <div className="card">
            {error && <div className="alert alert-error mb-2">⚠️ {error}</div>}
            {notice && <div className="alert alert-info mb-2">ℹ️ {notice}</div>}

            {step === 'credentials' && (
              <form onSubmit={handleCredentialsSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-username">Username or Staff Email</label>
                  <input
                    id="admin-username"
                    className="form-input"
                    type="text"
                    placeholder="admin or faculty@institution.edu"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" htmlFor="admin-password" style={{ marginBottom: 0 }}>Password</label>
                    <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--color-primary, #f59e0b)', textDecoration: 'none' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="admin-password"
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <button
                  id="admin-login-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                >
                  {loading ? <><div className="btn-spinner" />Signing in...</> : '🔑 Sign In'}
                </button>

                {/* 1-Click Fast Track Staff Role Demos */}
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 10px' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1-Click Staff Role Demos</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      id="btn-quick-demo-admin"
                      onClick={handleQuickDemoAdminLogin}
                      className="btn btn-block"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(37, 99, 235, 0.2) 100%)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        fontWeight: 700,
                        padding: '9px 12px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                      }}
                    >
                      <span>👑 Super Admin (Full Control)</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
                        /admin/dashboard
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-quick-demo-inspector"
                      onClick={handleQuickDemoInspectorLogin}
                      className="btn btn-block"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(126, 34, 206, 0.25) 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#c084fc',
                        fontWeight: 700,
                        padding: '9px 12px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                      }}
                    >
                      <span>🛡️ Inspector (Live Leaderboard)</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
                        Direct Leaderboard
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-quick-demo-faculty"
                      onClick={handleQuickDemoFacultyLogin}
                      className="btn btn-block"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        fontWeight: 700,
                        padding: '9px 12px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                      }}
                    >
                      <span>🎓 Faculty (Section Allocations)</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
                        Section A Paper
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {step === '2fa' && (
              <form onSubmit={handle2faSubmit}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛡️</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Two-Factor Authentication</h3>
                  <p className="text-muted text-sm">Mandatory RFC 6238 TOTP Protection</p>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="totp-code">6-Digit Authenticator or Backup Code</label>
                  <input
                    id="totp-code"
                    className="form-input"
                    type="text"
                    placeholder="123456 or 10-char backup"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={10}
                    autoFocus
                    autoComplete="one-time-code"
                    style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem', fontWeight: 700 }}
                    required
                  />
                </div>
                <button
                  id="totp-verify-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                >
                  {loading ? <><div className="btn-spinner" />Verifying...</> : '🔐 Verify & Continue'}
                </button>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setTotpCode(''); setError(''); setNotice(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    &larr; Back to login
                  </button>
                </div>
              </form>
            )}

            {step === 'email_otp' && (
              <form onSubmit={handleEmailOtpSubmit}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📩</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Email Login Verification</h3>
                  <p className="text-muted text-sm">Enter the 6-digit one-time passcode sent to your registered email</p>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email-otp-code">6-Digit Verification Code</label>
                  <input
                    id="email-otp-code"
                    className="form-input"
                    type="text"
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.4rem', fontWeight: 800 }}
                    required
                  />
                </div>
                <button
                  id="email-otp-verify-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                >
                  {loading ? <><div className="btn-spinner" />Verifying OTP...</> : '🔐 Verify & Sign In'}
                </button>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setTotpCode(''); setError(''); setNotice(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    &larr; Back to credentials
                  </button>
                </div>
              </form>
            )}

            {step === '2fa_setup' && (
              <form onSubmit={handleEnrollConfirm}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📲</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Setup Mandatory 2FA</h3>
                  <p className="text-muted text-sm">Scan with Google Authenticator, Authy, or Microsoft Authenticator</p>
                </div>

                {enrollmentData?.qr_code && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'inline-block', padding: 8, background: '#ffffff', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)' }}>
                      <img src={enrollmentData.qr_code} alt="2FA QR Code" style={{ width: 180, height: 180, display: 'block' }} />
                    </div>
                    {enrollmentData?.secret && (
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        Manual Entry Key: <code style={{ color: 'var(--color-primary, #38bdf8)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{enrollmentData.secret}</code>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="enroll-code">Enter 6-Digit Code to Activate</label>
                  <input
                    id="enroll-code"
                    className="form-input"
                    type="text"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem', fontWeight: 700 }}
                    required
                  />
                </div>
                <button
                  id="enroll-confirm-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                >
                  {loading ? <><div className="btn-spinner" />Activating...</> : '🚀 Activate 2FA & Enter Portal'}
                </button>
              </form>
            )}

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            >
              Are you a student?{' '}
              <Link to="/enter-exam" style={{ color: 'var(--color-primary, #2B7FFF)', fontWeight: 600 }}>
                Enter Assessment &rarr;
              </Link>
            </div>
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.74rem', color: 'var(--color-text-faint, #64748b)' }}>
              LogicWhileLiRE • <em>"Logic. While. LiRE."</em> • Developed by R. Charan Sai • © 2026 All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
