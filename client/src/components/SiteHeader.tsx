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
        { label: 'Enter Exam', to: '/enter-exam' },
        { label: 'Practice Sectors', to: '/practice' },
      ]
    : [
        { label: 'Home', to: '/' },
        { label: 'Candidate Gate', to: '/gate' },
        { label: '5 Technical Sectors', to: '/practice' },
        { label: 'Admin Portal', to: '/admin' },
      ];

  return (
    <motion.header
      className={`site-header ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: mounted ? 0 : -80, opacity: mounted ? 1 : 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Official Logic Whi1e LiRE Logo */}
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

        {/* Dynamic Action Call-to-Action: Only show Enter Exam if student is authenticated */}
        {isLoggedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
            <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
              <MagneticButton
                className="btn btn-primary btn-sm"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                  boxShadow: '0 4px 14px rgba(255, 122, 0, 0.35)',
                }}
              >
                🚀 Enter Exam
              </MagneticButton>
            </Link>

            <Link
              to="/student/dashboard"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--color-primary-light, #38BDF8)',
                fontSize: '0.8rem',
                fontWeight: 700,
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
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <MagneticButton
                className="btn btn-primary btn-sm"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                }}
              >
                🎓 Student Portal
              </MagneticButton>
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
  );
}
