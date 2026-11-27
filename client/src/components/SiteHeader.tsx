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
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#FF7A00',
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '12px' }}>
              <span style={{ color: '#FF7A00' }}>Logic</span>
              <span style={{ color: '#FFFFFF' }}>While</span>
            </span>
            <span style={{ color: '#64748B' }}>›</span>
            <span style={{ color: '#FFB400', fontWeight: 500, fontSize: '12px' }}>
              LiRE Assessment Sub-Branch
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: '#94A3B8' }}>
              Status: <strong style={{ color: '#34D399', fontWeight: 600 }}>Operational</strong>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>|</span>
            <span style={{ color: '#94A3B8' }}>
              Clock: <strong style={{ color: '#FFB400', fontWeight: 600 }}>Server-Authoritative</strong>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>|</span>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-horizonx'));
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 180, 0, 0.1)',
                border: '1px solid rgba(255, 180, 0, 0.28)',
                borderRadius: 6,
                padding: '2px 8px',
                color: '#FFD000',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                cursor: 'pointer',
                transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              title="Toggle HorizonX Architectural Blueprint Inspect Mode (Key: H)"
            >
              <IconHierarchy size={12} color="#FFD000" />
              <span>HorizonX [H]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Width Navigation Header Bar */}
      <header
        className={`site-header ${scrolled ? 'scrolled' : ''}`}
        style={{
          background: scrolled ? '#050B22' : '#07134B',
          borderBottom: '2px solid rgba(255, 180, 0, 0.65)',
          height: '64px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          position: 'relative',
          transition: 'background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
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
