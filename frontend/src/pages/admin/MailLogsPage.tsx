import React, { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import ParticleField from '../../components/3d/ParticleField';
import { listMailLogs, resendMailLog, type MailLog, extractErrorMessage } from '../../lib/api';

const TEMPLATE_OPTIONS = [
  { value: 'all', label: 'All Role Templates' },
  { value: 'admin_welcome', label: 'admin_welcome (Admin Console Onboarding)' },
  { value: 'inspector_created', label: 'inspector_created (Invigilator Account)' },
  { value: 'faculty_created', label: 'faculty_created (Faculty & Assigned Sections)' },
  { value: 'student_otp', label: 'student_otp (Sign-Up OTP • 10m Expiry)' },
  { value: 'student_registered', label: 'student_registered (Account Verified)' },
  { value: 'password_reset', label: 'password_reset (Credential Recovery)' },
  { value: 'exam_scheduled', label: 'exam_scheduled (Targeted Hall Ticket)' },
  { value: 'faculty_paper_allocated', label: 'faculty_paper_allocated (Paper Assignment)' },
  { value: 'result_report', label: 'result_report (Official Scorecard)' },
  { value: 'admin_alert', label: 'admin_alert (Anti-Cheat & Nightly Backup)' },
];

export default function MailLogsPage() {
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<MailLog | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMailLogs({
        page,
        limit: 15,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        template: filterTemplate !== 'all' ? filterTemplate : undefined,
        search: search.trim() || undefined,
      });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch outbound mail logs'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterTemplate, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResend = async (logId: string) => {
    setResendingId(logId);
    try {
      const res = await resendMailLog(logId);
      if (res.data?.success) {
        showToast('Email successfully re-dispatched via Resend API!', 'success');
        // Refresh logs list
        fetchLogs();
      } else {
        showToast('Resend failed: Server returned an unsuccessful status', 'error');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to re-dispatch email'), 'error');
    } finally {
      setResendingId(null);
    }
  };

  const getTemplateBadgeStyle = (template: string) => {
    switch (template) {
      case 'faculty_created':
        return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' };
      case 'inspector_created':
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)' };
      case 'admin_welcome':
        return { background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.35)' };
      case 'student_otp':
        return { background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.35)' };
      case 'student_registered':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)' };
      case 'exam_scheduled':
        return { background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.35)' };
      case 'admin_alert':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' };
      case 'result_report':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)' };
      case 'faculty_paper_allocated':
        return { background: 'rgba(192, 132, 252, 0.15)', color: '#e879f9', border: '1px solid rgba(192, 132, 252, 0.35)' };
      default:
        return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.35)' };
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent' || status === 'delivered') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 9999,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          Delivered
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 9999,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
        Failed
      </span>
    );
  };

  return (
    <AnimatedPage>
      <div className="admin-layout">
        <AdminSidebar activeTab="mail-logs" />

        <main className="admin-content" style={{ position: 'relative', overflow: 'hidden' }}>
          <ParticleField liveCount={Math.max(1, logs.length)} particleCount={150} color="var(--color-primary, #00d2ff)" />

          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>📬 Outbound Email Dispatch Logs</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                    Resend API
                  </span>
                </h1>
                <p className="text-muted text-sm">
                  Live institutional audit of outbound role-based communications, Resend delivery IDs, status telemetry, and manual re-dispatch.
                </p>
              </div>

              <button
                onClick={fetchLogs}
                disabled={loading}
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🔄</span>
                <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
              </button>
            </div>

            {/* Toast Notification */}
            {toast && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                <span>{toast.message}</span>
              </div>
            )}

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="card card-sm" style={{ borderLeft: '3px solid #38bdf8' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Total Outbound Logs
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {stats.total || logs.length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #10b981' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Successfully Dispatched
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  {stats.sent || logs.filter((l) => l.status === 'sent' || l.status === 'delivered').length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #ef4444' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Failed Dispatches
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
                  {stats.failed || logs.filter((l) => l.status === 'failed').length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #a855f7' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Distinct Role Templates
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc' }}>
                  10 Active
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div
              className="card card-sm"
              style={{
                marginBottom: 20,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flex: 1, minWidth: 260, gap: 10 }}>
                <input
                  type="text"
                  placeholder="Search by recipient email or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                  style={{ width: '100%', maxWidth: 360 }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {/* Template Filter */}
                <select
                  value={filterTemplate}
                  onChange={(e) => {
                    setFilterTemplate(e.target.value);
                    setPage(1);
                  }}
                  className="input"
                  style={{ width: 'auto', minWidth: 220 }}
                >
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="input"
                  style={{ width: 'auto', minWidth: 140 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="sent">Delivered / Sent</option>
                  <option value="failed">Failed Delivery</option>
                </select>
              </div>
            </div>

            {/* Mail Logs Data Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Recipient</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Role Template</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Subject</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Resend ID</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Timestamp</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                          Loading email dispatch records...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                          <div style={{ fontSize: '32px', marginBottom: 10 }}>📭</div>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>No Outbound Emails Found</div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>
                            {search || filterStatus !== 'all' || filterTemplate !== 'all'
                              ? 'Try adjusting your search criteria or status filter.'
                              : 'Outbound emails sent via Resend will appear here in real-time.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      logs.map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Status Badge */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            {getStatusBadge(item.status)}
                          </td>

                          {/* Recipient */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                              {item.to_email}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Via {item.sent_by || 'system'}
                            </div>
                          </td>

                          {/* Template */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: '12px',
                                fontWeight: 700,
                                ...getTemplateBadgeStyle(item.template),
                              }}
                            >
                              {item.template}
                            </span>
                          </td>

                          {/* Subject */}
                          <td style={{ padding: '14px 18px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', color: 'var(--color-text)' }} title={item.subject}>
                              {item.subject}
                            </div>
                            {item.error_message && (
                              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: 2 }} title={item.error_message}>
                                ⚠️ {item.error_message}
                              </div>
                            )}
                          </td>

                          {/* Resend ID */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {item.resend_id ? item.resend_id.slice(0, 16) + '...' : '—'}
                          </td>

                          {/* Timestamp */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8' }}>
                            {new Date(item.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                              {item.html_content && (
                                <button
                                  onClick={() => setPreviewLog(item)}
                                  className="btn btn-xs btn-secondary"
                                  title="View rendered email preview"
                                >
                                  👁️ Preview
                                </button>
                              )}

                              <button
                                onClick={() => handleResend(item.id)}
                                disabled={resendingId === item.id}
                                className="btn btn-xs btn-primary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                }}
                              >
                                {resendingId === item.id ? (
                                  <span>⏳ Sending...</span>
                                ) : (
                                  <>
                                    <span>🔁</span>
                                    <span>Resend</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {total > 15 && (
                <div
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total} records
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn btn-xs btn-secondary"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * 15 >= total}
                      className="btn btn-xs btn-secondary"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* HTML Email Preview Modal */}
      {previewLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setPreviewLog(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              background: '#0d1835',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  {previewLog.subject}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 2 }}>
                  To: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{previewLog.to_email}</span> • Template: <span style={{ fontWeight: 700 }}>{previewLog.template}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => handleResend(previewLog.id)}
                  disabled={resendingId === previewLog.id}
                  className="btn btn-xs btn-primary"
                >
                  {resendingId === previewLog.id ? 'Sending...' : '🔁 Resend Now'}
                </button>
                <button
                  onClick={() => setPreviewLog(null)}
                  className="btn btn-xs btn-secondary"
                  style={{ fontSize: '16px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe preview */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#070d1e' }}>
              <iframe
                title="Email Preview"
                srcDoc={previewLog.html_content || '<p>No content preview available</p>'}
                style={{
                  width: '100%',
                  height: 520,
                  border: 'none',
                  borderRadius: 10,
                  background: '#ffffff',
                }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
