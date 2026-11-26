import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ui/ThemeToggle';
import { IconHierarchy, IconGraduation, IconCross, IconMenu, IconFlash } from './icons/HumanIcons';

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

  // Clean, Uncluttered Institutional Navigation Links: All Core Portals
  const navLinks = isLoggedIn
    ? [
        { label: 'Home', to: '/' },
        { label: 'Enter Exam', to: '/enter-exam' },
        { label: 'Practice', to: '/practice' },
        { label: 'Student', to: '/student/dashboard' },
        { label: 'Faculty', to: '/faculty' },
        { label: 'Inspector', to: '/inspector' },
        { label: 'Admin', to: '/admin' },
      ]
    : [
        { label: 'Home', to: '/' },
        { label: 'Enter Exam', to: '/enter-exam' },
        { label: 'Practice', to: '/practice' },
        { label: 'Student', to: '/login' },
        { label: 'Faculty', to: '/faculty' },
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
          ? '0 6px 26px rgba(5, 11, 34, 0.65)'
          : '0 4px 18px rgba(5, 11, 34, 0.45)',
      }}
    >
      {/* Top Utility Corporate Lineage Bar — Fixed at very top */}
      <div
        style={{
          background: '#07134B',
          color: '#CBD5E1',
          fontSize: '11.5px',
          fontWeight: 600,
          borderBottom: '1px solid rgba(255, 180, 0, 0.35)',
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
                background: '#FF7A00',
                boxShadow: '0 0 8px #FF7A00',
                display: 'inline-block',
              }}
            />
            <span style={{ letterSpacing: '0.04em', fontWeight: 900 }}>
              <span style={{ color: '#FF7A00' }}>LOGIC</span>
              <span style={{ color: '#FFFFFF' }}>WHILE</span>
            </span>
            <span style={{ color: '#64748B' }}>›</span>
            <span style={{ color: '#FFD000', fontWeight: 700, letterSpacing: '0.04em' }}>
              LiRE ASSESSMENT SUB-BRANCH
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px' }}>
            <span>
              STATUS: <strong style={{ color: '#10B981' }}>OPERATIONAL</strong>
            </span>
            <span style={{ color: '#475569' }}>|</span>
            <span>
              CLOCK: <strong style={{ color: '#FFB400' }}>SERVER-AUTHORITATIVE</strong>
            </span>
            <span style={{ color: '#475569' }}>|</span>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-horizonx'));
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255, 180, 0, 0.14)',
                border: '1px solid rgba(255, 180, 0, 0.42)',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#FFD000',
                fontSize: '10.5px',
                fontWeight: 700,
                fontFamily: "'Space Grotesk', monospace",
                cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'all 0.18s ease',
              }}
              title="Toggle HorizonX Architectural Blueprint Inspect Mode (Key: H)"
            >
              <IconHierarchy size={11} color="#FFD000" />
              <span>HORIZONX [H]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Width Navigation Header Bar */}
      <header
        className={`site-header ${scrolled ? 'scrolled' : ''}`}
        style={{
          background: scrolled
            ? 'linear-gradient(90deg, #050B22 0%, #07134B 50%, #050B22 100%)'
            : 'linear-gradient(90deg, #07134B 0%, #0A1C68 50%, #07134B 100%)',
          borderBottom: '3px solid #FFB400',
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
            aria-label="LogicWhile — LiRE Assessment Portal Home"
          >
            <BrandLogo size="sm" variant="standard" showTagline={true} themeOverride="dark" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {navLinks.map(({ label, to }) => (
              <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                <div
                  className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
                  style={{
                    color: location.pathname === to ? '#FFD000' : '#E2E8F0',
                    fontWeight: location.pathname === to ? 800 : 600,
                    fontSize: '13.5px',
                    padding: '7px 11px',
                    borderRadius: 6,
                    background: location.pathname === to ? 'rgba(255, 180, 0, 0.14)' : 'transparent',
                    border: location.pathname === to ? '1px solid rgba(255, 180, 0, 0.42)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </div>
              </Link>
            ))}

            {/* Logged in state: student indicator + Logout */}
            {isLoggedIn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#FFD000',
                    fontWeight: 700,
                    background: 'rgba(255, 180, 0, 0.12)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 180, 0, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconGraduation size={13} color="#FFB400" />
                  <span>{studentUser.name?.split(' ')[0] || 'Candidate'}</span>
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 122, 0, 0.5)',
                    color: '#FB923C',
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
              style={{ color: '#FFFFFF', fontSize: '1.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {menuOpen ? <IconCross size={18} color="#FFFFFF" /> : <IconMenu size={18} color="#FFFFFF" />}
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
                <IconFlash size={14} color="#001A38" />
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
