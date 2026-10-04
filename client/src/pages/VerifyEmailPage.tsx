import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyRegistrationOtp } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email token and activating your candidate account...');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!email || !token) {
      setStatus('error');
      setMessage('Invalid or missing verification parameters. Please use the link provided in your email.');
      return;
    }

    const emailStr: string = email;
    const tokenStr: string = token;

    async function verify() {
      try {
        const res = await verifyRegistrationOtp({ email: emailStr, token: tokenStr });
        if (res.data?.success) {
          if (res.data?.token) {
            localStorage.setItem('student_token', res.data.token);
          }
          if (res.data?.student) {
            localStorage.setItem('student_user', JSON.stringify(res.data.student));
          }
          setStatus('success');
          setMessage('Your email has been verified and your student account is now active! Redirecting to your dashboard...');
          setTimeout(() => {
            navigate('/student/dashboard');
          }, 1500);
        } else {
          setStatus('error');
          setMessage(res.data?.error || 'Verification failed. Please try again or request a new link.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Verification link expired or invalid. Please request a new verification code.');
      }
    }

    verify();
  }, [searchParams, navigate]);

  return (
    <AnimatedPage>
      <div className="page-center" style={{ minHeight: '100vh', padding: 24 }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>

        <div className="card text-center animate-slide-up" style={{ maxWidth: 480, padding: '36px 28px', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)' }}>
          <div style={{ marginBottom: 20 }}>
            <BrandLogo size="md" variant="hero" />
          </div>

          {status === 'verifying' && (
            <div>
              <div className="btn-spinner" style={{ width: 44, height: 44, borderWidth: 3, margin: '0 auto 18px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>
                Verifying Email Activation
              </h2>
              <p className="text-muted text-sm">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4ade80', marginBottom: 8 }}>
                Account Verified!
              </h2>
              <p className="text-sm" style={{ color: '#cbd5e1', marginBottom: 20 }}>
                {message}
              </p>
              <Link to="/student/dashboard" className="btn btn-primary w-full">
                Go to Student Dashboard &rarr;
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
                Activation Failed
              </h2>
              <p className="text-muted text-sm mb-4">{message}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/register" className="btn btn-primary w-full">
                  Back to Registration
                </Link>
                <Link to="/login" className="btn btn-outline w-full">
                  Sign In to Existing Account
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
