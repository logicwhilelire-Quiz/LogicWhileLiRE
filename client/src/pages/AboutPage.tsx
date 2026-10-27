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
                padding: '6px 18px',
                borderRadius: 999,
                background: '#002147',
                color: '#EAA812',
                border: '1px solid #EAA812',
                fontWeight: 800,
                fontSize: '0.85rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Elevating Coding Knowledge
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                fontWeight: 800,
                color: 'var(--color-text)',
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              The Story of LogicWhileLiRE
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
              border: '2px solid rgba(234, 168, 18, 0.4)',
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
                  background: 'linear-gradient(135deg, #002147 0%, #0A2540 100%)',
                  border: '2px solid #EAA812',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EAA812',
                  fontSize: '2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  boxShadow: '0 4px 14px rgba(0, 33, 71, 0.3)',
                }}
              >
                RC
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#EAA812',
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
                  Creator & Lead Developer of the LogicWhileLiRE Autonomous Examination Engine.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                  <a
                    href="mailto:logicwhilelire@gmail.com"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38BDF8',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <span>✉️</span> logicwhilelire@gmail.com
                  </a>
                  <a
                    href="tel:+919493734553"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(234, 168, 18, 0.1)',
                      border: '1px solid rgba(234, 168, 18, 0.3)',
                      color: '#EAA812',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <span>📞</span> +91 9493734553
                  </a>
                </div>
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

          {/* Core Philosophy Section: Official LogicWhile LiRE Triad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 48 }}>
            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                borderTop: '4px solid #38BDF8',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: '#0284C7' }}>
                1. Li — Live Execution
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Server-authoritative millisecond timers, instantaneous multi-modal proctoring, and synchronized live examination runs with absolute chronological fairness.
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                borderTop: '4px solid #EAA812',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>🛡️</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: '#B45309' }}>
                2. R — Real-Time Rank Engine
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Dynamic merit leaderboards, tamper-proof forensic audit verification, single-seat cryptographic session locks, and automated candidate ranking.
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                borderTop: '4px solid #10B981',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>🪐</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: '#059669' }}>
                3. E — Assessment Engine
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Multi-dimensional evaluation across all 5 technical sectors: Quantitative Velocity, Deductive Logic, Core CS Systems, DSA Algorithms, and Cloud Architecture.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button
                className="btn btn-secondary"
                style={{
                  padding: '12px 24px',
                  background: '#002147',
                  border: '1.5px solid #EAA812',
                  color: '#EAA812',
                  fontWeight: 800,
                  borderRadius: 8,
                }}
              >
                🏛️ Institutional Home
              </button>
            </Link>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button
                className="btn btn-primary"
                style={{
                  padding: '12px 24px',
                  background: '#EAA812',
                  border: 'none',
                  color: '#002147',
                  fontWeight: 800,
                  borderRadius: 8,
                  boxShadow: '0 4px 14px rgba(234, 168, 18, 0.4)',
                }}
              >
                🎓 Student Login
              </button>
            </Link>
            <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
              <button
                className="btn btn-secondary"
                style={{
                  padding: '12px 24px',
                  background: '#002147',
                  border: '1.5px solid #CBD5E1',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  borderRadius: 8,
                }}
              >
                ⚡ Enter Examination
              </button>
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
