import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ui/ThemeToggle';

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [studentUser, setStudentUser] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
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
    localStorage.removeItem('logicwhilelire_attempt');
    localStorage.removeItem('lw_attempt');
    localStorage.removeItem('candidate_gate_pass');
    localStorage.removeItem('student_gate_pass');
    sessionStorage.clear();
    setStudentUser(null);
    navigate('/login');
  };

  const isLoggedIn = !!studentUser;

  // Clean, Uncluttered Institutional Navigation Links
  // Institutional Navigation Links for all key roles: Student, Faculty, Inspector, Admin
  const navLinks = isLoggedIn
    ? [
        { label: 'Home', to: '/' },
        { label: 'Student Gate', to: '/student/dashboard' },
        { label: 'Inspector', to: '/inspector' },
        { label: 'Admin', to: '/admin' },
      ]
    : [
        { label: 'Home', to: '/' },
        { label: 'Student / Candidate Gate', to: '/login' },
        { label: 'Inspector', to: '/inspector' },
        { label: 'Admin', to: '/admin' },
      ];

  return (
    <div
      className="site-header-fixed-wrap"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 1000,
        boxShadow: scrolled
          ? '0 6px 24px rgba(0, 0, 0, 0.45)'
          : '0 4px 18px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Top Utility Helpline Bar — Fixed at very top */}
      <div
        style={{
          background: '#001833',
          color: '#94A3B8',
          fontSize: '11.5px',
          fontWeight: 600,
          borderBottom: '1px solid rgba(234, 168, 18, 0.3)',
          padding: '5px 24px',
          width: '100%',
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#EAA812', letterSpacing: '0.04em', fontWeight: 800 }}>
              LOGICWHILE LiRE
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#F1F5F9', fontWeight: 700, letterSpacing: '0.02em' }}>
              R. CHARAN SAI KRISHNA
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>AUTONOMOUS ASSESSMENT ENGINE</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px' }}>
            <span>
              STATUS: <strong style={{ color: '#10B981' }}>SYSTEM OPERATIONAL</strong>
            </span>
            <span style={{ color: '#475569' }}>|</span>
            <span>
              CLOCK: <strong style={{ color: '#EAA812' }}>SERVER-AUTHORITATIVE</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Full-Width Navigation Header Bar */}
      <header
        className={`site-header ${scrolled ? 'scrolled' : ''}`}
        style={{
          background: scrolled ? '#001A38' : '#002147',
          borderBottom: '3px solid #EAA812',
          height: '74px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Official Brand Logo */}
          <Link
            to="/"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
            aria-label="LogicWhile LiRE Home"
          >
            <BrandLogo size="sm" variant="standard" showTagline={true} />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {navLinks.map(({ label, to }) => (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <div
                  className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
                  style={{
                    color: location.pathname === to ? '#EAA812' : '#E2E8F0',
                    fontWeight: location.pathname === to ? 800 : 600,
                    fontSize: '14px',
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: location.pathname === to ? 'rgba(234,168,18,0.1)' : 'transparent',
                    border: location.pathname === to ? '1px solid rgba(234,168,18,0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </div>
              </Link>
            ))}

            {/* Fast-Track Exam Entry CTA */}
            <Link
              to="/enter-exam"
              id="header-enter-exam-cta"
              style={{
                textDecoration: 'none',
                marginLeft: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #EAA812 0%, #F59E0B 100%)',
                  color: '#001A38',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '7px 14px',
                  borderRadius: 8,
                  boxShadow: '0 2px 12px rgba(234, 168, 18, 0.35)',
                  letterSpacing: '0.02em',
                  transition: 'all 0.18s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 18px rgba(234, 168, 18, 0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(234, 168, 18, 0.35)';
                }}
              >
                <span>⚡</span>
                <span>Enter Exam</span>
              </div>
            </Link>

            {/* Logged in state: student indicator + Logout */}
            {isLoggedIn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span
                  style={{
                    fontSize: '12.5px',
                    color: '#38BDF8',
                    fontWeight: 700,
                    background: 'rgba(56, 189, 248, 0.1)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  🎓 {studentUser.name?.split(' ')[0] || 'Candidate'}
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#F87171',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Log out of student session"
                >
                  Logout
                </button>
              </div>
            )}

            <ThemeToggle className="ml-2" />
          </nav>

          {/* Mobile Menu Button */}
          <div style={{ display: 'none' }} className="mobile-menu-wrap">
            <ThemeToggle className="mobile-theme-toggle" />
            <button
              className="btn btn-ghost btn-sm mobile-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              style={{ color: '#FFFFFF', fontSize: '1.4rem' }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#002147',
                borderBottom: '2px solid #EAA812',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
              }}
            >
              <Link
                to="/enter-exam"
                onClick={() => setMenuOpen(false)}
                style={{
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, #EAA812 0%, #F59E0B 100%)',
                  color: '#001A38',
                  fontWeight: 800,
                  fontSize: '14px',
                  padding: '10px 14px',
                  borderRadius: 8,
                  textAlign: 'center',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>⚡</span>
                <span>Enter Live Exam (Code Entry)</span>
              </Link>
              {navLinks.map(({ label, to }) => (
                <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                  <div
                    className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
                    style={{ color: location.pathname === to ? '#EAA812' : '#FFFFFF', padding: '8px 0', fontWeight: 700 }}
                  >
                    {label}
                  </div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </div>
  );
}
