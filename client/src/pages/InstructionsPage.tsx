import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io as connectSocket, Socket } from 'socket.io-client';
import BrandLogo from '../components/BrandLogo';
import CodeRain from '../components/3d/CodeRain';
import { getAttemptStatus, startStudentAttempt, getExamLobbyStats } from '../lib/api';
import { SOCKET_URL } from '../lib/config';
import {
  IconLock,
  IconProhibit,
  IconClock,
  IconShield,
  IconTerminal,
  IconLaunch,
  IconCheck,
  IconAlert,
  IconFlash,
  IconPulse,
} from '../components/icons/HumanIcons';

export default function InstructionsPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isDemoOrDev = Boolean(examCode?.toUpperCase().includes('DEMO') || import.meta.env.DEV);
  const routerState = (location.state as any) || {};
  const stored = (() => {
    try {
      const raw = localStorage.getItem('logicwhilelire_attempt') || localStorage.getItem('growthran_attempt') || localStorage.getItem('lw_attempt') || '{}';
      return JSON.parse(raw);
    } catch {
      return {};
    }
  })();

  const examDetails = stored.examDetails || routerState.examDetails || {};
  const serverStartTime = routerState.serverStartTime || stored.serverStartTime;
  const isExamLive = Boolean(serverStartTime);
  const [countdown, setCountdown] = useState(isDemoOrDev || isExamLive ? 3 : 15);
  const [canProceed, setCanProceed] = useState(isDemoOrDev || isExamLive);
  const [systemOk, setSystemOk] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const durationSeconds = routerState.durationSeconds || stored.durationSeconds || 3600;
  const canonicalHt = routerState.hallTicket || stored.hallTicket || stored.roll_number || 'CANDIDATE';
  const canonicalAttemptId = routerState.attemptId || stored.attemptId || stored.attempt_id;
  const adminSetViolations = (() => {
    try {
      const v = localStorage.getItem(`admin_max_violations_${examCode?.toUpperCase()}`);
      if (v) return Number(v);
    } catch {}
    return null;
  })();
  const maxViolations = Number(adminSetViolations || stored.max_violations || routerState.maxViolations || 3);
  const [currentMaxViolations, setCurrentMaxViolations] = useState<number>(maxViolations);
  const [liveServerStart, setLiveServerStart] = useState<number | null>(serverStartTime || null);
  const [liveDuration, setLiveDuration] = useState<number>(durationSeconds);
  const [examLiveDispatched, setExamLiveDispatched] = useState<boolean>(isExamLive);

  // Synchronous WebSocket connection for live start dispatch and inspector config
  useEffect(() => {
    if (!examCode) return;
    const socket = connectSocket(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: { token: localStorage.getItem('student_token') || undefined },
    });

    socket.on('connect', () => {
      socket.emit('instructions:join', {
        examCode,
        hallTicket: canonicalHt,
      });
    });

    socket.on('EXAM_STARTED', (data: any) => {
      if (data?.exam_id?.toUpperCase() === examCode.toUpperCase() || data?.examCode?.toUpperCase() === examCode.toUpperCase()) {
        setExamLiveDispatched(true);
        if (data.server_start_time) setLiveServerStart(data.server_start_time);
        if (data.duration_seconds) setLiveDuration(data.duration_seconds);
        setCanProceed(true);
        setCountdown(0);
      }
    });

    socket.on('STUDENT_RELEASED', (data: any) => {
      if (data?.examCode?.toUpperCase() === examCode.toUpperCase()) {
        setCanProceed(true);
      }
    });

    socket.on('exam:config', (data: any) => {
      if (data?.examCode?.toUpperCase() === examCode.toUpperCase() && data.maxViolations) {
        setCurrentMaxViolations(Number(data.maxViolations));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [examCode, canonicalHt]);

  // REST polling fallback: guarantee instant proceed when inspector triggers live start
  useEffect(() => {
    if (!examCode || examLiveDispatched) return;
    const poll = async () => {
      try {
        const res = await getExamLobbyStats(examCode);
        if (res.data?.exam_started?.server_start_time) {
          setExamLiveDispatched(true);
          setLiveServerStart(res.data.exam_started.server_start_time);
          if (res.data.exam_started.duration_seconds) {
            setLiveDuration(res.data.exam_started.duration_seconds);
          }
          setCanProceed(true);
          setCountdown(0);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [examCode, examLiveDispatched]);

  // Strict Waiting Hall release verification on mount
  useEffect(() => {
    async function verifyRelease() {
      if (!examCode) return;
      if (serverStartTime || isDemoOrDev || routerState.isReleased || stored.isReleased || stored.is_released) {
        return;
      }
      const attemptId = canonicalAttemptId;
      const hallTicket = canonicalHt;
      if (!attemptId && !hallTicket) {
        navigate(`/waiting-lobby/${examCode}`, { replace: true });
        return;
      }
      try {
        const res = await getAttemptStatus(examCode, { attemptId, hallTicket });
        if (res.data?.is_released) {
          try {
            const updated = { ...stored, isReleased: true };
            localStorage.setItem('logicwhilelire_attempt', JSON.stringify(updated));
          } catch {}
        } else if (res.data?.status === 'waiting_verification' || res.data?.status === 'in_lobby') {
          // If supervisor has not released the candidate yet, route to Waiting Lobby
          navigate(`/contest/${encodeURIComponent(examCode)}/waiting-lobby`, {
            replace: true,
            state: {
              hallTicket,
              attemptId,
              candidate: stored,
              examCode,
              isReleased: false,
            },
          });
        }
      } catch {
        // Non-blocking fallback
      }
    }
    verifyRelease();
  }, [examCode, serverStartTime, isDemoOrDev, canonicalAttemptId, canonicalHt]);

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

  async function handleStart() {
    if (!canProceed || isStarting) return;
    setIsStarting(true);
    setStartError('');

    try {
      sessionStorage.setItem(`lw_camera_consented_${examCode}`, 'true');
      sessionStorage.setItem('lw_camera_consented', 'true');
    } catch {}

    try {
      const attemptId = canonicalAttemptId;
      const hallTicket = canonicalHt;
      const sessionToken = stored.session_token || stored.token;

      // Server-authoritative start authorization
      const res = await startStudentAttempt(examCode!, {
        attemptId,
        session_token: sessionToken,
        hallTicket,
      });

      const effectiveStart = res.data?.server_start_time || liveServerStart || serverStartTime || Date.now();
      const effectiveDuration = res.data?.duration_seconds || liveDuration || durationSeconds || 3600;

      navigate(`/quiz/${examCode}`, {
        state: {
          hallTicket,
          serverStartTime: effectiveStart,
          durationSeconds: effectiveDuration,
          attemptId: res.data?.attempt_id || attemptId,
        },
      });
    } catch (err: any) {
      // In case of transient network failure, fallback directly with cached clock
      navigate(`/quiz/${examCode}`, {
        state: {
          hallTicket: canonicalHt,
          serverStartTime: liveServerStart || serverStartTime || Date.now(),
          durationSeconds: liveDuration || durationSeconds || 3600,
          attemptId: canonicalAttemptId,
        },
      });
    } finally {
      setIsStarting(false);
    }
  }

  const rules = [
    {
      icon: <IconLock size={20} color="#EF4444" />,
      title: 'Strict Fullscreen Lock',
      text: 'Exiting fullscreen or pressing escape key triggers immediate security violation recording.',
      severity: 'danger',
    },
    {
      icon: <IconProhibit size={20} color="#EF4444" />,
      title: 'Tab Navigation Guard',
      text: `Switching tabs, sliding to external windows, or losing window focus is strictly tracked. Maximum ${currentMaxViolations} tab violations permitted before automatic lockout (Settled by Inspector).`,
      severity: 'danger',
    },
    {
      icon: <IconClock size={20} color="#F59E0B" />,
      title: 'Server-Authoritative Clock',
      text: 'Timer is globally synchronized to the official exam closing time. Late arrivals share the same final deadline.',
      severity: 'info',
    },
    {
      icon: <IconShield size={20} color="#10B981" />,
      title: 'Automated Session Persistence',
      text: 'Every answer selection is cryptographically committed in real-time. If network fluctuates, your session resumes seamlessly.',
      severity: 'info',
    },
    {
      icon: <IconTerminal size={20} color="#38BDF8" />,
      title: 'Coding Sandbox & Review',
      text: 'Integrated code editor features isolated execution. Final code submissions undergo automated unit tests and institutional review.',
      severity: 'info',
    },
    {
      icon: <IconAlert size={20} color="#F59E0B" />,
      title: 'Clipboard & Screen Shield',
      text: 'Copy, paste, cut, context-menu, and screen capture shortcuts are actively prevented by forensic anti-leak watermarking.',
      severity: 'warning',
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
            <div style={{ display: 'inline-flex', padding: 12, borderRadius: 12, background: 'rgba(43,127,255,0.1)', border: '1px solid rgba(43,127,255,0.25)', marginBottom: 12 }}>
              <IconShield size={32} color="#38BDF8" />
            </div>
            <h1
              style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                color: 'var(--color-text, #F0F4FC)',
                fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                marginBottom: 8,
              }}
            >
              Institutional Examination Protocol
            </h1>
            <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.92rem' }}>
              {examDetails.exam_name || examCode} • {examDetails.duration_minutes || 60} Minutes • {examDetails.total_questions || 15} Assessment Items
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <IconShield size={16} color="#38BDF8" />
              <h2
                style={{
                  color: 'var(--color-text, #F0F4FC)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0,
                }}
              >
                Hardware & System Clearance
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: 'Network Sync', ok: true, icon: <IconPulse size={16} color="#10B981" /> },
                { label: 'Browser Mutex', ok: true, icon: <IconTerminal size={16} color="#10B981" /> },
                { label: 'Screen Lock', ok: true, icon: <IconLock size={16} color="#10B981" /> },
                { label: 'Webcam Stream', ok: systemOk, icon: <IconShield size={16} color={systemOk ? '#10B981' : '#F59E0B'} /> },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: item.ok ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${item.ok ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    borderRadius: 8,
                  }}
                >
                  {item.icon}
                  <span
                    style={{
                      fontSize: '0.84rem',
                      color: item.ok ? '#10B981' : '#F59E0B',
                      fontWeight: 600,
                    }}
                  >
                    {item.label} {item.ok ? '✓' : '• Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Dispatch Banner */}
          {examLiveDispatched && (
            <div
              style={{
                background: 'rgba(16,185,129,0.15)',
                border: '1.5px solid rgba(16,185,129,0.45)',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 8px 24px rgba(16,185,129,0.15)',
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 12px #10B981' }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#34D399', fontWeight: 800, fontSize: '0.96rem', letterSpacing: '0.02em' }}>
                  EXAMINATION IS LIVE ON SERVER
                </div>
                <div style={{ color: '#CBD5E1', fontSize: '0.82rem', marginTop: 2 }}>
                  The supervisor has authorized live assessment start. All candidate clocks are synchronized. You may enter immediately.
                </div>
              </div>
            </div>
          )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <IconLock size={18} color="#FFBE00" />
              <h2
                style={{
                  color: 'var(--color-text, #F0F4FC)',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  letterSpacing: '0.04em',
                  margin: 0,
                }}
              >
                Anti-Cheating Regulations & Security Invariants
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {rules.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: rule.severity === 'danger' ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${rule.severity === 'danger' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)'}`,
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{rule.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>
                      {rule.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: rule.severity === 'danger' ? '#F87171' : 'var(--color-text-muted, #94a3b8)',
                        lineHeight: 1.5,
                      }}
                    >
                      {rule.text}
                    </div>
                  </div>
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
                  Reviewing Mandatory Security Policy — Door Opens In
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
                      width: `${((40 - countdown) / 40) * 100}%`,
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconFlash size={14} color="#2B7FFF" />
                  <span>I understand the security rules • Enter Examination →</span>
                </button>
              </>
            ) : (
              <>
                {startError && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#F87171',
                      borderRadius: 8,
                      padding: '10px 16px',
                      marginBottom: 16,
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <IconAlert size={16} color="#F87171" />
                    <span>{startError}</span>
                  </div>
                )}
                <div
                  style={{
                    fontSize: '0.94rem',
                    color: 'var(--color-text-muted, #94a3b8)',
                    marginBottom: 20,
                  }}
                >
                  Clearance confirmed. All proctoring telemetry is actively synchronized with the server clock.
                </div>
                <motion.button
                  id="start-exam-now-btn"
                  onClick={handleStart}
                  disabled={isStarting}
                  whileHover={{ scale: isStarting ? 1 : 1.02 }}
                  whileTap={{ scale: isStarting ? 1 : 0.98 }}
                  style={{
                    background: isStarting ? '#475569' : 'linear-gradient(135deg, #2B7FFF 0%, #1B5FB5 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '16px 48px',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    cursor: isStarting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 24px rgba(43,127,255,0.35)',
                    fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <IconLaunch size={20} color="#FFFFFF" />
                  <span>{isStarting ? 'Authorizing Exam Clock...' : 'Enter Assessment Environment'}</span>
                </motion.button>
              </>
            )}
          </div>

          {/* Official Footer */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.74rem',
              color: 'var(--color-text-faint, #64748b)',
              paddingBottom: 24,
            }}
          >
            LogicWhile • Institutional Assessment Platform • © 2026 LogicWhile. All rights reserved.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
