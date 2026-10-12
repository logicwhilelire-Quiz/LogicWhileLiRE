import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  // Auto-redirect to the actual Candidate Registration Gate
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/gate', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <AnimatedPage>
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at 50% 20%, #0c1228 0%, #050814 80%)',
          color: '#f0f4fc',
          fontFamily: "'Inter', system-ui, sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'rgba(15, 23, 42, 0.90)',
            border: '1px solid rgba(43, 127, 255, 0.25)',
            borderRadius: 20,
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <BrandLogo size="md" />
          </div>

          {/* Animated countdown ring */}
          <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 20 }}>
            <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="34" cy="34" r="29" fill="none" stroke="rgba(43,127,255,0.12)" strokeWidth="5" />
              <circle
                cx="34" cy="34" r="29"
                fill="none"
                stroke="#2B7FFF"
                strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 29}`}
                strokeDashoffset={`${2 * Math.PI * 29 * (1 - countdown / 3)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#2B7FFF',
            }}>
              {countdown}
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
            Redirecting to Registration Gate…
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 28px' }}>
            Candidate registration is managed through the official
            <strong style={{ color: '#38bdf8' }}> Candidate Registration Gate</strong>.
            You'll be redirected automatically in <strong style={{ color: '#2B7FFF' }}>{countdown}s</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => navigate('/gate', { replace: true })}
              className="btn btn-primary btn-full btn-lg"
              style={{ fontWeight: 800 }}
            >
              🚀 Go to Registration Gate Now
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-secondary btn-full"
            >
              🔑 Proceed to Student Login
            </button>
          </div>

          <div style={{ marginTop: 24, fontSize: '0.76rem', color: '#475569' }}>
            LogicWhileLiRE · Institutional Roster Governance Policy
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
