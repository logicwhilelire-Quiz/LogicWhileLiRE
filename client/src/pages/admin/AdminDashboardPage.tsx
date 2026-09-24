import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, activateExam, adminLogout, getQRUrl } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';
import AnimatedCounter from '../../components/AnimatedCounter';

interface Exam {
  id: string;
  title: string;
  duration_minutes: number;
  start_time: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrExamId, setQrExamId] = useState<string | null>(null);

  useEffect(() => {
    listExams()
      .then((r) => setExams(r.data.exams))
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(exam: Exam) {
    await activateExam(exam.id, !exam.is_active);
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, is_active: !exam.is_active } : e))
    );
  }

  async function handleLogout() {
    try {
      await adminLogout();
    } catch (_) {}
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  return (
    <AnimatedPage>
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div style={{ marginBottom: 24 }}>
            <BrandLogo size="sm" />
          </div>

          <div className="admin-sidebar-title">Exam Management</div>
          <button id="nav-dashboard" className="admin-nav-item active" onClick={() => navigate('/admin/dashboard')}>📊 Dashboard</button>
          <button id="nav-create-exam" className="admin-nav-item" onClick={() => navigate('/admin/create-exam')}>➕ Create Exam</button>
          <button id="nav-import" className="admin-nav-item" onClick={() => navigate('/admin/import')}>📥 Import Questions</button>
          <button id="nav-sessions" className="admin-nav-item" onClick={() => navigate('/admin/sessions')}>👥 Sessions</button>
          <button id="nav-reports" className="admin-nav-item" onClick={() => navigate('/admin/reports')}>📈 Reports</button>
          <button id="nav-analytics" className="admin-nav-item" onClick={() => navigate('/admin/analytics')}>🔬 Analytics</button>

          <div style={{ marginTop: 'auto', paddingTop: 24 }}>
            <button id="admin-logout-btn" className="admin-nav-item" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="admin-content">
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>Control Center</h1>
            <p className="text-muted text-sm">Real-time exam management, proctoring monitoring, and export reports.</p>
          </div>

          {/* Animated Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>Total Exams</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                <AnimatedCounter value={exams.length} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid var(--color-success)' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>Active Exams</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-success)' }}>
                <AnimatedCounter value={exams.filter(e => e.is_active).length} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>Server Mode</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b', marginTop: 8 }}>
                ⚡ Server-Authoritative
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>All Assessment Exams</h2>
            <button id="create-exam-quick-btn" className="btn btn-primary btn-sm" onClick={() => navigate('/admin/create-exam')}>
              ➕ New Exam
            </button>
          </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
          </div>
        ) : exams.length === 0 ? (
          <div className="card text-center" style={{ padding: 48 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
            <p className="font-bold mb-1">No exams yet</p>
            <p className="text-muted text-sm mb-2">Create your first exam to get started.</p>
            <button className="btn btn-primary" onClick={() => navigate('/admin/create-exam')}>Create Exam</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="font-bold">{exam.title}</td>
                  <td className="text-muted">{exam.duration_minutes} min</td>
                  <td>
                    <span className={`badge ${exam.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {exam.is_active ? '● Live' : '○ Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        id={`toggle-exam-${exam.id}`}
                        className={`btn btn-sm ${exam.is_active ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => handleToggle(exam)}
                      >
                        {exam.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        id={`qr-exam-${exam.id}`}
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQrExamId(exam.id)}
                      >
                        📷 QR
                      </button>
                      <button
                        id={`leaderboard-exam-${exam.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/leaderboard/${exam.id}`)}
                      >
                        🏆 Leaderboard
                      </button>
                      <button
                        id={`import-exam-${exam.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/admin/import?examId=${exam.id}`)}
                      >
                        📥 Import
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {/* QR Code Modal */}
      {qrExamId && (
        <div className="modal-overlay" onClick={() => setQrExamId(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Enrollment QR Code</h3>
            <p className="text-muted text-sm mb-2">Share this QR code with participants to enroll.</p>
            <img
              src={getQRUrl(qrExamId)}
              alt="Enrollment QR Code"
              style={{ width: 256, height: 256, borderRadius: 12, background: '#fff', padding: 12 }}
            />
            <div className="mt-2">
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/admin/exams/${qrExamId}/qr`}
                download="enrollment-qr.png"
                className="btn btn-primary btn-sm"
              >
                ⬇️ Download PNG
              </a>
            </div>
            <button id="close-qr-btn" className="btn btn-ghost btn-sm mt-1" onClick={() => setQrExamId(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}
