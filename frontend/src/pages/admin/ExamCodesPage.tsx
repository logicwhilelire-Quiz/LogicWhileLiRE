import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import AdminSidebar from '../../components/layout/AdminSidebar';
import { API_BASE_URL } from '../../lib/config';

const BASE_URL = API_BASE_URL;

function api(path: string, opts?: Parameters<typeof axios>[1]) {
  const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  return axios({
    url: `${BASE_URL}${path}`,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
}

function apiForm(path: string, data: FormData) {
  const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  return axios.post(`${BASE_URL}${path}`, data, {
    withCredentials: true,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface College {
  id: number;
  college_name: string;
  college_code: string;
}

interface ExamCode {
  id: number;
  exam_code: string;
  exam_name: string;
  subject: string;
  total_questions: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  college: { college_name: string; college_code: string };
}

export default function ExamCodesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterCollegeId = searchParams.get('college');

  const [examCodes, setExamCodes] = useState<ExamCode[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // QR modal state
  const [qrModal, setQrModal] = useState<{ code: ExamCode; qrUrl: string; entryUrl: string } | null>(null);

  // Import modal
  const [importModal, setImportModal] = useState<ExamCode | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    college_id: filterCollegeId || '',
    exam_name: '',
    subject: '',
    total_questions: '30',
    duration_minutes: '60',
    start_time: '',
    end_time: '',
  });

  async function load() {
    setLoading(true);
    try {
      let ecRes: any, colRes: any;
      try {
        [ecRes, colRes] = await Promise.all([
          api('/api/admin/exam-codes'),
          api('/api/admin/colleges'),
        ]);
      } catch {
        [ecRes, colRes] = await Promise.all([
          api('/api/exam-codes').catch(() => ({ data: { exam_codes: [] } })),
          api('/api/colleges').catch(() => ({ data: { colleges: [] } })),
        ]);
      }
      let codes = ecRes?.data?.exam_codes || [];
      if (filterCollegeId) codes = codes.filter((c: ExamCode) => c.college && String((c as any).college_id) === filterCollegeId);
      setExamCodes(codes);
      setColleges(colRes?.data?.colleges || []);
    } catch {
      // Silently maintain existing state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api('/api/admin/exam-codes', { method: 'POST', data: form });
      setSuccess(`Exam code ${res.data.exam_code.exam_code} created!`);
      setShowForm(false);
      load();
      // Show QR immediately
      setQrModal({
        code: res.data.exam_code,
        qrUrl: res.data.qr,
        entryUrl: res.data.entry_url,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Creation failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(ec: ExamCode) {
    try {
      await api(`/api/admin/exam-codes/${ec.id}/toggle`, { method: 'PATCH', data: { is_active: !ec.is_active } });
      setExamCodes(prev => prev.map(c => c.id === ec.id ? { ...c, is_active: !c.is_active } : c));
    } catch {
      setError('Failed to update status');
    }
  }

  async function openQR(ec: ExamCode) {
    try {
      const res = await api(`/api/admin/exam-codes/${ec.id}/report`);
      // Show QR from a fresh generation
      const clientOrigin = window.location.origin;
      const entryUrl = `${clientOrigin}/enter-exam?code=${ec.exam_code}`;
      // Get QR as data URL by fetching the endpoint
      const qrRes = await axios.get(`${BASE_URL}/api/admin/exam-codes/${ec.id}/qr`, {
        responseType: 'blob',
        withCredentials: true,
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` },
      });
      const qrUrl = URL.createObjectURL(qrRes.data);
      setQrModal({ code: ec, qrUrl, entryUrl });
    } catch {
      setError('Failed to load QR');
    }
  }

  async function handleImport() {
    if (!importModal || !importFile) return;
    setImporting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', importFile);
      const res = await apiForm(`/api/admin/exam-codes/${importModal.id}/import-questions`, form);
      setSuccess(`${res.data.inserted_count} questions imported for ${importModal.exam_code}`);
      setImportModal(null);
      setImportFile(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  }

  function getStatus(ec: ExamCode): { label: string; color: string } {
    const now = new Date();
    if (!ec.is_active) return { label: '○ Inactive', color: '#64748b' };
    if (now < new Date(ec.start_time)) return { label: '⏳ Upcoming', color: '#FDCB6E' };
    if (now > new Date(ec.end_time)) return { label: '✖ Expired', color: '#ef4444' };
    return { label: '● Live', color: '#00B894' };
  }

  const defaultStartTime = () => {
    const d = new Date(); d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  };
  const defaultEndTime = () => {
    const d = new Date(); d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--color-bg, #070a14)' }}>
      {/* Sidebar */}
      <AdminSidebar activeTab="exam-codes" />

      {/* Main */}
      <main className="admin-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>🔑 Exam Codes</h1>
            <p className="text-muted text-sm">Generate and manage unique exam codes (GR-COLLEGE-XXXXXX or legacy LW-) for each college's assessment.</p>
          </div>
          <button id="generate-exam-code-btn" className="btn btn-primary"
            onClick={() => {
              setForm(p => ({ ...p, start_time: defaultStartTime(), end_time: defaultEndTime() }));
              setShowForm(true);
              setError('');
            }}>
            ⚡ Generate Exam Code
          </button>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error" style={{ marginBottom: 16 }} onClick={() => setError('')}>{error}</motion.div>}
          {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-success" style={{ marginBottom: 16 }} onClick={() => setSuccess('')}>{success}</motion.div>}
        </AnimatePresence>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Codes', value: examCodes.length, color: 'inherit' },
            { label: 'Live Now', value: examCodes.filter(e => getStatus(e).label.includes('Live')).length, color: '#00B894' },
            { label: 'Upcoming', value: examCodes.filter(e => getStatus(e).label.includes('Upcoming')).length, color: '#FDCB6E' },
            { label: 'Expired', value: examCodes.filter(e => getStatus(e).label.includes('Expired')).length, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="card card-sm" style={{ borderLeft: s.color !== 'inherit' ? `3px solid ${s.color}` : undefined }}>
              <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
        ) : examCodes.length === 0 ? (
          <div className="card text-center" style={{ padding: 60 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔑</div>
            <p className="font-bold mb-1">No exam codes yet</p>
            <p className="text-muted text-sm mb-2">Generate your first exam code to start an assessment.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>⚡ Generate First Code</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Code</th>
                  <th>College</th>
                  <th>Exam Name</th>
                  <th>Time Window</th>
                  <th>Duration</th>
                  <th>Qs</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {examCodes.map(ec => {
                  const status = getStatus(ec);
                  return (
                    <tr key={ec.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', background: 'rgba(108,92,231,0.12)', color: '#a29bfe', borderRadius: 6, padding: '3px 10px', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {ec.exam_code}
                        </span>
                      </td>
                      <td className="text-muted text-sm">{ec.college?.college_name || '—'}</td>
                      <td className="font-bold text-sm">{ec.exam_name}</td>
                      <td className="text-muted text-xs" style={{ whiteSpace: 'nowrap' }}>
                        <div>{formatDateTime(ec.start_time)}</div>
                        <div style={{ color: '#64748b' }}>→ {formatDateTime(ec.end_time)}</div>
                      </td>
                      <td className="text-muted">{ec.duration_minutes}m</td>
                      <td className="text-muted">{ec.total_questions}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, color: status.color, background: `${status.color}18`, whiteSpace: 'nowrap' }}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button id={`qr-${ec.id}`} className="btn btn-secondary btn-sm" onClick={() => openQR(ec)} title="View QR & Share">📷 QR</button>
                          <button id={`import-q-${ec.id}`} className="btn btn-ghost btn-sm" onClick={() => { setImportModal(ec); setImportFile(null); }} title="Upload Questions">📥 Qs</button>
                          <button id={`leaderboard-ec-${ec.id}`} className="btn btn-ghost btn-sm" onClick={() => navigate(`/leaderboard-ec/${ec.exam_code}`)} title="Leaderboard">🏆</button>
                          <button id={`toggle-ec-${ec.id}`} className={`btn btn-sm ${ec.is_active ? 'btn-danger' : 'btn-primary'}`} onClick={() => handleToggle(ec)}>
                            {ec.is_active ? 'Off' : 'On'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── CREATE FORM MODAL ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ duration: 0.3 }} className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 6 }}>⚡ Generate Exam Code</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 20 }}>A unique GR-COLLEGE-XXXXXX code will be auto-generated (legacy LW- codes remain fully supported).</p>

              {error && <div className="alert alert-error mb-2" style={{ fontSize: '0.88rem' }}>{error}</div>}

              <form id="exam-code-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">College *</label>
                  <select className="form-input" value={form.college_id} onChange={e => setForm(p => ({ ...p, college_id: e.target.value }))} required
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                    <option value="">Select College</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.college_name} ({c.college_code})</option>)}
                  </select>
                  {colleges.length === 0 && <div className="text-xs" style={{ marginTop: 4, color: '#FDCB6E' }}>⚠️ No colleges found. <button type="button" className="btn-ghost" style={{ color: '#a29bfe', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '0.78rem', padding: 0, textDecoration: 'underline' }} onClick={() => { setShowForm(false); navigate('/admin/colleges'); }}>Add College first</button></div>}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Exam Name *</label>
                  <input className="form-input" placeholder="CRT-DAY-12 / Aptitude Mock Test" value={form.exam_name} onChange={e => setForm(p => ({ ...p, exam_name: e.target.value }))} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Subject</label>
                    <input className="form-input" placeholder="Aptitude / Coding" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Total Questions</label>
                    <input className="form-input" type="number" min="1" max="200" value={form.total_questions} onChange={e => setForm(p => ({ ...p, total_questions: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Duration (minutes)</label>
                  <input className="form-input" type="number" min="5" max="300" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start Time *</label>
                    <input className="form-input" type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">End Time *</label>
                    <input className="form-input" type="datetime-local" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} required />
                  </div>
                </div>

                <div style={{ background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  💡 Code preview: <strong style={{ color: '#a29bfe', fontFamily: 'monospace' }}>GR-{form.college_id ? (colleges.find(c => String(c.id) === form.college_id)?.college_code || 'CODE') : 'CODE'}-XXXXXX</strong>
                  <br />Share this code with your entire college batch. Existing LW- and new GR- codes are accepted seamlessly.
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button id="exam-code-form-cancel" type="button" className="btn btn-ghost btn-full" onClick={() => setShowForm(false)}>Cancel</button>
                  <button id="exam-code-form-generate" type="submit" className="btn btn-primary btn-full" disabled={saving || colleges.length === 0}>
                    {saving ? <><div className="btn-spinner" /> Generating...</> : '⚡ Generate Code'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR MODAL ── */}
      <AnimatePresence>
        {qrModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setQrModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="modal" style={{ maxWidth: 420, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 4 }}>📷 Exam Code QR</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Share this QR or code with your college batch</p>

              <div style={{ display: 'inline-block', background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <img src={qrModal.qrUrl} alt="Exam Code QR" style={{ width: 220, height: 220, display: 'block' }} />
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 900, color: '#a29bfe', marginBottom: 12, letterSpacing: '0.06em' }}>
                {qrModal.code.exam_code}
              </div>

              <div style={{ background: 'rgba(108,92,231,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: 4 }}>📝 {qrModal.code.exam_name}</div>
                <div>⏱️ {qrModal.code.duration_minutes} min | ❓ {qrModal.code.total_questions} questions</div>
                <div style={{ marginTop: 8, wordBreak: 'break-all', color: '#a29bfe', fontSize: '0.78rem' }}>
                  🔗 {qrModal.entryUrl}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <a
                  href={qrModal.qrUrl}
                  download={`${qrModal.code.exam_code}-qr.png`}
                  className="btn btn-primary btn-sm"
                >
                  ⬇️ Download QR
                </a>
                <button onClick={() => navigator.clipboard.writeText(qrModal.code.exam_code)} className="btn btn-secondary btn-sm">
                  📋 Copy Code
                </button>
                <button id="close-qr-modal" onClick={() => setQrModal(null)} className="btn btn-ghost btn-sm">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── IMPORT QUESTIONS MODAL ── */}
      <AnimatePresence>
        {importModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setImportModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 4 }}>📥 Import Questions</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 4 }}>for exam code: <strong style={{ color: '#a29bfe', fontFamily: 'monospace' }}>{importModal.exam_code}</strong></p>
              <p className="text-muted text-xs" style={{ marginBottom: 20 }}>Upload an .xlsx file. Supports 1-Click format (question_text, type, option1 | option2 | option3 | option4, correct_index, marks) or multi-column format.</p>

              {error && <div className="alert alert-error mb-2" style={{ fontSize: '0.88rem' }}>{error}</div>}

              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
                style={{ marginBottom: 16, cursor: 'pointer' }}
              >
                <div className="upload-icon">📊</div>
                <div className="upload-text">{importFile ? importFile.name : 'Click to select Excel file (.xlsx)'}</div>
                <div className="upload-hint">Max 5MB</div>
                <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => setImportFile(e.target.files?.[0] || null)} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={() => setImportModal(null)}>Cancel</button>
                <button id="import-questions-submit" type="button" className="btn btn-primary btn-full" disabled={!importFile || importing} onClick={handleImport}>
                  {importing ? <><div className="btn-spinner" /> Importing...</> : '📥 Import Questions'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
