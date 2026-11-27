import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { forgotPassword, forgotUserId } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';
import {
  IconMail,
  IconAlert,
  IconKey,
  IconUsers,
  IconShield,
  IconCheck,
  IconFlash,
} from '../components/icons/HumanIcons';

type RecoveryMode = 'password' | 'userid';
type PortalType = 'auto' | 'student' | 'faculty' | 'inspector' | 'admin';

const PORTAL_META: Record<PortalType, { label: string; loginPath: string; color: string; placeholder: string }> = {
  auto: {
    label: 'All Portals',
    loginPath: '/login',
    color: '#38BDF8',
    placeholder: 'Email, Hall Ticket (e.g. 22B91A0501), or Username',
  },
  student: {
    label: 'Student',
    loginPath: '/login',
    color: '#60A5FA',
    placeholder: 'Registered email or Hall Ticket (e.g. 22B91A0501)',
  },
  faculty: {
    label: 'Faculty',
    loginPath: '/faculty',
    color: '#FB923C',
    placeholder: 'Faculty email or username',
  },
  inspector: {
    label: 'Inspector',
    loginPath: '/inspector',
    color: '#A78BFA',
    placeholder: 'Inspector email or username',
  },
  admin: {
    label: 'Super Admin',
    loginPath: '/admin',
    color: '#FFB400',
    placeholder: 'Admin email or username',
  },
};

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const rawPortal = (searchParams.get('portal') || 'auto').toLowerCase();
  const initialPortal: PortalType = (['student', 'faculty', 'inspector', 'admin', 'auto'] as PortalType[]).includes(rawPortal as PortalType)
    ? (rawPortal as PortalType)
    : 'auto';
  const initialMode: RecoveryMode = searchParams.get('mode') === 'id' ? 'userid' : 'password';

  const [mode, setMode] = useState<RecoveryMode>(initialMode);
  const [portal, setPortal] = useState<PortalType>(initialPortal);
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState('');

  const portalMeta = PORTAL_META[portal];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = identifier.trim();

    if (mode === 'userid') {
      if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        setError('Please enter your registered email address so we can email your User ID.');
        return;
      }
    } else if (!cleaned || cleaned.length < 2) {
      setError('Please enter your registered email, hall ticket, or staff username.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'userid') {
        const res = await forgotUserId({ email: cleaned.toLowerCase(), portal });
        setSubmittedMsg(res.data?.message || 'Your registered User ID / Hall Ticket details have been dispatched.');
      } else {
        const res = await forgotPassword({ identifier: cleaned, email: cleaned.includes('@') ? cleaned.toLowerCase() : undefined, portal });
        setSubmittedMsg(res.data?.message || 'A secure password reset link and User ID details have been dispatched.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to dispatch recovery email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center" style={{ padding: '32px 16px' }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
        </div>

        <div className="container animate-slide-up" style={{ maxWidth: 480 }}>
          <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <BrandLogo size="md" variant="hero" />
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: portalMeta.color, textTransform: 'uppercase', marginBottom: 4 }}>
              LogicWhile • Credential &amp; Mail Recovery Center
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: 4, color: 'var(--color-text)' }}>
              {mode === 'password' ? 'Reset Your Password' : 'Recover Your User ID'}
            </h2>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              {mode === 'password'
                ? 'Receive a 1-hour secure reset link & User ID summary via email'
                : 'Receive your Student Hall Ticket or Staff Username via registered email'}
            </p>
          </div>

          <div className="card" style={{ padding: '24px', borderColor: `${portalMeta.color}40` }}>
            {/* Mode Switcher Tabs */}
            {!submitted && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  padding: 4,
                  background: 'rgba(15, 23, 42, 0.75)',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => { setMode('password'); setError(''); }}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 8,
                    border: mode === 'password' ? `1px solid ${portalMeta.color}70` : '1px solid transparent',
                    background: mode === 'password' ? `${portalMeta.color}22` : 'transparent',
                    color: mode === 'password' ? '#FFFFFF' : '#94A3B8',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <IconKey size={14} color={mode === 'password' ? portalMeta.color : '#94A3B8'} />
                  <span>Forgot Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('userid'); setError(''); }}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 8,
                    border: mode === 'userid' ? `1px solid ${portalMeta.color}70` : '1px solid transparent',
                    background: mode === 'userid' ? `${portalMeta.color}22` : 'transparent',
                    color: mode === 'userid' ? '#FFFFFF' : '#94A3B8',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <IconUsers size={14} color={mode === 'userid' ? portalMeta.color : '#94A3B8'} />
                  <span>Forgot User ID</span>
                </button>
              </div>
            )}

            {/* Portal Selector Pills */}
            {!submitted && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Target Portal Account
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(Object.keys(PORTAL_META) as PortalType[]).map((key) => {
                    const m = PORTAL_META[key];
                    const active = portal === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPortal(key)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 999,
                          fontSize: '0.74rem',
                          fontWeight: active ? 800 : 600,
                          border: active ? `1px solid ${m.color}` : '1px solid rgba(255,255,255,0.1)',
                          background: active ? `${m.color}22` : 'rgba(255,255,255,0.03)',
                          color: active ? m.color : '#94A3B8',
                          cursor: 'pointer',
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="submitted"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ textAlign: 'center', padding: '8px 0' }}
                >
                  {/* Animated Dispatched Mail Icon */}
                  <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div
                      animate={{ scale: [1, 1.28, 1], opacity: [0.45, 0.08, 0.45] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        border: '2px solid rgba(56, 189, 248, 0.55)',
                      }}
                    />
                    <motion.div
                      initial={{ y: 8 }}
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.16)',
                        border: '2px solid rgba(16, 185, 129, 0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconMail size={26} color="#38BDF8" />
                    </motion.div>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', color: '#34D399', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10 }}>
                    <IconCheck size={12} color="#34D399" />
                    <span>Mail Relay Dispatched</span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
                    Check Your Inbox
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.6, marginBottom: 20 }}>
                    {submittedMsg} <strong style={{ color: '#f8fafc' }}>{identifier}</strong>
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="btn btn-secondary btn-full"
                    >
                      Try another account or mode
                    </button>
                    <Link to={portalMeta.loginPath} className="btn btn-primary btn-full">
                      Return to {portalMeta.label} Login →
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleSubmit}
                  noValidate
                >
                  {error && (
                    <div className="alert alert-error mb-3" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconAlert size={16} color="#EF4444" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-identifier-input">
                      {mode === 'userid'
                        ? 'Registered Institutional Email'
                        : 'Email, Hall Ticket, or Staff Username'}
                    </label>
                    <input
                      id="forgot-identifier-input"
                      className="form-input"
                      type={mode === 'userid' ? 'email' : 'text'}
                      placeholder={mode === 'userid' ? 'e.g. student@college.edu or faculty@logicwhilelire.com' : portalMeta.placeholder}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete={mode === 'userid' ? 'email' : 'username'}
                      required
                      autoFocus
                    />
                    <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IconShield size={12} color={portalMeta.color} />
                      <span>Works securely across Student, Faculty, Inspector, and Super Admin portals.</span>
                    </span>
                  </div>

                  <button
                    id="forgot-submit-btn"
                    type="submit"
                    className="btn btn-primary btn-full btn-lg"
                    disabled={loading}
                    style={{ marginTop: 8 }}
                  >
                    {loading ? (
                      <>
                        <div className="btn-spinner" /> Dispatching via Mail Relay...
                      </>
                    ) : mode === 'userid' ? (
                      <>
                        <IconFlash size={16} /> Email My User ID / Hall Ticket
                      </>
                    ) : (
                      <>
                        <IconMail size={16} /> Send Password Reset &amp; ID Mail
                      </>
                    )}
                  </button>

                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: 12,
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted, #94a3b8)',
                    }}
                  >
                    <Link to="/login" style={{ color: '#60A5FA', fontWeight: 700, textDecoration: 'none' }}>Student Login</Link>
                    <span>•</span>
                    <Link to="/faculty" style={{ color: '#FB923C', fontWeight: 700, textDecoration: 'none' }}>Faculty Login</Link>
                    <span>•</span>
                    <Link to="/inspector" style={{ color: '#A78BFA', fontWeight: 700, textDecoration: 'none' }}>Inspector Login</Link>
                    <span>•</span>
                    <Link to="/admin" style={{ color: '#FFB400', fontWeight: 700, textDecoration: 'none' }}>Admin Login</Link>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
