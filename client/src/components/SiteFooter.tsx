import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from './BrandLogo';

const FOOTER_LINKS = {
  Platform: [
    { label: 'Assessments', to: '/enter-exam' },
    { label: 'Practice Arena 🔥', to: '/practice' },
    { label: 'Candidate Gate 🛡️', to: '/gate' },
    { label: 'Admin Dashboard', to: '/admin/dashboard' },
  ],
  Resources: [
    { label: 'About & Credits', to: '/about' },
    { label: 'Candidate Portal', to: '/login' },
    { label: 'Documentation', to: '#' },
    { label: 'System Status', to: '#' },
  ],
  Institutional: [
    { label: 'Autonomous Examination Engine', to: '#' },
    { label: 'AI Proctoring Architecture', to: '#' },
    { label: 'Enterprise Security', to: '#' },
    { label: 'Exam Code Verification', to: '/enter-exam' },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="site-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="footer-grid">
        {/* Brand Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <BrandLogo size="md" variant="full" />
            </motion.div>
          </Link>

          <p className="footer-tagline" style={{ maxWidth: 360, color: 'var(--color-text-muted)' }}>
            Autonomous Examination Platform featuring server-authoritative timing, AI proctoring, multi-language code execution, and real-time analytics.
          </p>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            Developed by R. Charan Sai
          </div>
        </div>

        {/* Link Columns */}
        {Object.entries(FOOTER_LINKS).map(([title, links]) => (
          <div key={title}>
            <div
              className="footer-col-title"
              style={{
                color: 'var(--color-primary-dark, #0A3F8F)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.92rem',
                marginBottom: 12,
              }}
            >
              {title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map(({ label, to }) => (
                to.startsWith('http') ? (
                  <a key={label} href={to} target="_blank" rel="noreferrer" className="footer-link">
                    {label}
                  </a>
                ) : (
                  <Link key={label} to={to} className="footer-link">
                    {label}
                  </Link>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom" style={{ borderColor: 'var(--color-border)' }}>
        <span>© 2026 R. Charan Sai. All rights reserved.</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <Link to="/about" className="footer-link">About & Credits</Link>
          <a href="#" className="footer-link">Privacy Policy</a>
          <a href="#" className="footer-link">Security Terms</a>
        </span>
      </div>
    </footer>
  );
}
