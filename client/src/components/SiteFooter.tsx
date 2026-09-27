import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const FOOTER_LINKS = {
  Platform: [
    { label: 'Enter Exam', to: '/enter-exam' },
    { label: 'Admin Dashboard', to: '/admin/dashboard' },
    { label: 'Leaderboard', to: '/leaderboard-ec/demo' },
  ],
  Features: [
    { label: 'Live Proctoring', to: '#' },
    { label: 'Code Execution', to: '#' },
    { label: 'AI Questions', to: '#' },
  ],
  Support: [
    { label: 'Documentation', to: '#' },
    { label: 'Contact', to: '#' },
    { label: 'Status', to: '#' },
  ],
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        {/* Brand */}
        <div>
          <motion.div
            className="footer-brand"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            ⚡ LogicWhile 4.0 ULTRA
          </motion.div>
          <p className="footer-tagline">
            India's most advanced assessment platform. Powered by AI, real-time proctoring,
            and 3D immersive experience.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            {['Twitter', 'LinkedIn', 'GitHub'].map(s => (
              <a key={s} href="#"
                style={{
                  padding: '6px 12px',
                  background: 'rgba(43,127,255,0.08)',
                  border: '1px solid rgba(43,127,255,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.8rem',
                  transition: 'all var(--transition-md)',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(43,127,255,0.15)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(43,127,255,0.08)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
                }}
              >
                {s}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(FOOTER_LINKS).map(([title, links]) => (
          <div key={title}>
            <div className="footer-col-title">{title}</div>
            {links.map(({ label, to }) => (
              <Link key={label} to={to} className="footer-link">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <span>© 2026 LogicWhile 4.0 ULTRA. Built for India's best colleges.</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href="#" className="footer-link">Privacy</a>
          <a href="#" className="footer-link">Terms</a>
        </span>
      </div>
    </footer>
  )
}
