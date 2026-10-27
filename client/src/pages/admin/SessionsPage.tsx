import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  listExams,
  listSessions,
  terminateSession,
  allowExamReentry,
  listSuspiciousActivity,
  resolveSuspiciousActivity,
} from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import BulkEnrollModal from '../../components/BulkEnrollModal';

interface Session {
  id: string;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  violation_count: number;
  termination_reason: string | null;
  suspicious_flags: unknown[] | null;
  participant: { name: string; hall_ticket: string; email: string } | null;
}

interface SuspiciousActivity {
  id: string;
  exam_id: string;
  session_id: string;
  participant_id: string;
  hall_ticket: string;
  conflict_session_id: string | null;
  conflict_participant_id: string | null;
  conflict_hall_ticket: string;
  activity_type: string;
  fingerprint: string;
  details: {
    current_participant_name?: string;
    conflict_participant_name?: string;
    conflict_session_status?: string;
    detected_at?: string;
    resolution_notes?: string;
  } | null;
  status: 'pending_review' | 'cleared' | 'confirmed_violation';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-neutral',
  in_progress: 'badge-primary',
  submitted: 'badge-success',
  completed: 'badge-success',
  terminated: 'badge-danger',
  terminated_cheating: 'badge-danger',
  'Terminated - violation': 'badge-danger',
};

export default function SessionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(searchParams.get('examId') || '');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<SuspiciousActivity[]>([]);
  const [activeTab, setActiveTab] = useState<'sessions' | 'fingerprints'>('sessions');
  const [loading, setLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total_pages: 1, total_count: 0 });
  const [isBulkEnrollOpen, setIsBulkEnrollOpen] = useState(false);

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    if (!adminToken) {
      navigate('/admin');
      return;
    }
    listExams().then((r) => setExams(r.data.exams)).catch(() => navigate('/admin'));
  }, [navigate]);

  const refreshSessions = () => {
    if (!selectedExamId) return;
    setLoading(true);
    Promise.all([
      listSessions(selectedExamId, page, 20),
      listSuspiciousActivity(selectedExamId),
    ])
      .then(([sessRes, actRes]) => {
        setSessions(sessRes.data.sessions || []);
        if (sessRes.data.pagination) {
          setPagination({
            total_pages: sessRes.data.pagination.total_pages,
            total_count: sessRes.data.pagination.total_count,
          });
        }
        setActivities(actRes.data.activities || []);
      })
      .catch((err) => console.error('Failed to load sessions data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshSessions();
  }, [selectedExamId, page]);

  async function handleTerminate(id: string) {
    if (!confirm('Terminate this session?')) return;
    setTerminatingId(id);
    try {
      await terminateSession(id, 'Terminated by admin');
      setSessions((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: 'terminated', termination_reason: 'Terminated by admin' } : s)
      );
    } finally {
      setTerminatingId(null);
    }
  }

  const [reentryLoadingId, setReentryLoadingId] = useState<string | null>(null);

  async function handleAllowReentry(id: string) {
    const reason = prompt('Enter justification for allowing re-entry (this will be permanently logged in audit trails):', 'Admin verified accidental hardware/network drop');
    if (!reason) return;
    setReentryLoadingId(id);
    try {
      await allowExamReentry(id, reason);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'in_progress', termination_reason: null } : s))
      );
      alert('✅ Re-entry permitted. The candidate can now resume their examination.');
    } catch (err: any) {
      alert(`❌ Failed to allow re-entry: ${err?.response?.data?.error || err.message}`);
    } finally {
      setReentryLoadingId(null);
    }
  }

  async function handleResolveFlag(id: string, action: 'clear' | 'confirm') {
    const confirmMsg =
      action === 'clear'
        ? 'Clear this duplicate fingerprint flag? (Use this for legitimate shared computer labs).'
        : 'Confirm this duplicate fingerprint match as a proctoring violation?';
    if (!confirm(confirmMsg)) return;

    setResolvingId(id);
    try {
      const res = await resolveSuspiciousActivity(id, action);
      setActivities((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: res.data.activity.status,
                reviewed_by: res.data.activity.reviewed_by,
                reviewed_at: res.data.activity.reviewed_at,
              }
            : a
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update flag');
    } finally {
      setResolvingId(null);
    }
  }

  const pendingFlagsCount = activities.filter((a) => a.status === 'pending_review').length;

  return (
    <AnimatedPage>
      <div className="admin-layout">
        <AdminSidebar activeTab="exams" />

        <main className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Proctoring & Sessions</h1>
              <p className="text-muted text-sm mb-3">Monitor live candidate sessions, device fingerprints, and proctoring flags.</p>
            </div>
            {selectedExamId && (
              <button
                id="sessions-bulk-enroll-btn"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsBulkEnrollOpen(true)}
                style={{ alignSelf: 'center' }}
              >
                👥 Bulk Enroll Candidates (CSV/XLSX)
              </button>
            )}
          </div>

          <div className="form-group" style={{ maxWidth: 400, marginBottom: 24 }}>
            <label className="form-label" htmlFor="sessions-exam-select">Select Exam</label>
            <select
              id="sessions-exam-select"
              className="form-input"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">-- Choose an exam --</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>

          {selectedExamId && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
              <button
                id="tab-all-sessions"
                className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('sessions')}
              >
                👥 Live Participant Sessions ({pagination.total_count || sessions.length})
              </button>
              <button
                id="tab-fingerprint-flags"
                className={`btn btn-sm ${activeTab === 'fingerprints' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('fingerprints')}
                style={{ position: 'relative' }}
              >
                🛡️ Device Fingerprint Conflicts ({activities.length})
                {pendingFlagsCount > 0 && (
                  <span
                    className="badge badge-danger"
                    style={{ marginLeft: 8, padding: '2px 6px', fontSize: '0.75rem', borderRadius: 999 }}
                  >
                    {pendingFlagsCount} Pending Review
                  </span>
                )}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />)}
            </div>
          ) : selectedExamId ? (
            activeTab === 'sessions' ? (
              sessions.length > 0 ? (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Hall Ticket</th>
                        <th>Status</th>
                        <th>Violations</th>
                        <th>Flags</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="font-bold">{s.participant?.name || '—'}</td>
                          <td className="font-mono text-sm">{s.participant?.hall_ticket}</td>
                          <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-neutral'}`}>{s.status}</span></td>
                          <td>
                            <span className={s.violation_count > 0 ? 'text-warning font-bold' : 'text-muted'}>
                              {s.violation_count}
                            </span>
                          </td>
                          <td>
                            {(s.suspicious_flags as unknown[])?.length > 0 ? (
                              <span className="badge badge-warning">⚠️ {(s.suspicious_flags as unknown[]).length} flags</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {s.status === 'in_progress' && (
                              <button
                                id={`terminate-${s.id}`}
                                className="btn btn-danger btn-sm"
                                onClick={() => handleTerminate(s.id)}
                                disabled={terminatingId === s.id}
                              >
                                {terminatingId === s.id ? '...' : '🚫 Terminate'}
                              </button>
                            )}
                            {(s.status === 'terminated' || s.status === 'terminated_cheating' || s.status === 'Terminated - violation') && (
                              <button
                                id={`allow-reentry-${s.id}`}
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAllowReentry(s.id)}
                                disabled={reentryLoadingId === s.id}
                                style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981', color: '#10B981', fontWeight: 700 }}
                                title="Admin Override: Reopen wrongly terminated session with audit logging"
                              >
                                {reentryLoadingId === s.id ? '...' : '🔓 Allow Re-entry'}
                              </button>
                            )}
                            {s.termination_reason && (
                              <span className="text-xs text-muted" style={{ display: 'block', marginTop: 4 }}>
                                {s.termination_reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {pagination.total_pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                      <span className="text-muted text-sm font-mono">
                        Page {page} of {pagination.total_pages} ({pagination.total_count} total sessions)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          ← Previous
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={page >= pagination.total_pages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="card text-center" style={{ padding: 48 }}>
                  <p className="text-muted">No sessions found for this exam.</p>
                </div>
              )
            ) : (
              /* FINGERPRINT REVIEW TAB */
              <div>
                <div className="alert alert-warning mb-3" style={{ fontSize: '0.85rem' }}>
                  <strong>⚠️ Shared Lab Environment Notice:</strong> False-positive fingerprint matches frequently occur in university and institutional computer labs where workstations share identical hardware, OS images, screen resolution, and WebGL drivers. The system flags conflicts for manual verification and <em>never automatically blocks candidates</em>.
                </div>

                {activities.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Candidate (Current Session)</th>
                        <th>Conflicting Candidate</th>
                        <th>Device Fingerprint Hash</th>
                        <th>Detected At</th>
                        <th>Review Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((act) => (
                        <tr key={act.id}>
                          <td>
                            <div className="font-bold">{act.details?.current_participant_name || act.hall_ticket}</div>
                            <div className="font-mono text-xs text-primary">{act.hall_ticket}</div>
                            <div className="font-mono text-xs text-muted">Session: {act.session_id.slice(0, 8)}...</div>
                          </td>
                          <td>
                            <div className="font-bold text-warning">{act.details?.conflict_participant_name || act.conflict_hall_ticket}</div>
                            <div className="font-mono text-xs text-warning">{act.conflict_hall_ticket}</div>
                            {act.conflict_session_id && (
                              <div className="font-mono text-xs text-muted">Conflict: {act.conflict_session_id.slice(0, 8)}...</div>
                            )}
                          </td>
                          <td>
                            <code
                              className="font-mono text-xs"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                padding: '3px 6px',
                                borderRadius: 4,
                                display: 'inline-block',
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={act.fingerprint}
                            >
                              {act.fingerprint.slice(0, 16)}...
                            </code>
                          </td>
                          <td className="text-xs font-mono text-muted">
                            {new Date(act.created_at).toLocaleString()}
                          </td>
                          <td>
                            {act.status === 'pending_review' && (
                              <span className="badge badge-warning">⏳ Pending Review</span>
                            )}
                            {act.status === 'cleared' && (
                              <span className="badge badge-success">✅ Flag Cleared</span>
                            )}
                            {act.status === 'confirmed_violation' && (
                              <span className="badge badge-danger">🚫 Confirmed Violation</span>
                            )}
                            {act.reviewed_by && (
                              <div className="text-xs text-muted mt-1">
                                By {act.reviewed_by}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                id={`clear-flag-${act.id}`}
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleResolveFlag(act.id, 'clear')}
                                disabled={resolvingId === act.id || act.status === 'cleared'}
                                title="Clear flag (e.g., student took exam on a shared lab computer)"
                                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                              >
                                {resolvingId === act.id ? '...' : '✅ Clear Flag'}
                              </button>
                              <button
                                id={`confirm-violation-${act.id}`}
                                className="btn btn-danger btn-sm"
                                onClick={() => handleResolveFlag(act.id, 'confirm')}
                                disabled={resolvingId === act.id || act.status === 'confirmed_violation'}
                                title="Confirm this device duplicate as an active cheating violation"
                                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                              >
                                {resolvingId === act.id ? '...' : '🚫 Confirm Violation'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="card text-center" style={{ padding: 48 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>🛡️</div>
                    <div className="font-bold" style={{ marginBottom: 4 }}>No Duplicate Fingerprints Detected</div>
                    <p className="text-muted text-sm">
                      All participant sessions in this exam currently have distinct browser/device signatures.
                    </p>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="card text-center" style={{ padding: 48 }}>
              <p className="text-muted">Please select an exam above to view sessions and proctoring activity.</p>
            </div>
          )}
          {/* Bulk Enrollment Modal */}
          {selectedExamId && isBulkEnrollOpen && (
            <BulkEnrollModal
              isOpen={isBulkEnrollOpen}
              onClose={() => setIsBulkEnrollOpen(false)}
              examId={selectedExamId}
              examTitle={exams.find((e) => e.id === selectedExamId)?.title || 'Selected Assessment'}
              onSuccess={refreshSessions}
            />
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
