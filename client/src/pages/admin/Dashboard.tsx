import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, activateExam } from '../../lib/api';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedCounter from '../../components/AnimatedCounter';
import LogicWhileLiRELoader from '../../components/LogicWhileLiRELoader';

import axios from 'axios';
import { API_BASE_URL } from '../../lib/config';

interface Exam {
  id: string;
  title: string;
  duration_minutes: number;
  start_time: string | null;
  is_active: boolean;
  created_at: string;
  created_by_name?: string | null;
  exam_code?: string;
}

interface DashboardWidgetsData {
  live_exams_count: number;
  live_exams: Array<{ id: string; title: string; is_active: boolean; start_time?: string }>;
  students_online: number;
  violations_count: number;
  recent_faculty_activity: Array<{
    id: string;
    user_id: string;
    role: string;
    action: string;
    target: string;
    ip: string;
    timestamp: string;
  }>;
  system_health: {
    status: string;
    database: string;
    latency_ms: number;
    socket_engine: string;
    uptime_seconds: number;
    heap_used_mb: number;
    node_version: string;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState<DashboardWidgetsData | null>(null);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('admin_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role === 'inspector' || u.role === 'college_admin') {
          navigate('/admin/inspector', { replace: true });
          return;
        }
        if (u.role === 'faculty') {
          navigate('/admin/exams', { replace: true });
          return;
        }
      }
    } catch {}

    setLoading(true);
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');

    Promise.all([
      listExams()
        .then((r) => setExams(r.data.exams || []))
        .catch(() => {}),
      axios
        .get(`${API_BASE_URL}/api/admin/dashboard-widgets`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        .then((r) => {
          if (r.data?.widgets) setWidgets(r.data.widgets);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [navigate]);

  const activeCount = widgets?.live_exams_count ?? exams.filter((e) => e.is_active).length;

  async function handleToggle(exam: Exam) {
    await activateExam(exam.id, !exam.is_active);
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, is_active: !exam.is_active } : e))
    );
  }

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="dashboard" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                LogicWhileLiRE Master Control
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Administrative Dashboard
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Single Source of Truth · Full Control over Exams, Students, Proctoring & Engine
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => navigate('/admin/exams')}
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>➕</span> Create / Launch Exam
              </button>
              <button
                onClick={() => navigate('/admin/monitor')}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>📡</span> Live 100-Tile Wall
              </button>
            </div>
          </div>

          {/* ── PHASE 2 WIDGETS: Live Exams, Students Online, Violations, System Health ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 28 }}>
            {/* Widget 1: Live Exams */}
            <div className="card" style={{ padding: '20px 24px', background: 'rgba(11, 18, 38, 0.7)', border: '1px solid rgba(43, 127, 255, 0.3)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Live Exams
                </span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 6, fontFamily: 'var(--font-display)' }}>
                <AnimatedCounter value={widgets?.live_exams_count ?? activeCount} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4 }}>
                {exams.length} total managed assessments
              </div>
            </div>

            {/* Widget 2: Students Online */}
            <div className="card" style={{ padding: '20px 24px', background: 'rgba(11, 18, 38, 0.7)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#10B981', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Students Online
                </span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10B981', marginTop: 6, fontFamily: 'var(--font-display)' }}>
                <AnimatedCounter value={widgets?.students_online ?? 0} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4 }}>
                Active in-progress sessions
              </div>
            </div>

            {/* Widget 3: Proctoring Violations */}
            <div className="card" style={{ padding: '20px 24px', background: 'rgba(11, 18, 38, 0.7)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#EF4444', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Proctoring Violations
                </span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 8px #EF4444' }} />
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#EF4444', marginTop: 6, fontFamily: 'var(--font-display)' }}>
                <AnimatedCounter value={widgets?.violations_count ?? 0} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4 }}>
                Cheating & tab switches flagged
              </div>
            </div>

            {/* Widget 4: System Health */}
            <div className="card" style={{ padding: '20px 24px', background: 'rgba(11, 18, 38, 0.7)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#8B5CF6', fontWeight: 700, letterSpacing: '0.05em' }}>
                  System Health
                </span>
                <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>
                  ● {widgets?.system_health?.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', marginTop: 8, fontFamily: 'var(--font-display)' }}>
                {widgets?.system_health?.latency_ms ?? 2} ms Latency
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>DB: {widgets?.system_health?.database || 'Supabase Connected'}</span>
                <span>Heap: {widgets?.system_health?.heap_used_mb || 64} MB</span>
              </div>
            </div>
          </div>

          {/* ── Widget 5: Recent Faculty Activity Panel ── */}
          <div className="card" style={{ padding: '20px 24px', background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📜</span> Recent Faculty Activity Feed
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                  Live surveillance of faculty operations, exam modifications, and content authoring
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/activity?role=faculty')}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--color-primary)', fontWeight: 700 }}
              >
                Open Audit Console →
              </button>
            </div>

            {(!widgets?.recent_faculty_activity || widgets.recent_faculty_activity.length === 0) ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                No recent faculty actions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Action</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Target</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Faculty ID</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-faint)' }}>IP Address</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-faint)' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widgets.recent_faculty_activity.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(43, 127, 255, 0.15)', color: 'var(--color-primary)' }}>
                            {l.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#E2E8F0', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {l.target}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                          {l.user_id}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {l.ip}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-faint)' }}>
                          {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Launch Cards */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>
            Control Center Operations
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[
              {
                title: '⚙️ Exam Control',
                desc: 'Create, duplicate, edit, set duration, passing %, and toggles (Proctoring, Leaderboard, Fullscreen Lock).',
                action: 'Manage Exams',
                route: '/admin/exams',
                color: '#2B7FFF',
              },
              {
                title: '❓ Question Bank Control',
                desc: '1-Click Excel import, edit, reorder, marks, difficulty, and public/hidden coding test cases.',
                action: 'Open Bank',
                route: '/admin/questions',
                color: '#8B5CF6',
              },
              {
                title: '👥 Student Roster Control',
                desc: 'Upload student roster via Excel. Block/unblock candidates during exams. Set attempt limits.',
                action: 'Manage Students',
                route: '/admin/students',
                color: '#10B981',
              },
              {
                title: '📡 Live Monitor Wall (100 Tiles)',
                desc: 'Observe all active candidate screens, face mesh alerts, trigger warnings, or extend exam time +10m.',
                action: 'Open Monitor Wall',
                route: '/admin/monitor',
                color: '#EC4899',
              },
              {
                title: '📈 Result & Analytics Control',
                desc: 'View pass %, cheating flags, topic breakdown, recalculate scores, give grace marks, and publish results.',
                action: 'Review Results',
                route: '/admin/results',
                color: '#F59E0B',
              },
              {
                title: '🛡️ Platform & Engine Control',
                desc: 'Brand styling, allowed code runtimes (Python/JS/C++), timeout limits, and maintenance mode.',
                action: 'Portal Settings',
                route: '/admin/settings',
                color: '#6366F1',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: '22px 24px',
                  background: 'rgba(11, 18, 38, 0.65)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px 0' }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                    {card.desc}
                  </p>
                </div>
                <button
                  onClick={() => navigate(card.route)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    marginTop: 18,
                    alignSelf: 'flex-start',
                    color: card.color,
                    border: `1px solid ${card.color}40`,
                    fontWeight: 700,
                  }}
                >
                  {card.action} →
                </button>
              </div>
            ))}
          </div>

          {/* Active Assessments Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Live Assessments
            </h2>
            <button onClick={() => navigate('/admin/exams')} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-primary)' }}>
              View All Exams →
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            {loading ? (
              <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogicWhileLiRELoader size="sm" message="Loading active LogicWhileLiRE assessments..." />
              </div>
            ) : exams.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No exams found. Click <strong>Create / Launch Exam</strong> to set up your first assessment.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Title / Access Code</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Duration</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--color-text-faint)', fontWeight: 600 }}>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.slice(0, 5).map((exam) => (
                    <tr key={exam.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{exam.title}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                          ID: {exam.id.slice(0, 16)}...
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                        ⏱️ {exam.duration_minutes} mins
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: exam.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                            color: exam.is_active ? '#10B981' : 'var(--color-text-muted)',
                            border: `1px solid ${exam.is_active ? 'rgba(16, 185, 129, 0.3)' : 'transparent'}`,
                          }}
                        >
                          {exam.is_active ? '🟢 LIVE' : '⚪ INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            onClick={() => handleToggle(exam)}
                            className="btn btn-sm"
                            style={{
                              background: exam.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: exam.is_active ? '#EF4444' : '#10B981',
                              border: `1px solid ${exam.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            {exam.is_active ? 'Deactivate' : '🚀 Launch'}
                          </button>
                          <button
                            onClick={() => navigate('/admin/monitor')}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.78rem' }}
                          >
                            Monitor
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}
