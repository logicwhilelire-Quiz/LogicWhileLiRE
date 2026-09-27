import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import MagneticButton from './3d/MagneticButton'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Enter Exam', to: '/enter-exam' },
  { label: 'Practice Arena 🔥', to: '/practice' },
  { label: 'Verify 📜', to: '/verify' },
  { label: 'Admin', to: '/admin' },
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
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <motion.div
          className="navbar-brand"
          style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 10 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {/* Logo mark */}
          <motion.svg
            width="28" height="28" viewBox="0 0 32 32" fill="none"
            initial={{ rotate: -10, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <rect width="32" height="32" rx="8" fill="url(#lg)" />
            <path d="M8 22L16 10L24 22H8Z" fill="white" fillOpacity="0.9" />
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2B7FFF" />
                <stop offset="1" stopColor="#1B5FCC" />
              </linearGradient>
            </defs>
          </motion.svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.03em' }}>
            LogicWhile
          </span>
          <span style={{
            background: 'linear-gradient(135deg, #2B7FFF, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
            alignSelf: 'flex-start', marginTop: 2,
          }}>4.0 ULTRA</span>
        </motion.div>
      </Link>

      {/* Desktop Nav */}
      <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
      <button
        className="btn btn-ghost btn-sm"
        style={{ display: 'none' }}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span style={{ fontSize: '1.3rem' }}>☰</span>
      </button>

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
              background: 'rgba(11,18,32,0.98)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--color-border)',
              padding: '16px 24px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            {NAV_LINKS.map(({ label, to }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div className={`navbar-link ${location.pathname === to ? 'active' : ''}`}>
                  {label}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
