import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import MagneticButton from './3d/MagneticButton'
import BrandLogo from './BrandLogo'
import ThemeToggle from './ui/ThemeToggle'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Assessments', to: '/enter-exam' },
  { label: 'Practice Arena 🔥', to: '/practice' },
  { label: 'Admin Portal', to: '/admin' },
]

export default function SiteHeader() {
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [mounted, setMounted]     = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      className={`site-header ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: mounted ? 0 : -80, opacity: mounted ? 1 : 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Official GROWTHRAN Logo */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <motion.div
          className="navbar-brand"
          style={{ display: 'flex', alignItems: 'center' }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <BrandLogo size="sm" variant="notag" />
        </motion.div>
      </Link>

      {/* Desktop Nav */}
      <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {NAV_LINKS.map(({ label, to }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <motion.div
              className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {label}
            </motion.div>
          </Link>
        ))}

        <ThemeToggle className="ml-2" />

        <Link to="/enter-exam" style={{ textDecoration: 'none', marginLeft: 8 }}>
          <MagneticButton
            className="btn btn-primary btn-sm"
            style={{ borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            🚀 Enter Exam
          </MagneticButton>
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ThemeToggle className="mobile-theme-toggle" />
        <button
          className="btn btn-ghost btn-sm mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span style={{ fontSize: '1.3rem' }}>{menuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--color-surface, rgba(11,18,32,0.98))',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--color-border)',
              padding: '16px 24px',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {NAV_LINKS.map(({ label, to }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div className={`navbar-link ${location.pathname === to ? 'active' : ''}`}>
                  {label}
                </div>
              </Link>
            ))}
            <Link to="/enter-exam" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', marginTop: 8 }}>
              <div className="btn btn-primary btn-block text-center" style={{ width: '100%' }}>
                🚀 Enter Exam
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
