import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [form, setForm] = useState({
    token: tokenParam,
    email: emailParam,
    new_password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenParam) setForm((prev) => ({ ...prev, token: tokenParam }));
    if (emailParam) setForm((prev) => ({ ...prev, email: emailParam }));
  }, [tokenParam, emailParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.token.trim()) {
      setError('Password reset token is missing or invalid.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email address is missing.');
      return;
    }
    if (!form.new_password || form.new_password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword({
        token: form.token.trim(),
        email: form.email.trim().toLowerCase(),
        new_password: form.new_password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>

        <div className="container animate-slide-up" style={{ maxWidth: 440 }}>
          <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <BrandLogo size="md" variant="hero" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4, color: 'var(--color-text)' }}>
              Set New Password
            </h2>
            <p className="text-muted text-sm">Choose a strong password for your account</p>
          </div>

          <div className="card" style={{ padding: '28px 24px' }}>
            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid rgba(16, 185, 129, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    margin: '0 auto 16px',
                  }}
                >
                  ✅
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
                  Password Reset Successful!
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.6, marginBottom: 24 }}>
                  Your password has been securely updated and any temporary account locks have been removed. You can now log in.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn btn-primary btn-full btn-lg"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {(!form.token || !form.email) && (
                  <div className="alert alert-warning mb-3">
                    ⚠️ Invalid or incomplete reset link. If you arrived here directly, please request a link from the forgot password page.
                  </div>
                )}

                {error && (
                  <div className="alert alert-error mb-3" role="alert">
                    ⚠️ {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">
                    Account Email
                  </label>
                  <input
                    id="reset-email"
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="student@example.com"
                    required
                    disabled={!!emailParam}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-new-password">
                    New Password
                  </label>
                  <input
                    id="reset-new-password"
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter at least 6 characters"
                    value={form.new_password}
                    onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                    autoComplete="new-password"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm-password">
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
                    value={form.confirm_password}
                    onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                    />
                    Show password
                  </label>
                </div>

                <button
                  id="reset-submit-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading || !form.token}
                >
                  {loading ? (
                    <>
                      <div className="btn-spinner" /> Updating Password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>

                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'center',
                    fontSize: '0.88rem',
                    color: 'var(--color-text-muted, #94a3b8)',
                  }}
                >
                  Need a new reset link?{' '}
                  <Link to="/forgot-password" style={{ color: 'var(--color-primary, #f59e0b)', fontWeight: 600 }}>
                    Request again
                  </Link>
                </div>
              </form>
            )}
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: 20,
              fontSize: '0.78rem',
              color: 'var(--color-text-muted, #94a3b8)',
              lineHeight: 1.6,
            }}
          >
            <div>LogicWhile LiRE • Architect &amp; Lead Engineer: <strong style={{ color: '#EAA812' }}>R. Charan Sai Krishna</strong></div>
            <div style={{ marginTop: 4 }}>
              Institutional Support: <a href="mailto:logicwhilelire@gmail.com" style={{ color: '#38BDF8', textDecoration: 'none' }}>logicwhilelire@gmail.com</a>
              {' '}&bull;{' '}
              Helpline: <a href="tel:+919493734553" style={{ color: '#EAA812', textDecoration: 'none' }}>+91 9493734553</a>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
