import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createExam } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';

export default function CreateExamPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    duration_minutes: 60,
    start_time: '',
    admin_email: '',
    is_leaderboard_public: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; title: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await createExam({
        title: form.title,
        duration_minutes: form.duration_minutes,
        start_time: form.start_time || undefined,
        admin_email: form.admin_email.trim() || undefined,
        is_leaderboard_public: form.is_leaderboard_public,
      });
      setSuccess({ id: res.data.exam.id, title: res.data.exam.title });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page-center">
        <div className="card animate-slide-up text-center" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Exam Created!</h2>
          <p className="text-muted mb-2"><strong>"{success.title}"</strong> has been created.</p>
          <p className="text-sm text-muted mb-3">Exam ID: <code className="font-mono" style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>{success.id}</code></p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/admin/import?examId=${success.id}`)}>
              📥 Import Questions
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
              ← Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ marginBottom: 24 }}>
          <BrandLogo size="sm" />
        </div>
        <button className="admin-nav-item" onClick={() => navigate('/admin/dashboard')}>📊 Dashboard</button>
        <button className="admin-nav-item active">➕ Create Exam</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/import')}>📥 Import Questions</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/sessions')}>👥 Sessions</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/reports')}>📈 Reports</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/analytics')}>🔬 Analytics</button>
      </aside>

      <main className="admin-content">
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Create New Exam</h1>
        <p className="text-muted text-sm mb-3">Set up a new exam. You can import questions after creation.</p>

        <div className="card" style={{ maxWidth: 560 }}>
          {error && <div className="alert alert-error mb-2">⚠️ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="exam-title">Exam Title</label>
              <input
                id="exam-title"
                className="form-input"
                type="text"
                placeholder="e.g. Mid-Term Computer Science Exam 2024"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="exam-duration">Duration (minutes)</label>
              <input
                id="exam-duration"
                className="form-input"
                type="number"
                min={1}
                max={480}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })}
              />
              <span className="text-xs text-muted mt-1">Between 1 and 480 minutes</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="exam-start-time">Scheduled Start Time (optional)</label>
              <input
                id="exam-start-time"
                className="form-input"
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-xs text-muted mt-1">If set, the session timer starts from this time. Leave blank to start when participant begins.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="exam-admin-email">Admin Alert Email (optional)</label>
              <input
                id="exam-admin-email"
                className="form-input"
                type="email"
                placeholder="proctor-admin@institution.edu"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
              />
              <span className="text-xs text-muted mt-1">Receives security alerts when sessions are terminated for proctoring violations.</span>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input
                id="exam-leaderboard-public"
                type="checkbox"
                checked={form.is_leaderboard_public}
                onChange={(e) => setForm({ ...form, is_leaderboard_public: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#f59e0b', cursor: 'pointer' }}
              />
              <label htmlFor="exam-leaderboard-public" className="text-sm" style={{ cursor: 'pointer', margin: 0 }}>
                <strong>Public Leaderboard</strong> — Candidate ranks visible on public standings & emailed result cards
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button id="create-exam-btn" type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><div className="btn-spinner" />Creating...</> : '✅ Create Exam'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/dashboard')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
    </AnimatedPage>
  );
}
