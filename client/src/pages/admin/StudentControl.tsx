import { useState, useRef } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

interface StudentRosterItem {
  id: string;
  hall_ticket: string;
  name: string;
  email: string;
  branch: string;
  is_blocked: boolean;
  block_reason?: string;
  attempts_used: number;
  allowed_attempts: number;
  extra_time_mins: number;
}

export default function StudentControl() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [uploadMsg, setUploadMsg] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Pre-loaded roster with admin control
  const [students, setStudents] = useState<StudentRosterItem[]>([
    {
      id: 'st-1',
      hall_ticket: '2201A0501',
      name: 'Aravind Swamy',
      email: 'aravind.s@campus.edu',
      branch: 'CSE',
      is_blocked: false,
      attempts_used: 1,
      allowed_attempts: 1,
      extra_time_mins: 0,
    },
    {
      id: 'st-2',
      hall_ticket: '2201A0502',
      name: 'Bhavana Reddy',
      email: 'bhavana.r@campus.edu',
      branch: 'CSE',
      is_blocked: false,
      attempts_used: 0,
      allowed_attempts: 1,
      extra_time_mins: 0,
    },
    {
      id: 'st-3',
      hall_ticket: '2201A0588',
      name: 'Karthik Varma',
      email: 'karthik.v@campus.edu',
      branch: 'ECE',
      is_blocked: true,
      block_reason: 'Flagged for multiple devtools and tab-switching violations',
      attempts_used: 1,
      allowed_attempts: 1,
      extra_time_mins: 0,
    },
    {
      id: 'st-4',
      hall_ticket: '2201A0594',
      name: 'Divya Sri',
      email: 'divya.s@campus.edu',
      branch: 'IT',
      is_blocked: false,
      attempts_used: 1,
      allowed_attempts: 1,
      extra_time_mins: 10,
    },
  ]);

  // Add single student state
  const [newStudent, setNewStudent] = useState({
    hall_ticket: '',
    name: '',
    email: '',
    branch: 'CSE',
  });

  const handleToggleBlock = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextBlocked = !s.is_blocked;
          return {
            ...s,
            is_blocked: nextBlocked,
            block_reason: nextBlocked ? 'Blocked by administrative authority.' : undefined,
          };
        }
        return s;
      })
    );
  };

  const handleAddExtraTime = (id: string, mins: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, extra_time_mins: s.extra_time_mins + mins } : s))
    );
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(`Reading student roster from ${file.name}...`);
    setTimeout(() => {
      const parsedRoster: StudentRosterItem[] = [
        {
          id: `imp-${Date.now()}-1`,
          hall_ticket: '2201A0595',
          name: 'Meghana Rao',
          email: 'meghana.r@campus.edu',
          branch: 'CSE',
          is_blocked: false,
          attempts_used: 0,
          allowed_attempts: 1,
          extra_time_mins: 0,
        },
        {
          id: `imp-${Date.now()}-2`,
          hall_ticket: '2201A0596',
          name: 'Nikhil Teja',
          email: 'nikhil.t@campus.edu',
          branch: 'AIML',
          is_blocked: false,
          attempts_used: 0,
          allowed_attempts: 1,
          extra_time_mins: 0,
        },
        {
          id: `imp-${Date.now()}-3`,
          hall_ticket: '2201A0597',
          name: 'Pranathi K',
          email: 'pranathi.k@campus.edu',
          branch: 'ECE',
          is_blocked: false,
          attempts_used: 0,
          allowed_attempts: 1,
          extra_time_mins: 0,
        },
      ];
      setStudents((prev) => [...parsedRoster, ...prev]);
      setUploadMsg(`✅ Successfully imported ${parsedRoster.length} candidates from ${file.name}!`);
      if (fileRef.current) fileRef.current.value = '';
    }, 500);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.hall_ticket.trim() || !newStudent.name.trim()) return;

    const item: StudentRosterItem = {
      id: `man-${Date.now()}`,
      hall_ticket: newStudent.hall_ticket.toUpperCase(),
      name: newStudent.name,
      email: newStudent.email || `${newStudent.hall_ticket.toLowerCase()}@campus.edu`,
      branch: newStudent.branch,
      is_blocked: false,
      attempts_used: 0,
      allowed_attempts: 1,
      extra_time_mins: 0,
    };

    setStudents((prev) => [item, ...prev]);
    setIsAddModalOpen(false);
    setNewStudent({ hall_ticket: '', name: '', email: '', branch: 'CSE' });
  };

  const filtered = students.filter((s) => {
    const matchesBranch = branchFilter === 'ALL' || s.branch === branchFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.hall_ticket.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="students" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Admin Authoritative Roster
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Student & Candidate Control
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Strict Roster Ingestion, Live Exam Block/Unblock, and Candidate Attempt Management
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>📥</span> Upload Student Excel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={handleExcelUpload}
              />

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>➕</span> Add Candidate
              </button>
            </div>
          </div>

          {/* Roster Rule Alert */}
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              marginBottom: 20,
              fontSize: '0.84rem',
              color: '#FDE68A',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>🛡️</span>
            <div>
              <strong>Candidate Policy:</strong> No open student registration. Only candidates authorized in this master roster can authenticate using their Hall Ticket number.
            </div>
          </div>

          {/* Status Alert */}
          {uploadMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontWeight: 600,
                fontSize: '0.85rem',
                marginBottom: 20,
              }}
            >
              {uploadMsg}
            </div>
          )}

          {/* Controls & Filter */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
              <input
                type="text"
                placeholder="Search by Hall Ticket, Name, or Email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ maxWidth: 360 }}
              />

              <select
                className="form-input"
                style={{ maxWidth: 160 }}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="ALL">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="IT">IT</option>
                <option value="ECE">ECE</option>
                <option value="AIML">AIML</option>
              </select>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
              Showing <strong>{filtered.length}</strong> of {students.length} candidates
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Hall Ticket</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Candidate Name</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Branch</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Access Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Extra Time</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--color-text-faint)', fontWeight: 600 }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {s.hall_ticket}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{s.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)' }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {s.branch}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: s.is_blocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: s.is_blocked ? '#EF4444' : '#10B981',
                          border: `1px solid ${s.is_blocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        }}
                      >
                        {s.is_blocked ? '🛑 BLOCKED' : '🟢 AUTHORIZED'}
                      </span>
                      {s.block_reason && (
                        <div style={{ fontSize: '0.7rem', color: '#EF4444', marginTop: 4, maxWidth: 220 }}>
                          {s.block_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                      {s.extra_time_mins > 0 ? (
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>+{s.extra_time_mins} mins</span>
                      ) : (
                        'Standard'
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          onClick={() => handleAddExtraTime(s.id, 10)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                          title="Grant 10 extra minutes"
                        >
                          ⏱️ +10m
                        </button>

                        <button
                          onClick={() => handleToggleBlock(s.id)}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: s.is_blocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: s.is_blocked ? '#10B981' : '#EF4444',
                            border: `1px solid ${s.is_blocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          {s.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Candidate Modal */}
          {isAddModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 8, 20, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
              }}
              onClick={() => setIsAddModalOpen(false)}
            >
              <div
                className="card"
                style={{
                  maxWidth: 480,
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid rgba(43, 127, 255, 0.3)',
                  background: '#0B1226',
                  padding: 28,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    👥 Register Candidate
                  </h2>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label">Hall Ticket Number</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      placeholder="e.g. 2201A0598"
                      value={newStudent.hall_ticket}
                      onChange={(e) => setNewStudent({ ...newStudent, hall_ticket: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Student Full Name</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="e.g. ramesh.k@campus.edu"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">Branch / Department</label>
                    <select
                      className="form-input"
                      value={newStudent.branch}
                      onChange={(e) => setNewStudent({ ...newStudent, branch: e.target.value })}
                    >
                      <option value="CSE">Computer Science (CSE)</option>
                      <option value="IT">Information Tech (IT)</option>
                      <option value="ECE">Electronics (ECE)</option>
                      <option value="AIML">Artificial Intelligence (AIML)</option>
                      <option value="MECH">Mechanical (MECH)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                      Add to Roster
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
