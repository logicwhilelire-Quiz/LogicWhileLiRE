import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentRegister } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    hall_ticket: '',
    mobile: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      e.name = 'Full name must be at least 2 characters';
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Please enter a valid email address';
    }
    if (!form.hall_ticket.trim() || form.hall_ticket.trim().length < 3) {
      e.hall_ticket = 'Hall ticket number must be at least 3 characters';
    } else if (!/^[A-Za-z0-9\-_]+$/.test(form.hall_ticket.trim())) {
      e.hall_ticket = 'Only letters, numbers, hyphens, and underscores allowed';
    }
    if (form.mobile && !/^\+?[0-9]{7,15}$/.test(form.mobile.trim())) {
      e.mobile = 'Enter a valid mobile number or leave blank';
    }
    if (!form.password || form.password.length < 6) {
      e.password = 'Password must be at least 6 characters';
    }
    if (form.password !== form.confirm_password) {
      e.confirm_password = 'Passwords do not match';
    }
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setApiError('');

    try {
      const res = await studentRegister({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        hall_ticket: form.hall_ticket.trim().toUpperCase(),
        mobile: form.mobile.trim() || undefined,
        password: form.password,
      });

      if (res.data?.token) {
        localStorage.setItem('student_token', res.data.token);
      }
      if (res.data?.student) {
        localStorage.setItem('student_user', JSON.stringify(res.data.student));
      }
      navigate('/enter-quiz');
    } catch (err: any) {
      setApiError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center" style={{ padding: '24px 16px' }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>

        <div className="container animate-slide-up" style={{ maxWidth: 480 }}>
          <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <BrandLogo size="md" variant="hero" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4, color: 'var(--color-text)' }}>
              Create Student Account
            </h2>
            <p className="text-muted text-sm">Register once to access all institute coding exams</p>
          </div>

          <div className="card" style={{ padding: '28px 24px' }}>
            {apiError && (
              <div className="alert alert-error mb-3" role="alert">
                ⚠️ {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="register-name">
                  Full Name <span style={{ color: 'var(--color-primary, #f59e0b)' }}>*</span>
                </label>
                <input
                  id="register-name"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  required
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-hall-ticket">
                    Hall Ticket <span style={{ color: 'var(--color-primary, #f59e0b)' }}>*</span>
                  </label>
                  <input
                    id="register-hall-ticket"
                    className={`form-input font-mono ${errors.hall_ticket ? 'error' : ''}`}
                    type="text"
                    placeholder="HT2026001"
                    value={form.hall_ticket}
                    onChange={(e) => setForm({ ...form, hall_ticket: e.target.value.toUpperCase() })}
                    autoCapitalize="characters"
                    required
                  />
                  {errors.hall_ticket && <span className="form-error">{errors.hall_ticket}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="register-mobile">
                    Mobile Number
                  </label>
                  <input
                    id="register-mobile"
                    className={`form-input ${errors.mobile ? 'error' : ''}`}
                    type="tel"
                    placeholder="+91 9876543210"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    autoComplete="tel"
                  />
                  {errors.mobile && <span className="form-error">{errors.mobile}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-email">
                  Email Address <span style={{ color: 'var(--color-primary, #f59e0b)' }}>*</span>
                </label>
                <input
                  id="register-email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  type="email"
                  placeholder="student@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-password">
                    Password <span style={{ color: 'var(--color-primary, #f59e0b)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="register-password"
                      className={`form-input ${errors.password ? 'error' : ''}`}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {errors.password && <span className="form-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="register-confirm-password">
                    Confirm Password <span style={{ color: 'var(--color-primary, #f59e0b)' }}>*</span>
                  </label>
                  <input
                    id="register-confirm-password"
                    className={`form-input ${errors.confirm_password ? 'error' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={form.confirm_password}
                    onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                  {errors.confirm_password && <span className="form-error">{errors.confirm_password}</span>}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  Show passwords
                </label>
              </div>

              <button
                id="student-register-btn"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="btn-spinner" /> Creating Account...
                  </>
                ) : (
                  'Create Account & Continue'
                )}
              </button>
            </form>

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
              Already registered?{' '}
              <Link to="/login" style={{ color: 'var(--color-primary, #f59e0b)', fontWeight: 600 }}>
                Sign in here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
