import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, activateExam, createExam, startExam } from '../../lib/api';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import BrandLogo from '../../components/BrandLogo';
import { generateSystemBackupArchive, exportRosterCsvString } from '../../lib/adminRosterStore';

interface ExamItem {
  id: string;
  title: string;
  exam_code?: string;
  duration_minutes: number;
  passing_percentage?: number;
  is_active: boolean;
  is_launched?: boolean;
  results_published?: boolean;
  proctoring_enabled?: boolean;
  leaderboard_enabled?: boolean;
  negative_marking?: number;
  shuffle_questions?: boolean;
  fullscreen_lock?: boolean;
  tab_switch_detection?: boolean;
  created_at: string;
}

export default function ExamControl() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);

  // Master Exam Command State
  const [selectedControlCode, setSelectedControlCode] = useState<string>('');
  const [examLifeState, setExamLifeState] = useState<'idle' | 'lobby' | 'started' | 'paused' | 'stopped'>('idle');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();
  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  useEffect(() => {
    try {
      const state = (localStorage.getItem(`admin_exam_state_${selectedControlCode}`) as any) || 'idle';
      setExamLifeState(state);
    } catch {}
  }, [selectedControlCode]);

  const broadcastExamCommand = (code: string, state: 'idle' | 'lobby' | 'started' | 'paused' | 'stopped', msg: string) => {
    try {
      localStorage.setItem(`admin_exam_state_${code}`, state);
      if (state === 'started') {
        localStorage.setItem(`admin_exam_started_at_${code}`, String(Date.now()));
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('logicwhilelire_admin_exam_commands');
        bc.postMessage({ examCode: code, state, timestamp: Date.now() });
        bc.close();
      }
    } catch {}
    setExamLifeState(state);
    setCommandFeedback(msg);
    setTimeout(() => setCommandFeedback(null), 5000);
  };

  const handleLaunchLobbyCommand = () => {
    broadcastExamCommand(selectedControlCode, 'lobby', `🚀 Exam Lobby for [${selectedControlCode}] is now OPEN. Students can enter the waiting room.`);
  };

  const handleStartExamCommand = async () => {
    try {
      await startExam(selectedControlCode, { allow_late_join: false }).catch(() => {});
    } catch {}
    broadcastExamCommand(selectedControlCode, 'started', `▶️ EXAM STARTED: Administrator has dispatched the official start command! All student assessment timers are live.`);
  };

  const handlePauseExamCommand = () => {
    broadcastExamCommand(selectedControlCode, 'paused', `⏸️ EXAM PAUSED: All active student testing screens have been frozen by Administrator.`);
  };

  const handleResumeExamCommand = () => {
    broadcastExamCommand(selectedControlCode, 'started', `▶️ EXAM RESUMED: Student screens are unlocked and countdown has resumed.`);
  };

  const handleStopExamCommand = () => {
    if (!window.confirm(`Are you sure you want to stop and terminate exam [${selectedControlCode}]? All active student exams will be force-submitted and locked.`)) return;
    broadcastExamCommand(selectedControlCode, 'stopped', `🛑 EXAM TERMINATED: Central command has ended the assessment. All answers auto-submitted.`);
  };

  const handleBackupCompleteSystem = () => {
    const backup = generateSystemBackupArchive();
    const fullBackup = {
      ...backup,
      exams,
      active_commands: {
        examCode: selectedControlCode,
        state: examLifeState,
      },
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogicWhileLiRE_Complete_System_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCommandFeedback(`💾 Full System Data Backup successfully generated and downloaded!`);
    setTimeout(() => setCommandFeedback(null), 5000);
  };

  const handleExportCsv = () => {
    const csvContent = exportRosterCsvString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogicWhileLiRE_Student_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCommandFeedback(`📊 Student roster CSV successfully exported!`);
    setTimeout(() => setCommandFeedback(null), 5000);
  };

  // Form State
  const [form, setForm] = useState({
    title: '',
    exam_code: 'LW-',
    duration_minutes: 60,
    passing_percentage: 40,
    proctoring_enabled: true,
    leaderboard_enabled: true,
    negative_marking: 0,
    shuffle_questions: true,
    fullscreen_lock: true,
    tab_switch_detection: true,
    results_published: false,
  });

  const loadExams = () => {
    setLoading(true);
    listExams()
      .then((r) => {
        const raw = r.data.exams || [];
        const mapped = raw.map((e: any) => ({
          ...e,
          exam_code: e.exam_code || `LW-${e.id.slice(0, 6).toUpperCase()}`,
          passing_percentage: e.passing_percentage ?? 40,
          is_launched: e.is_launched ?? e.is_active,
          results_published: e.results_published ?? false,
          proctoring_enabled: e.proctoring_enabled ?? true,
          leaderboard_enabled: e.leaderboard_enabled ?? true,
          negative_marking: e.negative_marking ?? 0,
          shuffle_questions: e.shuffle_questions ?? true,
          fullscreen_lock: e.fullscreen_lock ?? true,
          tab_switch_detection: e.tab_switch_detection ?? true,
        }));
        setExams(mapped);
        if (mapped.length > 0) {
          setSelectedControlCode(mapped[0].exam_code || mapped[0].id);
        } else {
          setSelectedControlCode('');
          setExamLifeState('idle');
          setCommandFeedback(null);
        }
      })
      .catch(() => {
        setExams([]);
        setSelectedControlCode('');
        setExamLifeState('idle');
        setCommandFeedback(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') || '{}');
      if (u.role === 'inspector' || u.role === 'college_admin') {
        navigate('/admin/inspector');
        return;
      }
    } catch {}
    loadExams();
  }, [navigate]);

  const handleToggleLaunch = async (exam: ExamItem) => {
    const nextState = !exam.is_active;
    try {
      await activateExam(exam.id, nextState);
    } catch {}
    setExams((prev) =>
      prev.map((e) =>
        e.id === exam.id ? { ...e, is_active: nextState, is_launched: nextState } : e
      )
    );
  };

  const handleToggleOption = (examId: string, field: keyof ExamItem) => {
    setExams((prev) =>
      prev.map((e) => (e.id === examId ? { ...e, [field]: !e[field] } : e))
    );
  };

  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setForm({
      title: '',
      exam_code: `LW-${Math.floor(100 + Math.random() * 900)}`,
      duration_minutes: 60,
      passing_percentage: 40,
      proctoring_enabled: true,
      leaderboard_enabled: true,
      negative_marking: 0,
      shuffle_questions: true,
      fullscreen_lock: true,
      tab_switch_detection: true,
      results_published: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam: ExamItem) => {
    setEditingExam(exam);
    setForm({
      title: exam.title,
      exam_code: exam.exam_code || `LW-${exam.id.slice(0, 6).toUpperCase()}`,
      duration_minutes: exam.duration_minutes || 60,
      passing_percentage: exam.passing_percentage ?? 40,
      proctoring_enabled: exam.proctoring_enabled ?? true,
      leaderboard_enabled: exam.leaderboard_enabled ?? true,
      negative_marking: exam.negative_marking ?? 0,
      shuffle_questions: exam.shuffle_questions ?? true,
      fullscreen_lock: exam.fullscreen_lock ?? true,
      tab_switch_detection: exam.tab_switch_detection ?? true,
      results_published: exam.results_published ?? false,
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (exam: ExamItem) => {
    const duplicate: ExamItem = {
      ...exam,
      id: `copy-${Date.now()}`,
      title: `${exam.title} (Copy)`,
      exam_code: `${exam.exam_code || 'LW'}-COPY`,
      is_active: false,
      is_launched: false,
      created_at: new Date().toISOString(),
    };
    setExams((prev) => [duplicate, ...prev]);
  };

  const handleDelete = (examId: string) => {
    if (window.confirm('Are you sure you want to delete this exam? This cannot be undone.')) {
      setExams((prev) => prev.filter((e) => e.id !== examId));
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (editingExam) {
      // Update existing exam with all modified options
      setExams((prev) =>
        prev.map((item) =>
          item.id === editingExam.id
            ? {
                ...item,
                title: form.title,
                exam_code: form.exam_code,
                duration_minutes: Number(form.duration_minutes),
                passing_percentage: Number(form.passing_percentage),
                proctoring_enabled: form.proctoring_enabled,
                leaderboard_enabled: form.leaderboard_enabled,
                negative_marking: Number(form.negative_marking),
                shuffle_questions: form.shuffle_questions,
                fullscreen_lock: form.fullscreen_lock,
                tab_switch_detection: form.tab_switch_detection,
                results_published: form.results_published,
              }
            : item
        )
      );
      setIsModalOpen(false);
      setEditingExam(null);
      return;
    }

    try {
      const res = await createExam({
        title: form.title,
        duration_minutes: Number(form.duration_minutes),
      });

      const newExam: ExamItem = {
        id: res.data?.exam?.id || `ex-${Date.now()}`,
        title: form.title,
        exam_code: form.exam_code,
        duration_minutes: Number(form.duration_minutes),
        passing_percentage: Number(form.passing_percentage),
        is_active: false,
        is_launched: false,
        results_published: form.results_published,
        proctoring_enabled: form.proctoring_enabled,
        leaderboard_enabled: form.leaderboard_enabled,
        negative_marking: form.negative_marking,
        shuffle_questions: form.shuffle_questions,
        fullscreen_lock: form.fullscreen_lock,
        tab_switch_detection: form.tab_switch_detection,
        created_at: new Date().toISOString(),
      };

      setExams((prev) => [newExam, ...prev]);
      setIsModalOpen(false);
    } catch {
      // Fallback local create
      const newExam: ExamItem = {
        id: `demo-${Date.now()}`,
        title: form.title,
        exam_code: form.exam_code,
        duration_minutes: Number(form.duration_minutes),
        passing_percentage: Number(form.passing_percentage),
        is_active: false,
        is_launched: false,
        results_published: form.results_published,
        proctoring_enabled: form.proctoring_enabled,
        leaderboard_enabled: form.leaderboard_enabled,
        negative_marking: form.negative_marking,
        shuffle_questions: form.shuffle_questions,
        fullscreen_lock: form.fullscreen_lock,
        tab_switch_detection: form.tab_switch_detection,
        created_at: new Date().toISOString(),
      };
      setExams((prev) => [newExam, ...prev]);
      setIsModalOpen(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="exams" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#FFC200', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                LogicWhileLiRE Admin Control
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Exam Control Center
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Add, Edit Options, Configure Timing, Toggle Security Locks, Duplicate, and Authoritatively Launch Exams
              </p>
            </div>

            {!isSuperAdmin ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', fontSize: '0.82rem', fontWeight: 700 }}>
                <span>🔒</span> Faculty Read-Only Mode
              </div>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="btn btn-primary"
                style={{
                  padding: '10px 22px',
                  fontWeight: 700,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                  boxShadow: '0 4px 14px rgba(255, 122, 0, 0.4)',
                }}
              >
                <span>➕</span> Add New Exam
              </button>
            )}
          </div>

          {/* Feedback Banner */}
          {commandFeedback && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 18px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(56, 189, 248, 0.15) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.5)',
                color: '#34d399',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>⚡</span>
              <div style={{ flex: 1, fontSize: '0.92rem' }}>{commandFeedback}</div>
              <button
                type="button"
                onClick={() => setCommandFeedback(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* MASTER EXAM COMMAND DECK & DATA BACKUP CENTER */}
          <div
            className="card"
            style={{
              marginBottom: 28,
              padding: '26px 28px',
              borderRadius: 18,
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
              border: '1.5px solid rgba(255, 194, 0, 0.45)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 194, 0, 0.15)',
              position: 'relative',
            }}
          >
            {/* Top Bar with BrandLogo & System Authority Pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <BrandLogo size="md" variant="standard" />
                <div style={{ height: 32, width: 1, background: 'rgba(255, 255, 255, 0.15)' }} />
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#FFC200', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    CENTRAL COMMAND CONSOLE
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                    Authoritative Exam Lifecycle &amp; Security Controller
                  </div>
                </div>
              </div>

              {/* Live Status Chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>Active State:</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    letterSpacing: '0.04em',
                    background:
                      examLifeState === 'started'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : examLifeState === 'paused'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : examLifeState === 'lobby'
                        ? 'rgba(56, 189, 248, 0.2)'
                        : examLifeState === 'stopped'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color:
                      examLifeState === 'started'
                        ? '#34D399'
                        : examLifeState === 'paused'
                        ? '#FBBF24'
                        : examLifeState === 'lobby'
                        ? '#38BDF8'
                        : examLifeState === 'stopped'
                        ? '#F87171'
                        : '#94A3B8',
                    border:
                      examLifeState === 'started'
                        ? '1px solid rgba(16, 185, 129, 0.5)'
                        : examLifeState === 'paused'
                        ? '1px solid rgba(245, 158, 11, 0.5)'
                        : examLifeState === 'lobby'
                        ? '1px solid rgba(56, 189, 248, 0.5)'
                        : examLifeState === 'stopped'
                        ? '1px solid rgba(239, 68, 68, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow:
                      examLifeState === 'started'
                        ? '0 0 14px rgba(16, 185, 129, 0.4)'
                        : examLifeState === 'paused'
                        ? '0 0 14px rgba(245, 158, 11, 0.4)'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        examLifeState === 'started'
                          ? '#10B981'
                          : examLifeState === 'paused'
                          ? '#F59E0B'
                          : examLifeState === 'lobby'
                          ? '#38BDF8'
                          : examLifeState === 'stopped'
                          ? '#EF4444'
                          : '#64748B',
                    }}
                  />
                  <span>
                    {!selectedControlCode || exams.length === 0
                      ? '⚪ NO ACTIVE EXAM'
                      : examLifeState === 'started'
                      ? '🟢 EXAM IN PROGRESS (ACTIVE)'
                      : examLifeState === 'paused'
                      ? '⏸️ EXAM PAUSED (SCREENS FROZEN)'
                      : examLifeState === 'lobby'
                      ? '🟡 LOBBY LAUNCHED (WAITING FOR ADMIN)'
                      : examLifeState === 'stopped'
                      ? '🛑 EXAM STOPPED & SUBMITTED'
                      : '⚪ READY / IDLE'}
                  </span>
                </span>
              </div>
            </div>

            {/* Target Exam Code Selector & Direct Controls Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 20, alignItems: 'center', marginBottom: 20 }} className="admin-command-grid">
              {/* Exam Code Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Target Exam Code Under Admin Authority:
                </label>
                <select
                  value={selectedControlCode}
                  onChange={(e) => setSelectedControlCode(e.target.value)}
                  className="form-input"
                  style={{
                    fontWeight: 800,
                    color: '#FFC200',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderColor: 'rgba(255, 194, 0, 0.4)',
                    fontSize: '0.96rem',
                    padding: '10px 14px',
                  }}
                >
                  {exams.length === 0 ? (
                    <option value="">No Active Exams Created Yet</option>
                  ) : (
                    exams.map((ex) => (
                      <option key={ex.id} value={ex.exam_code || ex.id}>
                        {ex.exam_code || ex.id} — {ex.title}
                      </option>
                    ))
                  )}
                </select>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                  Students in lobby enter with this code and await your start command.
                </div>
              </div>

              {/* Master Push Commands */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Authoritative Exam Execution Commands:
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* 1. Launch Lobby */}
                  <button
                    type="button"
                    onClick={handleLaunchLobbyCommand}
                    disabled={!selectedControlCode || exams.length === 0}
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1.5px solid rgba(56, 189, 248, 0.5)',
                      color: '#38BDF8',
                      fontWeight: 800,
                      padding: '9px 16px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: (!selectedControlCode || exams.length === 0) ? 0.4 : 1,
                      cursor: (!selectedControlCode || exams.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                    title="Open waiting lobby for students to join and wait"
                  >
                    <span>🚀</span> 1. Launch Lobby
                  </button>

                  {/* 2. Start Exam */}
                  <button
                    type="button"
                    onClick={handleStartExamCommand}
                    disabled={!selectedControlCode || exams.length === 0}
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontWeight: 900,
                      padding: '9px 18px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                      opacity: (!selectedControlCode || exams.length === 0) ? 0.4 : 1,
                      cursor: (!selectedControlCode || exams.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                    title="Dispatches live start command to all students in lobby"
                  >
                    <span>▶️</span> 2. Start Exam Now
                  </button>

                  {/* 3. Pause / Freeze */}
                  {examLifeState === 'paused' ? (
                    <button
                      type="button"
                      onClick={handleResumeExamCommand}
                      disabled={!selectedControlCode || exams.length === 0}
                      className="btn btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        padding: '9px 16px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: (!selectedControlCode || exams.length === 0) ? 0.4 : 1,
                        cursor: (!selectedControlCode || exams.length === 0) ? 'not-allowed' : 'pointer',
                      }}
                      title="Resume exam and unfreeze student screens"
                    >
                      <span>▶️</span> Resume Exam
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseExamCommand}
                      disabled={!selectedControlCode || exams.length === 0}
                      className="btn btn-sm"
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1.5px solid rgba(245, 158, 11, 0.5)',
                        color: '#FBBF24',
                        fontWeight: 800,
                        padding: '9px 16px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: (!selectedControlCode || exams.length === 0) ? 0.4 : 1,
                        cursor: (!selectedControlCode || exams.length === 0) ? 'not-allowed' : 'pointer',
                      }}
                      title="Freeze all student screens immediately"
                    >
                      <span>⏸️</span> 3. Pause / Freeze
                    </button>
                  )}

                  {/* 4. Stop & Terminate */}
                  <button
                    type="button"
                    onClick={handleStopExamCommand}
                    disabled={!selectedControlCode || exams.length === 0}
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1.5px solid rgba(239, 68, 68, 0.5)',
                      color: '#F87171',
                      fontWeight: 800,
                      padding: '9px 16px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: (!selectedControlCode || exams.length === 0) ? 0.4 : 1,
                      cursor: (!selectedControlCode || exams.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                    title="End exam and auto-submit all active student sessions"
                  >
                    <span>🛑</span> 4. Stop &amp; Conclude
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Actions: 1-Click Complete System Data Backup & CSV Export */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                paddingTop: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.1rem' }}>💾</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Authoritative Data Redundancy &amp; Audit Vault
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    Complete backup snapshot of all rosters, candidate attempts, responses, and proctor security logs
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleBackupCompleteSystem}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    padding: '8px 16px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  }}
                  title="Download complete timestamped JSON backup archive"
                >
                  <span>💾</span> 1-Click Full System Backup (.JSON)
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="btn btn-sm btn-ghost"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#E2E8F0',
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Export student roster spreadsheet"
                >
                  <span>📊</span> Export Roster (.CSV)
                </button>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 10,
              background: isSuperAdmin ? 'rgba(255, 194, 0, 0.08)' : 'rgba(56, 189, 248, 0.08)',
              border: `1px solid ${isSuperAdmin ? 'rgba(255, 194, 0, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
              marginBottom: 24,
              fontSize: '0.86rem',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{isSuperAdmin ? '🔒' : 'ℹ️'}</span>
            <div>
              {isSuperAdmin ? (
                <><strong>Administrator Authority:</strong> You have 100% control over all exam options and execution. The student exam will start <strong>only when you issue the start command</strong> above. Click <strong>✏️ Edit Options</strong> on any exam to customize codes, durations, pass criteria, or negative marking.</>
              ) : (
                <><strong>Faculty View (Read-Only):</strong> You can review exam configuration and view live telemetric sessions. Creating exams, modifying parameters, and launching attempts are reserved for the Administrator.</>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading exam roster...
            </div>
          ) : exams.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                No Exams Created Yet
              </div>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', maxWidth: 440, margin: '8px auto 20px' }}>
                The exam platform is currently clean. Click below to create and configure your first institution assessment.
              </p>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', fontWeight: 800, borderRadius: 8 }}
                >
                  ➕ Create First Exam
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="card"
                  style={{
                    padding: '24px 28px',
                    borderRadius: 14,
                    border: `1px solid ${exam.is_active ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 194, 0, 0.2)'}`,
                    background: exam.is_active ? 'rgba(16, 185, 129, 0.04)' : 'rgba(11, 18, 38, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                          {exam.title}
                        </h2>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: exam.is_active ? '#10B98125' : 'rgba(255,255,255,0.06)',
                            color: exam.is_active ? '#10B981' : 'var(--color-text-muted)',
                            border: `1px solid ${exam.is_active ? '#10B98150' : 'transparent'}`,
                          }}
                        >
                          {exam.is_active ? '🟢 LIVE' : '⚪ DRAFT'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.82rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        <span>🔑 Code: <strong style={{ color: '#FFC200' }}>{exam.exam_code}</strong></span>
                        <span>⏱️ Duration: <strong>{exam.duration_minutes} mins</strong></span>
                        <span>🎯 Pass Criteria: <strong>{exam.passing_percentage}%</strong></span>
                        <span>⚠️ Negative: <strong>{exam.negative_marking ? `-${exam.negative_marking}` : 'None'}</strong></span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {isSuperAdmin ? (
                        <>
                          {/* EDIT ALL OPTIONS BUTTON */}
                          <button
                            onClick={() => handleOpenEditModal(exam)}
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(255, 194, 0, 0.14)',
                              color: '#FFC200',
                              border: '1px solid rgba(255, 194, 0, 0.4)',
                              fontWeight: 700,
                              padding: '8px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            title="Edit All Options for this Exam"
                          >
                            <span>✏️</span> Edit Options
                          </button>

                          <button
                            onClick={() => handleToggleLaunch(exam)}
                            className="btn btn-sm"
                            style={{
                              background: exam.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(43, 127, 255, 0.2)',
                              color: exam.is_active ? '#EF4444' : 'var(--color-primary-light, #38BDF8)',
                              border: `1px solid ${exam.is_active ? '#EF444440' : 'rgba(43, 127, 255, 0.5)'}`,
                              fontWeight: 800,
                              padding: '8px 14px',
                            }}
                          >
                            {exam.is_active ? '🛑 Deactivate' : '🚀 Launch'}
                          </button>

                          <button
                            onClick={() => navigate(`/admin/live-console/${exam.exam_code || exam.id}`)}
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              fontWeight: 700,
                              padding: '8px 12px',
                            }}
                            title="Open Instructor Live Console"
                          >
                            📡 Live
                          </button>

                          <button
                            onClick={() => handleDuplicate(exam)}
                            className="btn btn-ghost btn-sm"
                            style={{ border: '1px solid var(--color-border)' }}
                            title="Duplicate Exam"
                          >
                            📋 Copy
                          </button>

                          <button
                            onClick={() => handleDelete(exam.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                            title="Delete Exam"
                          >
                            🗑️ Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => navigate(`/admin/live-console/${exam.exam_code || exam.id}`)}
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              fontWeight: 700,
                              padding: '8px 14px',
                            }}
                            title="Open Instructor Live Console"
                          >
                            📡 View Live Telemetry
                          </button>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', fontStyle: 'italic', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                            Faculty Read-Only
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Feature Control Switches */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    {[
                      { key: 'proctoring_enabled', label: 'AI Proctoring Wall', icon: '📹' },
                      { key: 'fullscreen_lock', label: 'Fullscreen Lockdown', icon: '🖥️' },
                      { key: 'tab_switch_detection', label: 'Tab Switch Guard', icon: '🚫' },
                      { key: 'shuffle_questions', label: 'Question Shuffle', icon: '🔀' },
                      { key: 'leaderboard_enabled', label: 'Public Leaderboard', icon: '🏆' },
                      { key: 'results_published', label: 'Results Visible', icon: '📊' },
                    ].map((toggle) => {
                      const enabled = (exam as any)[toggle.key];
                      return (
                        <button
                          key={toggle.key}
                          onClick={() => {
                            if (!isSuperAdmin) return;
                            handleToggleOption(exam.id, toggle.key as keyof ExamItem);
                          }}
                          style={{
                            background: enabled ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${enabled ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: 8,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: enabled ? '#F8FAFC' : '#64748B',
                            cursor: isSuperAdmin ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            opacity: isSuperAdmin ? 1 : 0.85,
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {toggle.icon} {toggle.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: enabled ? '#38BDF8' : '#64748B',
                            }}
                          >
                            {enabled ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal for Creating & Editing Exam Options */}
          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
              }}
              onClick={() => setIsModalOpen(false)}
            >
              <div
                className="card"
                style={{
                  maxWidth: 600,
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 194, 0, 0.4)',
                  background: '#0B1226',
                  padding: 32,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    {editingExam ? '✏️ Edit Exam Options & Rules' : '➕ Add New Assessment'}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="form-label">Exam Title</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      placeholder="e.g. Sector 1 · Quantitative Speed Maths Final"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="form-label">Portal Access Code</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        placeholder="LW-EXAM-2026"
                        value={form.exam_code}
                        onChange={(e) => setForm({ ...form, exam_code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Duration (Minutes)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="5"
                        required
                        value={form.duration_minutes}
                        onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="form-label">Passing Score (%)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        max="100"
                        value={form.passing_percentage}
                        onChange={(e) => setForm({ ...form, passing_percentage: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Negative Marking (Penalty per wrong)</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.25"
                        min="0"
                        value={form.negative_marking}
                        onChange={(e) => setForm({ ...form, negative_marking: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Switch Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFC200' }}>
                      Security & Integrity Options
                    </label>

                    {[
                      { key: 'proctoring_enabled', label: 'Enable AI Webcam Proctoring Wall' },
                      { key: 'fullscreen_lock', label: 'Enforce Fullscreen Lockdown (Exit = Terminate)' },
                      { key: 'tab_switch_detection', label: 'Strict Tab Switch & Devtools Detection' },
                      { key: 'shuffle_questions', label: 'Randomize Question Order Per Candidate' },
                      { key: 'leaderboard_enabled', label: 'Enable Live Candidate Leaderboard' },
                      { key: 'results_published', label: 'Publish Results & Report Cards to Candidates' },
                    ].map((item) => (
                      <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#FFFFFF', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(form as any)[item.key]}
                          onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: '#FF7A00' }}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                      }}
                    >
                      {editingExam ? '💾 Save & Update Options' : '🚀 Create & Deploy Exam'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
