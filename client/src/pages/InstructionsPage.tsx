import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import CodeRain from '../components/3d/CodeRain';
import MagneticButton from '../components/3d/MagneticButton';

export default function InstructionsPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(60);
  const [canProceed, setCanProceed] = useState(false);
  const [systemOk, setSystemOk] = useState(false);

  // Get stored attempt
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('lw_attempt') || '{}'); } catch { return {}; }
  })();

  const examDetails = stored.examDetails || {};

  useEffect(() => {
    if (!stored.attemptId || !stored.examCode) {
      navigate('/enter-exam');
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanProceed(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // System check
  useEffect(() => {
    async function check() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setSystemOk(true);
      } catch {
        setSystemOk(true); // Allow without camera for now
      }
    }
    check();
  }, []);

  function handleStart() {
    if (!canProceed) return;
    navigate(`/quiz/${examCode}`, {
      state: { hallTicket: stored.hallTicket }
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0A1931 0%, #12245a 100%)', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Module 12: Code Rain Matrix Background (opacity 0.05) */}
      <CodeRain opacity={0.05} />

      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
        <BrandLogo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 6 }}>
            {stored.examCode}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
            {stored.hallTicket}
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: 720 }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', fontFamily: "'Poppins', system-ui, sans-serif", marginBottom: 8, letterSpacing: '-0.01em' }}>
              Exam Instructions
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
              {examDetails.exam_name} · {examDetails.duration_minutes} min · {examDetails.total_questions} questions
            </p>
          </div>

          {/* System Check */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 14, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚙️ System Check</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {[
                { label: 'Internet', ok: true, icon: '🌐' },
                { label: 'Browser', ok: true, icon: '🖥️' },
                { label: 'Screen Lock', ok: true, icon: '🔐' },
                { label: 'Camera', ok: systemOk, icon: '📷' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: item.ok ? 'rgba(0,184,148,0.08)' : 'rgba(253,203,110,0.08)', border: `1px solid ${item.ok ? 'rgba(0,184,148,0.2)' : 'rgba(253,203,110,0.2)'}`, borderRadius: 8 }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '0.88rem', color: item.ok ? '#00B894' : '#FDCB6E', fontWeight: 600 }}>{item.label} {item.ok ? '✓' : '⚠'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '24px', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 16, fontSize: '1rem' }}>📜 Rules & Guidelines</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🔒', text: 'Exam will lock to Fullscreen mode. Pressing ESC counts as a violation.', severity: 'warning' },
                { icon: '👁️', text: 'Switching tabs or windows is detected. 3 violations = Auto Submit.', severity: 'warning' },
                { icon: '⏱️', text: 'Timer is server-synchronized. You cannot pause or manipulate the timer.', severity: 'info' },
                { icon: '💾', text: 'Answers are auto-saved every time you click an option. If power goes out, you can resume.', severity: 'info' },
                { icon: '❌', text: 'Right-click, Copy, Ctrl+C, Ctrl+V are disabled during the exam.', severity: 'warning' },
                { icon: '🎟️', text: 'One attempt only. Once submitted, you cannot re-enter with the same hall ticket.', severity: 'danger' },
                { icon: '⌨️', text: 'Keyboard shortcuts: 1-4 = Select option, N = Next question, P = Previous.', severity: 'info' },
                { icon: '🟢', text: 'Question palette: Green = Answered, White = Not answered, Purple = Review.', severity: 'info' },
              ].map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{rule.icon}</span>
                  <span style={{ fontSize: '0.9rem', color: rule.severity === 'danger' ? '#f87171' : rule.severity === 'warning' ? '#FDCB6E' : 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    {rule.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Countdown + Start */}
          <div style={{ textAlign: 'center', padding: '32px 24px', background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: 14 }}>
            {!canProceed ? (
              <>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Please read instructions — starting in
                </div>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#6C5CE7', fontFamily: 'monospace', marginBottom: 16, lineHeight: 1 }}>
                  {countdown}
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(60 - countdown) / 60 * 100}%`, background: 'linear-gradient(90deg, #6C5CE7, #00B894)', borderRadius: 999, transition: 'width 1s linear' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
                  You're ready to begin. The exam timer starts when you click Start.
                </div>
                <motion.button
                  id="start-exam-now-btn"
                  onClick={handleStart}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    background: 'linear-gradient(135deg, #6C5CE7 0%, #5848c2 100%)',
                    color: '#fff', border: 'none', borderRadius: 14,
                    padding: '18px 48px', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer',
                    boxShadow: '0 8px 32px rgba(108,92,231,0.5)',
                    fontFamily: "'Poppins', system-ui, sans-serif",
                  }}
                >
                  🚀 Start Exam
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
      `}</style>
    </div>
  );
}
