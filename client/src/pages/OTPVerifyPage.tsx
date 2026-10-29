import { useState, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { verifyOtp } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function OTPVerifyPage() {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { participant_id: string; email: string } | null;

  // Retrieve or persist participant_id and email across browser refreshes
  const participantId = state?.participant_id || sessionStorage.getItem(`otp_pid_${examId}`) || '';
  const email = state?.email || sessionStorage.getItem(`otp_email_${examId}`) || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (state?.participant_id) {
      sessionStorage.setItem(`otp_pid_${examId}`, state.participant_id);
    }
    if (state?.email) {
      sessionStorage.setItem(`otp_email_${examId}`, state.email);
    }

    if (!participantId) {
      navigate(`/enroll/${examId}`);
    } else {
      inputRefs.current[0]?.focus();
    }
  }, [examId, state, participantId, navigate]);

  // Resend countdown timer
  useEffect(() => {
    let timer: any;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

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

  async function handleResendOtp(e: React.MouseEvent) {
    e.preventDefault();
    if (resendTimer > 0 || resending || !participantId) return;

    setResending(true);
    setApiError('');
    setResendNotice('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/enroll/${examId}/resend-otp`, {
        participant_id: participantId,
      });
      setResendNotice(res.data?.message || 'A fresh OTP code has been sent to your email.');
      setResendTimer(30); // 30 second cooldown
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to resend OTP. Please re-enroll.';
      setApiError(msg);
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6) {
      setApiError('Please enter the complete 6-digit OTP code');
      return;
    }

    if (!participantId) {
      setApiError('Session expired. Please re-enroll to start your exam.');
      return;
    }

    setLoading(true);
    setApiError('');
    setResendNotice('');

    try {
      const res = await verifyOtp(examId!, {
        participant_id: participantId,
        otp: otpString,
      });

      if (res.data?.token) {
        localStorage.setItem('session_token', res.data.token);
      }
      setSuccess(true);
      setTimeout(() => {
        navigate('/exam', {
          state: {
            session_id: res.data?.session_id,
            participant_name: res.data?.participant_name,
          },
        });
      }, 1200);
    } catch (err: any) {
      setApiError(err?.response?.data?.error || 'OTP verification failed. Please check the code and try again.');
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
              We sent a 6-digit code to <strong style={{ color: 'var(--color-text)' }}>{email || 'your registered email'}</strong>
            </p>
          </div>

          <div className="card">
            {success ? (
              <div className="text-center animate-fade-in" style={{ padding: '24px 0' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>✅</div>
                <div className="font-bold" style={{ fontSize: '1.25rem', color: '#10B981' }}>
                  Verification Successful!
                </div>
                <p className="text-muted mt-1">Redirecting to your examination station...</p>
              </div>
            ) : (
              <>
                {resendNotice && (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10B981',
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: '#059669',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: 16,
                      textAlign: 'center',
                    }}
                  >
                    ✓ {resendNotice}
                  </div>
                )}

                {apiError && (
                  <div className="alert alert-error mb-2" style={{ textAlign: 'center' }}>
                    ⚠️ {apiError}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: 12 }}>
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="otp-container" onPaste={handlePaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          ref={(el) => {
                            inputRefs.current[i] = el;
                          }}
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
                    style={{ cursor: loading || otp.join('').length < 6 ? 'not-allowed' : 'pointer' }}
                  >
                    {loading ? (
                      <>
                        <div className="btn-spinner" /> Verifying...
                      </>
                    ) : (
                      <>🔓 Verify & Enter Exam</>
                    )}
                  </button>
                </form>

                <div className="divider" style={{ margin: '20px 0 16px' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || resending}
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: resendTimer > 0 ? '#64748B' : '#38BDF8',
                      cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    {resending ? 'Sending...' : resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : '✉️ Resend OTP'}
                  </button>

                  <button
                    id="otp-back-btn"
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/enroll/${examId}`)}
                    style={{ color: '#94A3B8', padding: 0 }}
                  >
                    Re-enroll with new details →
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-muted text-xs mt-2">
            🔒 This code expires in 10 minutes for examination security.
          </p>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5 }}>
            <div>LogicWhileLiRE • Lead Architect: <strong style={{ color: '#EAA812' }}>R. Charan Sai Krishna</strong></div>
            <div>Support: <a href="mailto:logicwhilelire@gmail.com" style={{ color: '#38BDF8', textDecoration: 'none' }}>logicwhilelire@gmail.com</a> | <a href="tel:+919493734553" style={{ color: '#EAA812', textDecoration: 'none' }}>+91 9493734553</a></div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
