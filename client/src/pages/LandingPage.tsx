import React from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BrandLogo from '../components/BrandLogo';

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        color: '#0F172A',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Official Top Navigation Header */}
      <SiteHeader />

      {/* Hero Section — IARE Institutional Theme with Elevated LogicWhile Branding */}
      <section
        style={{
          background: 'linear-gradient(180deg, #001A38 0%, #002147 60%, #00152E 100%)',
          color: '#FFFFFF',
          padding: '54px 24px 60px',
          borderBottom: '3px solid #EAA812',
        }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto', textAlign: 'center' }}>
          {/* Official Brand Emblem Presentation */}
          <div style={{ display: 'inline-block', marginBottom: 20 }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 16,
                padding: '16px 28px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(234, 168, 18, 0.4)',
              }}
            >
              <BrandLogo size="md" variant="standard" showTagline={false} />
            </div>
          </div>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 850,
              lineHeight: 1.2,
              margin: '0 0 12px',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            LogicWhile <span style={{ color: '#EAA812' }}>Live Rank Engine</span>
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: '#CBD5E1',
              maxWidth: 720,
              margin: '0 auto 30px',
              lineHeight: 1.6,
            }}
          >
            Synchronous live assessment and real-time invigilation platform with server-authoritative timers,
            automated anti-cheat monitoring, and instantaneous competitive telemetry.
          </p>

          {/* Quick Exam Entry Action */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to="/enter-exam"
              style={{
                background: '#EAA812',
                color: '#002147',
                fontWeight: 800,
                fontSize: '0.96rem',
                padding: '12px 28px',
                borderRadius: 8,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(234, 168, 18, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚡</span> Enter Live Exam with Code &amp; Hall Ticket
            </Link>
          </div>
        </div>
      </section>

      {/* Main Single-Page Content: Exactly Three Minimal Logins */}
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 24px', width: '100%', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span
            style={{
              background: '#FEF3C7',
              color: '#92400E',
              padding: '4px 14px',
              borderRadius: 16,
              fontSize: '0.78rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Official Access Gateways
          </span>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#002147', margin: '12px 0 6px' }}>
            Choose Your Authorized Login
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.92rem', margin: 0 }}>
            Dedicated portals with role isolation and synchronized examination control.
          </p>
        </div>

        {/* Three Focused Login Gateways */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 22,
          }}
        >
          {/* 1. Student Portal Gateway */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '2px solid #E2E8F0',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '2rem' }}>🎓</span>
                <span
                  style={{
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                  }}
                >
                  Student Gateway
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#002147', margin: '0 0 10px' }}>
                Student Login
              </h3>
              <p style={{ color: '#475569', fontSize: '0.86rem', lineHeight: 1.6, margin: '0 0 18px' }}>
                Access candidate dashboard, test schedule, performance analytics, and hall ticket records.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                to="/login"
                id="landing-student-login-btn"
                style={{
                  textAlign: 'center',
                  background: '#002147',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '11px 16px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0, 33, 71, 0.2)',
                }}
              >
                Sign In as Student →
              </Link>
            </div>
          </div>

          {/* 2. Admin Console Gateway */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '2px solid #EAA812',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 6px 18px rgba(234, 168, 18, 0.12)',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '2rem' }}>🏛️</span>
                <span
                  style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 12,
                  }}
                >
                  Admin &amp; Controller
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#002147', margin: '0 0 10px' }}>
                Admin Login
              </h3>
              <p style={{ color: '#475569', fontSize: '0.86rem', lineHeight: 1.6, margin: '0 0 18px' }}>
                Complete administrative control: manage colleges, question papers, academic hierarchy, live exam start, and backups.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                to="/admin"
                id="landing-admin-login-btn"
                style={{
                  textAlign: 'center',
                  background: '#EAA812',
                  color: '#002147',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  padding: '11px 16px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(234, 168, 18, 0.3)',
                }}
              >
                Sign In as Admin →
              </Link>
            </div>
          </div>

          {/* 3. Inspector Gateway */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '2px solid #E2E8F0',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '2rem' }}>🔍</span>
                <span
                  style={{
                    background: '#F0FDF4',
                    color: '#166534',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                  }}
                >
                  Invigilation Level
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#002147', margin: '0 0 10px' }}>
                Inspector Login
              </h3>
              <p style={{ color: '#475569', fontSize: '0.86rem', lineHeight: 1.6, margin: '0 0 18px' }}>
                Live invigilation stream with real-time leaderboards, violation alerts, whisper messaging, and candidate communication.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                to="/inspector"
                id="landing-inspector-login-btn"
                style={{
                  textAlign: 'center',
                  background: '#002147',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '11px 16px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0, 33, 71, 0.2)',
                }}
              >
                Sign In as Inspector →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <SiteFooter />
    </div>
  );
}
