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

  // Form State
  const [form, setForm] = useState({
    title: '',
    exam_code: 'GR-',
    duration_minutes: 60,
    passing_percentage: 40,
    proctoring_enabled: true,
    leaderboard_enabled: true,
    negative_marking: 0,
    shuffle_questions: true,
    fullscreen_lock: true,
    tab_switch_detection: true,
  });

  const loadExams = () => {
    setLoading(true);
    listExams()
      .then((r) => {
        const raw = r.data.exams || [];
        setExams(
          raw.map((e: any) => ({
            ...e,
            exam_code: e.exam_code || `GR-${e.id.slice(0, 6).toUpperCase()}`,
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
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();
  }, [navigate]);

  const handleToggleLaunch = async (exam: ExamItem) => {
    const nextState = !exam.is_active;
    await activateExam(exam.id, nextState);
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

  const handleDuplicate = (exam: ExamItem) => {
    const duplicate: ExamItem = {
      ...exam,
      id: `copy-${Date.now()}`,
      title: `${exam.title} (Copy)`,
      exam_code: `${exam.exam_code || 'GR'}-COPY`,
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
        results_published: false,
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
      setForm({
        title: '',
        exam_code: 'GR-',
        duration_minutes: 60,
        passing_percentage: 40,
        proctoring_enabled: true,
        leaderboard_enabled: true,
        negative_marking: 0,
        shuffle_questions: true,
        fullscreen_lock: true,
        tab_switch_detection: true,
      });
    } catch {
      // Fallback local create for demo
      const newExam: ExamItem = {
        id: `demo-${Date.now()}`,
        title: form.title,
        exam_code: form.exam_code,
        duration_minutes: Number(form.duration_minutes),
        passing_percentage: Number(form.passing_percentage),
        is_active: false,
        is_launched: false,
        results_published: false,
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
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Admin Only Access
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Exam Control Center
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Create, Configure, Toggle Security Guards, Duplicate, and Authoritatively Launch Exams
              </p>
            </div>

            <button
              onClick={() => {
                setEditingExam(null);
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span>➕</span> Create New Exam
            </button>
          </div>

          {/* Quick Notice */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 10,
              background: 'rgba(43, 127, 255, 0.08)',
              border: '1px solid rgba(43, 127, 255, 0.25)',
              marginBottom: 24,
              fontSize: '0.86rem',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔒</span>
            <div>
              <strong>Strict Admin Rule:</strong> No exam is ever visible or accessible to candidates until you click the <strong>Launch Button</strong>. You hold 100% control over timing, passing score, and proctoring locks.
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
                    borderRadius: 12,
                    border: `1px solid ${exam.is_active ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border)'}`,
                    background: exam.is_active ? 'rgba(16, 185, 129, 0.03)' : 'rgba(11, 18, 38, 0.65)',
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
                            background: exam.is_active ? '#10B98120' : 'rgba(255,255,255,0.06)',
                            color: exam.is_active ? '#10B981' : 'var(--color-text-muted)',
                            border: `1px solid ${exam.is_active ? '#10B98140' : 'transparent'}`,
                          }}
                        >
                          {exam.is_active ? '🟢 LIVE' : '⚪ DRAFT'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.82rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        <span>🔑 Code: <strong style={{ color: 'var(--color-primary)' }}>{exam.exam_code}</strong></span>
                        <span>⏱️ Duration: <strong>{exam.duration_minutes} mins</strong></span>
                        <span>🎯 Pass Criteria: <strong>{exam.passing_percentage}%</strong></span>
                        <span>⚠️ Negative: <strong>{exam.negative_marking ? `-${exam.negative_marking}` : 'None'}</strong></span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleToggleLaunch(exam)}
                        className="btn btn-sm"
                        style={{
                          background: exam.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(43, 127, 255, 0.2)',
                          color: exam.is_active ? '#EF4444' : 'var(--color-primary)',
                          border: `1px solid ${exam.is_active ? '#EF444440' : 'rgba(43, 127, 255, 0.5)'}`,
                          fontWeight: 800,
                          padding: '8px 16px',
                        }}
                      >
                        {exam.is_active ? '🛑 Deactivate Exam' : '🚀 Launch to Candidates'}
                      </button>

                      <button
                        onClick={() => handleDuplicate(exam)}
                        className="btn btn-ghost btn-sm"
                        style={{ border: '1px solid var(--color-border)' }}
                        title="Duplicate Exam"
                      >
                        📋 Duplicate
                      </button>

                      <button
                        onClick={() => handleDelete(exam.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        title="Delete Exam"
                      >
                        🗑️ Delete
                      </button>
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
                          type="button"
                          onClick={() => handleToggleOption(exam.id, toggle.key as any)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: enabled ? 'rgba(43, 127, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${enabled ? 'rgba(43, 127, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: enabled ? '#FFFFFF' : 'var(--color-text-faint)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          <span>{toggle.icon} {toggle.label}</span>
                          <span style={{ fontSize: '0.72rem', color: enabled ? '#10B981' : '#64748B', fontWeight: 700 }}>
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

          {/* Create Exam Modal */}
          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 8, 20, 0.85)',
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
                  maxWidth: 580,
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: 14,
                  border: '1px solid rgba(43, 127, 255, 0.3)',
                  background: '#0B1226',
                  padding: 32,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    ⚙️ Create Managed Assessment
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
                      placeholder="e.g. Aerospace Engineering & DSA Sprint 2026"
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
                        placeholder="GR-AERO-2026"
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
                      <label className="form-label">Negative Marking (Marks per wrong)</label>
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
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      Security & Integrity Toggles
                    </label>

                    {[
                      { key: 'proctoring_enabled', label: 'Enable AI Webcam Proctoring Wall' },
                      { key: 'fullscreen_lock', label: 'Enforce Fullscreen Lockdown (Exit = Terminate)' },
                      { key: 'tab_switch_detection', label: 'Strict Tab Switch & Devtools Detection' },
                      { key: 'shuffle_questions', label: 'Randomize Question Order Per Candidate' },
                      { key: 'leaderboard_enabled', label: 'Enable Live Candidate Leaderboard' },
                    ].map((item) => (
                      <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#FFFFFF', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(form as any)[item.key]}
                          onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
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
                      style={{ flex: 1, fontWeight: 700 }}
                    >
                      Save & Scaffold Exam
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
