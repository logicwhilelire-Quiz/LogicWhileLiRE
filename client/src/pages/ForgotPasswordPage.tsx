import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send password reset email. Please try again.');
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
              Reset Your Password
            </h2>
            <p className="text-muted text-sm">We'll send a secure 1-hour reset link to your email</p>
          </div>

          <div className="card" style={{ padding: '28px 24px' }}>
            {submitted ? (
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
                  ✉️
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
                  Check Your Inbox
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.6, marginBottom: 20 }}>
                  If an account exists for <strong style={{ color: '#f8fafc' }}>{email}</strong>, a password reset link has been dispatched. The link is strictly valid for <strong>1 hour</strong>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="btn btn-secondary btn-full"
                  >
                    Resend to a different email
                  </button>
                  <Link to="/login" className="btn btn-primary btn-full">
                    Return to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="alert alert-error mb-3" role="alert">
                    ⚠️ {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email-input">
                    Registered Email Address
                  </label>
                  <input
                    id="forgot-email-input"
                    className="form-input"
                    type="email"
                    placeholder="student@example.com or logicwhilelire@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: 4, display: 'block' }}>
                    Works for both Student and Faculty/Admin accounts
                  </span>
                </div>

                <button
                  id="forgot-submit-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  {loading ? (
                    <>
                      <div className="btn-spinner" /> Sending Link...
                    </>
                  ) : (
                    'Send Password Reset Link'
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
                  Remember your password?{' '}
                  <Link to="/login" style={{ color: 'var(--color-primary, #f59e0b)', fontWeight: 600 }}>
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
