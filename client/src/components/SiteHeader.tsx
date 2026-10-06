import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MagneticButton from './3d/MagneticButton';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ui/ThemeToggle';

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [studentUser, setStudentUser] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Track student authentication status in real-time
  useEffect(() => {
    const checkAuth = () => {
      try {
        const u = localStorage.getItem('student_user');
        const token = localStorage.getItem('student_token');
        if (u && token) {
          setStudentUser(JSON.parse(u));
        } else {
          setStudentUser(null);
        }
      } catch {
        setStudentUser(null);
      }
    };
    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
    setStudentUser(null);
    navigate('/login');
  };

  const isLoggedIn = !!studentUser;

  // Dynamic Navigation Links based on authentication
  const navLinks = isLoggedIn
    ? [
        { label: 'Home', to: '/' },
        { label: 'My Dashboard', to: '/student/dashboard' },
        { label: '5 Technical Sectors', to: '/practice' },
        { label: 'Enter Exam', to: '/enter-exam' },
      ]
    : [
        { label: 'Home', to: '/' },
        { label: 'Candidate Gate', to: '/gate' },
        { label: 'Student Login', to: '/login' },
        { label: 'Admin Portal', to: '/admin' },
      ];

  return (
    <>
      {/* Top Utility Helpline Bar */}
      <div
        style={{
          background: 'var(--hp-navy, #080d2a)',
          color: '#94a3b8',
          fontSize: '12px',
          fontWeight: 600,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '6px 20px',
          position: 'relative',
          zIndex: 501,
        }}
      >
        <div
          style={{
            maxWidth: 1060,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#38bdf8', letterSpacing: '0.06em', fontWeight: 800 }}>LOGIC WHI1E LiRE</span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#cbd5e1' }}>AUTONOMOUS ASSESSMENT ENGINE</span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>5 TECHNICAL SECTORS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11.5px', fontFamily: 'var(--font-display)' }}>
            <span style={{ color: '#94a3b8' }}>SYSTEM INTEGRITY:</span>
            <span style={{ color: '#10b981', fontWeight: 800 }}>● 100% AUTHORITATIVE</span>
          </div>
        </div>
      </div>

      <motion.header
        className={`site-header ${scrolled ? 'scrolled' : ''}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: mounted ? 0 : -80, opacity: mounted ? 1 : 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Official Brand Logo */}
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
        <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {navLinks.map(({ label, to }) => (
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

          {/* Dynamic Action Call-to-Action */}
          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
              <Link to="/enter-exam" className="nav-cta">
                <span>🚀 Enter Exam</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>

              <Link
                to="/student/dashboard"
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: '10px',
                  background: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  color: 'var(--color-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                }}
                title={`Logged in as ${studentUser.name || 'Candidate'}`}
              >
                <span>🎓</span>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {studentUser.name?.split(' ')[0] || 'Dashboard'}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="btn btn-ghost btn-xs"
                style={{ color: '#EF4444', fontSize: '0.75rem', padding: '4px 8px' }}
                title="Log out of student account"
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <Link to="/gate" className="nav-cta">
                <span>Candidate Gate</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
            </div>
          )}
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
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--color-surface, rgba(11,18,32,0.98))',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--color-border)',
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {navLinks.map(({ label, to }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div className={`navbar-link ${location.pathname === to ? 'active' : ''}`}>{label}</div>
              </Link>
            ))}

            {isLoggedIn ? (
              <>
                <Link
                  to="/enter-exam"
                  onClick={() => setMenuOpen(false)}
                  style={{ textDecoration: 'none', marginTop: 8 }}
                >
                  <div className="btn btn-primary btn-block text-center" style={{ width: '100%', background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)' }}>
                    🚀 Enter Exam Code
                  </div>
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="btn btn-ghost btn-block text-center"
                  style={{ width: '100%', color: '#EF4444' }}
                >
                  Log Out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', marginTop: 8 }}>
                <div className="btn btn-primary btn-block text-center" style={{ width: '100%' }}>
                  🎓 Student Portal Login
                </div>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
    </>
  );
}
