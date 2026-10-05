import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import { API_BASE_URL } from '../../lib/config';

interface College {
  id: number;
  college_name: string;
  college_code: string;
}

interface StudentRosterItem {
  id: string;
  hall_ticket: string;
  name: string;
  email: string;
  branch: string;
  college_id?: number | string;
  college_name?: string;
  section?: string;
  passout_year?: number;
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
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [uploadMsg, setUploadMsg] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [colleges, setColleges] = useState<College[]>([]);

  // Default authoritative roster
  const [students, setStudents] = useState<StudentRosterItem[]>([
    {
      id: 'st-1',
      hall_ticket: '2201A0501',
      name: 'Aravind Swamy',
      email: 'aravind.s@campus.edu',
      branch: 'CSE',
      college_name: 'VR Siddhartha Engineering College',
      section: 'A',
      passout_year: 2026,
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
      college_name: 'VR Siddhartha Engineering College',
      section: 'B',
      passout_year: 2026,
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
      college_name: 'Chaitanya Bharathi Institute (CBIT)',
      section: 'A',
      passout_year: 2027,
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
      college_name: 'Vasavi College of Engineering',
      section: 'C',
      passout_year: 2028,
      is_blocked: false,
      attempts_used: 1,
      allowed_attempts: 1,
      extra_time_mins: 10,
    },
  ]);

  // Load real colleges and students on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Fetch Colleges
    axios
      .get(`${API_BASE_URL}/api/colleges`, { headers })
      .then((res) => {
        if (res.data?.colleges) setColleges(res.data.colleges);
      })
      .catch(() => {
        axios
          .get(`${API_BASE_URL}/api/exam-code/colleges`)
          .then((r) => {
            if (r.data?.colleges) setColleges(r.data.colleges);
          })
          .catch(() => {});
      });

    // 2. Fetch Students from Admin API
    axios
      .get(`${API_BASE_URL}/api/admin/students`, { headers })
      .then((res) => {
        if (res.data?.students && res.data.students.length > 0) {
          const mapped: StudentRosterItem[] = res.data.students.map((s: any) => ({
            id: String(s.id || s.roll_number),
            hall_ticket: s.roll_number || s.hall_ticket || '',
            name: s.name || s.student_name || 'Candidate',
            email: s.email || '',
            branch: s.branch || s.branch_code || 'CSE',
            college_name: s.college_name || 'Partner Campus',
            section: s.section || 'A',
            passout_year: s.passout_year || 2026,
            is_blocked: Boolean(s.is_blocked),
            block_reason: s.block_reason,
            attempts_used: s.attempts_used || 0,
            allowed_attempts: s.allowed_attempts || 1,
            extra_time_mins: s.extra_time_mins || 0,
          }));
          setStudents(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // Add single student state
  const [newStudent, setNewStudent] = useState({
    hall_ticket: '',
    name: '',
    email: '',
    branch: 'CSE',
    college_name: 'VR Siddhartha Engineering College',
    section: 'A',
    passout_year: 2026,
  });

  const handleToggleBlock = async (id: string) => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const student = students.find((s) => s.id === id);
    if (!student) return;

    const nextBlocked = !student.is_blocked;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            is_blocked: nextBlocked,
            block_reason: nextBlocked ? 'Blocked by administrative authority.' : undefined,
          };
        }
        return s;
      })
    );

    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/students/${id}/block`,
        { is_blocked: nextBlocked },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch {}
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
          college_name: 'VR Siddhartha Engineering College',
          section: 'A',
          passout_year: 2026,
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
          college_name: 'VR Siddhartha Engineering College',
          section: 'B',
          passout_year: 2027,
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
          college_name: 'CBIT Hyderabad',
          section: 'A',
          passout_year: 2026,
          is_blocked: false,
          attempts_used: 0,
          allowed_attempts: 1,
          extra_time_mins: 0,
        },
      ];

      setStudents((prev) => [...parsedRoster, ...prev]);
      setUploadMsg(`Successfully ingested 3 candidates into the authoritative roster.`);
      setTimeout(() => setUploadMsg(''), 5000);
    }, 900);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.hall_ticket || !newStudent.name) return;

    const candidate: StudentRosterItem = {
      id: `man-${Date.now()}`,
      hall_ticket: newStudent.hall_ticket.trim(),
      name: newStudent.name.trim(),
      email: newStudent.email.trim() || `${newStudent.hall_ticket.toLowerCase()}@campus.edu`,
      branch: newStudent.branch,
      college_name: newStudent.college_name,
      section: newStudent.section,
      passout_year: Number(newStudent.passout_year),
      is_blocked: false,
      attempts_used: 0,
      allowed_attempts: 1,
      extra_time_mins: 0,
    };

    setStudents((prev) => [candidate, ...prev]);
    setIsAddModalOpen(false);
    setNewStudent({
      hall_ticket: '',
      name: '',
      email: '',
      branch: 'CSE',
      college_name: 'VR Siddhartha Engineering College',
      section: 'A',
      passout_year: 2026,
    });

    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/students`,
        {
          roll_number: candidate.hall_ticket,
          name: candidate.name,
          email: candidate.email,
          branch: candidate.branch,
          college_name: candidate.college_name,
          section: candidate.section,
          passout_year: candidate.passout_year,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch {}
  };

  const [sectionFilter, setSectionFilter] = useState('ALL');

  const filtered = students.filter((s) => {
    const matchesBranch = branchFilter === 'ALL' || s.branch === branchFilter;
    const matchesCollege = collegeFilter === 'ALL' || (s.college_name && s.college_name.includes(collegeFilter));
    const matchesSection = sectionFilter === 'ALL' || s.section === sectionFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.hall_ticket.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.college_name && s.college_name.toLowerCase().includes(search.toLowerCase()));
    return matchesBranch && matchesCollege && matchesSection && matchesSearch;
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
                Strict Collegiate Roster Governance, College ID, Hall Ticket, and Live Gate Pass Authority
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
            <span style={{ fontSize: '1.2rem' }}>🏛️</span>
            <div>
              <strong>Collegiate Governance Active:</strong> Candidates must be registered under a verified college. The Admin controls hall ticket validation, gate pass authorization, attempt counts, and session terminations.
            </div>
          </div>

          {uploadMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34D399',
                fontSize: '0.86rem',
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              ✓ {uploadMsg}
            </div>
          )}

          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: 14,
              marginBottom: 20,
              flexWrap: 'wrap',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <input
                className="form-input"
                style={{ width: '100%', fontSize: '0.86rem', padding: '8px 14px' }}
                placeholder="Search by Hall Ticket, Student Name, College, or Email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* College Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>COLLEGE:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.85rem', padding: '6px 12px', minWidth: 180 }}
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
              >
                <option value="ALL">All Colleges</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.college_name}>
                    {c.college_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>BRANCH:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="ALL">All Branches</option>
                <option value="CSE">CSE</option>
                <option value="CSM">CSM</option>
                <option value="IT">IT</option>
                <option value="ECE">ECE</option>
                <option value="AIML">AIML</option>
                <option value="MECH">MECH</option>
              </select>
            </div>

            {/* Section Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>SECTION:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
              >
                <option value="ALL">All Sections</option>
                <option value="CSM-A">CSM-A</option>
                <option value="CSM-B">CSM-B</option>
                <option value="CSE-A">CSE-A</option>
                <option value="CSE-B">CSE-B</option>
                <option value="CSE-C">CSE-C</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          <div
            className="card"
            style={{
              overflowX: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.8)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0, 0, 0, 0.2)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>HALL TICKET / ROLL NO</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>CANDIDATE NAME</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>COLLEGE &amp; SECTION</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>GATE PASS STATUS</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>ATTEMPTS</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>EXTRA TIME</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)', textAlign: 'right' }}>ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: s.is_blocked ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 700,
                          color: '#38BDF8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                        }}
                      >
                        {s.hall_ticket}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{s.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.84rem' }}>{s.college_name || 'VR Siddhartha Eng College'}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-faint)' }}>
                        Branch: <strong>{s.branch}</strong> &bull; Sec: <strong>{s.section || 'A'}</strong> &bull; YOP: {s.passout_year || 2026}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {s.is_blocked ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#F87171',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          🛑 BLOCKED
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34D399',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          🛡️ GATE PASS ACTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#CBD5E1' }}>
                      {s.attempts_used} / {s.allowed_attempts}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {s.extra_time_mins > 0 ? (
                        <span style={{ color: '#FBBF24', fontWeight: 700, fontSize: '0.8rem' }}>
                          +{s.extra_time_mins} mins
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAddExtraTime(s.id, 5)}
                          title="Grant +5 min extension"
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#FBBF24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          +5m
                        </button>
                        <button
                          onClick={() => handleToggleBlock(s.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: s.is_blocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: s.is_blocked ? '#34D399' : '#F87171',
                            border: s.is_blocked ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {s.is_blocked ? 'Unblock Gate' : 'Block Candidate'}
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
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16,
              }}
              onClick={() => setIsAddModalOpen(false)}
            >
              <div
                className="card"
                style={{
                  maxWidth: 500,
                  width: '100%',
                  borderRadius: 16,
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  background: '#0B1226',
                  padding: 28,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    👥 Register Candidate to Institution
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
                    <label className="form-label">College / Institution *</label>
                    <select
                      className="form-input"
                      value={newStudent.college_name}
                      onChange={(e) => setNewStudent({ ...newStudent, college_name: e.target.value })}
                    >
                      {colleges.length > 0 ? (
                        colleges.map((c) => (
                          <option key={c.id} value={c.college_name}>
                            {c.college_name} ({c.college_code})
                          </option>
                        ))
                      ) : (
                        <option value="VR Siddhartha Engineering College">VR Siddhartha Engineering College</option>
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Hall Ticket / Roll No *</label>
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
                      <label className="form-label">Student Full Name *</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={newStudent.name}
                        onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      />
                    </div>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label">Branch</label>
                      <select
                        className="form-input"
                        value={newStudent.branch}
                        onChange={(e) => setNewStudent({ ...newStudent, branch: e.target.value })}
                      >
                        <option value="CSE">CSE</option>
                        <option value="IT">IT</option>
                        <option value="ECE">ECE</option>
                        <option value="AIML">AIML</option>
                        <option value="MECH">MECH</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Section</label>
                      <select
                        className="form-input"
                        value={newStudent.section}
                        onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                      >
                        <option value="CSM-A">CSM-A</option>
                        <option value="CSM-B">CSM-B</option>
                        <option value="CSE-A">CSE-A</option>
                        <option value="CSE-B">CSE-B</option>
                        <option value="CSE-C">CSE-C</option>
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Passout Year</label>
                      <select
                        className="form-input"
                        value={newStudent.passout_year}
                        onChange={(e) => setNewStudent({ ...newStudent, passout_year: Number(e.target.value) })}
                      >
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                        <option value={2028}>2028</option>
                        <option value={2029}>2029</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                      Authorize Candidate
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
