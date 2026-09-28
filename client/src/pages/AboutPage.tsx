import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BrandLogo from '../components/BrandLogo';

export default function AboutPage() {
  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <main style={{ flex: 1, padding: '60px 24px' }}>
        <div className="page-content" style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Header block */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <BrandLogo size="lg" variant="full" />
            </div>

            <div
              style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: 999,
                background: 'var(--color-primary-light, #E0EDFF)',
                color: 'var(--color-primary, #1B5FB5)',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Learn. Grow. Run.
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                fontWeight: 800,
                color: 'var(--color-text)',
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              The Story of GROWTHRAN
            </h1>

            <p
              style={{
                fontSize: '1.15rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.6,
                maxWidth: 680,
                margin: '0 auto',
              }}
            >
              An autonomous examination and engineering assessment platform engineered for scale, algorithmic fairness, and uncompromising proctoring integrity.
            </p>
          </div>

          {/* Developer Credit Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'var(--color-surface, #FFFFFF)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '36px 40px',
              boxShadow: 'var(--shadow-md)',
              marginBottom: 40,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #0A3F8F 0%, #1B5FB5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                RC
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--color-primary)',
                  }}
                >
                  Architect & Engineer
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    margin: '4px 0',
                  }}
                >
                  R. Charan Sai
                </h2>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                  Creator & Lead Developer of the GROWTHRAN Autonomous Examination Engine.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid var(--color-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>Architecture</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>Server-Authoritative Evaluation</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>Proctoring</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>Edge AI MediaPipe Web Workers</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>Status</span>
                <div style={{ fontWeight: 600, color: '#059669', marginTop: 2 }}>Production Grade (v4.0)</div>
              </div>
            </div>
          </motion.div>

          {/* Core Philosophy Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 48 }}>
            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>📖</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-primary-dark)' }}>
                1. Learn
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Rigorous foundational knowledge. Detailed syllabus mapping across algorithms, systems, mathematics, and distributed engineering.
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>📈</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-primary)' }}>
                2. Grow
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Continuous candidate progression. Difficulty tracking, topic accuracy index, and transparent performance telemetry over time.
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)' }}>
                3. Run
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                High-velocity code execution and timed performance. Real-time competitive leaderboard sprints with zero server drift.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ textAlign: 'center' }}>
            <Link to="/" style={{ textDecoration: 'none', marginRight: 12 }}>
              <button className="btn btn-primary" style={{ padding: '12px 28px' }}>
                🚀 Explore Platform
              </button>
            </Link>
            <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary" style={{ padding: '12px 28px' }}>
                Take an Assessment
              </button>
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
