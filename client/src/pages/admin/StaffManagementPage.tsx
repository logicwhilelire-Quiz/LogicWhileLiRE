import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listStaff, createStaff, toggleStaffActive, adminLogout, type StaffMember } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';
import AnimatedCounter from '../../components/AnimatedCounter';

export default function StaffManagementPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'faculty' as 'faculty' | 'super_admin',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();

  const isSuperAdmin = currentUser.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    fetchStaff();
  }, [isSuperAdmin]);

  async function fetchStaff() {
    setLoading(true);
    try {
      const res = await listStaff();
      if (res.data?.staff) {
        setStaff(res.data.staff);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(member: StaffMember) {
    setError('');
    setSuccessMsg('');
    try {
      const res = await toggleStaffActive(member.id, !member.is_active);
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, is_active: !member.is_active } : s))
      );
      setSuccessMsg(res.data?.message || 'Status updated successfully');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update staff status');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await createStaff(form);
      if (res.data?.staff) {
        setStaff((prev) => [res.data.staff, ...prev]);
        setSuccessMsg(`Faculty account for ${res.data.staff.name} created successfully!`);
        setShowCreateModal(false);
        setForm({ name: '', email: '', password: '', role: 'faculty' });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create staff account');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await adminLogout();
    } catch (_) {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  if (!isSuperAdmin) {
    return (
      <AnimatedPage>
        <div className="page-center">
          <div className="card text-center" style={{ maxWidth: 440, padding: 36 }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Access Restricted</h2>
            <p className="text-muted text-sm mb-3">
              Staff Management is restricted to Institutional Super Administrators.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/admin/dashboard')}>
              Return to My Assessments
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  const facultyCount = staff.filter((s) => s.role === 'faculty').length;
  const superAdminCount = staff.filter((s) => s.role === 'super_admin').length;
  const activeCount = staff.filter((s) => s.is_active).length;

  return (
    <AnimatedPage>
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div style={{ marginBottom: 24 }}>
            <BrandLogo size="sm" />
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>
              Logged in as
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser.name || currentUser.email || 'Super Admin'}
            </div>
            <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginTop: 4 }}>
              🛡️ Super Admin
            </span>
          </div>

          <div className="admin-sidebar-title">Navigation</div>
          <button id="nav-dashboard" className="admin-nav-item" onClick={() => navigate('/admin/dashboard')}>
            📊 Dashboard
          </button>
          <button id="nav-staff" className="admin-nav-item active" onClick={() => navigate('/admin/staff')}>
            🛡️ Staff Management
          </button>
          <button id="nav-create-exam" className="admin-nav-item" onClick={() => navigate('/admin/create-exam')}>
            ➕ Create Exam
          </button>
          <button id="nav-import" className="admin-nav-item" onClick={() => navigate('/admin/import')}>
            📥 Import Questions
          </button>
          <button id="nav-sessions" className="admin-nav-item" onClick={() => navigate('/admin/sessions')}>
            👥 Sessions
          </button>
          <button id="nav-reports" className="admin-nav-item" onClick={() => navigate('/admin/reports')}>
            📈 Reports
          </button>
          <button id="nav-analytics" className="admin-nav-item" onClick={() => navigate('/admin/analytics')}>
            🔬 Analytics
          </button>

          <div style={{ marginTop: 'auto', paddingTop: 24 }}>
            <button id="admin-logout-btn" className="admin-nav-item" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>Faculty & Staff Governance</h1>
              <p className="text-muted text-sm">
                Manage trainer accounts across CRT, Coding Institute, and Enterprise software pillars.
              </p>
            </div>
            <button
              id="add-faculty-btn"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ Add Faculty Member
            </button>
          </div>

          {error && <div className="alert alert-error mb-2">⚠️ {error}</div>}
          {successMsg && <div className="alert alert-success mb-2">✅ {successMsg}</div>}

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Total Faculty
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                <AnimatedCounter value={facultyCount} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid var(--color-success)' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Active Accounts
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-success)' }}>
                <AnimatedCounter value={activeCount} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #6366f1' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Super Admins
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#818cf8' }}>
                <AnimatedCounter value={superAdminCount} />
              </div>
            </div>
          </div>

          {/* Staff Table */}
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              Authorized Personnel Roster
            </h2>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No staff members registered.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Name & Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const isSelf = member.id === currentUser.id;
                    return (
                      <tr key={member.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{member.name}</div>
                          <div className="text-muted text-xs font-mono">{member.email}</div>
                        </td>
                        <td>
                          {member.role === 'super_admin' ? (
                            <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                              🛡️ Super Admin
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontWeight: 600, color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}>
                              👨‍🏫 Faculty Trainer
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${member.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {member.is_active ? '● Active' : '○ Deactivated'}
                          </span>
                        </td>
                        <td className="text-muted text-xs">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {isSelf ? (
                            <span className="text-muted text-xs italic font-mono">(Your Account)</span>
                          ) : (
                            <button
                              id={`toggle-staff-${member.id}`}
                              className={`btn btn-sm ${member.is_active ? 'btn-danger' : 'btn-primary'}`}
                              onClick={() => handleToggleStatus(member)}
                            >
                              {member.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* Create Staff Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div
              className="modal animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 460 }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6 }}>
                Create New Staff Account
              </h3>
              <p className="text-muted text-sm mb-3">
                Faculty members can create assessments, upload questions, and monitor live proctoring for their exams.
              </p>

              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label" htmlFor="staff-name">Full Name</label>
                  <input
                    id="staff-name"
                    className="form-input"
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-email">Institutional Email</label>
                  <input
                    id="staff-email"
                    className="form-input"
                    type="email"
                    required
                    placeholder="e.g. rajesh@logicwhilelire.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-password">Initial Password</label>
                  <input
                    id="staff-password"
                    className="form-input"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-role">Role Assignment</label>
                  <select
                    id="staff-role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  >
                    <option value="faculty">Faculty / Trainer (Scoped to own assessments)</option>
                    <option value="super_admin">Super Administrator (Full platform control)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreateModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-create-staff-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
