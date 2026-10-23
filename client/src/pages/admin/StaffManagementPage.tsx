import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listStaff,
  createStaff,
  toggleStaffActive,
  resetStaffPassword,
  updateStaffPermissions,
  deleteStaff,
  type StaffMember,
} from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import AnimatedCounter from '../../components/AnimatedCounter';

export const FACULTY_PERMISSIONS = [
  {
    key: 'create_questions',
    label: 'Author & Edit Questions',
    description: 'Create, update, and delete assessment questions and question banks.',
    badge: 'Questions',
  },
  {
    key: 'upload_excel',
    label: 'Upload Excel & Rosters',
    description: 'Bulk upload question spreadsheets (.xlsx) and candidate student rosters.',
    badge: 'Uploads',
  },
  {
    key: 'view_results',
    label: 'View Results & Analytics',
    description: 'Access exam sessions, participant history, and question/topic performance breakdown.',
    badge: 'Results',
  },
  {
    key: 'export_data',
    label: 'Export Data & Reports',
    description: 'Export official Excel grade sheets, PDF score reports, and student batches.',
    badge: 'Exports',
  },
  {
    key: 'manage_exams',
    label: 'Create & Manage Exams',
    description: 'Create new exams, toggle active status, and modify assessment parameters.',
    badge: 'Exams',
  },
  {
    key: 'manage_students',
    label: 'Manage Students & Resets',
    description: 'Create and update student profiles, reset passwords, and manage enrollments.',
    badge: 'Students',
  },
];

export default function StaffManagementPage() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Permission Matrix Modal State
  const [selectedStaffForPerms, setSelectedStaffForPerms] = useState<StaffMember | null>(null);
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'faculty' as 'faculty' | 'super_admin' | 'inspector',
    college_id: 1,
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
      if (err?.response?.status === 401) {
        setError('Admin session expired. Please re-authenticate.');
      }
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

  async function handleResetPassword(member: StaffMember) {
    if (!confirm(`Reset password for ${member.name} (${member.email})? A new temporary password will be generated and emailed.`)) {
      return;
    }
    setError('');
    setSuccessMsg('');
    try {
      const res = await resetStaffPassword(member.id);
      setSuccessMsg(`Temporary password generated for ${member.name}: ${res.data.temporaryPassword} (Welcome/Reset email dispatched)`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset staff password');
    }
  }

  function openPermissionsModal(member: StaffMember) {
    setSelectedStaffForPerms(member);
    setActivePermissions(member.permissions || ['create_questions', 'view_results']);
    setError('');
    setSuccessMsg('');
  }

  function togglePermission(key: string) {
    setActivePermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleSavePermissions() {
    if (!selectedStaffForPerms) return;
    setSavingPerms(true);
    setError('');
    setSuccessMsg('');
    try {
      await updateStaffPermissions(selectedStaffForPerms.id, activePermissions);
      setStaff((prev) =>
        prev.map((s) =>
          s.id === selectedStaffForPerms.id ? { ...s, permissions: activePermissions } : s
        )
      );
      setSuccessMsg(`Permissions updated successfully for ${selectedStaffForPerms.name}`);
      setSelectedStaffForPerms(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSavingPerms(false);
    }
  }

  async function handleDeleteStaff(member: StaffMember) {
    if (
      !confirm(
        `Are you sure you want to permanently delete staff account for ${member.name} (${member.email})?`
      )
    ) {
      return;
    }
    setError('');
    setSuccessMsg('');
    try {
      await deleteStaff(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      setSuccessMsg(`Staff account for ${member.name} deleted successfully`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete staff account');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password ? form.password.trim() : undefined,
        role: form.role,
      };
      if (form.role === 'inspector') {
        payload.college_id = Number(form.college_id) || 1;
      }
      const res = await createStaff(payload);
      if (res.data?.staff) {
        setStaff((prev) => [res.data.staff, ...prev]);
        setSuccessMsg(
          `Staff account created for ${res.data.staff.name}! Temporary password: ${res.data.temporaryPassword || 'Generated'} (Welcome email dispatched)`
        );
        setShowCreateModal(false);
        setForm({ name: '', email: '', password: '', role: 'faculty', college_id: 1 });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create staff account');
    } finally {
      setSubmitting(false);
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
  const inspectorCount = staff.filter((s) => s.role === 'inspector' || s.role === 'college_admin').length;
  const superAdminCount = staff.filter((s) => s.role === 'super_admin' || s.role === 'admin').length;
  const activeCount = staff.filter((s) => s.is_active).length;

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="staff" />

        {/* Main Content */}
        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>Staff Governance & Role Hierarchy</h1>
              <p className="text-muted text-sm">
                Manage Super Admins, College Inspectors (Principals), and Faculty Trainers with server-side role enforcement.
              </p>
            </div>
            <button
              id="add-faculty-btn"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ Add Staff / Inspector / Faculty
            </button>
          </div>

          {error && <div className="alert alert-error mb-2">⚠️ {error}</div>}
          {successMsg && <div className="alert alert-success mb-2">✅ {successMsg}</div>}

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Faculty Members
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                <AnimatedCounter value={facultyCount} />
              </div>
            </div>
            <div className="card card-sm" style={{ borderLeft: '3px solid #EAB308' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Inspectors (Principals)
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#FACC15' }}>
                <AnimatedCounter value={inspectorCount} />
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
            <div className="card card-sm" style={{ borderLeft: '3px solid var(--color-success)' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                Active Accounts
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-success)' }}>
                <AnimatedCounter value={activeCount} />
              </div>
            </div>
          </div>

          {/* Staff Table */}
          <div className="card" style={{ padding: '24px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              Authorized Personnel Roster & Security
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
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Staff Name & Email</th>
                    <th style={{ padding: '12px' }}>Role & Scope</th>
                    <th style={{ padding: '12px' }}>2FA Security</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Created</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const isSelf = member.id === currentUser.id;
                    const roleLabel =
                      member.role === 'super_admin' || member.role === 'admin'
                        ? '🛡️ Super Admin'
                        : member.role === 'inspector' || member.role === 'college_admin'
                        ? `🏛️ Inspector (College #${member.college_id || 1})`
                        : '👨‍🏫 Faculty Member';

                    return (
                      <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{member.name}</div>
                          <div className="text-muted text-xs font-mono">{member.email}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 8,
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background:
                                member.role === 'super_admin' || member.role === 'admin'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : member.role === 'inspector' || member.role === 'college_admin'
                                  ? 'rgba(234, 179, 8, 0.2)'
                                  : 'rgba(16, 185, 129, 0.2)',
                              color:
                                member.role === 'super_admin' || member.role === 'admin'
                                  ? '#93C5FD'
                                  : member.role === 'inspector' || member.role === 'college_admin'
                                  ? '#FDE047'
                                  : '#6EE7B7',
                            }}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {member.two_factor_enabled ? (
                            <span style={{ fontSize: '0.74rem', color: '#34D399', fontWeight: 700 }}>
                              🔐 2FA Active (TOTP)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)' }}>
                              Standard Password
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${member.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {member.is_active ? '● Active' : '○ Deactivated'}
                          </span>
                        </td>
                        <td className="text-muted text-xs" style={{ padding: '12px' }}>
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {member.role === 'faculty' && (
                              <button
                                id={`perms-btn-${member.id}`}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                                onClick={() => openPermissionsModal(member)}
                                title="Configure Faculty Permission Matrix"
                              >
                                ⚙️ Matrix ({member.permissions?.length ?? 2})
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleResetPassword(member)}
                            >
                              Reset PW
                            </button>
                            {!isSelf && (
                              <>
                                <button
                                  id={`toggle-staff-${member.id}`}
                                  className={`btn btn-sm ${member.is_active ? 'btn-danger' : 'btn-primary'}`}
                                  style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                                  onClick={() => handleToggleStatus(member)}
                                >
                                  {member.is_active ? 'Deactivate' : 'Reactivate'}
                                </button>
                                <button
                                  id={`delete-staff-${member.id}`}
                                  className="btn btn-sm btn-ghost text-danger"
                                  style={{ padding: '3px 8px', fontSize: '0.74rem', color: 'var(--color-danger)' }}
                                  onClick={() => handleDeleteStaff(member)}
                                  title="Delete Staff Account"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
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
              style={{ maxWidth: 480 }}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6 }}>
                Create Staff / Inspector Account
              </h3>
              <p className="text-muted text-sm mb-3">
                Account creation dispatches a welcome email with a temporary password and requires a password change on first login.
              </p>

              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label" htmlFor="staff-name">Full Name *</label>
                  <input
                    id="staff-name"
                    className="form-input"
                    type="text"
                    required
                    placeholder="e.g. Dr. K. V. Rao / Faculty Trainer"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-email">Institutional Email *</label>
                  <input
                    id="staff-email"
                    className="form-input"
                    type="email"
                    required
                    placeholder="e.g. faculty@logicwhilelire.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-password">Temporary Password (Leave blank to auto-generate)</label>
                  <input
                    id="staff-password"
                    className="form-input"
                    type="password"
                    placeholder="Auto-generated if left blank"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-role">Role Assignment *</label>
                  <select
                    id="staff-role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  >
                    <option value="faculty">Faculty / Trainer (Scoped to own assessments & questions)</option>
                    <option value="inspector">Inspector (College Principal Level - Scoped to college)</option>
                    <option value="super_admin">Super Administrator (Full platform control & backups)</option>
                  </select>
                </div>

                {form.role === 'inspector' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="staff-college">Assigned College Scope *</label>
                    <select
                      id="staff-college"
                      className="form-input"
                      value={form.college_id}
                      onChange={(e) => setForm({ ...form, college_id: Number(e.target.value) })}
                    >
                      <option value={1}>VR Siddhartha Engineering College (#1)</option>
                      <option value={2}>KL University (#2)</option>
                    </select>
                  </div>
                )}

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
                    {submitting ? 'Creating...' : 'Enroll & Dispatch Welcome Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permission Matrix Modal (Phase 1 RBAC) */}
        {selectedStaffForPerms && (
          <div className="modal-overlay" onClick={() => setSelectedStaffForPerms(null)}>
            <div
              className="modal animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 580, background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  ⚙️ Faculty Permission Matrix
                </h3>
                <span className="badge badge-primary font-mono text-xs">
                  {selectedStaffForPerms.name}
                </span>
              </div>
              <p className="text-muted text-xs mb-3">
                Tick which specific assessment capabilities this faculty member is permitted to execute. Unchecked actions will be blocked server-side on every route.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setActivePermissions(FACULTY_PERMISSIONS.map((p) => p.key))}
                >
                  ✓ Select All Permissions
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setActivePermissions([])}
                >
                  ✕ Clear All
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                {FACULTY_PERMISSIONS.map((perm) => {
                  const isChecked = activePermissions.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      id={`perm-card-${perm.key}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isChecked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm.key)}
                        style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isChecked ? '#93C5FD' : '#f8fafc' }}>
                            {perm.label}
                          </span>
                          <span className="badge badge-neutral text-xs" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            {perm.badge}
                          </span>
                        </div>
                        <div className="text-muted text-xs" style={{ lineHeight: 1.4 }}>
                          {perm.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedStaffForPerms(null)}
                  disabled={savingPerms}
                >
                  Cancel
                </button>
                <button
                  id="save-permissions-btn"
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSavePermissions}
                  disabled={savingPerms}
                >
                  {savingPerms ? 'Saving Matrix...' : 'Save Permission Matrix'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
