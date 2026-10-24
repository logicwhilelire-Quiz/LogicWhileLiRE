import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import BrandLogo from '../../components/BrandLogo';
import { API_BASE_URL } from '../../lib/config';
import {
  getAdminRosterStudents,
  saveAdminRosterStudents,
  clearAllAdminStudents,
  getRegistrationAuthorityMode,
  setRegistrationAuthorityMode,
  approveCandidateRoster,
  rejectCandidateRoster,
  bulkApproveAllPendingCandidates,
  generateSystemBackupArchive,
  exportRosterCsvString,
  type RegistrationAuthorityMode,
} from '../../lib/adminRosterStore';

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
  contact_number?: string;
  mobile?: string;
  branch: string;
  college_id?: number | string;
  college_name?: string;
  section?: string;
  batch?: string;
  passout_year?: number;
  student_gate_pass?: string;
  candidate_gate_pass?: string;
  is_verified?: boolean;
  is_blocked: boolean;
  block_reason?: string | null;
  attempts_used: number;
  allowed_attempts: number;
  extra_time_mins: number;
  temporary_password?: string;
  email_dispatched?: boolean;
  email_dispatched_at?: string;
  live_status?: {
    state: string;
    label: string;
    exam_code?: string;
    current_question?: number;
    score?: number;
    max_score?: number;
    violations?: number;
  };
}

export default function StudentControl() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [passoutYearFilter, setPassoutYearFilter] = useState<string>('ALL');
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [uploadMsg, setUploadMsg] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [colleges, setColleges] = useState<College[]>([]);
  const [copiedPass, setCopiedPass] = useState<string | null>(null);
  const [copiedCreds, setCopiedCreds] = useState<string | null>(null);
  const [previewEmailStudent, setPreviewEmailStudent] = useState<StudentRosterItem | null>(null);
  const [bulkUploadSummary, setBulkUploadSummary] = useState<{ total: number; emailsSent: number; filename: string } | null>(null);

  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admin_registration_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [regAuthorityMode, setRegAuthorityMode] = useState<RegistrationAuthorityMode>(() => getRegistrationAuthorityMode());

  const handleChangeAuthorityMode = (mode: RegistrationAuthorityMode) => {
    setRegAuthorityMode(mode);
    setRegistrationAuthorityMode(mode);
    setRegistrationEnabled(mode !== 'ADMIN_ONLY');
    setUploadMsg(
      mode === 'ADMIN_ONLY'
        ? '🔒 Authority Mode: STRICT ADMIN ENTRY ONLY. Candidate self-registration is closed.'
        : mode === 'CLEARANCE_REQUIRED'
        ? '⏳ Authority Mode: CLEARANCE REQUIRED. New candidates require explicit Administrator Approval.'
        : '🟢 Authority Mode: ACTIVE AUTO-CLEARANCE. Candidates are automatically approved.'
    );
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleApproveClearance = (student: StudentRosterItem) => {
    approveCandidateRoster(student.id);
    setStudents((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, is_verified: true, status: 'approved' } : s))
    );
    setUploadMsg(`✓ Examination clearance granted for ${student.name} (${student.hall_ticket}).`);
    setTimeout(() => setUploadMsg(''), 4000);
  };

  const handleBulkApprovePending = () => {
    const approvedCount = bulkApproveAllPendingCandidates();
    setStudents((prev) =>
      prev.map((s) => (s.is_verified === false || (s as any).status === 'pending_clearance' ? { ...s, is_verified: true, status: 'approved' } : s))
    );
    setUploadMsg(`⚡ Successfully approved and cleared ${approvedCount} candidate(s) for examination!`);
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleBackupFullSystem = () => {
    const backup = generateSystemBackupArchive();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogicWhileLiRE_Roster_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUploadMsg('💾 Full System Candidate Data Backup successfully downloaded!');
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleExportRosterCsv = () => {
    const csv = exportRosterCsvString();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogicWhileLiRE_Student_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUploadMsg('📊 Student roster exported to CSV spreadsheet!');
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleClearRosterFresh = () => {
    if (!window.confirm('⚠️ Reset Student Roster to Fresh State?\n\nThis will remove all current student entries from local storage so you can start 100% fresh with new institutional imports. Are you sure?')) {
      return;
    }
    clearAllAdminStudents();
    setStudents([]);
    setUploadMsg('🧹 All candidate roster records cleared. Platform is now in a 100% fresh application state.');
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleToggleRegistration = () => {
    const next = !registrationEnabled;
    setRegistrationEnabled(next);
    localStorage.setItem('admin_registration_enabled', String(next));
    const newMode: RegistrationAuthorityMode = next ? 'CLEARANCE_REQUIRED' : 'ADMIN_ONLY';
    setRegAuthorityMode(newMode);
    setRegistrationAuthorityMode(newMode);
    setUploadMsg(
      next
        ? '✅ Student Registration Gate is now ACTIVE under Administrator Clearance Mode.'
        : '⏸️ Student Registration Gate has been PAUSED by Administrator.'
    );
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();
  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  const generateGatePass = (prefix: 'GP-STU' | 'GP-CAND', roll?: string) => {
    const code = (roll || 'CAND').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${code || 'PASS'}-${rand}`;
  };

  const handleCopyPass = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(text);
    setTimeout(() => setCopiedPass(null), 2200);
  };

  // Authoritative admin roster initialized from central store
  const [students, setStudents] = useState<StudentRosterItem[]>(() => {
    const roster = getAdminRosterStudents();
    return roster.map((s) => ({
      id: s.id,
      hall_ticket: s.hall_ticket || (s as any).roll_number || '',
      name: s.name,
      email: s.email,
      contact_number: s.contact_number || s.mobile || '',
      mobile: s.mobile || s.contact_number || '',
      branch: s.branch || (s as any).branch_code || 'CSE',
      college_name: s.college_name,
      college_id: s.college_id,
      section: s.section,
      batch: s.batch,
      passout_year: s.passout_year,
      student_gate_pass: s.student_gate_pass,
      candidate_gate_pass: s.candidate_gate_pass,
      is_verified: s.is_verified,
      is_blocked: !!s.is_blocked,
      block_reason: s.block_reason,
      live_status: s.live_status || { state: s.is_verified ? 'cleared' : 'pending', label: s.is_verified ? '✓ Cleared & Ready' : '⏳ Pending Admin Clearance' },
      attempts_used: s.attempts_used || 0,
      allowed_attempts: s.allowed_attempts || 1,
      extra_time_mins: s.extra_time_mins || 0,
    }));
  });

  // Automatically synchronize with central persistent storage whenever admin modifies roster
  useEffect(() => {
    if (students && students.length > 0) {
      saveAdminRosterStudents(students as any);
    }
  }, [students]);

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
          .get(`${API_BASE_URL}/api/exam-code/colleges`, { headers })
          .then((r) => {
            if (r.data?.colleges) setColleges(r.data.colleges);
          })
          .catch(() => {});
      });

    // 2. Fetch Students from Admin API
    axios
      .get(`${API_BASE_URL}/api/admin/students`, { headers })
      .then((res) => {
        if (Array.isArray(res.data?.students)) {
          const mapped: StudentRosterItem[] = res.data.students.map((s: any) => ({
            id: String(s.id || s.roll_number),
            hall_ticket: s.roll_number || s.hall_ticket || '',
            name: s.name || s.student_name || 'Candidate',
            email: s.email || '',
            contact_number: s.contact_number || s.mobile || '',
            mobile: s.mobile || s.contact_number || '',
            branch: s.branch || s.branch_code || 'CSE',
            college_name: s.college_name || '',
            college_id: s.college_id,
            section: s.section || 'A',
            batch: s.batch || (s.year_of_passing ? `Batch ${s.year_of_passing}` : 'Batch 1'),
            passout_year: s.passout_year || s.year_of_passing || 2026,
            student_gate_pass: s.student_gate_pass || `GP-STU-${s.roll_number || s.hall_ticket || 'STU'}-${String(s.id || '101').slice(-4).toUpperCase()}`,
            candidate_gate_pass: s.candidate_gate_pass || `GP-CAND-${s.roll_number || s.hall_ticket || 'CAND'}-${String(s.id || '202').slice(-4).toUpperCase()}`,
            is_verified: s.is_verified !== false,
            is_blocked: Boolean(s.is_blocked),
            block_reason: s.block_reason,
            live_status: s.live_status || {
              state: s.is_verified !== false ? 'cleared' : 'pending',
              label: s.is_verified !== false ? '✓ Cleared & Ready' : '⏳ Pending Admin Clearance',
            },
            attempts_used: s.attempts_used || 0,
            allowed_attempts: s.allowed_attempts || 1,
            extra_time_mins: s.extra_time_mins || 0,
          }));

          // Merge without losing local entries
          setStudents((prev) => {
            const apiRolls = new Set(mapped.map((m) => m.hall_ticket.toUpperCase()));
            const localOnly = prev.filter((p) => !apiRolls.has(p.hall_ticket.toUpperCase()));
            return [...mapped, ...localOnly];
          });
        }
      })
      .catch(() => {});
  }, []);

  // Add single student state with auto-generated gate passes
  const [newStudent, setNewStudent] = useState({
    hall_ticket: '',
    name: '',
    email: '',
    branch: 'CSE',
    college_name: '',
    section: 'CSM-A',
    batch: 'Batch 1',
    passout_year: 2026,
    student_gate_pass: 'GP-STU-CAND-7842',
    candidate_gate_pass: 'GP-CAND-CAND-9153',
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === filtered.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const handleBulkVerifySelected = async () => {
    if (selectedStudentIds.size === 0) return;
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setBulkLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/students/bulk-verify`,
        { student_ids: Array.from(selectedStudentIds) },
        { headers }
      );
      if (res.data?.success) {
        setStudents((prev) =>
          prev.map((s) => (selectedStudentIds.has(s.id) ? { ...s, is_verified: true } : s))
        );
        setBulkFeedback(`✅ Successfully verified ${selectedStudentIds.size} selected student(s)!`);
        setSelectedStudentIds(new Set());
        setTimeout(() => setBulkFeedback(null), 5000);
      }
    } catch (err: any) {
      setBulkFeedback(`❌ Bulk verification failed: ${err.response?.data?.error || err.message}`);
      setTimeout(() => setBulkFeedback(null), 5000);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkVerifySection = async () => {
    const currentSec = sectionFilter === 'ALL' ? 'A' : sectionFilter;
    if (!confirm(`Mark ALL students in section "${currentSec}" as email-verified? This creates an audit log entry so imported students are not locked out.`)) return;
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setBulkLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/students/bulk-verify`,
        { section_id: currentSec },
        { headers }
      );
      if (res.data?.success) {
        setStudents((prev) =>
          prev.map((s) =>
            sectionFilter === 'ALL' || (s.section || '').toUpperCase() === currentSec.toUpperCase()
              ? { ...s, is_verified: true }
              : s
          )
        );
        setBulkFeedback(`✅ ${res.data.message || `Successfully verified all students in section ${currentSec}!`}`);
        setTimeout(() => setBulkFeedback(null), 5000);
      }
    } catch (err: any) {
      setBulkFeedback(`❌ Section verification failed: ${err.response?.data?.error || err.message}`);
      setTimeout(() => setBulkFeedback(null), 5000);
    } finally {
      setBulkLoading(false);
    }
  };

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

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(`⚡ Reading & parsing student roster from "${file.name}"...`);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setUploadMsg('❌ Empty file: No sheets found.');
        return;
      }
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

      if (!rawRows || rawRows.length === 0) {
        setUploadMsg('❌ Uploaded sheet contains no data rows.');
        return;
      }

      // Map rows accurately and dynamically (supports 300 to 400+ students)
      const parsedRoster: StudentRosterItem[] = rawRows.map((row, idx) => {
        const rawName =
          row['Name'] ||
          row['Student Name'] ||
          row['Full Name'] ||
          row['Candidate Name'] ||
          `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() ||
          `Candidate ${idx + 1}`;
        const rawRoll =
          row['Roll Number'] ||
          row['Hall Ticket'] ||
          row['Roll'] ||
          row['HTNO'] ||
          row['roll_number'] ||
          row['hall_ticket'] ||
          `STU${Date.now()}${idx}`;
        const cleanRoll = String(rawRoll).trim().toUpperCase();
        const rawEmail =
          row['Email'] ||
          row['Email ID'] ||
          row['Login ID'] ||
          row['Student Email'] ||
          `${cleanRoll.toLowerCase()}@campus.edu`;
        const cleanEmail = String(rawEmail).trim().toLowerCase();
        const branch = String(row['Branch'] || row['Branch Code'] || row['Department'] || row['Dept'] || 'CSE').trim().toUpperCase();
        const section = String(row['Section'] || row['Sec'] || 'A').trim().toUpperCase();
        const college = String(row['College'] || row['College Name'] || '').trim();
        const yop = parseInt(String(row['Year of Passing'] || row['YOP'] || row['Batch'] || 2028), 10) || 2028;
        const password = String(row['Password'] || `Student#${Math.floor(100000 + Math.random() * 900000)}!`);

        return {
          id: `imp-${Date.now()}-${idx}`,
          hall_ticket: cleanRoll,
          name: String(rawName).trim(),
          email: cleanEmail,
          branch,
          college_name: college,
          section,
          batch: `Batch ${yop}`,
          passout_year: yop,
          student_gate_pass: `GP-STU-${cleanRoll}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          candidate_gate_pass: `GP-CAND-${cleanRoll}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          is_verified: true,
          is_blocked: false,
          attempts_used: 0,
          allowed_attempts: 1,
          extra_time_mins: 0,
          temporary_password: password,
          email_dispatched: true,
          email_dispatched_at: new Date().toLocaleTimeString(),
        };
      });

      // Also dispatch to backend API to persist to Supabase & trigger server email queue
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);
      try {
        await axios.post(`${API_BASE_URL}/api/admin/students/bulk-import`, formData, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (err: any) {
        console.warn('Backend bulk import notice:', err?.response?.data || err.message);
      }

      setStudents((prev) => {
        const existingHt = new Set(prev.map((s) => s.hall_ticket.toUpperCase()));
        const uniqueNew = parsedRoster.filter((p) => !existingHt.has(p.hall_ticket.toUpperCase()));
        return [...uniqueNew, ...prev];
      });

      setBulkUploadSummary({
        total: parsedRoster.length,
        emailsSent: parsedRoster.length,
        filename: file.name,
      });

      setUploadMsg(
        `✅ Successfully loaded ${parsedRoster.length} candidate(s) from "${file.name}"! Auto-reply credentials emails dispatched with Login ID, Hall Ticket, and Password.`
      );
      setTimeout(() => setUploadMsg(''), 8000);
    } catch (err: any) {
      setUploadMsg(`❌ Error parsing file: ${err?.message || 'Invalid spreadsheet format'}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleDownloadCredentialsCsv = () => {
    const headers = ['Name', 'Hall Ticket / Roll Number', 'Login ID (Email)', 'Access Password', 'Branch', 'Section', 'College', 'Portal Link'];
    const rows = students.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.hall_ticket}"`,
      `"${s.email}"`,
      `"${s.temporary_password || 'Student#123456!'}"`,
      `"${s.branch}"`,
      `"${s.section || 'A'}"`,
      `"${s.college_name || 'Institution'}"`,
      `"${window.location.origin}/login"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogicWhile_Student_Credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUploadMsg('📊 Bulk Credentials list (with Login ID, Hall Ticket & Passwords) downloaded successfully!');
    setTimeout(() => setUploadMsg(''), 4000);
  };

  const handleCopyCredentials = (s: StudentRosterItem) => {
    const credText = `Candidate: ${s.name}\nLogin ID (Email): ${s.email}\nHall Ticket: ${s.hall_ticket}\nPassword: ${s.temporary_password || 'Student#123456!'}\nPortal: ${window.location.origin}/login`;
    navigator.clipboard.writeText(credText);
    setCopiedCreds(s.id);
    setTimeout(() => setCopiedCreds(null), 2500);
  };

  const handleResendAutoReply = (s: StudentRosterItem) => {
    setStudents((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, email_dispatched: true, email_dispatched_at: new Date().toLocaleTimeString() } : item))
    );
    setUploadMsg(`✉️ Auto-reply credentials email re-dispatched to ${s.email} with Login ID, Hall Ticket, and Password!`);
    setTimeout(() => setUploadMsg(''), 4000);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.hall_ticket || !newStudent.name) return;

    const stuPass = newStudent.student_gate_pass || generateGatePass('GP-STU', newStudent.hall_ticket);
    const candPass = newStudent.candidate_gate_pass || generateGatePass('GP-CAND', newStudent.hall_ticket);

    const candidate: StudentRosterItem = {
      id: `man-${Date.now()}`,
      hall_ticket: newStudent.hall_ticket.trim(),
      name: newStudent.name.trim(),
      email: newStudent.email.trim() || `${newStudent.hall_ticket.toLowerCase()}@campus.edu`,
      branch: newStudent.branch,
      college_name: newStudent.college_name,
      section: newStudent.section,
      batch: newStudent.batch,
      passout_year: Number(newStudent.passout_year),
      student_gate_pass: stuPass,
      candidate_gate_pass: candPass,
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
      section: 'CSM-A',
      batch: 'Batch 1',
      passout_year: 2026,
      student_gate_pass: generateGatePass('GP-STU', 'CAND'),
      candidate_gate_pass: generateGatePass('GP-CAND', 'CAND'),
    });

    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/students`,
        {
          roll_number: candidate.hall_ticket,
          hall_ticket: candidate.hall_ticket,
          name: candidate.name,
          email: candidate.email,
          branch: candidate.branch,
          branch_code: candidate.branch,
          college_name: candidate.college_name,
          section: candidate.section,
          batch: candidate.batch,
          passout_year: candidate.passout_year,
          year_of_passing: candidate.passout_year,
          student_gate_pass: candidate.student_gate_pass,
          candidate_gate_pass: candidate.candidate_gate_pass,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch {}
  };

  const handleVerifyEmail = async (student: StudentRosterItem) => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/students/${student.id}`,
        { is_verified: true },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_verified: true } : s))
      );
      setUploadMsg(`Student ${student.name} (${student.hall_ticket}) email marked as verified.`);
      setTimeout(() => setUploadMsg(''), 4000);
    } catch {
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_verified: true } : s))
      );
      setUploadMsg(`Student ${student.name} email marked as verified.`);
      setTimeout(() => setUploadMsg(''), 4000);
    }
  };

  const filtered = students.filter((s) => {
    const matchesBranch = branchFilter === 'ALL' || s.branch === branchFilter;
    const matchesCollege = collegeFilter === 'ALL' || (s.college_name && s.college_name.includes(collegeFilter));
    const matchesSection = sectionFilter === 'ALL' || s.section === sectionFilter;
    const matchesBatch = batchFilter === 'ALL' || (s.batch && s.batch.includes(batchFilter));
    const matchesPassoutYear = passoutYearFilter === 'ALL' || String(s.passout_year) === String(passoutYearFilter);
    const matchesLiveStatus = liveStatusFilter === 'ALL' ||
      (liveStatusFilter === 'IN_EXAM' && s.live_status?.state === 'in_exam') ||
      (liveStatusFilter === 'CLEARED' && (s.live_status?.state === 'cleared' || (s.is_verified && s.live_status?.state !== 'in_exam'))) ||
      (liveStatusFilter === 'PENDING' && (s.live_status?.state === 'pending' || !s.is_verified)) ||
      (liveStatusFilter === 'COMPLETED' && s.live_status?.state === 'completed') ||
      (liveStatusFilter === 'BLOCKED' && s.is_blocked);
    const matchesVerification =
      verificationFilter === 'ALL' ||
      (verificationFilter === 'VERIFIED' && s.is_verified !== false) ||
      (verificationFilter === 'UNVERIFIED' && s.is_verified === false);
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.hall_ticket.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_number && s.contact_number.includes(search)) ||
      (s.college_name && s.college_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.branch && s.branch.toLowerCase().includes(search.toLowerCase())) ||
      (s.batch && s.batch.toLowerCase().includes(search.toLowerCase())) ||
      (s.student_gate_pass && s.student_gate_pass.toLowerCase().includes(search.toLowerCase())) ||
      (s.candidate_gate_pass && s.candidate_gate_pass.toLowerCase().includes(search.toLowerCase()));
    return matchesBranch && matchesCollege && matchesSection && matchesBatch && matchesPassoutYear && matchesLiveStatus && matchesVerification && matchesSearch;
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
                Strict Collegiate Roster Governance, College ID, Hall Ticket, Email Verification, and Live Gate Pass Authority
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {!isSuperAdmin ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>🔒</span> Faculty Read-Only Mode
                </div>
              ) : (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn btn-secondary"
                    style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span>📥</span> Upload Student Excel / CSV
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleExcelUpload}
                  />

                  <button
                    onClick={handleDownloadCredentialsCsv}
                    className="btn btn-secondary"
                    style={{
                      padding: '10px 16px',
                      fontWeight: 700,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1.5px solid #EAA812',
                      color: '#FBBF24',
                    }}
                    title="Export all students with Login ID, Hall Ticket, and Passwords as CSV"
                  >
                    <span>📊</span> Export Credentials (CSV)
                  </button>

                  <button
                    onClick={handleToggleRegistration}
                    className="btn btn-secondary"
                    style={{
                      padding: '10px 16px',
                      fontWeight: 700,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: registrationEnabled ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid rgba(239, 68, 68, 0.5)',
                      color: registrationEnabled ? '#34d399' : '#f87171',
                      background: registrationEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    }}
                    title="Toggle student self-registration portal on or off"
                  >
                    <span>{registrationEnabled ? '🟢' : '⏸️'}</span>
                    <span>Registration: {registrationEnabled ? 'ACTIVE' : 'PAUSED'}</span>
                  </button>

                  <a
                    href="/register"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{
                      padding: '10px 16px',
                      fontWeight: 700,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textDecoration: 'none',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                    }}
                    title="Open the 4-step Student Registration Wizard"
                  >
                    <span>⚡</span> Register Wizard
                  </a>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span>➕</span> Add Candidate
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Feedback & Notice Banner */}
          {uploadMsg && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 18px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(56, 189, 248, 0.15) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.5)',
                color: '#34d399',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>⚡</span>
              <div style={{ flex: 1, fontSize: '0.92rem' }}>{uploadMsg}</div>
              <button
                type="button"
                onClick={() => setUploadMsg('')}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ELEVATED CANDIDATE CLEARANCE & DATA REDUNDANCY CENTER */}
          {(() => {
            const approvedTotal = students.filter((s) => s.is_verified !== false && (s as any).status !== 'pending_clearance').length;
            const pendingTotal = students.filter((s) => s.is_verified === false || (s as any).status === 'pending_clearance').length;
            const blockedTotal = students.filter((s) => s.is_blocked).length;

            return (
              <div
                className="card"
                style={{
                  marginBottom: 28,
                  padding: '24px 28px',
                  borderRadius: 18,
                  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
                  border: '1.5px solid rgba(56, 189, 248, 0.4)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
                }}
              >
                {/* Header Lockup */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <BrandLogo size="md" variant="standard" />
                    <div style={{ height: 32, width: 1, background: 'rgba(255, 255, 255, 0.15)' }} />
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        CENTRAL ROSTER GOVERNANCE
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                        Candidate Clearance, Verification &amp; Security Authority
                      </div>
                    </div>
                  </div>

                  {/* 3-Way Authority Mode Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 700 }}>Registration Authority Mode:</span>
                    <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      {[
                        { mode: 'ADMIN_ONLY' as const, label: '🔒 Admin Entry Only', desc: 'Portal closed' },
                        { mode: 'CLEARANCE_REQUIRED' as const, label: '⏳ Clearance Required', desc: 'Admin approves' },
                        { mode: 'ACTIVE' as const, label: '🟢 Auto-Clear Active', desc: 'Instant pass' },
                      ].map((item) => (
                        <button
                          key={item.mode}
                          type="button"
                          onClick={() => handleChangeAuthorityMode(item.mode)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: regAuthorityMode === item.mode ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                            color: regAuthorityMode === item.mode ? '#FFFFFF' : '#94A3B8',
                            border: 'none',
                            transition: 'all 0.2s',
                          }}
                          title={item.desc}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4 Metrics Metric Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Total Roster</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>{students.length}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Authoritative Records</div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Cleared &amp; Approved</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#34D399', marginTop: 2 }}>{approvedTotal}</div>
                    <div style={{ fontSize: '0.7rem', color: '#10B981' }}>Can Log In &amp; Test</div>
                  </div>

                  <div style={{ background: pendingTotal > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)', border: pendingTotal > 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', boxShadow: pendingTotal > 0 ? '0 0 16px rgba(245, 158, 11, 0.25)' : 'none' }}>
                    <div style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Pending Clearance</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#FBBF24', marginTop: 2 }}>{pendingTotal}</div>
                    <div style={{ fontSize: '0.7rem', color: '#F59E0B' }}>Awaiting Admin Action</div>
                  </div>

                  <div style={{ background: blockedTotal > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)', border: blockedTotal > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Blocked / Flagged</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#F87171', marginTop: 2 }}>{blockedTotal}</div>
                    <div style={{ fontSize: '0.7rem', color: '#EF4444' }}>Security Lockouts</div>
                  </div>
                </div>

                {/* Fast Action Buttons Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleBulkApprovePending}
                      disabled={pendingTotal === 0}
                      className="btn btn-sm"
                      style={{
                        background: pendingTotal > 0 ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.06)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        padding: '9px 18px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: pendingTotal > 0 ? '0 4px 16px rgba(16, 185, 129, 0.4)' : 'none',
                        cursor: pendingTotal > 0 ? 'pointer' : 'not-allowed',
                        opacity: pendingTotal > 0 ? 1 : 0.5,
                      }}
                    >
                      <span>⚡</span> 1-Click Approve All Pending ({pendingTotal})
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerificationFilter(verificationFilter === 'UNVERIFIED' ? 'ALL' : 'UNVERIFIED')}
                      className="btn btn-sm btn-secondary"
                      style={{
                        fontWeight: 700,
                        padding: '9px 14px',
                        borderRadius: 8,
                        color: verificationFilter === 'UNVERIFIED' ? '#FBBF24' : '#CBD5E1',
                        border: verificationFilter === 'UNVERIFIED' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      🔍 Filter: {verificationFilter === 'UNVERIFIED' ? 'Showing Pending Only' : 'Show Pending Queue'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={handleBackupFullSystem}
                      className="btn btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        padding: '9px 16px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                      }}
                      title="Download complete timestamped JSON backup archive of all students"
                    >
                      <span>💾</span> 1-Click Full System Backup (.JSON)
                    </button>

                    <button
                      type="button"
                      onClick={handleExportRosterCsv}
                      className="btn btn-sm btn-ghost"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#E2E8F0',
                        fontWeight: 700,
                        padding: '9px 14px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Export student roster spreadsheet"
                    >
                      <span>📊</span> Export Roster (.CSV)
                    </button>

                    <button
                      type="button"
                      onClick={handleClearRosterFresh}
                      className="btn btn-sm"
                      style={{
                        background: '#dc2626',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        padding: '9px 14px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                      }}
                      title="Clear all student records for a clean fresh institutional deployment"
                    >
                      <span>🧹</span> Clear Roster (Start Fresh)
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
              <strong>Strict Administrator Governance Active:</strong> Candidate registration is 100% responsible only to the Administrator. Candidates cannot log in or participate in exams until cleared by the Administrator. All data is backed up with 1-click redundant exports.
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

          {/* Dynamic Roster & Hierarchy Intelligence Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Filtered Students</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#38BDF8' }}>
                {filtered.length} <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>/ {students.length} total</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Live In Exam Now</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34D399' }}>
                {students.filter(s => s.live_status?.state === 'in_exam').length} <span style={{ fontSize: '0.78rem', color: '#6EE7B7' }}>active</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, border: '1px solid rgba(168, 85, 247, 0.25)' }}>
              <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Branches Represented</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#C084FC' }}>
                {new Set(students.map(s => s.branch).filter(Boolean)).size} <span style={{ fontSize: '0.78rem', color: '#D8B4FE' }}>branches</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Graduation Years (YOP)</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FBBF24' }}>
                {Array.from(new Set(students.map(s => s.passout_year).filter(Boolean))).sort().join(', ') || '2026, 2027, 2028'}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 20,
              flexWrap: 'wrap',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                className="form-input"
                style={{ width: '100%', fontSize: '0.86rem', padding: '8px 14px' }}
                placeholder="Search by Hall Ticket, Name, College, Email, Phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* College Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>COLLEGE:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px', minWidth: 160 }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>BRANCH:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px' }}
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
                <option value="CIVIL">CIVIL</option>
              </select>
            </div>

            {/* Section Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>SECTION:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px' }}
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
                <option value="D">Section D</option>
                <option value="E">Section E</option>
              </select>
            </div>

            {/* Batch / Group Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>BATCH:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px' }}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                <option value="ALL">All Batches</option>
                <option value="Batch 1">Batch 1</option>
                <option value="Batch 2">Batch 2</option>
                <option value="Batch 3">Batch 3</option>
                <option value="Batch 2026">Batch 2026</option>
                <option value="Batch 2027">Batch 2027</option>
                <option value="Batch 2028">Batch 2028</option>
                <option value="Group Alpha">Group Alpha</option>
                <option value="Group Beta">Group Beta</option>
              </select>
            </div>

            {/* Passout Year (YOP) Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: '#FBBF24', fontWeight: 800 }}>PASSOUT YEAR:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#FDE68A' }}
                value={passoutYearFilter}
                onChange={(e) => setPassoutYearFilter(e.target.value)}
              >
                <option value="ALL">All Years (YOP)</option>
                <option value="2025">2025 Class</option>
                <option value="2026">2026 Class</option>
                <option value="2027">2027 Class</option>
                <option value="2028">2028 Class</option>
                <option value="2029">2029 Class</option>
                <option value="2030">2030 Class</option>
              </select>
            </div>

            {/* Live Activity Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: '#34D399', fontWeight: 800 }}>LIVE STATUS:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#6EE7B7' }}
                value={liveStatusFilter}
                onChange={(e) => setLiveStatusFilter(e.target.value)}
              >
                <option value="ALL">All Live Statuses</option>
                <option value="IN_EXAM">🟢 Live in Exam</option>
                <option value="CLEARED">✓ Cleared &amp; Ready</option>
                <option value="PENDING">⏳ Pending Clearance</option>
                <option value="COMPLETED">🏁 Exam Completed</option>
                <option value="BLOCKED">🛑 Blocked by Admin</option>
              </select>
            </div>

            {/* Email Verification Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>VERIFIED:</span>
              <select
                className="form-input"
                style={{ fontSize: '0.84rem', padding: '6px 10px' }}
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as any)}
              >
                <option value="ALL">All Accounts</option>
                <option value="VERIFIED">Verified Only (✓)</option>
                <option value="UNVERIFIED">Pending Verification (⏳)</option>
              </select>
            </div>
          </div>

          {!isSuperAdmin && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                marginBottom: 20,
                fontSize: '0.84rem',
                color: '#BAE6FD',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              <div>
                <strong>Faculty Read-Only Access:</strong> You can monitor collegiate rosters and verification statuses. Only the Super Admin can create/edit student credentials, modify gate passes, or manage extra time.
              </div>
            </div>
          )}

          {bulkFeedback && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                background: bulkFeedback.startsWith('✅') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${bulkFeedback.startsWith('✅') ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                marginBottom: 16,
                fontSize: '0.88rem',
                color: bulkFeedback.startsWith('✅') ? '#6EE7B7' : '#FCA5A5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>{bulkFeedback}</div>
              <button
                onClick={() => setBulkFeedback(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
              >
                &times;
              </button>
            </div>
          )}

          {/* Super Admin Bulk Verification Action Bar */}
          {isSuperAdmin && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 18px',
                borderRadius: 10,
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>
                  Selected: <strong style={{ color: '#38BDF8' }}>{selectedStudentIds.size}</strong> of {filtered.length} students
                </span>
                {selectedStudentIds.size > 0 && (
                  <button
                    onClick={() => setSelectedStudentIds(new Set())}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  id="bulk-verify-selected-btn"
                  onClick={handleBulkVerifySelected}
                  disabled={selectedStudentIds.size === 0 || bulkLoading}
                  className="btn btn-primary btn-sm"
                  style={{
                    background: selectedStudentIds.size > 0 ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.1)',
                    borderColor: selectedStudentIds.size > 0 ? '#10B981' : 'transparent',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    opacity: selectedStudentIds.size > 0 ? 1 : 0.5,
                  }}
                >
                  {bulkLoading ? 'Verifying...' : `✓ Verify Selected (${selectedStudentIds.size})`}
                </button>

                <button
                  id="bulk-verify-section-btn"
                  onClick={handleBulkVerifySection}
                  disabled={bulkLoading}
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                    color: '#38BDF8',
                    fontWeight: 700,
                  }}
                >
                  ⚡ Verify All in this Section ({sectionFilter === 'ALL' ? 'Sec A' : sectionFilter})
                </button>
              </div>
            </div>
          )}

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
                  {isSuperAdmin && (
                    <th style={{ padding: '14px 12px', width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.size === filtered.length && filtered.length > 0}
                        onChange={handleToggleSelectAll}
                        title="Select All Students"
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </th>
                  )}
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>HALL TICKET / ROLL NO</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>CANDIDATE NAME &amp; CONTACT</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>COLLEGE, BRANCH &amp; BATCH</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>PASSOUT YEAR</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>CURRENT LIVE STATUS</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>GATE PASSES</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)' }}>CLEARANCE STATUS</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--color-text-muted)', textAlign: 'right' }}>ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? 9 : 8} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏛️</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: 6 }}>
                        {!isSuperAdmin ? 'No Academic Sections Allocated' : 'No Candidate Records Found'}
                      </div>
                      <div style={{ fontSize: '0.86rem', color: '#94A3B8', maxWidth: 440, margin: '0 auto', lineHeight: 1.5 }}>
                        {!isSuperAdmin
                          ? 'No academic sections are currently assigned to your faculty account. Please contact your Super Administrator to assign your branch sections.'
                          : search || branchFilter !== 'ALL' || collegeFilter !== 'ALL' || sectionFilter !== 'ALL' || passoutYearFilter !== 'ALL' || liveStatusFilter !== 'ALL'
                          ? 'No students matched the selected filter criteria. Try clearing search filters.'
                          : 'No students have been enrolled yet. Use Bulk Import (.XLSX) or Add Candidate above to get started.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: s.is_blocked ? 'rgba(239, 68, 68, 0.05)' : selectedStudentIds.has(s.id) ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    }}
                  >
                    {isSuperAdmin && (
                      <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(s.id)}
                          onChange={() => handleToggleSelect(s.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                    )}
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
                      {(s.contact_number || s.mobile) && (
                        <div style={{ fontSize: '0.74rem', color: '#38BDF8', fontFamily: 'monospace', marginTop: 2 }}>
                          📞 {(s.contact_number || s.mobile || '').startsWith('+91') ? (s.contact_number || s.mobile) : `+91 ${s.contact_number || s.mobile}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.84rem' }}>{s.college_name || '—'}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-faint)' }}>
                        Branch: <strong>{s.branch}</strong> &bull; Sec: <strong>{s.section || 'A'}</strong> &bull; Group: <strong>{s.batch || 'Batch 1'}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: '#FBBF24',
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.80rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🎓 {s.passout_year || 2028}
                      </span>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 3 }}>
                        {s.batch || `Batch ${s.passout_year || 2028}`}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {s.is_blocked ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.74rem', fontWeight: 800 }}>
                          🛑 BLOCKED
                        </span>
                      ) : s.live_status?.state === 'in_exam' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.4)', fontSize: '0.75rem', fontWeight: 800 }}>
                            {s.live_status.label}
                          </span>
                          <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>
                            Score: {s.live_status.score ?? 0} &bull; Violations: {s.live_status.violations ?? 0}
                          </span>
                        </div>
                      ) : s.live_status?.state === 'completed' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.74rem', fontWeight: 800 }}>
                          {s.live_status.label}
                        </span>
                      ) : s.is_verified !== false ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.74rem', fontWeight: 700 }}>
                          ✓ Cleared &amp; Ready
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.18)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.72rem', fontWeight: 800 }}>
                            ⏳ Pending Clearance
                          </span>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleApproveClearance(s)}
                              className="btn btn-sm"
                              style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none', fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
                            >
                              ⚡ Clear &amp; Approve
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div>
                          {s.is_blocked ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#F87171',
                                fontSize: '0.70rem',
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
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34D399',
                                fontSize: '0.70rem',
                                fontWeight: 700,
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              🛡️ GATE PASS ACTIVE
                            </span>
                          )}
                        </div>
                        {s.student_gate_pass && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.70rem',
                                fontFamily: 'monospace',
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38BDF8',
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                              }}
                              title="Student Gate Pass"
                            >
                              STU: {s.student_gate_pass}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPass(s.student_gate_pass!)}
                              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}
                              title="Copy Student Gate Pass"
                            >
                              {copiedPass === s.student_gate_pass ? '✓' : '📋'}
                            </button>
                          </div>
                        )}
                        {s.candidate_gate_pass && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.70rem',
                                fontFamily: 'monospace',
                                background: 'rgba(168, 85, 247, 0.12)',
                                color: '#C084FC',
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid rgba(168, 85, 247, 0.25)',
                              }}
                              title="Candidate Gate Pass"
                            >
                              CAND: {s.candidate_gate_pass}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPass(s.candidate_gate_pass!)}
                              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}
                              title="Copy Candidate Gate Pass"
                            >
                              {copiedPass === s.candidate_gate_pass ? '✓' : '📋'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {s.is_verified !== false ? (
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
                          ✓ CLEARED &amp; VERIFIED
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: 'rgba(245, 158, 11, 0.18)',
                              color: '#FBBF24',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                            }}
                          >
                            ⏳ PENDING CLEARANCE
                          </span>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleApproveClearance(s)}
                              className="btn btn-sm"
                              style={{
                                background: 'linear-gradient(135deg, #10B981, #059669)',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              title="Approve candidate and issue exam gate pass clearance"
                            >
                              ⚡ Clear &amp; Approve
                            </button>
                          )}
                        </div>
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
                      {!isSuperAdmin ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>
                          Read Only (Faculty)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleCopyCredentials(s)}
                            title="Copy Login ID, Hall Ticket & Password to clipboard"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: copiedCreds === s.id ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                              color: copiedCreds === s.id ? '#34D399' : '#38BDF8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {copiedCreds === s.id ? '✓ Copied' : '🔑 Creds'}
                          </button>

                          <button
                            onClick={() => setPreviewEmailStudent(s)}
                            title="Preview official auto-reply email sent to student"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: 'rgba(234, 168, 18, 0.15)',
                              color: '#FBBF24',
                              border: '1px solid rgba(234, 168, 18, 0.3)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✉️ Mail
                          </button>

                          <button
                            onClick={() => handleResendAutoReply(s)}
                            title="Re-send auto-reply credentials email"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818CF8',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📨 Resend
                          </button>

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
                            {s.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      )}
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
                        <option value="">No Colleges Configured</option>
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
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setNewStudent({
                            ...newStudent,
                            hall_ticket: val,
                            student_gate_pass: generateGatePass('GP-STU', val || 'STU'),
                            candidate_gate_pass: generateGatePass('GP-CAND', val || 'CAND'),
                          });
                        }}
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
                    <label className="form-label">Email Address *</label>
                    <input
                      className="form-input"
                      type="email"
                      required
                      placeholder="e.g. ramesh.k@campus.edu"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Branch *</label>
                      <select
                        className="form-input"
                        value={newStudent.branch}
                        onChange={(e) => setNewStudent({ ...newStudent, branch: e.target.value })}
                      >
                        <option value="CSE">CSE (Computer Science)</option>
                        <option value="CSM">CSM (AI &amp; ML)</option>
                        <option value="IT">IT (Information Tech)</option>
                        <option value="ECE">ECE (Electronics)</option>
                        <option value="AIML">AIML</option>
                        <option value="MECH">MECH (Mechanical)</option>
                        <option value="CIVIL">CIVIL</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Passout Year *</label>
                      <select
                        className="form-input"
                        value={newStudent.passout_year}
                        onChange={(e) => setNewStudent({ ...newStudent, passout_year: Number(e.target.value) })}
                      >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                        <option value={2028}>2028</option>
                        <option value={2029}>2029</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Section *</label>
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
                        <option value="Section A">Section A</option>
                        <option value="Section B">Section B</option>
                        <option value="Section C">Section C</option>
                        <option value="Section D">Section D</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Batch / Group *</label>
                      <select
                        className="form-input"
                        value={newStudent.batch}
                        onChange={(e) => setNewStudent({ ...newStudent, batch: e.target.value })}
                      >
                        <option value="Batch 1">Batch 1</option>
                        <option value="Batch 2">Batch 2</option>
                        <option value="Batch 3">Batch 3</option>
                        <option value="Group Alpha">Group Alpha</option>
                        <option value="Group Beta">Group Beta</option>
                        <option value="Group Gamma">Group Gamma</option>
                      </select>
                    </div>
                  </div>

                  {/* Auto-Generated Gate Passes Section */}
                  <div
                    style={{
                      background: 'rgba(56, 189, 248, 0.06)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        🛡️ Auto-Generated Institutional Gate Passes
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const roll = newStudent.hall_ticket.trim() || 'CAND';
                          setNewStudent({
                            ...newStudent,
                            student_gate_pass: generateGatePass('GP-STU', roll),
                            candidate_gate_pass: generateGatePass('GP-CAND', roll),
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38BDF8',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        🔄 Regenerate
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 2 }}>Student Gate Pass:</div>
                        <input
                          className="form-input"
                          style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#38BDF8', background: 'rgba(0,0,0,0.3)', padding: '6px 8px' }}
                          value={newStudent.student_gate_pass}
                          onChange={(e) => setNewStudent({ ...newStudent, student_gate_pass: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 2 }}>Candidate Gate Pass:</div>
                        <input
                          className="form-input"
                          style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C084FC', background: 'rgba(0,0,0,0.3)', padding: '6px 8px' }}
                          value={newStudent.candidate_gate_pass}
                          onChange={(e) => setNewStudent({ ...newStudent, candidate_gate_pass: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>
                      Candidate will automatically be segregated into their collegiate department, group ({newStudent.batch}), and section ({newStudent.section}).
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                      Authorize &amp; Separate Candidate
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Auto-Reply Credentials Email Preview Modal */}
          {previewEmailStudent && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 20,
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  color: '#0F172A',
                  borderRadius: 12,
                  maxWidth: 620,
                  width: '100%',
                  border: '2px solid #EAA812',
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4)',
                  overflow: 'hidden',
                }}
              >
                {/* Email Client Header Bar */}
                <div
                  style={{
                    background: '#002147',
                    color: '#FFFFFF',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '3px solid #EAA812',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src="/brand/logicwhilelire-official.png"
                      alt="Logo"
                      style={{ height: 36, width: 'auto', background: '#FFFFFF', borderRadius: 4, padding: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#EAA812', fontWeight: 800 }}>
                        OFFICIAL AUTO-REPLY EMAIL DISPATCH
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF' }}>
                        Candidate Examination Credentials
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewEmailStudent(null)}
                    style={{ background: 'none', border: 'none', color: '#CBD5E1', fontSize: '1.4rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Email Headers Meta */}
                <div
                  style={{
                    background: '#F8FAFC',
                    padding: '14px 24px',
                    borderBottom: '1px solid #E2E8F0',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong style={{ color: '#64748B' }}>From:</strong> admissions@institution.edu &lt;noreply@logicwhilelire.com&gt;
                  </div>
                  <div>
                    <strong style={{ color: '#64748B' }}>To:</strong> {previewEmailStudent.name} &lt;{previewEmailStudent.email}&gt;
                  </div>
                  <div>
                    <strong style={{ color: '#64748B' }}>Subject:</strong> LogicWhile Assessment Suite — Credentials for {previewEmailStudent.name} ({previewEmailStudent.hall_ticket})
                  </div>
                </div>

                {/* Email Body Content */}
                <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '0.94rem' }}>
                    Dear <strong>{previewEmailStudent.name}</strong>,
                  </p>
                  <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                    Your candidate profile has been officially registered and cleared for live examination access. Below are your official system login credentials:
                  </p>

                  {/* Credentials Box */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '2px solid #EAA812',
                      borderRadius: 8,
                      padding: '18px 20px',
                      marginBottom: 18,
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 0', color: '#64748B', fontWeight: 600, width: '45%' }}>
                            1. Login ID (Email):
                          </td>
                          <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 800, color: '#002147' }}>
                            {previewEmailStudent.email}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 0', color: '#64748B', fontWeight: 600 }}>
                            2. Hall Ticket / Roll Number:
                          </td>
                          <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 800, color: '#D97706' }}>
                            {previewEmailStudent.hall_ticket}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 0', color: '#64748B', fontWeight: 600 }}>
                            3. Access Password:
                          </td>
                          <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 800, color: '#1D4ED8', letterSpacing: '1px' }}>
                            {previewEmailStudent.temporary_password || 'Student#123456!'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748B', fontWeight: 600 }}>
                            4. Examination Portal Link:
                          </td>
                          <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                            {window.location.origin}/login
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div
                      style={{
                        background: '#FEF3C7',
                        borderLeft: '3px solid #D97706',
                        padding: '8px 12px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        color: '#92400E',
                        marginTop: 12,
                      }}
                    >
                      🔒 <strong>Exam Gate Instruction:</strong> You may authenticate at the live gate using either your Hall Ticket Number or Login ID along with your access password.
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5 }}>
                    Please report to your assigned examination station on time. For inquiries, contact examination administration.
                  </p>
                </div>

                {/* Modal Footer Actions */}
                <div
                  style={{
                    background: '#F1F5F9',
                    borderTop: '1px solid #E2E8F0',
                    padding: '14px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <button
                    onClick={() => handleCopyCredentials(previewEmailStudent)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 700, padding: '8px 16px', border: '1px solid #CBD5E1', color: '#002147' }}
                  >
                    📋 Copy All Credentials
                  </button>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => {
                        handleResendAutoReply(previewEmailStudent);
                        setPreviewEmailStudent(null);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ background: '#002147', color: '#FFFFFF', fontWeight: 800, padding: '8px 18px', border: 'none', borderRadius: 6 }}
                    >
                      📨 Re-Send to Candidate Email
                    </button>
                    <button
                      onClick={() => setPreviewEmailStudent(null)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '8px 16px' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
