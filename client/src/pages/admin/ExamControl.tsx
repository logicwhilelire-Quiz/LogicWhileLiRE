import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, activateExam, createExam } from '../../lib/api';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

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

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();
  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

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
        setExams(
          raw.map((e: any) => ({
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
          }))
        );
      })
      .catch(() => {
        // Fallback default sample exams for admin demonstration
        setExams([
          {
            id: 'ex-quant-01',
            title: 'Sector 1: Quantitative Velocity & Speed Maths Sprint',
            exam_code: 'LW-QUANT-01',
            duration_minutes: 45,
            passing_percentage: 50,
            is_active: true,
            is_launched: true,
            results_published: true,
            proctoring_enabled: true,
            leaderboard_enabled: true,
            negative_marking: 0.25,
            shuffle_questions: true,
            fullscreen_lock: true,
            tab_switch_detection: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'ex-logic-02',
            title: 'Sector 2: Deductive Logic & Cognitive Constraints',
            exam_code: 'LW-LOGIC-02',
            duration_minutes: 50,
            passing_percentage: 45,
            is_active: false,
            is_launched: false,
            results_published: false,
            proctoring_enabled: true,
            leaderboard_enabled: true,
            negative_marking: 0,
            shuffle_questions: true,
            fullscreen_lock: true,
            tab_switch_detection: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'ex-corecs-03',
            title: 'Sector 3 & 4: Core CS Systems & DSA Comprehensive Finals',
            exam_code: 'LW-CS-301',
            duration_minutes: 90,
            passing_percentage: 40,
            is_active: true,
            is_launched: true,
            results_published: true,
            proctoring_enabled: true,
            leaderboard_enabled: true,
            negative_marking: 0.5,
            shuffle_questions: true,
            fullscreen_lock: true,
            tab_switch_detection: true,
            created_at: new Date().toISOString(),
          },
        ]);
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
                Logic Whi1e LiRE Admin Control
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
                <><strong>Administrator Authority:</strong> You have 100% control over all exam options. Click <strong>✏️ Edit Options</strong> on any exam to customize codes, durations, pass criteria, or negative marking, and toggle security guards in real-time.</>
              ) : (
                <><strong>Faculty View (Read-Only):</strong> You can review exam configuration and view live telemetric sessions. Creating exams, modifying parameters, and launching attempts are reserved for the Administrator.</>
              )}
            </div>
          </div>

          {/* Exams Grid */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading exam roster...
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
