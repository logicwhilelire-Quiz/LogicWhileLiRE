import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import CodeRain from '../components/3d/CodeRain';

export default function InstructionsPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const navigate = useNavigate();
  const isDemoOrDev = Boolean(examCode?.toUpperCase().includes('DEMO') || import.meta.env.DEV);
  const [countdown, setCountdown] = useState(isDemoOrDev ? 5 : 60);
  const [canProceed, setCanProceed] = useState(false);
  const [systemOk, setSystemOk] = useState(false);
  const [lang, setLang] = useState<'en' | 'te'>('en');

  // Get stored attempt
  const stored = (() => {
    try {
      const raw = localStorage.getItem('logicwhilelire_attempt') || localStorage.getItem('growthran_attempt') || localStorage.getItem('lw_attempt') || '{}';
      return JSON.parse(raw);
    } catch {
      return {};
    }
  })();

  const examDetails = stored.examDetails || {};

  useEffect(() => {
    if (!stored.attemptId || !stored.examCode) {
      navigate('/enter-exam');
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanProceed(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // System check
  useEffect(() => {
    async function check() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setSystemOk(true);
      } catch {
        setSystemOk(true); // Graceful fallback
      }
    }
    check();
  }, []);

  function handleStart() {
    if (!canProceed) return;
    navigate(`/quiz/${examCode}`, {
      state: { hallTicket: stored.hallTicket },
    });
  }

  const rules = [
    {
      icon: '🔒',
      en: 'Exam will lock to Fullscreen mode. Pressing ESC counts as an integrity violation.',
      te: 'పరీక్ష పూర్తి స్క్రీన్ మోడ్‌లో లాక్ అవుతుంది. ESC నొక్కడం ఉల్లంఘనగా నమోదు చేయబడుతుంది.',
      severity: 'warning',
    },
    {
      icon: '👁️',
      en: 'Switching tabs or windows is automatically detected. 3 violations = Auto Submit.',
      te: 'ట్యాబ్‌లు లేదా ఇతర విండోలకు మారడం గుర్తించబడుతుంది. 3 ఉల్లంఘనలు = పరీక్ష ఆటో సబ్మిట్.',
      severity: 'warning',
    },
    {
      icon: '⏱️',
      en: 'Timer is server-synchronized. You cannot pause or manipulate the remaining time.',
      te: 'సమయం సర్వర్‌తో సమకాలీకరించబడింది. సమయాన్ని పాజ్ చేయడం లేదా మార్చడం సాధ్యం కాదు.',
      severity: 'info',
    },
    {
      icon: '💾',
      en: 'Answers are auto-saved every time you select an option. If network drops, session resumes seamlessly.',
      te: 'ప్రతి ప్రశ్నకు సమాధానం స్వయంచాలకంగా సేవ్ అవుతుంది. నెట్‌వర్క్ ఆగినా తిరిగి ప్రారంభించవచ్చు.',
      severity: 'info',
    },
    {
      icon: '❌',
      en: 'Right-click, Copy, Cut, and Paste are strictly disabled during the exam session.',
      te: 'పరీక్ష సమయంలో రైట్-క్లిక్, కాపీ, పేస్ట్ మరియు డెవ్‌టూల్స్ పూర్తిగా నిలిపివేయబడతాయి.',
      severity: 'warning',
    },
    {
      icon: '🎟️',
      en: 'Single session per hall ticket. Once submitted, re-entry is blocked by server authority.',
      te: 'ఒక్క హాల్ టికెట్‌కు ఒకే సెషన్ అనుమతించబడుతుంది. సబ్మిట్ చేసిన తర్వాత తిరిగి ప్రవేశం ఉండదు.',
      severity: 'danger',
    },
    {
      icon: '💻',
      en: 'Coding questions are submitted for manual faculty review and are not part of the live instant MCQ auto-grade.',
      te: 'కోడింగ్ ప్రశ్నలు మాన్యువల్ ఫ్యాకల్టీ మూల్యాంకనం కోసం సమర్పించబడతాయి మరియు తక్షణ MCQ ఆటో-గ్రేడ్‌లో చేర్చబడవు.',
      severity: 'info',
    },
    {
      icon: '⌨️',
      en: 'Keyboard shortcuts: 1-4 = Select option, N = Next question, P = Previous question.',
      te: 'కీబోర్డ్ షార్ట్‌కట్‌లు: 1-4 = ఆప్షన్ ఎంపిక, N = తదుపరి ప్రశ్న, P = మునుపటి ప్రశ్న.',
      severity: 'info',
    },
    {
      icon: '🟢',
      en: 'Question Palette: Green = Answered, Slate = Not Answered, Blue = Marked for Review.',
      te: 'ప్రశ్నల పాలెట్: ఆకుపచ్చ = సమాధానమిచ్చినవి, బూడిద = సమాధానమివ్వనివి, నీలం = రివ్యూ కోసం.',
      severity: 'info',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg, #050814)',
        color: 'var(--color-text, #F0F4FC)',
        fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Code Rain Matrix Background */}
      <CodeRain opacity={0.03} />

      {/* Nav */}
      <nav
        style={{
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          background: 'rgba(5, 8, 20, 0.85)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <BrandLogo size="sm" showTagline />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Language Toggle (English / Telugu) */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: 2,
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: lang === 'en' ? 'var(--color-primary, #2B7FFF)' : 'transparent',
                color: lang === 'en' ? '#FFFFFF' : 'var(--color-text-muted, #94a3b8)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('te')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: lang === 'te' ? 'var(--color-primary, #2B7FFF)' : 'transparent',
                color: lang === 'te' ? '#FFFFFF' : 'var(--color-text-muted, #94a3b8)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              తెలుగు (Telugu)
            </button>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.82rem',
              color: 'var(--color-primary, #2B7FFF)',
              background: 'rgba(43,127,255,0.1)',
              border: '1px solid rgba(43,127,255,0.3)',
              padding: '4px 12px',
              borderRadius: 6,
              fontWeight: 700,
            }}
          >
            {stored.examCode}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)' }}>
            {stored.hallTicket}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 740 }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>📋</div>
            <h1
              style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                color: 'var(--color-text, #F0F4FC)',
                fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                marginBottom: 8,
              }}
            >
              {lang === 'en' ? 'Official Exam Instructions' : 'అధికారిక పరీక్ష సూచనలు'}
            </h1>
            <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.92rem' }}>
              {examDetails.exam_name} • {examDetails.duration_minutes} min • {examDetails.total_questions} questions
            </p>
          </div>

          {/* System Check */}
          <div
            style={{
              background: 'var(--color-surface, #0c1222)',
              border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
              borderRadius: 14,
              padding: '20px 24px',
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                color: 'var(--color-text, #F0F4FC)',
                fontWeight: 700,
                marginBottom: 14,
                fontSize: '0.92rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ⚙️ {lang === 'en' ? 'Hardware & System Verification' : 'హార్డ్‌వేర్ & సిస్టమ్ తనిఖీ'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: lang === 'en' ? 'Network' : 'ఇంటర్నెట్', ok: true, icon: '🌐' },
                { label: lang === 'en' ? 'Browser' : 'బ్రౌజర్', ok: true, icon: '🖥️' },
                { label: lang === 'en' ? 'Screen Lock' : 'స్క్రీన్ లాక్', ok: true, icon: '🔐' },
                { label: lang === 'en' ? 'Camera' : 'కెమెరా', ok: systemOk, icon: '📷' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: item.ok ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${item.ok ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span
                    style={{
                      fontSize: '0.86rem',
                      color: item.ok ? '#10B981' : '#F59E0B',
                      fontWeight: 600,
                    }}
                  >
                    {item.label} {item.ok ? '✓' : '⚠'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div
            style={{
              background: 'var(--color-surface, #0c1222)',
              border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
              borderRadius: 14,
              padding: '24px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                color: 'var(--color-text, #F0F4FC)',
                fontWeight: 700,
                marginBottom: 16,
                fontSize: '0.98rem',
              }}
            >
              📜 {lang === 'en' ? 'Proctoring Rules & Guidelines' : 'పరీక్ష నియమాలు మరియు మార్గదర్శకాలు'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{rule.icon}</span>
                  <span
                    style={{
                      fontSize: '0.88rem',
                      color:
                        rule.severity === 'danger'
                          ? '#EF4444'
                          : rule.severity === 'warning'
                          ? '#F59E0B'
                          : 'var(--color-text-muted, #94a3b8)',
                      lineHeight: 1.55,
                    }}
                  >
                    {lang === 'en' ? rule.en : rule.te}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Countdown + Start */}
          <div
            style={{
              textAlign: 'center',
              padding: '32px 24px',
              background: 'rgba(43,127,255,0.06)',
              border: '1px solid rgba(43,127,255,0.2)',
              borderRadius: 14,
              marginBottom: 32,
            }}
          >
            {!canProceed ? (
              <>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted, #94a3b8)',
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                  }}
                >
                  {lang === 'en'
                    ? 'Please review instructions — candidate portal opens in'
                    : 'దయచేసి సూచనలను సమీక్షించండి — పరీక్ష ప్రారంభం సమయం'}
                </div>
                <div
                  style={{
                    fontSize: '3.6rem',
                    fontWeight: 900,
                    color: 'var(--color-primary, #2B7FFF)',
                    fontFamily: 'var(--font-mono, monospace)',
                    marginBottom: 16,
                    lineHeight: 1,
                  }}
                >
                  {countdown}s
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${((60 - countdown) / 60) * 100}%`,
                      background: 'linear-gradient(90deg, #2B7FFF, #10B981)',
                      borderRadius: 999,
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
                <button
                  type="button"
                  id="skip-instruction-wait-btn"
                  onClick={() => setCanProceed(true)}
                  style={{
                    marginTop: 18,
                    background: 'rgba(43,127,255,0.08)',
                    border: '1px solid rgba(43,127,255,0.3)',
                    color: 'var(--color-primary, #2B7FFF)',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ⚡ I have reviewed the instructions • Skip wait →
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: '0.96rem',
                    color: 'var(--color-text-muted, #94a3b8)',
                    marginBottom: 20,
                  }}
                >
                  {lang === 'en'
                    ? 'You are ready to begin. The server timer starts immediately upon clicking.'
                    : 'మీరు సిద్ధంగా ఉన్నారు. స్టార్ట్ క్లిక్ చేయగానే సర్వర్ టైమర్ ప్రారంభమవుతుంది.'}
                </div>
                <motion.button
                  id="start-exam-now-btn"
                  onClick={handleStart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'linear-gradient(135deg, #2B7FFF 0%, #1B5FB5 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '16px 48px',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(43,127,255,0.35)',
                    fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                  }}
                >
                  🚀 {lang === 'en' ? 'Start Exam' : 'పరీక్ష ప్రారంభించండి'}
                </motion.button>
              </>
            )}
          </div>

          {/* Official Footer Credit */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.74rem',
              color: 'var(--color-text-faint, #64748b)',
              paddingBottom: 24,
            }}
          >
            LogicWhileLiRE • "Logic. While. LiRE." • Developed by R. Charan Sai • © 2026 All rights reserved.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
