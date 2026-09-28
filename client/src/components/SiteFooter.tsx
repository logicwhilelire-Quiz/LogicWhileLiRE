import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const FOOTER_LINKS = {
  Platform: [
    { label: 'Enter Exam', to: '/enter-exam' },
    { label: 'Admin Dashboard', to: '/admin/dashboard' },
    { label: 'Practice Arena 🔥', to: '/practice' },
    { label: 'Verify Certificate 📜', to: '/verify' },
  ],
  'IARE Portals': [
    { label: 'Samvidha Portal', to: 'https://samvidha.iare.ac.in/' },
    { label: 'BuildIT Platform', to: 'https://buildit.iare.ac.in/' },
    { label: 'Akanksha LMS', to: 'https://akanksha.iare.ac.in/' },
    { label: 'Official IARE Website', to: 'https://www.iare.ac.in/' },
  ],
  Accreditation: [
    { label: 'NAAC "A++" Grade', to: 'https://www.iare.ac.in/' },
    { label: 'NIRF Ranked (151–200)', to: 'https://www.iare.ac.in/' },
    { label: 'NBA Accredited Programs', to: 'https://www.iare.ac.in/' },
    { label: 'Autonomous Examination Cell', to: 'https://www.iare.ac.in/' },
  ],
}

export default function SiteFooter() {
  return (
    <footer className="site-footer" style={{ borderTop: '2px solid #bf9f62' }}>
      <div className="footer-grid">
        {/* Brand */}
        <div>
          <motion.div
            className="footer-brand"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{ color: '#bf9f62', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🏛️ IARE • LogicWhile 4.0 ULTRA
          </motion.div>
          <p className="footer-tagline">
            Institute of Aeronautical Engineering (Autonomous) — Dundigal, Hyderabad.
            Premier computer-based testing, algorithmic evaluation, and AI-proctored examination ecosystem.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            {['Twitter', 'LinkedIn', 'YouTube', 'Facebook'].map(s => (
              <a key={s} href={s === 'LinkedIn' ? 'https://www.linkedin.com/school/institute-of-aeronautical-engineering/' : 'https://www.iare.ac.in/'}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '6px 14px',
                  background: 'rgba(191,159,98,0.12)',
                  border: '1px solid rgba(191,159,98,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all var(--transition-md)',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(191,159,98,0.25)'
                  ;(e.currentTarget as HTMLElement).style.color = '#fff'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(191,159,98,0.12)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
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
            <div className="footer-col-title" style={{ color: '#bf9f62', fontFamily: 'var(--font-display)' }}>{title}</div>
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
        ))}
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom" style={{ borderColor: 'rgba(191,159,98,0.2)' }}>
        <span>© 2026 Institute of Aeronautical Engineering (IARE). Powered by LogicWhile 4.0 ULTRA.</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <a href="https://www.iare.ac.in/" target="_blank" rel="noreferrer" className="footer-link">IARE Official</a>
          <a href="#" className="footer-link">Privacy Policy</a>
          <a href="#" className="footer-link">Examination Regulations</a>
        </span>
      </div>
    </footer>
  )
}
