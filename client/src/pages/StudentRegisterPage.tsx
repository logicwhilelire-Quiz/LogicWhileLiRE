import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { studentRegister, verifyRegistrationOtp, resendRegistrationOtp } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

const DEFAULT_COLLEGES = [
  { id: 1, name: 'Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)', code: 'VRSEC' },
  { id: 2, name: 'Koneru Lakshmaiah Education Foundation (KL University)', code: 'KLU' },
];

const COHORTS = [
  { id: 'coh-vrsec-2026', name: 'Class of 2026 (YOP 2026)' },
  { id: 'coh-vrsec-2027', name: 'Class of 2027 (YOP 2027)' },
  { id: 'coh-klu-2026', name: 'Class of 2026 (KLU)' },
];

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function StudentRegisterPage() {
  const navigate = useNavigate();

  // Dynamic colleges enabled for registration
  const [colleges, setColleges] = useState(DEFAULT_COLLEGES);

  // Registration Form State
  const [form, setForm] = useState({
    full_name: '',
    roll_number: '',
    college_id: 1,
    cohort_id: 'coh-vrsec-2026',
    section: 'B',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiErrorCode, setApiErrorCode] = useState('');

  // Fetch only registration-enabled colleges
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/colleges?registration=true`)
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.colleges) && res.data.colleges.length > 0) {
          const loaded = res.data.colleges.map((c: any) => ({
            id: c.id,
            name: c.college_name,
            code: c.college_code,
          }));
          setColleges(loaded);
          setForm((prev) => {
            if (!loaded.some((c: any) => c.id === prev.college_id)) {
              return { ...prev, college_id: loaded[0].id };
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  // OTP Verification Step State
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      e.full_name = 'Full name must be at least 2 characters';
    }
    if (!form.roll_number.trim() || form.roll_number.trim().length < 2) {
      e.roll_number = 'Roll number / Hall ticket is required';
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Please enter a valid institutional email address';
    }
    if (form.phone && !/^\+?[0-9]{7,15}$/.test(form.phone.trim())) {
      e.phone = 'Enter a valid mobile number or leave blank';
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
    setApiErrorCode('');

    try {
      const res = await studentRegister({
        full_name: form.full_name.trim(),
        roll_number: form.roll_number.trim().toUpperCase(),
        college_id: form.college_id,
        cohort_id: form.cohort_id,
        section: form.section,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });

      if (res.data?.requires_verification) {
        setStep('verify');
        setResendCooldown(30);
        if (res.data?.demo_otp) {
          setDemoOtp(res.data.demo_otp);
        }
      } else if (res.data?.token) {
        localStorage.setItem('student_token', res.data.token);
        if (res.data?.student) {
          localStorage.setItem('student_user', JSON.stringify(res.data.student));
        }
        navigate('/student/dashboard');
      }
    } catch (err: any) {
      const resp = err?.response?.data;
      setApiError(resp?.error || 'Registration failed. Please try again.');
      setApiErrorCode(resp?.code || '');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 4) {
      setVerifyError('Please enter the 6-digit verification code.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');
    setVerifySuccess('');

    try {
      const res = await verifyRegistrationOtp({
        email: form.email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      if (res.data?.token) {
        localStorage.setItem('student_token', res.data.token);
        if (res.data?.student) {
          localStorage.setItem('student_user', JSON.stringify(res.data.student));
        }
        setVerifySuccess('Account activated! Redirecting to student dashboard...');
        setTimeout(() => {
          navigate('/student/dashboard');
        }, 1200);
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      setVerifyError(err?.response?.data?.error || 'Verification failed. Please check the code and try again.');
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setVerifyError('');
    setVerifySuccess('');
    try {
      const res = await resendRegistrationOtp({ email: form.email.trim().toLowerCase() });
      setResendCooldown(45);
      setVerifySuccess('A fresh verification code has been dispatched to your email.');
      if (res.data?.demo_otp) {
        setDemoOtp(res.data.demo_otp);
      }
    } catch (err: any) {
      setVerifyError(err?.response?.data?.error || 'Failed to resend code. Please try again.');
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center" style={{ padding: '32px 16px', minHeight: '100vh' }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>

        <div className="container animate-slide-up" style={{ maxWidth: 540 }}>
          {/* Header */}
          <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <BrandLogo size="md" variant="hero" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4, color: 'var(--color-text)' }}>
              {step === 'form' ? 'Student Registration' : 'Verify Student Email'}
            </h2>
            <p className="text-muted text-sm" style={{ maxWidth: 440 }}>
              {step === 'form'
                ? 'Register with your institutional roll number on the approved college roster.'
                : `Enter the 6-digit verification code sent to ${form.email}`}
            </p>
          </div>

          <div className="card" style={{ padding: '28px 24px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            {step === 'form' ? (
              <>
                {/* Roster & API Error Alert */}
                {apiError && (
                  <div
                    className={`alert ${apiErrorCode === 'ROSTER_ROLL_NOT_FOUND' || apiErrorCode === 'ROSTER_SECTION_MISMATCH' ? 'alert-warning' : 'alert-error'} mb-3`}
                    role="alert"
                    style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.5 }}
                  >
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>
                      {apiErrorCode === 'ROSTER_ROLL_NOT_FOUND' ? '📋' : '⚠️'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {apiErrorCode === 'ROSTER_ROLL_NOT_FOUND'
                          ? 'Roster Verification Required'
                          : apiErrorCode === 'ROSTER_SECTION_MISMATCH'
                          ? 'Section Mismatch'
                          : 'Registration Notice'}
                      </div>
                      <div style={{ marginTop: 2 }}>{apiError}</div>
                      {apiErrorCode === 'ROSTER_ROLL_NOT_FOUND' && (
                        <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#cbd5e1' }}>
                          ℹ️ Institutional Policy: Only students whose roll numbers have been imported by the college administration can register.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Full Name */}
                  <div className="form-group mb-3">
                    <label className="form-label" htmlFor="reg-name">
                      Full Name <span style={{ color: 'var(--color-primary)' }}>*</span>
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      className={`form-input ${errors.full_name ? 'input-error' : ''}`}
                      placeholder="e.g. Aravind Swamy"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      required
                    />
                    {errors.full_name && <span className="field-error">{errors.full_name}</span>}
                  </div>

                  {/* College & Cohort Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mb-3">
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-college">
                        College / Institution <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <select
                        id="reg-college"
                        className="form-input"
                        value={form.college_id}
                        onChange={(e) => setForm({ ...form, college_id: Number(e.target.value) })}
                      >
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name.split(' ')[0]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-cohort">
                        Cohort / Year <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <select
                        id="reg-cohort"
                        className="form-input"
                        value={form.cohort_id}
                        onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}
                      >
                        {COHORTS.map((coh) => (
                          <option key={coh.id} value={coh.id}>
                            {coh.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Roll Number & Section Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }} className="mb-3">
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-roll">
                        Roll Number / Hall Ticket <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <input
                        id="reg-roll"
                        type="text"
                        className={`form-input ${errors.roll_number ? 'input-error' : ''}`}
                        placeholder="e.g. 2201A0501"
                        value={form.roll_number}
                        onChange={(e) => setForm({ ...form, roll_number: e.target.value.toUpperCase() })}
                        style={{ fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
                        required
                      />
                      {errors.roll_number && <span className="field-error">{errors.roll_number}</span>}
                      <span className="text-muted text-xs" style={{ display: 'block', marginTop: 4 }}>
                        Must match institutional roster
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-section">
                        Section <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <select
                        id="reg-section"
                        className="form-input"
                        value={form.section}
                        onChange={(e) => setForm({ ...form, section: e.target.value })}
                      >
                        {SECTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            Section {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Email & Phone Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mb-3">
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-email">
                        Email Address <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        className={`form-input ${errors.email ? 'input-error' : ''}`}
                        placeholder="student@campus.edu"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                      {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-phone">
                        Phone / Mobile
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        className={`form-input ${errors.phone ? 'input-error' : ''}`}
                        placeholder="+91 9876543210"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                      {errors.phone && <span className="field-error">{errors.phone}</span>}
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mb-4">
                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-password">
                        Password <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        className={`form-input ${errors.password ? 'input-error' : ''}`}
                        placeholder="Min 6 characters"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                      />
                      {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="reg-confirm-pw">
                        Confirm Password <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <input
                        id="reg-confirm-pw"
                        type={showPassword ? 'text' : 'password'}
                        className={`form-input ${errors.confirm_password ? 'input-error' : ''}`}
                        placeholder="Re-enter password"
                        value={form.confirm_password}
                        onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                        required
                      />
                      {errors.confirm_password && (
                        <span className="field-error">{errors.confirm_password}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4" style={{ fontSize: '0.85rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                      />
                      Show passwords
                    </label>
                    <span className="text-muted text-xs">Composite key (college_id, roll_number) enforced</span>
                  </div>

                  <button
                    id="btn-register-submit"
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={loading}
                    style={{ padding: '12px', fontWeight: 700, fontSize: '0.98rem' }}
                  >
                    {loading ? 'Validating Roster & Sending OTP...' : 'Register & Receive Verification Code →'}
                  </button>
                </form>
              </>
            ) : (
              /* Step 2: OTP Verification */
              <div>
                {verifySuccess && (
                  <div className="alert alert-success mb-3" style={{ fontSize: '0.88rem' }}>
                    ✅ {verifySuccess}
                  </div>
                )}

                {verifyError && (
                  <div className="alert alert-error mb-3" style={{ fontSize: '0.88rem' }}>
                    ⚠️ {verifyError}
                  </div>
                )}

                {demoOtp && (
                  <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.84rem', color: '#93c5fd' }}>
                    🔑 <strong>Development Demo OTP:</strong> <code style={{ fontWeight: 800, letterSpacing: '3px' }}>{demoOtp}</code>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp}>
                  <div className="form-group mb-4">
                    <label className="form-label" htmlFor="otp-input" style={{ textAlign: 'center', display: 'block', fontSize: '0.92rem' }}>
                      Enter 6-Digit Passcode
                    </label>
                    <input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      className="form-input"
                      style={{
                        textAlign: 'center',
                        fontSize: '1.8rem',
                        letterSpacing: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        padding: '14px',
                        color: 'var(--color-primary-light, #60a5fa)',
                      }}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      autoFocus
                      required
                    />
                    <div className="text-center text-muted text-xs mt-2">
                      ⏱ Passcode expires in 15 minutes. Check your spam/junk folder if needed.
                    </div>
                  </div>

                  <button
                    id="btn-verify-otp"
                    type="submit"
                    className="btn btn-primary w-full mb-3"
                    disabled={verifyLoading || otp.length < 4}
                    style={{ padding: '12px', fontWeight: 700 }}
                  >
                    {verifyLoading ? 'Verifying & Activating...' : 'Verify Email & Activate Account →'}
                  </button>

                  <div className="flex items-center justify-between" style={{ fontSize: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="btn-link text-muted"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      ← Back to edit details
                    </button>

                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0}
                      className="btn-link"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                        color: resendCooldown > 0 ? '#64748b' : 'var(--color-primary-light, #60a5fa)',
                        fontWeight: 600,
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.88rem' }}>
              <span className="text-muted">Already registered on the platform? </span>
              <Link to="/login" style={{ color: 'var(--color-primary-light, #60a5fa)', fontWeight: 600 }}>
                Sign in to Student Portal &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
