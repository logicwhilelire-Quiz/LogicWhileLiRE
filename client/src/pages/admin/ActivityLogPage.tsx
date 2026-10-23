import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import AnimatedCounter from '../../components/AnimatedCounter';
import { API_BASE_URL } from '../../lib/config';

interface AuditLogItem {
  id: string;
  user_id: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  user_agent: string;
  timestamp: string;
  payload?: any;
}

export default function ActivityLogPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();

  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    fetchLogs();
  }, [roleFilter, actionFilter, dateFilter, isSuperAdmin]);

  async function fetchLogs() {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      const params: any = { limit: 200 };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await axios.get(`${API_BASE_URL}/api/admin/activity`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Admin session expired. Please re-authenticate.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <AnimatedPage>
        <div className="page-center">
          <div className="card text-center" style={{ maxWidth: 440, padding: 36 }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Access Restricted</h2>
            <p className="text-muted text-sm mb-3">
              The Forensic Activity & Monitoring Log is strictly restricted to Super Administrators.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/admin/dashboard')}>
              Return to Console
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (l.user_id || '').toLowerCase().includes(s) ||
      (l.action || '').toLowerCase().includes(s) ||
      (l.target || '').toLowerCase().includes(s) ||
      (l.ip || '').toLowerCase().includes(s)
    );
  });

  const facultyActionsCount = logs.filter((l) => l.role === 'faculty').length;
  const inspectorActionsCount = logs.filter((l) => l.role === 'inspector' || l.role === 'college_admin').length;
  const loginEventsCount = logs.filter((l) => l.action.includes('LOGIN')).length;

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="activity" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>
                📜 Institutional Activity & Monitoring Trail
              </h1>
              <p className="text-muted text-sm">
                Immutable audit trail tracking logins, failed attempts, exam start/stops, question edits, exports, and permission changes.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh Log'}
            </button>
          </div>

          {error && <div className="alert alert-error mb-3">⚠️ {error}</div>}

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Total Recorded Events
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                <AnimatedCounter value={logs.length} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #10B981' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Faculty Actions
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>
                <AnimatedCounter value={facultyActionsCount} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #F59E0B' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Inspector Actions
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>
                <AnimatedCounter value={inspectorActionsCount} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #3B82F6' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Authentication Events
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>
                <AnimatedCounter value={loginEventsCount} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card mb-3" style={{ padding: '16px 20px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Role Filter</label>
                <select
                  id="filter-role"
                  className="form-input form-input-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="faculty">Faculty Trainers</option>
                  <option value="inspector">College Inspectors</option>
                  <option value="super_admin">Super Administrators</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Action Type</label>
                <select
                  id="filter-action"
                  className="form-input form-input-sm"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="all">All Action Types</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="FAILED_LOGIN">FAILED_LOGIN</option>
                  <option value="START_EXAM">START_EXAM</option>
                  <option value="END_EXAM">END_EXAM</option>
                  <option value="CREATE_QUESTION">CREATE_QUESTION</option>
                  <option value="UPDATE_QUESTION">UPDATE_QUESTION</option>
                  <option value="DELETE_QUESTION">DELETE_QUESTION</option>
                  <option value="UPDATE_STAFF_PERMISSIONS">UPDATE_STAFF_PERMISSIONS</option>
                  <option value="BULK_IMPORT_STUDENTS">BULK_IMPORT_STUDENTS</option>
                  <option value="CREATE_STUDENT">CREATE_STUDENT</option>
                  <option value="UPDATE_STUDENT">UPDATE_STUDENT</option>
                  <option value="RUN_SYSTEM_BACKUP">RUN_SYSTEM_BACKUP</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Date</label>
                <input
                  id="filter-date"
                  type="date"
                  className="form-input form-input-sm"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Search Filter</label>
                <input
                  id="filter-search"
                  type="text"
                  className="form-input form-input-sm"
                  placeholder="Filter by user, target, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Activity Table */}
          <div className="card" style={{ padding: 20, background: 'rgba(15, 23, 42, 0.75)', border: '1px solid var(--color-border)' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 50, borderRadius: 8 }} />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No audit events match the selected filters.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Timestamp</th>
                      <th style={{ padding: '10px' }}>User ID / Actor</th>
                      <th style={{ padding: '10px' }}>Role</th>
                      <th style={{ padding: '10px' }}>Action</th>
                      <th style={{ padding: '10px' }}>Target</th>
                      <th style={{ padding: '10px' }}>IP Address</th>
                      <th style={{ padding: '10px' }}>User Agent</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((item, idx) => {
                      const isAuthFailed = item.action === 'FAILED_LOGIN';
                      const isDangerAction = item.action.includes('DELETE') || item.action.includes('BLOCK') || isAuthFailed;
                      const isPermChange = item.action.includes('PERMISSIONS');

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                          <td style={{ padding: '10px', whiteSpace: 'nowrap' }} className="font-mono text-xs text-muted">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 600, color: '#f8fafc' }}>
                            {item.user_id}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 6,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background:
                                  item.role === 'super_admin'
                                    ? 'rgba(59, 130, 246, 0.2)'
                                    : item.role === 'inspector'
                                    ? 'rgba(234, 179, 8, 0.2)'
                                    : 'rgba(16, 185, 129, 0.2)',
                                color:
                                  item.role === 'super_admin'
                                    ? '#93C5FD'
                                    : item.role === 'inspector'
                                    ? '#FDE047'
                                    : '#6EE7B7',
                              }}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                background: isDangerAction
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : isPermChange
                                  ? 'rgba(168, 85, 247, 0.2)'
                                  : 'rgba(59, 130, 246, 0.15)',
                                color: isDangerAction
                                  ? '#FCA5A5'
                                  : isPermChange
                                  ? '#D8B4FE'
                                  : '#93C5FD',
                              }}
                            >
                              {item.action}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: 'var(--color-text-faint)' }}>
                            {item.target || '—'}
                          </td>
                          <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.76rem' }} className="text-muted">
                            {item.ip}
                          </td>
                          <td style={{ padding: '10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-muted text-xs" title={item.user_agent}>
                            {item.user_agent}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            {item.payload ? (
                              <button
                                className="btn btn-xs btn-ghost"
                                onClick={() => setSelectedPayload(item.payload)}
                                style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                              >
                                👁️ View
                              </button>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Payload Inspection Modal */}
        {selectedPayload && (
          <div className="modal-overlay" onClick={() => setSelectedPayload(null)}>
            <div
              className="modal animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 520, background: 'rgba(15, 23, 42, 0.95)' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 12 }}>
                Audit Event Payload Details
              </h3>
              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  padding: 14,
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  overflowX: 'auto',
                  maxHeight: 300,
                  color: '#93C5FD',
                }}
              >
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setSelectedPayload(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
