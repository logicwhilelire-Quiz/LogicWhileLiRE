import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { startSession, getQuestions, saveAnswer, submitSession, logViolation } from '../lib/api';
import { getBrowserFingerprint } from '../lib/fingerprint';
import { useTimer } from '../hooks/useTimer';
import { useProctor } from '../hooks/useProctor';
import BrandLogo from '../components/BrandLogo';
import LogicWhileLiRELoader from '../components/LogicWhileLiRELoader';
import AnimatedPage from '../components/AnimatedPage';

interface Question {
  id: string;
  question: string;
  options: Record<string, string>;
  marks: number;
  topic: string;
}

interface ViolationState {
  show: boolean;
  terminated: boolean;
  message: string;
  count: number;
}

export default function ExamPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { session_id: string; participant_name: string } | null;

  const [phase, setPhase] = useState<'starting' | 'active' | 'submitting' | 'done'>('starting');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answeredIndices, setAnsweredIndices] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [loadingQ, setLoadingQ] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);
  const [violation, setViolation] = useState<ViolationState>({
    show: false, terminated: false, message: '', count: 0,
  });
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const questionStartTimeRef = useRef<number>(Date.now());
  const sessionId = state?.session_id || '';

  // ——— Timer (server-authoritative) ———
  const timer = useTimer(sessionId, async () => {
    // Timer expired — server will auto-submit, show done UI
    setPhase('done');
  });

  // ——— Network status & offline sync ———
  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      timer.resync();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [timer]);

  // ——— Duplicate Tab Prevention ———
  useEffect(() => {
    if (!sessionId) return;
    const channelName = `logicwhilelire_exam_${sessionId}`;
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
    const tabId = Math.random().toString(36).substring(2, 9);
    localStorage.setItem(`exam_tab_${sessionId}`, tabId);

    if (bc) {
      bc.postMessage({ type: 'TAB_OPENED', tabId });
      bc.onmessage = (event) => {
        if (event.data?.type === 'TAB_OPENED' && event.data?.tabId !== tabId) {
          setIsDuplicateTab(true);
          bc.postMessage({ type: 'DUPLICATE_DETECTED' });
        } else if (event.data?.type === 'DUPLICATE_DETECTED') {
          setIsDuplicateTab(true);
        }
      };
    }

    return () => {
      if (bc) bc.close();
      localStorage.removeItem(`exam_tab_${sessionId}`);
    };
  }, [sessionId]);

  // ——— Violation handler ———
  const handleViolation = useCallback(async (type: string, notes?: string) => {
    if (phase !== 'active') return;
    try {
      const res = await logViolation(sessionId, type, notes);
      const data = res.data;
      if (data.terminated) {
        setViolation({ show: true, terminated: true, message: data.reason, count: data.violation_count });
        setPhase('done');
      } else if (data.warning) {
        setViolation({ show: true, terminated: false, message: data.message, count: data.violation_count });
      }
    } catch {
      // Ignore — beacon already sent
    }
  }, [sessionId, phase]);

  // ——— Proctoring ———
  const { requestFullscreen } = useProctor({
    sessionId,
    onViolation: handleViolation,
    enabled: phase === 'active',
  });

  const loadPage = useCallback(async (page: number) => {
    setLoadingQ(true);
    try {
      const res = await getQuestions(sessionId, page);
      const { questions: qs, total_count, total_pages } = res.data;
      setQuestions(qs);
      setTotalPages(total_pages);
      setTotalCount(total_count);
      setCurrentPage(page);
      setCurrentQ(0);
      questionStartTimeRef.current = Date.now();
    } finally {
      setLoadingQ(false);
    }
  }, [sessionId]);

  // ——— Start session & load first page ———
  useEffect(() => {
    if (!sessionId) { navigate('/'); return; }

    async function init() {
      try {
        const fp = await getBrowserFingerprint();
        await startSession(fp);
        await loadPage(1);
        await requestFullscreen();
        setPhase('active');
      } catch (err: any) {
        console.error('[ExamPage] Start failed:', err);
      }
    }
    init();
  }, []);

  // ——— Save answer ———
  const handleSelectOption = useCallback(async (questionId: string, option: string) => {
    const latency = Date.now() - questionStartTimeRef.current;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setAnsweredIndices((prev) => new Set(prev).add((currentPage - 1) * 10 + currentQ));
    questionStartTimeRef.current = Date.now();

    try {
      await saveAnswer(sessionId, { question_id: questionId, chosen_option: option, answer_latency_ms: latency });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'SESSION_TERMINATED') {
        setViolation({ show: true, terminated: true, message: 'Your session has been terminated.', count: 0 });
        setPhase('done');
      } else if (code === 'TIME_EXPIRED') {
        setPhase('done');
      }
    }
  }, [sessionId, currentPage, currentQ]);

  // ——— Keyboard Option & Navigation Shortcuts ———
  useEffect(() => {
    if (phase !== 'active' || loadingQ || !questions[currentQ]) return;
    const currentQuestion = questions[currentQ];

    const onKey = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      const key = e.key.toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(key) && currentQuestion.options[key]) {
        handleSelectOption(currentQuestion.id, key);
      } else if (['1', '2', '3', '4'].includes(key)) {
        const optKey = ['a', 'b', 'c', 'd'][parseInt(key, 10) - 1];
        if (currentQuestion.options[optKey]) handleSelectOption(currentQuestion.id, optKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, loadingQ, questions, currentQ, handleSelectOption]);

  // ——— Submit ———
  const handleSubmit = useCallback(async () => {
    setSubmitConfirm(false);
    setPhase('submitting');
    try {
      await submitSession(sessionId);
      setPhase('done');
    } catch {
      setPhase('active');
    }
  }, [sessionId]);

  const globalIndex = (currentPage - 1) * 10 + currentQ;
  const currentQuestion = questions[currentQ];
  const answeredCount = answeredIndices.size;
  const unansweredCount = Math.max(0, totalCount - answeredCount);

  // ——— Duplicate Tab Screen ———
  if (isDuplicateTab) {
    return (
      <div className="page-center">
        <div className="card text-center animate-slide-up" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)', marginBottom: 8 }}>
            Multiple Exam Tabs Detected
          </h2>
          <p className="text-muted text-sm mb-3">
            This exam is already open in another browser tab or window. To maintain strict proctoring integrity, only one active tab is allowed.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Make This Tab Active
          </button>
        </div>
      </div>
    );
  }

  // ——— Initial Loading / Starting Screen ———
  if (phase === 'starting') {
    return (
      <div className="page-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogicWhileLiRELoader
          size="lg"
          message="Initializing secure LogicWhileLiRE exam environment..."
        />
      </div>
    );
  }

  // ——— Exam complete screen ———
  if (phase === 'done') {
    return (
      <AnimatedPage>
        <div className="page-center">
          <div className="card animate-slide-up text-center" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <BrandLogo size="md" />
            </div>

            {violation.terminated ? (
              <>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🚫</div>
                <h2 style={{ color: 'var(--color-danger)', fontWeight: 800, marginBottom: 8 }}>
                  Exam Session Terminated
                </h2>
                <p className="text-muted text-sm mb-3">
                  Your session was closed due to repeated proctoring violations:
                </p>
                <div className="alert alert-error mb-3" style={{ textAlign: 'left' }}>
                  {violation.message || 'Maximum violation threshold exceeded.'}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontWeight: 800, marginBottom: 8, color: 'var(--color-text)' }}>
                  Exam Completed!
                </h2>
                <p className="text-muted text-sm mb-3">
                  Thank you, <strong style={{ color: 'var(--color-text)' }}>{state?.participant_name}</strong>. Your responses have been securely submitted and graded.
                </p>
                <div className="alert alert-success mb-3">
                  ✅ Answers evaluated server-side. Real-time standings are updating.
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                id="view-leaderboard-btn"
                className="btn btn-primary"
                onClick={() => navigate('/leaderboard/' + (questions[0] ? sessionId : ''))}
              >
                🏆 View Live Leaderboard
              </button>
            </div>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="app-layout">
        {/* Offline Warning Banner */}
        {isOffline && (
          <div
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 2px 12px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <span>⚠️</span>
            <span>Network disconnected. Your server-authoritative timer continues. Answers will sync once reconnected.</span>
          </div>
        )}

        {/* ——— Exam Header ——— */}
        <nav className="navbar">
          <BrandLogo size="sm" showTagline={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="text-muted text-sm">
              Candidate: <strong style={{ color: 'var(--color-text)' }}>{state?.participant_name}</strong>
            </span>
          </div>
        </nav>

        <div className="exam-header">
          <div>
            <div className="exam-title">Question {globalIndex + 1} of {totalCount}</div>
            <div style={{ marginTop: 6 }}>
              <div className="progress-bar-wrap" style={{ width: 220 }}>
                <div className="progress-bar-fill" style={{ width: `${(answeredCount / Math.max(1, totalCount)) * 100}%` }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="text-sm text-muted">{answeredCount}/{totalCount} answered</span>
            {/* Countdown Timer with Attention Alert */}
            <div className={`timer-wrapper ${timer.isCritical ? 'pulse-danger' : timer.isWarning ? 'pulse-warning' : ''}`}>
              <span className="timer-icon">⏱</span>
              <div>
                <div
                  className={`timer-display ${timer.isCritical ? 'critical' : timer.isWarning ? 'warning' : ''}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {timer.displayTime}
                </div>
                <div className="timer-label">Remaining</div>
              </div>
            </div>
          </div>
        </div>

        {/* ——— Main Content ——— */}
        <div style={{ display: 'flex', flex: 1, gap: 24, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          {/* Question Area */}
          <div style={{ flex: 1 }}>
            {loadingQ ? (
              <div className="question-card">
                <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 60, marginBottom: 24 }} />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 54, marginBottom: 12, borderRadius: 10 }} />
                ))}
              </div>
            ) : currentQuestion ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="question-card"
                >
                  <div className="question-number">Question {globalIndex + 1}</div>
                  <div className="question-meta">
                    <span className="badge badge-primary">{currentQuestion.topic}</span>
                    <span className="badge badge-neutral">{currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}</span>
                    <span className="text-muted text-xs font-mono" style={{ marginLeft: 'auto' }}>
                      Press A-D or 1-4
                    </span>
                  </div>
                  <div className="question-text">{currentQuestion.question}</div>

                  <div className="option-list">
                    {Object.entries(currentQuestion.options).map(([key, text]) => {
                      const isSelected = answers[currentQuestion.id] === key;
                      return (
                        <motion.div
                          key={key}
                          id={`option-${currentQuestion.id}-${key}`}
                          className={`option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectOption(currentQuestion.id, key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectOption(currentQuestion.id, key);
                            }
                          }}
                          role="radio"
                          tabIndex={0}
                          aria-checked={isSelected}
                          whileTap={{ scale: 0.985 }}
                          whileHover={{ scale: 1.006 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="option-key">{key.toUpperCase()}</div>
                          <div className="option-text">{text}</div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Navigation Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                    <button
                      id="prev-question-btn"
                      className="btn btn-secondary"
                      onClick={() => {
                        if (currentQ > 0) { setCurrentQ(currentQ - 1); questionStartTimeRef.current = Date.now(); }
                        else if (currentPage > 1) loadPage(currentPage - 1);
                      }}
                      disabled={currentPage === 1 && currentQ === 0}
                    >
                      ← Previous
                    </button>
                    <button
                      id="next-question-btn"
                      className="btn btn-primary"
                      onClick={() => {
                        if (currentQ < questions.length - 1) { setCurrentQ(currentQ + 1); questionStartTimeRef.current = Date.now(); }
                        else if (currentPage < totalPages) loadPage(currentPage + 1);
                      }}
                      disabled={currentPage === totalPages && currentQ === questions.length - 1}
                    >
                      Next →
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : null}

            {/* Submit button */}
            <div style={{ marginTop: 20 }}>
              <button
                id="submit-exam-btn"
                className="btn btn-danger btn-full btn-lg"
                onClick={() => setSubmitConfirm(true)}
                disabled={phase === 'submitting'}
              >
                {phase === 'submitting' ? <><div className="btn-spinner" />Submitting...</> : '🏁 Submit Exam'}
              </button>
            </div>
          </div>

          {/* Question Navigator Sidebar */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ marginBottom: 10, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Question Map
            </div>
            <div className="question-nav">
              {Array.from({ length: totalCount }, (_, i) => {
                const pageNum = Math.floor(i / 10) + 1;
                const qIdx = i % 10;
                const isCurrent = globalIndex === i;
                const isAnswered = answeredIndices.has(i);
                return (
                  <button
                    key={i}
                    className={`q-nav-btn ${isCurrent ? 'current' : isAnswered ? 'answered' : ''}`}
                    onClick={() => {
                      if (pageNum !== currentPage) loadPage(pageNum).then(() => setCurrentQ(qIdx));
                      else setCurrentQ(qIdx);
                    }}
                    aria-label={`Question ${i + 1} ${isAnswered ? '(Answered)' : '(Unanswered)'}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: 'linear-gradient(135deg, #f59e0b, #f97316)', flexShrink: 0 }} />
                <span>Current Question</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(16,185,129,0.2)', border: '1px solid var(--color-success)', flexShrink: 0 }} />
                <span>Answered ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', flexShrink: 0 }} />
                <span>Unanswered ({unansweredCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* ——— Violation Modal with Attention Shake ——— */}
        <AnimatePresence>
          {violation.show && (
            <div className="modal-overlay">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, x: [0, -12, 12, -8, 8, -4, 4, 0] }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.45 }}
                className={`modal ${violation.terminated ? 'modal-danger' : 'modal-warning'}`}
                role="alert"
                aria-live="assertive"
              >
                <div className="modal-icon">{violation.terminated ? '🚫' : '⚠️'}</div>
                <div className="modal-title">
                  {violation.terminated ? 'Session Terminated' : `Violation Warning (${violation.count})`}
                </div>
                <p className="modal-message">{violation.message}</p>
                {!violation.terminated && (
                  <button
                    id="violation-dismiss-btn"
                    className="btn btn-primary btn-full"
                    onClick={() => setViolation((v) => ({ ...v, show: false }))}
                  >
                    I Understand — Continue Exam
                  </button>
                )}
                {violation.terminated && (
                  <div className="alert alert-error">Your exam session has ended. Please contact your administrator.</div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ——— Submit Confirm Modal ——— */}
        <AnimatePresence>
          {submitConfirm && (
            <div className="modal-overlay">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="modal"
              >
                <div className="modal-icon">🏁</div>
                <div className="modal-title">Confirm Exam Submission</div>
                <div className="modal-message">
                  <p style={{ marginBottom: 12 }}>
                    You have answered <strong style={{ color: 'var(--color-success)' }}>{answeredCount}</strong> of <strong>{totalCount}</strong> questions.
                  </p>
                  {unansweredCount > 0 ? (
                    <div className="alert alert-warning mb-2" style={{ textAlign: 'left' }}>
                      ⚠️ <strong>{unansweredCount} questions</strong> are still unanswered!
                    </div>
                  ) : (
                    <div className="alert alert-success mb-2" style={{ textAlign: 'left' }}>
                      ✨ All questions have been answered.
                    </div>
                  )}
                  <p className="text-muted text-xs">
                    Once submitted, answers cannot be edited and your final score will be published.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button id="submit-cancel-btn" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSubmitConfirm(false)}>
                    ← Continue Exam
                  </button>
                  <button id="submit-confirm-btn" className="btn btn-danger" style={{ flex: 1 }} onClick={handleSubmit}>
                    ✅ Final Submit
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatedPage>
  );
}
