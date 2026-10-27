import { useState, useEffect, useRef, useMemo } from 'react';
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

export interface CollegeBranch {
  branch_code: string;
  branch_name: string;
  batch_count: number;
  batches: string[];
  section_count: number;
  sections: string[];
  passout_years: number[];
  student_count: number;
  live_active_count: number;
}

export interface EnrichedStudent {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  roll_number: string;
  hall_ticket?: string;
  email: string;
  contact_number: string;
  college_id: number;
  college_name: string;
  branch: string;
  branch_code: string;
  section: string;
  batch: string;
  passout_year: number;
  year_of_passing?: number;
  student_gate_pass?: string;
  candidate_gate_pass?: string;
  is_verified: boolean;
  is_blocked: boolean;
  block_reason?: string | null;
  created_at: string;
  live_status?: {
    state: 'in_exam' | 'in_lobby' | 'cleared' | 'pending' | 'completed' | 'blocked';
    label: string;
    exam_code?: string;
    current_question?: number;
    score?: number;
    max_score?: number;
    violations?: number;
    started_at?: string;
    submitted_at?: string;
  };
}

export interface LiveStatusSummary {
  in_exam: number;
  in_lobby: number;
  cleared_ready: number;
  pending_clearance: number;
  completed: number;
  blocked: number;
}

export interface College {
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
  // Deep hierarchy & live telemetry:
  total_branches?: number;
  branches?: CollegeBranch[];
  total_batches?: number;
  batches?: string[];
  total_sections?: number;
  sections?: string[];
  passout_years?: number[];
  total_students?: number;
  live_status_summary?: LiveStatusSummary;
  students?: EnrichedStudent[];
}

export default function CollegesPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState<College[]>([]);
  const [overallSummary, setOverallSummary] = useState<{
    total_students: number;
    live_in_exam: number;
    pending_clearance: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCollege, setEditCollege] = useState<College | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter for main college table
  const [collegeSearch, setCollegeSearch] = useState('');

  // Deep-dive Inspector Modal State
  const [inspectCollege, setInspectCollege] = useState<College | null>(null);
  const [inspectTab, setInspectTab] = useState<'branches' | 'passout' | 'live' | 'students'>('branches');
  const [studentSearch, setStudentSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterPassoutYear, setFilterPassoutYear] = useState('ALL');
  const [filterLiveStatus, setFilterLiveStatus] = useState('ALL');

  const [form, setForm] = useState({
    college_name: '',
    college_code: '',
    city: '',
    state: 'Andhra Pradesh',
    contact_email: '',
    contact_phone: '',
    registration_enabled: true,
  });

  function enhanceCollegeRecord(c: any): College {
    const branches: CollegeBranch[] = c.branches && c.branches.length > 0 ? c.branches : [
      { branch_code: 'CSE', branch_name: 'Computer Science & Engineering', batch_count: 2, batches: ['Batch 1', 'Batch 2'], section_count: 2, sections: ['A', 'B'], passout_years: [2026, 2027, 2028], student_count: (c.students || []).filter((s: any) => s.branch === 'CSE').length, live_active_count: 0 },
      { branch_code: 'CSM', branch_name: 'CSE (AI & ML)', batch_count: 2, batches: ['Batch 1', 'Batch 2'], section_count: 2, sections: ['A', 'B'], passout_years: [2026, 2027, 2028], student_count: (c.students || []).filter((s: any) => s.branch === 'CSM').length, live_active_count: 0 },
      { branch_code: 'IT', branch_name: 'Information Technology', batch_count: 2, batches: ['Batch 1', 'Batch 2'], section_count: 2, sections: ['A', 'B'], passout_years: [2026, 2027, 2028], student_count: (c.students || []).filter((s: any) => s.branch === 'IT').length, live_active_count: 0 },
      { branch_code: 'ECE', branch_name: 'Electronics & Communication', batch_count: 2, batches: ['Batch 1', 'Batch 2'], section_count: 2, sections: ['A', 'B'], passout_years: [2026, 2027, 2028], student_count: (c.students || []).filter((s: any) => s.branch === 'ECE').length, live_active_count: 0 },
      { branch_code: 'AIML', branch_name: 'AI & Data Science', batch_count: 2, batches: ['Batch 1', 'Batch 2'], section_count: 2, sections: ['A', 'B'], passout_years: [2026, 2027, 2028], student_count: (c.students || []).filter((s: any) => s.branch === 'AIML').length, live_active_count: 0 },
    ];

    return {
      ...c,
      registration_enabled: c.registration_enabled !== false,
      total_branches: c.total_branches || branches.length,
      branches,
      total_batches: c.total_batches || c.batches?.length || 2,
      batches: c.batches && c.batches.length > 0 ? c.batches : ['Batch 1', 'Batch 2'],
      total_sections: c.total_sections || c.sections?.length || 2,
      sections: c.sections && c.sections.length > 0 ? c.sections : ['A', 'B'],
      passout_years: c.passout_years && c.passout_years.length > 0 ? c.passout_years : [2026, 2027, 2028, 2029, 2030],
      total_students: c.total_students ?? c.students?.length ?? 0,
      live_status_summary: c.live_status_summary || { in_exam: 0, in_lobby: 0, cleared_ready: 0, pending_clearance: 0, completed: 0, blocked: 0 },
      students: c.students || []
    };
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      let loadedColleges: College[] = [];
      let loaded = false;

      // Tier 1: Enriched admin breakdown
      try {
        const res = await api('/api/admin/colleges?breakdown=true');
        if (res.data && Array.isArray(res.data.colleges)) {
          loadedColleges = res.data.colleges.map(enhanceCollegeRecord);
          if (res.data.overall_summary) setOverallSummary(res.data.overall_summary);
          loaded = true;
        }
      } catch {
        // Silently continue to Tier 2
      }

      // Tier 2: Public breakdown fallback
      if (!loaded) {
        try {
          const fbRes = await api('/api/colleges?breakdown=true');
          if (fbRes.data && Array.isArray(fbRes.data.colleges)) {
            loadedColleges = fbRes.data.colleges.map(enhanceCollegeRecord);
            if (fbRes.data.overall_summary) setOverallSummary(fbRes.data.overall_summary);
            loaded = true;
          }
        } catch {
          // Silently continue to Tier 3
        }
      }

      // Tier 3: Standard colleges list
      if (!loaded) {
        try {
          const plainRes = await api('/api/admin/colleges');
          if (plainRes.data && Array.isArray(plainRes.data.colleges)) {
            loadedColleges = plainRes.data.colleges.map(enhanceCollegeRecord);
            loaded = true;
          }
        } catch {
          // Silently continue to Tier 4
        }
      }

      // Tier 4: Public colleges endpoint
      if (!loaded) {
        try {
          const pubRes = await api('/api/colleges');
          if (pubRes.data && Array.isArray(pubRes.data.colleges)) {
            loadedColleges = pubRes.data.colleges.map(enhanceCollegeRecord);
            loaded = true;
          }
        } catch {
          // Silently continue
        }
      }

      setColleges(loadedColleges);
      if (inspectCollege) {
        const updated = loadedColleges.find(c => c.id === inspectCollege.id);
        setInspectCollege(updated || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    if (!adminToken) {
      navigate('/admin', { replace: true });
      return;
    }
    load();
  }, [navigate]);

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
    setError('');
    try {
      await api(`/api/admin/colleges/${college.id}`, { method: 'PATCH', data: { is_active: !college.is_active } });
      setColleges(prev => prev.map(c => c.id === college.id ? { ...c, is_active: !c.is_active } : c));
      setSuccess(`College "${college.college_name}" status set to ${!college.is_active ? 'Active' : 'Disabled'}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleToggleRegistration(college: College) {
    setError('');
    try {
      const nextVal = !(college.registration_enabled !== false);
      await api(`/api/admin/colleges/${college.id}`, { method: 'PATCH', data: { registration_enabled: nextVal } });
      setColleges(prev => prev.map(c => c.id === college.id ? { ...c, registration_enabled: nextVal } : c));
      setSuccess(`Student registration ${nextVal ? 'ENABLED' : 'DISABLED'} for ${college.college_name}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update registration status');
    }
  }

  async function handleDelete(college: College) {
    if (!confirm(`Delete ${college.college_name}? This will also delete all exam codes for this college.`)) return;
    setError('');
    try {
      await api(`/api/admin/colleges/${college.id}`, { method: 'DELETE' });
      setSuccess(`College "${college.college_name}" deleted successfully`);
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

  // Quick verify/clear student from inspect modal
  async function handleToggleVerifyStudent(student: EnrichedStudent) {
    try {
      const nextVal = !student.is_verified;
      await api(`/api/admin/students/${student.id}`, {
        method: 'PATCH',
        data: { is_verified: nextVal }
      });
      // Update local state in inspected college and list
      if (inspectCollege && inspectCollege.students) {
        const updatedStudents = inspectCollege.students.map(s =>
          s.id === student.id ? { ...s, is_verified: nextVal, live_status: nextVal ? { state: 'cleared' as const, label: '✓ Cleared & Ready' } : { state: 'pending' as const, label: '⏳ Pending Admin Clearance' } } : s
        );
        const updatedCollege = { ...inspectCollege, students: updatedStudents };
        setInspectCollege(updatedCollege);
        setColleges(prev => prev.map(c => c.id === updatedCollege.id ? updatedCollege : c));
      }
      setSuccess(`Updated verification for ${student.name} (${student.roll_number})`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to toggle verification');
    }
  }

  // Quick block/unblock student from inspect modal
  async function handleToggleBlockStudent(student: EnrichedStudent) {
    try {
      const nextVal = !student.is_blocked;
      await api(`/api/admin/students/${student.id}`, {
        method: 'PATCH',
        data: { is_blocked: nextVal, block_reason: nextVal ? 'Admin blocked from College Control' : null }
      });
      if (inspectCollege && inspectCollege.students) {
        const updatedStudents = inspectCollege.students.map(s =>
          s.id === student.id ? { ...s, is_blocked: nextVal, live_status: nextVal ? { state: 'blocked' as const, label: '🛑 Blocked by Admin' } : { state: 'pending' as const, label: '⏳ Pending Admin Clearance' } } : s
        );
        const updatedCollege = { ...inspectCollege, students: updatedStudents };
        setInspectCollege(updatedCollege);
        setColleges(prev => prev.map(c => c.id === updatedCollege.id ? updatedCollege : c));
      }
      setSuccess(`${nextVal ? 'Blocked' : 'Unblocked'} candidate ${student.name}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to toggle block status');
    }
  }

  // Export full registered student roster CSV for inspected college
  function exportCollegeStudentsCSV(college: College) {
    const list = college.students || [];
    if (list.length === 0) {
      alert('No candidates registered under this college yet to export.');
      return;
    }
    const headers = [
      'Roll Number',
      'Candidate Name',
      'Email',
      'Contact Phone',
      'College',
      'Branch',
      'Section',
      'Batch',
      'Passout Year',
      'Student Gate Pass',
      'Candidate Gate Pass',
      'Live State',
      'Live Status Details',
      'Score',
      'Violations',
      'Verified',
      'Blocked',
      'Registered At'
    ];
    const rows = list.map(s => [
      `"${s.roll_number || ''}"`,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      `"${s.contact_number || ''}"`,
      `"${college.college_name}"`,
      `"${s.branch || ''}"`,
      `"${s.section || ''}"`,
      `"${s.batch || ''}"`,
      `"${s.passout_year || ''}"`,
      `"${s.student_gate_pass || ''}"`,
      `"${s.candidate_gate_pass || ''}"`,
      `"${s.live_status?.state || ''}"`,
      `"${(s.live_status?.label || '').replace(/"/g, '""')}"`,
      `"${s.live_status?.score ?? ''}"`,
      `"${s.live_status?.violations ?? 0}"`,
      `"${s.is_verified ? 'YES' : 'NO'}"`,
      `"${s.is_blocked ? 'YES' : 'NO'}"`,
      `"${s.created_at || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${college.college_code}_candidates_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered colleges list for main table
  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return colleges;
    const q = collegeSearch.toLowerCase().trim();
    return colleges.filter(c =>
      c.college_name.toLowerCase().includes(q) ||
      c.college_code.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.branches && c.branches.some(b => b.branch_code.toLowerCase().includes(q) || b.branch_name.toLowerCase().includes(q)))
    );
  }, [colleges, collegeSearch]);

  // Filtered students for inspect modal
  const filteredStudents = useMemo(() => {
    if (!inspectCollege || !inspectCollege.students) return [];
    return inspectCollege.students.filter(s => {
      if (filterBranch !== 'ALL' && s.branch !== filterBranch) return false;
      if (filterSection !== 'ALL' && s.section !== filterSection) return false;
      if (filterPassoutYear !== 'ALL' && String(s.passout_year) !== filterPassoutYear) return false;
      if (filterLiveStatus !== 'ALL') {
        const state = s.live_status?.state || (s.is_blocked ? 'blocked' : s.is_verified ? 'cleared' : 'pending');
        if (state !== filterLiveStatus.toLowerCase()) return false;
      }
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.roll_number.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.contact_number.toLowerCase().includes(q) ||
          (s.student_gate_pass && s.student_gate_pass.toLowerCase().includes(q)) ||
          s.branch.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q) ||
          s.batch.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [inspectCollege, studentSearch, filterBranch, filterSection, filterPassoutYear, filterLiveStatus]);

  // Overall totals across all loaded colleges
  const totalRegisteredStudents = overallSummary?.total_students ?? colleges.reduce((acc, c) => acc + (c.total_students || c.students?.length || 0), 0);
  const totalLiveInExam = overallSummary?.live_in_exam ?? colleges.reduce((acc, c) => acc + (c.live_status_summary?.in_exam || 0), 0);
  const totalPendingClearance = overallSummary?.pending_clearance ?? colleges.reduce((acc, c) => acc + (c.live_status_summary?.pending_clearance || 0), 0);
  const totalBranchesCount = colleges.reduce((acc, c) => acc + (c.total_branches || c.branches?.length || 0), 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--color-bg, #070a14)' }}>
      {/* Sidebar */}
      <AdminSidebar activeTab="colleges" />

      {/* Main Content */}
      <main className="admin-content" style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                🏛️ College & Session Control
              </h1>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                ADMIN SOVEREIGNTY
              </span>
            </div>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              Centrally govern all college branches, batches, sections, passout years, registration gates, and live candidate activity telemetry.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBulkUpload}
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
            />
            <button
              id="refresh-colleges-btn"
              className="btn btn-secondary"
              onClick={load}
              disabled={loading}
              title="Refresh live college data and candidate telemetry"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              🔄 Refresh
            </button>
            <button
              id="bulk-import-college-btn"
              className="btn btn-secondary"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              style={{ background: '#002147', color: '#FFFFFF', border: '1px solid #334155' }}
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
          {error && !error.toLowerCase().includes('failed to load') && !error.toLowerCase().includes('could not load') && (
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

        {/* Real-time Telemetry & Intelligence KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div className="card card-sm" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              🏛️ Colleges Configured
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc' }}>{colleges.length}</div>
            <div className="text-muted text-xs">{colleges.filter(c => c.is_active).length} Active Campuses</div>
          </div>

          <div className="card card-sm" style={{ background: 'rgba(15, 23, 42, 0.7)', borderLeft: '3px solid #6366f1', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              🏢 Branches & Batches
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#818cf8' }}>{totalBranchesCount}</div>
            <div className="text-muted text-xs">Mapped across campuses</div>
          </div>

          <div className="card card-sm" style={{ background: 'rgba(15, 23, 42, 0.7)', borderLeft: '3px solid #38bdf8', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              👥 Registered Candidates
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#38bdf8' }}>{totalRegisteredStudents}</div>
            <div className="text-muted text-xs">Full student rosters</div>
          </div>

          <div className="card card-sm" style={{ background: 'rgba(15, 23, 42, 0.7)', borderLeft: '3px solid #10b981', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              🟢 Live in Exam Now
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{totalLiveInExam}</span>
              {totalLiveInExam > 0 && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 10px #10b981' }} />}
            </div>
            <div className="text-muted text-xs">Real-time candidate activity</div>
          </div>

          <div className="card card-sm" style={{ background: 'rgba(15, 23, 42, 0.7)', borderLeft: '3px solid #f59e0b', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              ⏳ Pending Clearance
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fbbf24' }}>{totalPendingClearance}</div>
            <div className="text-muted text-xs">Awaiting admin gate pass</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <input
              id="search-college-input"
              type="text"
              className="form-input"
              placeholder="🔍 Search colleges by name, code, branch, or city..."
              value={collegeSearch}
              onChange={e => setCollegeSearch(e.target.value)}
              style={{ paddingLeft: 14, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {collegeSearch && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCollegeSearch('')} style={{ fontSize: '0.8rem' }}>
              Clear Search
            </button>
          )}
        </div>

        {/* Colleges Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 10 }} />)}
          </div>
        ) : filteredColleges.length === 0 ? (
          <div className="card text-center" style={{ padding: 60, background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏛️</div>
            <p className="font-bold mb-1" style={{ color: '#f8fafc' }}>
              {collegeSearch ? 'No colleges match your search' : 'No colleges added yet'}
            </p>
            <p className="text-muted text-sm mb-2">
              {collegeSearch ? 'Try a different college name or code.' : 'Add your first college to start managing branches, batches, and candidate sessions.'}
            </p>
            {!collegeSearch && <button className="btn btn-primary" onClick={openAdd}>Add First College</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>COLLEGE NAME & DETAILS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>CODE</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>BRANCHES & BATCHES</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>SECTIONS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>PASSOUT YEARS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>REGISTERED & LIVE STATUS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>REGISTRATION GATE</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8' }}>ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredColleges.map(college => {
                  const branches = college.branches || [];
                  const sections = college.sections || [];
                  const passoutYears = college.passout_years || [2026, 2027, 2028, 2029, 2030];
                  const liveSummary = college.live_status_summary || { in_exam: 0, in_lobby: 0, cleared_ready: 0, pending_clearance: 0, completed: 0, blocked: 0 };
                  const totalStudents = college.total_students ?? college.students?.length ?? 0;

                  return (
                    <tr key={college.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {/* Name & Contact */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{college.college_name}</div>
                        <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                          {college.city ? `${college.city}, ${college.state || 'AP'}` : college.state || 'Andhra Pradesh'}
                          {college.contact_phone && ` • 📞 ${college.contact_phone}`}
                        </div>
                        {college.contact_email && <div className="text-muted text-xs" style={{ color: '#64748b' }}>{college.contact_email}</div>}
                      </td>

                      {/* Code */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontFamily: 'monospace', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', borderRadius: 6, padding: '3px 8px', fontSize: '0.82rem', fontWeight: 700, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                          {college.college_code}
                        </span>
                      </td>

                      {/* Branches & Batches */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {branches.slice(0, 3).map(b => (
                              <span
                                key={b.branch_code}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  fontWeight: 600,
                                }}
                              >
                                {b.branch_code} ({b.batch_count || 1} {b.batch_count === 1 ? 'batch' : 'batches'})
                              </span>
                            ))}
                            {branches.length > 3 && (
                              <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                +{branches.length - 3} more
                              </span>
                            )}
                          </div>
                          <div className="text-muted text-xs">
                            {branches.length} branch(es) • {college.total_batches || college.batches?.length || 1} batch(es)
                          </div>
                        </div>
                      </td>

                      {/* Sections */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 160 }}>
                          {sections.slice(0, 4).map(sec => (
                            <span
                              key={sec}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(168, 85, 247, 0.12)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.25)',
                                fontWeight: 600,
                              }}
                            >
                              Sec {sec}
                            </span>
                          ))}
                          {sections.length > 4 && (
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                              +{sections.length - 4}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Passout Years */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {passoutYears.map(yr => (
                            <span
                              key={yr}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(234, 179, 8, 0.12)',
                                color: '#facc15',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                fontWeight: 600,
                              }}
                            >
                              {yr}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Registered Students & Live Telemetry */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9' }}>
                            👥 {totalStudents} Registered
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {liveSummary.in_exam > 0 ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                🟢 {liveSummary.in_exam} In Exam
                              </span>
                            ) : null}
                            {liveSummary.pending_clearance > 0 ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                ⏳ {liveSummary.pending_clearance} Pending
                              </span>
                            ) : null}
                            {liveSummary.cleared_ready > 0 ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 600 }}>
                                ✓ {liveSummary.cleared_ready} Cleared
                              </span>
                            ) : null}
                            {liveSummary.completed > 0 ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 600 }}>
                                🏁 {liveSummary.completed} Done
                              </span>
                            ) : null}
                            {totalStudents === 0 && (
                              <span className="text-muted text-xs">No candidates yet</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Registration Enabled Toggle */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          id={`toggle-reg-college-${college.id}`}
                          type="button"
                          onClick={() => handleToggleRegistration(college)}
                          className={`badge ${college.registration_enabled !== false ? 'badge-success' : 'badge-neutral'}`}
                          style={{
                            cursor: 'pointer',
                            border: '1px solid currentColor',
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            fontWeight: 600
                          }}
                          title="Click to enable/disable student registration portal access for this college"
                        >
                          {college.registration_enabled !== false ? '✓ Gate Open' : '✕ Gate Closed'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Deep Inspector Button */}
                          <button
                            id={`inspect-college-${college.id}`}
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setInspectCollege(college);
                              setInspectTab('branches');
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                              border: 'none',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '5px 12px',
                              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)'
                            }}
                            title="Inspect branches, batches, sections, passout years, and live candidate activity"
                          >
                            🔍 Inspect Roster & Sections
                          </button>

                          <button
                            id={`edit-college-${college.id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(college)}
                            style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            id={`toggle-college-${college.id}`}
                            className={`btn btn-sm ${college.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggle(college)}
                            style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          >
                            {college.is_active ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            id={`exam-codes-college-${college.id}`}
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/admin/exam-codes?college=${college.id}`)}
                            style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                            title="Manage exam codes for this college"
                          >
                            🔑 Codes
                          </button>

                          <button
                            id={`delete-college-${college.id}`}
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleDelete(college)}
                            style={{ color: 'var(--color-danger)', fontSize: '0.85rem', padding: '5px 8px' }}
                            title="Delete college"
                          >
                            🗑️
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── COLLEGE DEEP-DIVE INSPECTOR MODAL ── */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {inspectCollege && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            style={{ zIndex: 1200, padding: 16 }}
            onClick={() => setInspectCollege(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="modal"
              style={{
                maxWidth: 1180,
                width: '96vw',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '28px 32px',
                background: 'rgba(10, 15, 30, 0.98)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
                borderRadius: 16
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                      🏛️ {inspectCollege.college_name}
                    </h2>
                    <span style={{ fontFamily: 'monospace', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', borderRadius: 6, padding: '3px 10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                      GR-{inspectCollege.college_code}
                    </span>
                    <span className={`badge ${inspectCollege.registration_enabled !== false ? 'badge-success' : 'badge-neutral'}`}>
                      {inspectCollege.registration_enabled !== false ? '✓ Student Registration Active' : '✕ Registration Suspended'}
                    </span>
                  </div>
                  <div className="text-muted text-xs" style={{ marginTop: 4 }}>
                    {inspectCollege.city ? `${inspectCollege.city}, ${inspectCollege.state}` : inspectCollege.state}
                    {inspectCollege.contact_phone && ` • 📞 ${inspectCollege.contact_phone}`}
                    {inspectCollege.contact_email && ` • ✉️ ${inspectCollege.contact_email}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => exportCollegeStudentsCSV(inspectCollege)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.78rem' }}
                    title="Export complete roster of all registered candidates with contacts, batches, and live status"
                  >
                    📥 Export Roster CSV
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setInspectCollege(null)}
                    style={{ fontSize: '1.2rem', padding: '4px 8px', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Quick KPI Strip inside modal */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-muted text-xs">Total Branches</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#818cf8' }}>
                    {inspectCollege.total_branches || inspectCollege.branches?.length || 0}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-muted text-xs">Total Batches</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                    {inspectCollege.total_batches || inspectCollege.batches?.length || 1}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-muted text-xs">Total Sections</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#c084fc' }}>
                    {inspectCollege.total_sections || inspectCollege.sections?.length || 1}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-muted text-xs">Registered Students</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' }}>
                    {inspectCollege.total_students || inspectCollege.students?.length || 0}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div className="text-muted text-xs">🟢 Live In Exam</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>
                    {inspectCollege.live_status_summary?.in_exam || 0}
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div className="text-muted text-xs">⏳ Pending Clearance</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>
                    {inspectCollege.live_status_summary?.pending_clearance || 0}
                  </div>
                </div>
              </div>

              {/* Inspector Tabs Navigation */}
              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => setInspectTab('branches')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    background: inspectTab === 'branches' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    color: inspectTab === 'branches' ? '#a5b4fc' : '#94a3b8',
                    borderBottom: inspectTab === 'branches' ? '2px solid #6366f1' : '2px solid transparent',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  🏢 Branches & Batches Matrix ({inspectCollege.branches?.length || 0})
                </button>

                <button
                  type="button"
                  onClick={() => setInspectTab('passout')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    background: inspectTab === 'passout' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    color: inspectTab === 'passout' ? '#a5b4fc' : '#94a3b8',
                    borderBottom: inspectTab === 'passout' ? '2px solid #6366f1' : '2px solid transparent',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  🎓 Passout Years & Graduation Classes
                </button>

                <button
                  type="button"
                  onClick={() => setInspectTab('live')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    background: inspectTab === 'live' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    color: inspectTab === 'live' ? '#34d399' : '#94a3b8',
                    borderBottom: inspectTab === 'live' ? '2px solid #10b981' : '2px solid transparent',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  📡 Live Candidate Telemetry ({inspectCollege.live_status_summary?.in_exam || 0} active)
                </button>

                <button
                  type="button"
                  onClick={() => setInspectTab('students')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    background: inspectTab === 'students' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    color: inspectTab === 'students' ? '#a5b4fc' : '#94a3b8',
                    borderBottom: inspectTab === 'students' ? '2px solid #6366f1' : '2px solid transparent',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  👥 Registered Candidate Roster ({inspectCollege.students?.length || 0})
                </button>
              </div>

              {/* ────────────────────────────────────────────── */}
              {/* TAB 1: BRANCHES & BATCHES MATRIX */}
              {/* ────────────────────────────────────────────── */}
              {inspectTab === 'branches' && (
                <div>
                  <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="text-muted text-xs" style={{ margin: 0 }}>
                      Complete branch hierarchy, batches allocated, section mapping, and live active candidates.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    {(inspectCollege.branches || []).map(b => (
                      <div
                        key={b.branch_code}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              {b.branch_code}
                            </span>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc', marginTop: 6 }}>
                              {b.branch_name}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f1f5f9' }}>
                              {b.student_count}
                            </div>
                            <div className="text-muted text-xs">Candidates</div>
                          </div>
                        </div>

                        {/* Batch Details */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Batches ({b.batch_count || b.batches.length || 1})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {b.batches.map(bat => (
                              <span key={bat} style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe', fontWeight: 600 }}>
                                📦 {bat}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Section Details */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8 }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Sections ({b.section_count || b.sections.length || 1})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {b.sections.map(sec => (
                              <span key={sec} style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.15)', color: '#e9d5ff', fontWeight: 600 }}>
                                🗂️ Sec {sec}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Passout Years Covered */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-muted text-xs">
                            Graduating: {b.passout_years.join(', ') || '2026–2030'}
                          </div>
                          {b.live_active_count > 0 ? (
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                              🟢 {b.live_active_count} In Exam
                            </span>
                          ) : (
                            <span className="text-muted text-xs">0 active now</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────── */}
              {/* TAB 2: PASSOUT YEARS & GRADUATION CLASSES */}
              {/* ────────────────────────────────────────────── */}
              {inspectTab === 'passout' && (
                <div>
                  <p className="text-muted text-xs" style={{ marginBottom: 16 }}>
                    Distribution of candidates by graduating passout year (YOP: 2025–2030), their branches, and exam readiness.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    {[2025, 2026, 2027, 2028, 2029, 2030].map(yr => {
                      const yrStudents = (inspectCollege.students || []).filter(s => s.passout_year === yr || s.year_of_passing === yr);
                      const yrBranches = Array.from(new Set(yrStudents.map(s => s.branch)));
                      const yrActive = yrStudents.filter(s => s.live_status?.state === 'in_exam').length;
                      const yrCleared = yrStudents.filter(s => s.is_verified).length;

                      return (
                        <div
                          key={yr}
                          style={{
                            background: yrStudents.length > 0 ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255,255,255,0.02)',
                            border: yrStudents.length > 0 ? '1px solid rgba(234, 179, 8, 0.25)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 12,
                            padding: '16px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#facc15' }}>{yr}</span>
                              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>
                                Class of {yr}
                              </span>
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                              {yrStudents.length}
                            </div>
                          </div>

                          <div className="text-muted text-xs">
                            {yrBranches.length > 0
                              ? `Branches: ${yrBranches.join(', ')}`
                              : 'No registered candidates yet'}
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {yrActive > 0 && (
                              <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                                🟢 {yrActive} in exam
                              </span>
                            )}
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
                              ✓ {yrCleared} cleared
                            </span>
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                              ⏳ {yrStudents.length - yrCleared} pending
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────── */}
              {/* TAB 3: LIVE CANDIDATE ACTIVITY TELEMETRY */}
              {/* ────────────────────────────────────────────── */}
              {inspectTab === 'live' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div className="text-muted text-xs">🟢 TAKING ACTIVE EXAM NOW</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                        {inspectCollege.live_status_summary?.in_exam || 0}
                      </div>
                      <div className="text-muted text-xs">Real-time interactive session</div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <div className="text-muted text-xs">⏳ PENDING ADMIN CLEARANCE</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                        {inspectCollege.live_status_summary?.pending_clearance || 0}
                      </div>
                      <div className="text-muted text-xs">Needs admin approval to test</div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                      <div className="text-muted text-xs">✓ CLEARED & READY IN LOBBY</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
                        {inspectCollege.live_status_summary?.cleared_ready || 0}
                      </div>
                      <div className="text-muted text-xs">Gate pass validated</div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <div className="text-muted text-xs">🏁 EXAM COMPLETED & SUBMITTED</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                        {inspectCollege.live_status_summary?.completed || 0}
                      </div>
                      <div className="text-muted text-xs">Scores recorded</div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <div className="text-muted text-xs">🛑 BLOCKED CANDIDATES</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>
                        {inspectCollege.live_status_summary?.blocked || 0}
                      </div>
                      <div className="text-muted text-xs">Access denied by admin</div>
                    </div>
                  </div>

                  {/* Active candidate stream */}
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10, color: '#f8fafc' }}>
                    Live Activity Stream
                  </h4>

                  {((inspectCollege.students || []).filter(s => s.live_status?.state === 'in_exam' || s.live_status?.state === 'completed')).length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📡</div>
                      <p className="text-muted text-sm" style={{ margin: 0 }}>
                        No candidates currently taking an active exam session right now.
                      </p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>CANDIDATE</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>BRANCH / SEC</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>EXAM CODE</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>CURRENT PROGRESS / QUESTION</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>VIOLATIONS</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#94a3b8' }}>LIVE SCORE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(inspectCollege.students || [])
                            .filter(s => s.live_status?.state === 'in_exam' || s.live_status?.state === 'completed')
                            .map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f1f5f9' }}>{s.name}</div>
                                  <div className="font-mono text-muted text-xs">{s.roll_number}</div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                                    {s.branch} • Sec {s.section}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#a5b4fc' }}>
                                  {s.live_status?.exam_code || 'EXAM-PORTAL'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{
                                    fontSize: '0.74rem',
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: s.live_status?.state === 'in_exam' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                                    color: s.live_status?.state === 'in_exam' ? '#34d399' : '#94a3b8',
                                    fontWeight: 700
                                  }}>
                                    {s.live_status?.label}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{
                                    color: (s.live_status?.violations || 0) > 0 ? '#f87171' : '#34d399',
                                    fontWeight: 700,
                                    fontSize: '0.82rem'
                                  }}>
                                    {s.live_status?.violations ?? 0}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc' }}>
                                  {s.live_status?.score !== undefined ? `${s.live_status.score} / ${s.live_status.max_score || 10}` : 'In session'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────── */}
              {/* TAB 4: REGISTERED CANDIDATE ROSTER */}
              {/* ────────────────────────────────────────────── */}
              {inspectTab === 'students' && (
                <div>
                  {/* Filters Bar inside Tab 4 */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Search candidates by name, roll no, phone, gate pass..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        style={{ padding: '7px 12px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Branch Filter */}
                    <select
                      className="form-input"
                      value={filterBranch}
                      onChange={e => setFilterBranch(e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="ALL">All Branches</option>
                      {(inspectCollege.branches || []).map(b => (
                        <option key={b.branch_code} value={b.branch_code}>{b.branch_code}</option>
                      ))}
                    </select>

                    {/* Section Filter */}
                    <select
                      className="form-input"
                      value={filterSection}
                      onChange={e => setFilterSection(e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="ALL">All Sections</option>
                      {(inspectCollege.sections || ['A', 'B', 'C', 'D', 'E']).map(sec => (
                        <option key={sec} value={sec}>Sec {sec}</option>
                      ))}
                    </select>

                    {/* Passout Year Filter */}
                    <select
                      className="form-input"
                      value={filterPassoutYear}
                      onChange={e => setFilterPassoutYear(e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="ALL">All Passout Years</option>
                      {[2025, 2026, 2027, 2028, 2029, 2030].map(yr => (
                        <option key={yr} value={String(yr)}>YOP {yr}</option>
                      ))}
                    </select>

                    {/* Live Status Filter */}
                    <select
                      className="form-input"
                      value={filterLiveStatus}
                      onChange={e => setFilterLiveStatus(e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="ALL">All Live Statuses</option>
                      <option value="IN_EXAM">🟢 In Exam</option>
                      <option value="CLEARED">✓ Cleared & Ready</option>
                      <option value="PENDING">⏳ Pending Clearance</option>
                      <option value="COMPLETED">🏁 Completed</option>
                      <option value="BLOCKED">🛑 Blocked</option>
                    </select>
                  </div>

                  {/* Student Table */}
                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                      <p className="text-muted text-sm">No registered candidates match your filters.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', maxHeight: '55vh', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#0b1120', zIndex: 2 }}>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>ROLL NO / HT</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>STUDENT NAME</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>CONTACT PHONE</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>BRANCH & SEC</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>BATCH & YOP</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>GATE PASS</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.74rem', color: '#94a3b8' }}>CURRENT LIVE STATUS</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.74rem', color: '#94a3b8' }}>ADMIN ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map(s => {
                            const liveState = s.live_status?.state || (s.is_blocked ? 'blocked' : s.is_verified ? 'cleared' : 'pending');
                            return (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc', fontSize: '0.82rem' }}>
                                  {s.roll_number}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#f1f5f9' }}>{s.name}</div>
                                  <div className="text-muted text-xs" style={{ color: '#64748b' }}>{s.email}</div>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                  {s.contact_number ? `📞 ${s.contact_number}` : '—'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600 }}>
                                    {s.branch} • {s.section}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0' }}>{s.batch}</div>
                                  <div className="text-muted text-xs">YOP: {s.passout_year}</div>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, color: '#94a3b8' }}>
                                    {s.student_gate_pass || s.candidate_gate_pass || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{
                                    fontSize: '0.74rem',
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    background: liveState === 'in_exam'
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : liveState === 'cleared'
                                        ? 'rgba(99, 102, 241, 0.2)'
                                        : liveState === 'blocked'
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : 'rgba(245, 158, 11, 0.2)',
                                    color: liveState === 'in_exam'
                                      ? '#34d399'
                                      : liveState === 'cleared'
                                        ? '#818cf8'
                                        : liveState === 'blocked'
                                          ? '#f87171'
                                          : '#fbbf24',
                                    border: `1px solid currentColor`
                                  }}>
                                    {s.live_status?.label || (s.is_verified ? '✓ Cleared & Ready' : '⏳ Pending Clearance')}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => handleToggleVerifyStudent(s)}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '3px 8px',
                                        color: s.is_verified ? '#f87171' : '#34d399',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                      }}
                                      title={s.is_verified ? 'Revoke gate clearance' : 'Grant gate clearance'}
                                    >
                                      {s.is_verified ? 'Revoke' : '✓ Clear'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => handleToggleBlockStudent(s)}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '3px 8px',
                                        color: s.is_blocked ? '#34d399' : '#f87171',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                      }}
                                      title={s.is_blocked ? 'Unblock candidate' : 'Block candidate'}
                                    >
                                      {s.is_blocked ? 'Unblock' : '🛑 Block'}
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
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── CREATE / EDIT COLLEGE FORM MODAL ── */}
      {/* ──────────────────────────────────────────────────────────── */}
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
              style={{ maxWidth: 520, background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 20, color: '#f8fafc' }}>
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
                  <input className="form-input" placeholder="University Institute of Technology" value={form.college_name}
                    onChange={e => setForm(p => ({ ...p, college_name: e.target.value }))} required />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">College Code *</label>
                  <input className="form-input font-mono" placeholder="UNIV01" value={form.college_code}
                    onChange={e => setForm(p => ({ ...p, college_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                    required disabled={!!editCollege}
                    style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} />
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Used in exam codes: GR-<strong>{form.college_code || 'CODE'}</strong>-XXXXXX
                    {editCollege && ' (cannot change code after creation)'}
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
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>Allow Student Registration</div>
                      <div className="text-muted text-xs">When enabled, students can register through the gate and select this college</div>
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
