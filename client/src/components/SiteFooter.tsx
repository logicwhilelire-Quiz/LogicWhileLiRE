import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from './BrandLogo';
import {
  IconShield,
  IconLock,
  IconFileText,
  IconCross,
} from './icons/HumanIcons';

type ModalType =
  | 'guidelines'
  | 'privacy'
  | 'security'
  | null;

export default function SiteFooter() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Sync with clean policy/guideline URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['guidelines', 'privacy', 'security'].includes(hash)) {
        setActiveModal(hash as ModalType);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (activeModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  function openModal(type: ModalType) {
    setActiveModal(type);
    window.location.hash = type || '';
  }

  function closeModal() {
    setActiveModal(null);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  return (
    <>
      <footer className="site-footer" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface, #090D1A)', position: 'relative', zIndex: 10 }}>
        <div className="footer-grid">
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <BrandLogo size="md" variant="standard" showTagline={true} />
              </motion.div>
            </Link>

            <p className="footer-tagline" style={{ maxWidth: 360, color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              <strong style={{ color: '#FF7A00' }}>LogicWhile</strong> <span style={{ color: '#FFB400', fontWeight: 700 }}>› Assessment Portal</span>. Synchronized institutional examinations, proctored assessments, and verified performance scorecards.
            </p>

            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFB400' }}>
              Elevating Coding Knowledge
            </div>
          </div>

          {/* Platform Column */}
          <div>
            <div
              className="footer-col-title"
              style={{
                color: '#FFB400',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.92rem',
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Portals
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/enter-exam" className="footer-link">
                Enter Exam Code
              </Link>
              <Link to="/login" className="footer-link">
                Student Portal
              </Link>
              <Link to="/faculty/login" className="footer-link">
                Faculty Portal
              </Link>
              <Link to="/inspector" className="footer-link">
                Inspector Console
              </Link>
              <Link to="/admin" className="footer-link">
                Admin Portal
              </Link>
            </div>
          </div>

          {/* Candidate Resources Column (Clean, zero internal docs or server spoilers) */}
          <div>
            <div
              className="footer-col-title"
              style={{
                color: '#FFB400',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.92rem',
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Student Help
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/practice" className="footer-link">
                5-Sector Practice Arena
              </Link>
              <Link to="/forgot-password" className="footer-link">
                Forgot User ID / Password
              </Link>
              <Link to="/about" className="footer-link">
                About LogicWhile
              </Link>
              <button
                type="button"
                onClick={() => openModal('guidelines')}
                className="footer-link text-left"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              >
                Candidate Exam Guidelines
              </button>
            </div>
          </div>

          {/* Governance & Support Column */}
          <div>
            <div
              className="footer-col-title"
              style={{
                color: '#FFB400',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.92rem',
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Support &amp; Trust
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="/#contact-support" className="footer-link">
                Helpdesk Contact
              </a>
              <button
                type="button"
                onClick={() => openModal('privacy')}
                className="footer-link text-left"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => openModal('security')}
                className="footer-link text-left"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              >
                Examination Conduct Rules
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom" style={{ borderColor: 'var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.86rem' }}>
            <span>© 2026 <strong>LogicWhile</strong> · LiRE Assessment Platform. All rights reserved.</span>
          </div>
          <span style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => openModal('privacy')}
              className="footer-link"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => openModal('security')}
              className="footer-link"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
            >
              Conduct Rules
            </button>
          </span>
        </div>
      </footer>

      {/* ─── CLEAN STUDENT POLICY MODAL ─── */}
      <AnimatePresence>
        {activeModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(5, 8, 20, 0.75)',
                backdropFilter: 'blur(10px)',
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 640,
                maxHeight: '85vh',
                background: '#0B132B',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#f8fafc',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(15, 23, 42, 0.8)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.14)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activeModal === 'guidelines' && <IconShield size={20} color="#FFB400" />}
                    {activeModal === 'privacy' && <IconLock size={20} color="#38bdf8" />}
                    {activeModal === 'security' && <IconFileText size={20} color="#f43f5e" />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                      {activeModal === 'guidelines' && 'Candidate Examination Guidelines'}
                      {activeModal === 'privacy' && 'Candidate Privacy Policy'}
                      {activeModal === 'security' && 'Examination Conduct Rules'}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>LogicWhile LiRE Institutional Assessment</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close modal"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCross size={16} color="#94A3B8" />
                </button>
              </div>

              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, lineHeight: 1.65, fontSize: '0.92rem', color: '#cbd5e1' }}>
                {activeModal === 'guidelines' && (
                  <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li><strong>Sign In Early:</strong> Enter your Hall Ticket and Exam Code 5 minutes before scheduled start time.</li>
                    <li><strong>Waiting Lobby:</strong> Wait in the examination lobby until your invigilator starts the exam. Your paper opens automatically.</li>
                    <li><strong>Fullscreen Required:</strong> Keep the exam window in fullscreen mode without switching tabs or minimizing your browser.</li>
                    <li><strong>Auto-Saved Answers:</strong> All selected answers are saved continuously so temporary Wi-Fi drops do not lose your progress.</li>
                  </ol>
                )}

                {activeModal === 'privacy' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ margin: 0 }}>LogicWhile LiRE protects candidate data and handles examination records strictly for academic evaluation.</p>
                    <div><strong style={{ color: '#38bdf8' }}>1. Camera Verification:</strong> Webcam checks run locally in your browser during proctored exams.</div>
                    <div><strong style={{ color: '#38bdf8' }}>2. Academic Records:</strong> Only your institutional identifier, name, and assessment responses are stored for grading and scorecards.</div>
                  </div>
                )}

                {activeModal === 'security' && (
                  <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li>Candidates must attempt assessments strictly under their own Hall Ticket and credentials.</li>
                    <li>Secondary monitors, external messaging tools, and tab switching during exams are restricted.</li>
                    <li>Repeated proctoring violations may lock and auto-submit an ongoing examination.</li>
                  </ol>
                )}
              </div>

              <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Close &amp; Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
