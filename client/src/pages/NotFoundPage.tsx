import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { IconBuilding, IconLaunch, IconGraduation, IconShield } from '../components/icons/HumanIcons';

/**
 * Seamless Portal Gateway fallback — eliminates stark 404/error screens
 * by routing unmatched URLs cleanly back to the user's intended portal.
 */
export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const p = location.pathname.toLowerCase();
    const timer = setTimeout(() => {
      if (p.startsWith('/admin')) {
        navigate(localStorage.getItem('admin_token') ? '/admin/dashboard' : '/admin', { replace: true });
      } else if (p.startsWith('/inspector')) {
        navigate(localStorage.getItem('inspector_token') ? '/inspector/console' : '/inspector', { replace: true });
      } else if (p.startsWith('/faculty')) {
        navigate('/faculty/login', { replace: true });
      } else if (p.startsWith('/student')) {
        navigate(localStorage.getItem('student_token') ? '/student/dashboard' : '/login', { replace: true });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [location.pathname, navigate]);

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#050B22' }}>
      <SiteHeader />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            maxWidth: 540,
            background: '#081232',
            border: '1px solid rgba(255, 180, 0, 0.28)',
            borderRadius: 16,
            padding: '36px 28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <BrandLogo size="md" variant="standard" showTagline={true} themeOverride="dark" />
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display, 'Rajdhani', sans-serif)",
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 10,
            }}
          >
            Select Your Assessment Gateway
          </h1>

          <p
            style={{
              color: '#94A3B8',
              fontSize: '0.94rem',
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Continue smoothly using one of the official LogicWhile LiRE portals below.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary" style={{ padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconBuilding size={16} color="currentColor" /> Home
              </button>
            </Link>
            <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary" style={{ padding: '10px 18px', background: '#FFB400', color: '#050B22', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconLaunch size={16} color="#050B22" /> Enter Exam Code
              </button>
            </Link>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary" style={{ padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconGraduation size={16} color="currentColor" /> Student Portal
              </button>
            </Link>
            <Link to="/admin" style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary" style={{ padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconShield size={16} color="currentColor" /> Staff / Admin
              </button>
            </Link>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
