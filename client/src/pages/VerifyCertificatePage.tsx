import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function VerifyCertificatePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg, #050814)' }}>
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            maxWidth: 560,
            width: '100%',
            background: 'var(--color-surface, #0c1222)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
            borderRadius: 'var(--radius-lg, 16px)',
            padding: '48px 36px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          {/* Brand Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <BrandLogo size="md" showTagline />
          </div>

          {/* Retired Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#EF4444',
              fontSize: '0.82rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            <span>Notice</span> • Service Retired
          </div>

          {/* Primary Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--color-text, #F0F4FC)',
              lineHeight: 1.25,
              marginBottom: 16,
            }}
          >
            Certificate verification has been retired.
          </h1>

          {/* Explanation */}
          <p
            style={{
              color: 'var(--color-text-muted, #94A3B8)',
              fontSize: '0.94rem',
              lineHeight: 1.6,
              marginBottom: 32,
            }}
          >
            The digital certificate verification service on GROWTHRAN has been permanently discontinued.
            If your printed credential or QR code directed you here, please note that verification records are no longer hosted online.
            For assessment verification, please contact your institution administrator directly.
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to="/"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 28px',
                borderRadius: 'var(--radius-md, 10px)',
                fontWeight: 700,
                fontSize: '0.92rem',
                textDecoration: 'none',
              }}
            >
              ← Return to Home
            </Link>
            <Link
              to="/enter-exam"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 'var(--radius-md, 10px)',
                fontWeight: 600,
                fontSize: '0.92rem',
                textDecoration: 'none',
              }}
            >
              Enter Exam Portal
            </Link>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
