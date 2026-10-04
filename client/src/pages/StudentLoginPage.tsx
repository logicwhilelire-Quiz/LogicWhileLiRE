import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentLogin } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';
import ParallaxGlowOrbs from '../components/3d/ParallaxGlowOrbs';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.login.trim()) {
      setError('Please enter your email or roll number / hall ticket');
      return;
    }
    if (!form.password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');
    setIsLocked(false);
    setRequiresVerification(false);

    try {
      const res = await studentLogin({
        login: form.login.trim(),
        password: form.password,
      });
      if (res.data?.token) {
        localStorage.setItem('student_token', res.data.token);
      }
      if (res.data?.student) {
        localStorage.setItem('student_user', JSON.stringify(res.data.student));
      }
      // Navigate to dedicated Student Dashboard
      navigate('/student/dashboard');
    } catch (err: any) {
      const resp = err?.response?.data;
      if (err?.response?.status === 423 || resp?.locked) {
        setIsLocked(true);
      }
      if (resp?.requires_verification) {
        setRequiresVerification(true);
        setUnverifiedEmail(resp?.email || form.login);
      }
      setError(resp?.error || 'Login failed. Please check your credentials or use 1-Click Demo Login below.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemoLogin() {
    const demoStudent = {
      id: 'stu-demo-01',
      name: 'R. Charan Sai (Candidate)',
      email: 'candidate@logicwhilelire.com',
      roll_number: 'HT2026CS01',
      college_id: 1,
      college_name: 'Aerospace Engineering & Tech',
      section: 'CSE-A',
      batch: '2026',
    };
    localStorage.setItem('student_token', 'demo-student-token-2026');
    localStorage.setItem('student_user', JSON.stringify(demoStudent));
    navigate('/student/dashboard');
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
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 20,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              marginBottom: 10,
            }}>
              <span>🪐</span> 5 TECHNICAL SECTORS ASSESSMENT PORTAL
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4, color: 'var(--color-text)' }}>
              Student Assessment Portal
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Sign in with your email or hall ticket to access quizzes &amp; 5-sector challenges
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                { name: '1. Quant', color: '#F59E0B' },
                { name: '2. Logic', color: '#8B5CF6' },
                { name: '3. Core CS', color: '#10B981' },
                { name: '4. DSA', color: '#38BDF8' },
                { name: '5. Full-Stack', color: '#F43F5E' },
              ].map((s) => (
                <span
                  key={s.name}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: `${s.color}15`,
                    border: `1px solid ${s.color}35`,
                    color: s.color,
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '28px 24px' }}>
            {error && (
              <div
                className={`alert ${isLocked ? 'alert-warning' : 'alert-error'} mb-3`}
                role="alert"
                aria-live="polite"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem' }}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{isLocked ? '🔒' : '⚠️'}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{isLocked ? 'Account Temporarily Locked' : 'Authentication Error'}</div>
                  <div style={{ marginTop: 2 }}>{error}</div>
                  {isLocked && (
                    <div style={{ marginTop: 8 }}>
                      <Link to="/forgot-password" style={{ color: 'var(--color-primary-light, #fbbf24)', fontWeight: 600, textDecoration: 'underline' }}>
                        Reset your password to unlock now &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="student-login-input">
                  Email Address or Hall Ticket
                </label>
                <input
                  id="student-login-input"
                  className="form-input"
                  type="text"
                  placeholder="e.g. HT2026001 or student@example.com"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  autoComplete="username"
                  required
                  aria-required="true"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" htmlFor="student-password-input" style={{ marginBottom: 0 }}>
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    style={{ fontSize: '0.8rem', color: 'var(--color-primary, #f59e0b)', textDecoration: 'none' }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="student-password-input"
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    style={{ paddingRight: 40 }}
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
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted, #94a3b8)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: 4,
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                id="student-login-btn"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || isLocked}
                style={{ marginTop: 8 }}
              >
                {loading ? (
                  <>
                    <div className="btn-spinner" /> Signing in...
                  </>
                ) : (
                  'Sign In & Access Quiz'
                )}
              </button>

              {/* 1-Click Fast Track Demo Login */}
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 10px' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or instant demo</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
                </div>
                <button
                  type="button"
                  id="btn-quick-demo-candidate"
                  onClick={handleQuickDemoLogin}
                  className="btn btn-block"
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.2) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    padding: '10px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <span>⚡</span> 1-Click Quick Candidate Demo Login
                </button>
              </div>
            </form>

            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                fontSize: '0.88rem',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            >
              Don't have an account yet?{' '}
              <Link to="/register" style={{ color: 'var(--color-primary, #f59e0b)', fontWeight: 600 }}>
                Register here
              </Link>
            </div>
          </div>

          {/* Quick link to faculty login */}
          <div className="text-center mt-3" style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)' }}>
            Institute Admin or Faculty?{' '}
            <Link to="/admin" style={{ color: '#cbd5e1', textDecoration: 'underline' }}>
              Control Center Login
            </Link>
          </div>

          {/* Official Footer Credit */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#64748b',
              marginTop: 24,
              paddingBottom: 24,
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
          >
            LogicWhileLiRE • <em>"Logic. While. LiRE."</em> • Developed by R. Charan Sai • © 2026
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
