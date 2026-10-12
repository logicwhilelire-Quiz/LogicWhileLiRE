import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function NotFoundPage() {
  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ maxWidth: 480 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <BrandLogo size="lg" variant="full" />
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: '4.5rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            404
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              marginBottom: 12,
            }}
          >
            Page Not Found
          </h1>

          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '1rem',
              lineHeight: 1.6,
              marginBottom: 32,
            }}
          >
            The examination link or page you requested does not exist or has been moved. Check the URL or return to the main dashboard.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary" style={{ padding: '12px 24px' }}>
                🏠 Back to Home
              </button>
            </Link>
            <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary" style={{ padding: '12px 24px' }}>
                ⚡ Enter Exam Code
              </button>
            </Link>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
