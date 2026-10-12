import { useState, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { verifyOtp } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function OTPVerifyPage() {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { participant_id: string; email: string; demo_otp?: string } | null;

  const [otp, setOtp] = useState(() => {
    if (state?.demo_otp && state.demo_otp.length === 6) {
      return state.demo_otp.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!state?.participant_id) {
      navigate(`/enroll/${examId}`);
    }
    inputRefs.current[0]?.focus();
  }, []);

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return; // digits only
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6) { setApiError('Please enter the complete 6-digit OTP'); return; }

    setLoading(true);
    setApiError('');

    try {
      const res = await verifyOtp(examId!, {
        participant_id: state!.participant_id,
        otp: otpString,
      });
      if (res.data?.token) {
        localStorage.setItem('session_token', res.data.token);
      }
      setSuccess(true);
      setTimeout(() => {
        navigate('/exam', { state: { session_id: res.data.session_id, participant_name: res.data.participant_name } });
      }, 1500);
    } catch (err: any) {
      setApiError(err?.response?.data?.error || 'OTP verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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

      <div className="container animate-slide-up">
        <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <BrandLogo size="lg" variant="hero" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text)' }}>
            Verify Your OTP
          </h2>
          <p className="text-muted text-sm">
            We sent a 6-digit code to <strong style={{ color: 'var(--color-text)' }}>{state?.email}</strong>
          </p>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center animate-fade-in">
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
              <div className="font-bold" style={{ fontSize: '1.2rem' }}>Verification Successful!</div>
              <p className="text-muted mt-1">Redirecting to your exam...</p>
            </div>
          ) : (
            <>
              {state?.demo_otp && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px dashed var(--color-primary, #6366f1)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.875rem'
                }}>
                  <span>⚡ <strong>Demo Mode OTP:</strong> <code style={{ letterSpacing: '2px', fontWeight: 'bold' }}>{state.demo_otp}</code></span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => {
                      const digits = state.demo_otp!.split('').slice(0, 6);
                      setOtp(digits);
                    }}
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              {apiError && (
                <div className="alert alert-error mb-2">⚠️ {apiError}</div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter OTP</label>
                  <div className="otp-container" onPaste={handlePaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        className={`otp-input ${digit ? 'filled' : ''}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        autoComplete="off"
                      />
                    ))}
                  </div>
                </div>

                <button
                  id="otp-verify-btn"
                  type="submit"
                  className="btn btn-primary btn-full btn-lg mt-2"
                  disabled={loading || otp.join('').length < 6}
                >
                  {loading ? (
                    <><div className="btn-spinner" />Verifying...</>
                  ) : (
                    <>🔓 Verify & Enter Exam</>
                  )}
                </button>
              </form>

              <div className="divider" />
              <p className="text-center text-sm text-muted">
                Didn't receive the code?{' '}
                <button
                  id="otp-back-btn"
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/enroll/${examId}`)}
                >
                  Re-enroll to resend
                </button>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-muted text-xs mt-2">
          🔒 This code expires in 10 minutes for security.
        </p>
      </div>
    </div>
    </AnimatedPage>
  );
}
