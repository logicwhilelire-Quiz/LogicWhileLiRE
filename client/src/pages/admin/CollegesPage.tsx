import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface College {
  id: number;
  college_name: string;
  college_code: string;
  city: string;
  state: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
  registration_enabled?: boolean;
  created_at: string;
}

export default function CollegesPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCollege, setEditCollege] = useState<College | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    college_name: '',
    college_code: '',
    city: '',
    state: 'Andhra Pradesh',
    contact_email: '',
    contact_phone: '',
    registration_enabled: true,
  });

  async function load() {
    setLoading(true);
    try {
      const res = await api('/api/admin/colleges');
      setColleges(res.data.colleges || []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Admin session has expired or is invalid. Please log in again.');
      } else {
        setError('Failed to load colleges');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditCollege(null);
    setForm({ college_name: '', college_code: '', city: '', state: 'Andhra Pradesh', contact_email: '', contact_phone: '', registration_enabled: true });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function openEdit(college: College) {
    setEditCollege(college);
    setForm({
      college_name: college.college_name,
      college_code: college.college_code,
      city: college.city || '',
      state: college.state || 'Andhra Pradesh',
      contact_email: college.contact_email || '',
      contact_phone: college.contact_phone || '',
      registration_enabled: college.registration_enabled !== false,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editCollege) {
        await api(`/api/admin/colleges/${editCollege.id}`, { method: 'PATCH', data: form });
        setSuccess('College updated successfully');
      } else {
        await api('/api/admin/colleges', { method: 'POST', data: form });
        setSuccess('College created successfully');
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Admin session has expired. Please log in again to continue.');
      } else {
        setError(err?.response?.data?.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(college: College) {
    try {
      await api(`/api/admin/colleges/${college.id}`, { method: 'PATCH', data: { is_active: !college.is_active } });
      setColleges(prev => prev.map(c => c.id === college.id ? { ...c, is_active: !c.is_active } : c));
    } catch {
      setError('Failed to update status');
    }
  }

  async function handleToggleRegistration(college: College) {
    try {
      const nextVal = !(college.registration_enabled !== false);
      await api(`/api/admin/colleges/${college.id}`, { method: 'PATCH', data: { registration_enabled: nextVal } });
      setColleges(prev => prev.map(c => c.id === college.id ? { ...c, registration_enabled: nextVal } : c));
      setSuccess(`Student registration ${nextVal ? 'ENABLED' : 'DISABLED'} for ${college.college_name}`);
    } catch {
      setError('Failed to update registration status');
    }
  }

  async function handleDelete(college: College) {
    if (!confirm(`Delete ${college.college_name}? This will also delete all exam codes for this college.`)) return;
    try {
      await api(`/api/admin/colleges/${college.id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Delete failed');
    }
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      const res = await axios.post(`${BASE_URL}/api/admin/colleges/import`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setSuccess(`✅ Successfully imported ${res.data.inserted || 0} college(s) from Excel!`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to import colleges from Excel spreadsheet.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--color-bg, #070a14)' }}>
      {/* Sidebar */}
      <AdminSidebar activeTab="colleges" />

      {/* Main */}
      <main className="admin-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>🏛️ Manage Colleges</h1>
            <p className="text-muted text-sm">Add and manage colleges for the exam code system.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBulkUpload}
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
            />
            <button
              id="bulk-import-college-btn"
              className="btn btn-secondary"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              style={{ background: '#002147', color: '#FFFFFF', border: '1px solid #CBD5E1' }}
            >
              {importing ? 'Importing...' : '📥 Bulk Import Excel'}
            </button>
            <button id="add-college-btn" className="btn btn-primary" onClick={openAdd}>
              ➕ Add College
            </button>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="alert alert-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{error}</span>
              {(error.toLowerCase().includes('expired') || error.toLowerCase().includes('token') || error.toLowerCase().includes('authentication') || error.toLowerCase().includes('session')) && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="btn btn-sm btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '4px 12px', fontSize: '0.8rem' }}
                >
                  🔑 Log In
                </button>
              )}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="alert alert-success" style={{ marginBottom: 16 }} onClick={() => setSuccess('')}>
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div className="card card-sm">
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Total Colleges</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{colleges.length}</div>
          </div>
          <div className="card card-sm" style={{ borderLeft: '3px solid var(--color-success)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Active</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>{colleges.filter(c => c.is_active).length}</div>
          </div>
          <div className="card card-sm" style={{ borderLeft: '3px solid var(--hp-amber, #f59e0b)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>States</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--hp-amber, #f59e0b)' }}>{new Set(colleges.map(c => c.state).filter(Boolean)).size}</div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
          </div>
        ) : colleges.length === 0 ? (
          error ? (
            <div className="card text-center" style={{ padding: 60 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
              <p className="font-bold mb-1" style={{ color: 'var(--color-danger)' }}>Could not load colleges</p>
              <p className="text-muted text-sm mb-3">{error}</p>
              <button className="btn btn-primary" onClick={() => navigate('/admin/login')}>🔑 Log In to View Colleges</button>
            </div>
          ) : (
            <div className="card text-center" style={{ padding: 60 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏛️</div>
              <p className="font-bold mb-1">No colleges added yet</p>
              <p className="text-muted text-sm mb-2">Add your first college to start generating exam codes.</p>
              <button className="btn btn-primary" onClick={openAdd}>Add First College</button>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>College Name</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Campus Status</th>
                  <th>Student Registration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map(college => (
                  <tr key={college.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{college.college_name}</div>
                      {college.contact_email && <div className="text-muted text-xs">{college.contact_email}</div>}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', background: 'rgba(108,92,231,0.12)', color: '#a29bfe', borderRadius: 6, padding: '2px 8px', fontSize: '0.85rem', fontWeight: 700 }}>
                        {college.college_code}
                      </span>
                    </td>
                    <td className="text-muted">{college.city || '—'}</td>
                    <td className="text-muted">{college.state || '—'}</td>
                    <td>
                      <span className={`badge ${college.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {college.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        id={`toggle-reg-college-${college.id}`}
                        type="button"
                        onClick={() => handleToggleRegistration(college)}
                        className={`badge ${college.registration_enabled !== false ? 'badge-success' : 'badge-neutral'}`}
                        style={{ cursor: 'pointer', border: '1px solid currentColor', padding: '4px 10px', fontSize: '0.78rem' }}
                        title="Click to toggle student registration"
                      >
                        {college.registration_enabled !== false ? '✓ Enabled' : '✕ Disabled'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button id={`edit-college-${college.id}`} className="btn btn-secondary btn-sm" onClick={() => openEdit(college)}>✏️ Edit</button>
                        <button id={`toggle-college-${college.id}`} className={`btn btn-sm ${college.is_active ? 'btn-danger' : 'btn-primary'}`} onClick={() => handleToggle(college)}>
                          {college.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button id={`exam-codes-college-${college.id}`} className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/exam-codes?college=${college.id}`)}>🔑 Codes</button>
                        <button id={`delete-college-${college.id}`} className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(college)} style={{ color: 'var(--color-danger)' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Form Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="modal"
              style={{ maxWidth: 520 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 20 }}>
                {editCollege ? '✏️ Edit College' : '🏛️ Add New College'}
              </h3>

              {error && (
                <div
                  className="alert alert-error mb-2"
                  style={{
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span>{error}</span>
                  {(error.toLowerCase().includes('expired') ||
                    error.toLowerCase().includes('token') ||
                    error.toLowerCase().includes('authentication') ||
                    error.toLowerCase().includes('session')) && (
                    <button
                      type="button"
                      onClick={() => navigate('/admin/login')}
                      className="btn btn-sm btn-primary"
                      style={{ whiteSpace: 'nowrap', padding: '4px 12px', fontSize: '0.8rem' }}
                    >
                      🔑 Log In
                    </button>
                  )}
                </div>
              )}

              <form id="college-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">College Name *</label>
                  <input className="form-input" placeholder="VR Siddhartha Engineering College" value={form.college_name}
                    onChange={e => setForm(p => ({ ...p, college_name: e.target.value }))} required />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">College Code *</label>
                  <input className="form-input font-mono" placeholder="VRSEC" value={form.college_code}
                    onChange={e => setForm(p => ({ ...p, college_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                    required disabled={!!editCollege}
                    style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} />
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Used in exam codes: GR-<strong>{form.college_code || 'CODE'}</strong>-XXXXXX
                    {editCollege && ' (cannot change after creation)'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">City</label>
                    <input className="form-input" placeholder="Vijayawada" value={form.city}
                      onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">State</label>
                    <input className="form-input" value={form.state}
                      onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Contact Email</label>
                  <input className="form-input" type="email" placeholder="principal@college.edu" value={form.contact_email}
                    onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Contact Phone</label>
                  <input className="form-input" placeholder="+91 99999 99999" value={form.contact_phone}
                    onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>

                <div className="form-group" style={{ margin: 0, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                    <input
                      id="form-registration-toggle"
                      type="checkbox"
                      checked={form.registration_enabled}
                      onChange={e => setForm(p => ({ ...p, registration_enabled: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Allow Student Registration</div>
                      <div className="text-muted text-xs">When enabled, students can select this college on the registration page</div>
                    </div>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button id="college-form-cancel" type="button" className="btn btn-ghost btn-full" onClick={() => setShowForm(false)}>Cancel</button>
                  <button id="college-form-save" type="submit" className="btn btn-primary btn-full" disabled={saving}>
                    {saving ? <><div className="btn-spinner" /> Saving...</> : (editCollege ? 'Update College' : 'Add College')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
