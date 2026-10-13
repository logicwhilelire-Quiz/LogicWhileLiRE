import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  getHierarchyOverview,
  listAcademicYears,
  createAcademicYear,
  deleteAcademicYear,
  listCohorts,
  createCohort,
  deleteCohort,
  listSections,
  createSection,
  deleteSection,
  listBatches,
  createBatch,
  deleteBatch,
  listHierarchyStudents,
  createHierarchyStudent,
  bulkImportStudents,
  previewHierarchyImport,
  exportBatchStudentsUrl,
  resetStudentPassword,
  setup2FA,
  verifyAndEnable2FA,
  disable2FA,
  runSystemBackup,
  downloadSystemBackupZip,
  type AcademicYear,
  type Cohort,
  type Section,
  type Batch,
  type HierarchyStudent,
} from '../../lib/api';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import BrandLogo from '../../components/BrandLogo';

export default function HierarchyManagementPage() {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || '{"role":"super_admin"}');
    } catch {
      return { role: 'super_admin' };
    }
  })();

  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const isInspector = currentUser.role === 'inspector' || currentUser.role === 'college_admin';

  // State: Colleges & Hierarchy Tree
  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<number>(currentUser.college_id || 1);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // State: Students in active selection
  const [students, setStudents] = useState<HierarchyStudent[]>([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [yearName, setYearName] = useState('');

  const [showAddCohortModal, setShowAddCohortModal] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [cohortYop, setCohortYop] = useState<number>(new Date().getFullYear() + 4);
  const [cohortDegree, setCohortDegree] = useState('B.Tech');
  const [cohortBranch, setCohortBranch] = useState('CSE');

  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [sectionName, setSectionName] = useState('');

  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [batchName, setBatchName] = useState('');

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    roll_number: '',
    name: '',
    email: '',
    phone: '',
  });

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2FA Security Modal
  const [show2faModal, setShow2faModal] = useState(false);
  const [twoFaData, setTwoFaData] = useState<{ secret: string; otpauth_url: string; qr_code_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaStatus, setTwoFaStatus] = useState<string>('');

  // Initial Load
  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    setLoading(true);
    try {
      const res = await getHierarchyOverview();
      if (res.data?.success) {
        setColleges(res.data.colleges || []);
        // Determine active college
        let collegeId = currentUser.college_id;
        if (!collegeId && res.data.colleges?.length > 0) {
          collegeId = res.data.colleges[0].id;
        }
        if (collegeId) {
          setSelectedCollegeId(collegeId);
          await loadYearsForCollege(collegeId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load hierarchy:', err);
      setMessage({ text: err.response?.data?.error || 'Failed to load institutional hierarchy.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadYearsForCollege(cid: number) {
    try {
      const res = await listAcademicYears(cid);
      const yrs = res.data.academic_years || [];
      setAcademicYears(yrs);
      if (yrs.length > 0) {
        const current = yrs.find((y) => y.is_current) || yrs[0];
        setSelectedYearId(current.id);
        await loadCohortsForYear(cid, current.id);
      } else {
        setSelectedYearId(null);
        setCohorts([]);
        setSelectedCohortId(null);
        setSections([]);
        setSelectedSectionId(null);
        setBatches([]);
        setSelectedBatchId(null);
        setStudents([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCohortsForYear(cid: number, yid: number) {
    try {
      const res = await listCohorts({ college_id: cid, academic_year_id: yid });
      const chs = res.data.cohorts || [];
      setCohorts(chs);
      if (chs.length > 0) {
        setSelectedCohortId(chs[0].id);
        await loadSectionsForCohort(chs[0].id);
      } else {
        setSelectedCohortId(null);
        setSections([]);
        setSelectedSectionId(null);
        setBatches([]);
        setSelectedBatchId(null);
        setStudents([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSectionsForCohort(chid: number) {
    try {
      const res = await listSections(chid);
      const secs = res.data.sections || [];
      setSections(secs);
      if (secs.length > 0) {
        setSelectedSectionId(secs[0].id);
        await loadBatchesForSection(secs[0].id);
      } else {
        setSelectedSectionId(null);
        setBatches([]);
        setSelectedBatchId(null);
        setStudents([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadBatchesForSection(secId: number) {
    try {
      const res = await listBatches(secId);
      const bts = res.data.batches || [];
      setBatches(bts);
      if (bts.length > 0) {
        setSelectedBatchId(bts[0].id);
        await loadStudents(secId, bts[0].id);
      } else {
        setSelectedBatchId(null);
        setStudents([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStudents(secId?: number, batchId?: number) {
    try {
      const res = await listHierarchyStudents({
        college_id: selectedCollegeId,
        section_id: secId || (selectedSectionId ?? undefined),
        batch_id: batchId || (selectedBatchId ?? undefined),
      });
      setStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle College Change
  async function handleSelectCollege(cid: number) {
    setSelectedCollegeId(cid);
    await loadYearsForCollege(cid);
  }

  // Handle Year Change
  async function handleSelectYear(yid: number) {
    setSelectedYearId(yid);
    await loadCohortsForYear(selectedCollegeId, yid);
  }

  // Handle Cohort Change
  async function handleSelectCohort(chid: number) {
    setSelectedCohortId(chid);
    await loadSectionsForCohort(chid);
  }

  // Handle Section Change
  async function handleSelectSection(secId: number) {
    setSelectedSectionId(secId);
    await loadBatchesForSection(secId);
  }

  // Handle Batch Change
  async function handleSelectBatch(batchId: number) {
    setSelectedBatchId(batchId);
    if (selectedSectionId) {
      await loadStudents(selectedSectionId, batchId);
    }
  }

  // Add Academic Year
  async function handleCreateYear() {
    if (!yearName.trim()) return;
    try {
      await createAcademicYear({
        college_id: selectedCollegeId,
        year_name: yearName.trim(),
        is_current: academicYears.length === 0,
      });
      setShowAddYearModal(false);
      setYearName('');
      setMessage({ text: 'Academic Year created successfully', type: 'success' });
      await loadYearsForCollege(selectedCollegeId);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to create academic year', type: 'error' });
    }
  }

  // Add Cohort
  async function handleCreateCohort() {
    if (!cohortName.trim() || !selectedYearId) return;
    const finalYop = Number(cohortYop) || (new Date().getFullYear() + 4);
    try {
      await createCohort({
        college_id: selectedCollegeId,
        academic_year_id: selectedYearId,
        cohort_name: cohortName.trim(),
        name: cohortName.trim(),
        yop: finalYop,
        year_of_passing: finalYop,
        degree: cohortDegree || 'B.Tech',
        branch: cohortBranch || 'CSE',
      });
      setShowAddCohortModal(false);
      setCohortName('');
      setMessage({ text: 'Cohort created successfully', type: 'success' });
      await loadCohortsForYear(selectedCollegeId, selectedYearId);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to create cohort', type: 'error' });
    }
  }

  // Add Section
  async function handleCreateSection() {
    if (!sectionName.trim() || !selectedCohortId) return;
    try {
      await createSection({
        college_id: selectedCollegeId,
        academic_year_id: selectedYearId || undefined,
        cohort_id: selectedCohortId,
        section_name: sectionName.trim(),
        name: sectionName.trim(),
      } as any);
      setShowAddSectionModal(false);
      setSectionName('');
      setMessage({ text: 'Section created successfully', type: 'success' });
      await loadSectionsForCohort(selectedCohortId);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to create section', type: 'error' });
    }
  }

  // Add Batch
  async function handleCreateBatch() {
    if (!batchName.trim() || !selectedSectionId) return;
    try {
      await createBatch({
        college_id: selectedCollegeId,
        academic_year_id: selectedYearId || undefined,
        cohort_id: selectedCohortId || undefined,
        section_id: selectedSectionId,
        batch_name: batchName.trim(),
        name: batchName.trim(),
      } as any);
      setShowAddBatchModal(false);
      setBatchName('');
      setMessage({ text: 'Batch created successfully', type: 'success' });
      await loadBatchesForSection(selectedSectionId);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to create batch', type: 'error' });
    }
  }

  // Add Single Student
  async function handleCreateStudent() {
    if (!selectedSectionId || !selectedBatchId) {
      setMessage({ text: 'A student must belong to exactly one section and one batch.', type: 'error' });
      return;
    }
    if (!studentForm.roll_number || !studentForm.name || !studentForm.email) {
      setMessage({ text: 'Please fill in Roll Number, Full Name, and Student Email.', type: 'error' });
      return;
    }

    try {
      const res = await createHierarchyStudent({
        roll_number: studentForm.roll_number.trim(),
        name: studentForm.name.trim(),
        email: studentForm.email.trim(),
        phone: studentForm.phone.trim(),
        college_id: selectedCollegeId,
        academic_year_id: selectedYearId || undefined,
        cohort_id: selectedCohortId || undefined,
        section_id: selectedSectionId,
        batch_id: selectedBatchId,
      });

      setShowAddStudentModal(false);
      setStudentForm({ roll_number: '', name: '', email: '', phone: '' });
      setMessage({
        text: `Student ${res.data.student.name} created! Welcome email dispatched with temporary password: ${res.data.temporaryPassword}`,
        type: 'success',
      });
      await loadStudents(selectedSectionId, selectedBatchId);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to create student', type: 'error' });
    }
  }

  // Reset Student Password
  async function handleResetStudentPassword(student: HierarchyStudent) {
    if (!confirm(`Reset password for ${student.name} (${student.roll_number || student.email})? A new temporary password will be issued and emailed.`)) {
      return;
    }
    try {
      const res = await resetStudentPassword(student.id);
      setMessage({
        text: `Password reset for ${student.name}. Temporary Password: ${res.data.temporaryPassword} (Email sent)`,
        type: 'success',
      });
      await loadStudents(selectedSectionId ?? undefined, selectedBatchId ?? undefined);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to reset password', type: 'error' });
    }
  }

  // Preview Bulk Import & Duplicate Detection
  async function handlePreview() {
    if (!importFile) {
      alert('Please select an Excel (.xlsx/.xls) or CSV file first');
      return;
    }
    setPreviewing(true);
    setPreviewData(null);
    try {
      const res = await previewHierarchyImport(importFile);
      setPreviewData(res.data);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to generate import preview', type: 'error' });
    } finally {
      setPreviewing(false);
    }
  }

  // Bulk Import (Idempotent with Section Auto-Linking & Audit Log)
  async function handleBulkImportSubmit() {
    if (!importFile) {
      alert('Please select an Excel (.xlsx/.xls) or CSV file');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await bulkImportStudents(importFile, {
        college_id: selectedCollegeId,
        section_id: selectedSectionId || undefined,
        batch_id: selectedBatchId || undefined,
      });
      setImportResult(res.data);
      setMessage({
        text: `Idempotent import completed: ${res.data.summary.inserted} students processed / enrolled.`,
        type: 'success',
      });
      await loadStudents(selectedSectionId ?? undefined, selectedBatchId ?? undefined);
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to process bulk import', type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  // 2FA Setup
  async function handleOpen2fa() {
    setShow2faModal(true);
    setTwoFaStatus('');
    try {
      const res = await setup2FA();
      setTwoFaData(res.data);
    } catch (err: any) {
      setTwoFaStatus(err.response?.data?.error || 'Failed to initiate 2FA setup');
    }
  }

  async function handleVerify2fa() {
    if (!totpCode || totpCode.trim().length !== 6) {
      setTwoFaStatus('Please enter the 6-digit authenticator code');
      return;
    }
    try {
      await verifyAndEnable2FA(totpCode.trim());
      setTwoFaStatus('✅ 2FA Successfully Enabled! Your account is now protected with TOTP.');
      setTotpCode('');
    } catch (err: any) {
      setTwoFaStatus(err.response?.data?.error || 'Invalid TOTP code. Please try again.');
    }
  }

  async function handleDisable2fa() {
    if (!totpCode || totpCode.trim().length !== 6) {
      setTwoFaStatus('Enter 6-digit TOTP code to confirm 2FA deactivation');
      return;
    }
    try {
      await disable2FA(totpCode.trim());
      setTwoFaStatus('2FA disabled successfully.');
      setTotpCode('');
    } catch (err: any) {
      setTwoFaStatus(err.response?.data?.error || 'Failed to disable 2FA');
    }
  }

  // Run System Backup
  async function handleRunBackup() {
    try {
      setMessage({ text: 'Exporting all key tables, batch student lists, and exam result sheets...', type: 'info' });
      const res = await downloadSystemBackupZip();
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logicwhilelire_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ text: 'System backup package (.zip with CSV, JSON, batch-wise lists, and row-count manifest) downloaded successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || 'Failed to download backup', type: 'error' });
    }
  }

  const filteredStudents = students.filter((s) => {
    if (!searchStudent) return true;
    const q = searchStudent.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q))
    );
  });

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="hierarchy" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Academic Architecture & Roster
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Hierarchy & Student Roster
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                College ➔ Academic Year ➔ Cohort (YOP) ➔ Section ➔ Batch (Single section & batch assignment model)
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleOpen2fa}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🛡️</span> 2FA Security
              </button>

              {isSuperAdmin && (
                <button
                  id="download-backup-btn"
                  onClick={handleRunBackup}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>💾</span> Download backup now
                </button>
              )}
            </div>
          </div>

          {/* Flash Notification */}
          {message && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: '0.88rem',
                fontWeight: 600,
                background:
                  message.type === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : message.type === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  message.type === 'success'
                    ? '#34D399'
                    : message.type === 'error'
                    ? '#F87171'
                    : '#60A5FA',
                border:
                  message.type === 'success'
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : message.type === 'error'
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* College Selector (Scoped for Inspector, Selectable for Super Admin) */}
          <div
            className="card"
            style={{
              padding: '18px 24px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid var(--color-border)',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: '1.8rem' }}>🏫</div>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)', fontWeight: 800 }}>
                  Active College Scope
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {colleges.find((c) => c.id === selectedCollegeId)?.name || `College #${selectedCollegeId}`}
                  {isInspector && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#EAB308', color: '#000', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      INSPECTOR ENFORCED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Switch College:</label>
                <select
                  value={selectedCollegeId}
                  onChange={(e) => handleSelectCollege(Number(e.target.value))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: '#FFF',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <Link
                  to="/admin/colleges"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#002147',
                    border: '1.5px solid #EAA812',
                    color: '#EAA812',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  🏫 Manage Colleges
                </Link>
              </div>
            )}
          </div>

          {/* 4-Step Interactive Breadcrumb Ribbon: Year -> Cohort -> Section -> Batch */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
            {/* 1. Academic Year */}
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.5)',
                border: selectedYearId ? '1.5px solid #EAA812' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#EAA812', letterSpacing: '0.05em' }}>
                  1. Academic Year
                </span>
                <button
                  onClick={() => setShowAddYearModal(true)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: 6,
                    background: 'rgba(234, 168, 18, 0.2)',
                    border: '1px solid rgba(234, 168, 18, 0.4)',
                    color: '#FDE68A',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  + Add Year
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {academicYears.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => handleSelectYear(y.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      fontWeight: selectedYearId === y.id ? 700 : 500,
                      background: selectedYearId === y.id ? 'rgba(234, 168, 18, 0.2)' : 'rgba(30, 41, 59, 0.3)',
                      color: selectedYearId === y.id ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: selectedYearId === y.id ? '1px solid #EAA812' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{y.year_name}</span>
                    {y.is_current && <span style={{ fontSize: '0.65rem', background: '#10B981', color: '#000', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>Active</span>}
                  </button>
                ))}
                {academicYears.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>No academic years defined yet.</div>}
              </div>
            </div>

            {/* 2. Cohort (YOP) */}
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.5)',
                border: selectedCohortId ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.05em' }}>
                  2. Cohort (YOP)
                </span>
                <button
                  disabled={!selectedYearId}
                  onClick={() => setShowAddCohortModal(true)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: 6,
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#C4B5FD',
                    cursor: selectedYearId ? 'pointer' : 'not-allowed',
                    opacity: selectedYearId ? 1 : 0.4,
                    fontWeight: 700,
                  }}
                >
                  + Add Cohort
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {cohorts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCohort(c.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      fontWeight: selectedCohortId === c.id ? 700 : 500,
                      background: selectedCohortId === c.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 41, 59, 0.3)',
                      color: selectedCohortId === c.id ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: selectedCohortId === c.id ? '1px solid #8B5CF6' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{c.cohort_name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#C4B5FD', fontWeight: 700 }}>YOP {c.yop}</span>
                  </button>
                ))}
                {cohorts.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>Select a year to view cohorts.</div>}
              </div>
            </div>

            {/* 3. Section */}
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.5)',
                border: selectedSectionId ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#F472B6', letterSpacing: '0.05em' }}>
                  3. Section
                </span>
                <button
                  disabled={!selectedCohortId}
                  onClick={() => setShowAddSectionModal(true)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: 6,
                    background: 'rgba(236, 72, 153, 0.2)',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
                    color: '#FBCFE8',
                    cursor: selectedCohortId ? 'pointer' : 'not-allowed',
                    opacity: selectedCohortId ? 1 : 0.4,
                    fontWeight: 700,
                  }}
                >
                  + Add Section
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSection(s.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      fontWeight: selectedSectionId === s.id ? 700 : 500,
                      background: selectedSectionId === s.id ? 'rgba(236, 72, 153, 0.2)' : 'rgba(30, 41, 59, 0.3)',
                      color: selectedSectionId === s.id ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: selectedSectionId === s.id ? '1px solid #EC4899' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    Section {s.section_name}
                  </button>
                ))}
                {sections.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>Select a cohort to view sections.</div>}
              </div>
            </div>

            {/* 4. Batch */}
            <div
              className="card"
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.5)',
                border: selectedBatchId ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 800, color: '#34D399', letterSpacing: '0.05em' }}>
                  4. Batch
                </span>
                <button
                  disabled={!selectedSectionId}
                  onClick={() => setShowAddBatchModal(true)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#A7F3D0',
                    cursor: selectedSectionId ? 'pointer' : 'not-allowed',
                    opacity: selectedSectionId ? 1 : 0.4,
                    fontWeight: 700,
                  }}
                >
                  + Add Batch
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBatch(b.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      textAlign: 'left',
                      fontSize: '0.84rem',
                      fontWeight: selectedBatchId === b.id ? 700 : 500,
                      background: selectedBatchId === b.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.3)',
                      color: selectedBatchId === b.id ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: selectedBatchId === b.id ? '1px solid #10B981' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    Batch {b.batch_name}
                  </button>
                ))}
                {batches.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>Select a section to view batches.</div>}
              </div>
            </div>
          </div>

          {/* Student Roster in Active Batch */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFF', margin: 0 }}>
                  Assigned Student Roster
                </h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Section:{' '}
                  <strong style={{ color: '#FFF' }}>
                    {sections.find((s) => s.id === selectedSectionId)?.section_name || 'None'}
                  </strong>{' '}
                  • Batch:{' '}
                  <strong style={{ color: '#FFF' }}>
                    {batches.find((b) => b.id === selectedBatchId)?.batch_name || 'None'}
                  </strong>{' '}
                  ({filteredStudents.length} Students)
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search name, roll, email..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: '#FFF',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.84rem',
                    width: 220,
                  }}
                />

                <button
                  disabled={!selectedBatchId}
                  onClick={() => setShowAddStudentModal(true)}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>👤</span> Add Student
                </button>

                <button
                  disabled={!selectedBatchId}
                  onClick={() => setShowBulkImportModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>📤</span> Bulk Import (CSV/Excel)
                </button>

                {selectedBatchId && (
                  <a
                    href={exportBatchStudentsUrl(selectedBatchId, 'xlsx')}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    <span>📥</span> Export Batch (Excel)
                  </a>
                )}
              </div>
            </div>

            {/* Students Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '12px 14px' }}>Roll / Hall Ticket</th>
                    <th style={{ padding: '12px 14px' }}>Student Name</th>
                    <th style={{ padding: '12px 14px' }}>Email Address</th>
                    <th style={{ padding: '12px 14px' }}>Section & Batch</th>
                    <th style={{ padding: '12px 14px' }}>First-Login Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => (
                    <tr key={st.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>
                        {st.roll_number || st.hall_ticket || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#FFFFFF' }}>{st.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>{st.email}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#93C5FD', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', marginRight: 6 }}>
                          Sec {sections.find((s) => s.id === st.section_id)?.section_name || st.section_id}
                        </span>
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#6EE7B7', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem' }}>
                          Batch {batches.find((b) => b.id === st.batch_id)?.batch_name || st.batch_id}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {st.must_change_password ? (
                          <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#FACC15', padding: '3px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700 }}>
                            🔑 Pending Password Change
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', padding: '3px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700 }}>
                            ✅ Password Set
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleResetStudentPassword(st)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#F87171',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--color-text-faint)' }}>
                        No students enrolled in this batch yet. Click "Add Student" or "Bulk Import" to populate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Add Year */}
          {showAddYearModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 420, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#FFF' }}>Add Academic Year</h3>
                
                {/* Quick Presets for 2026, 2021, etc. */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#EAA812', fontWeight: 700, marginBottom: 6 }}>
                    ⚡ Quick Year Presets (2026, 2021, etc.):
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['2026', '2021', '2025-2026', '2026-2027', '2020-2021', '2021-2022'].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setYearName(yr)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '0.8rem',
                          borderRadius: 6,
                          background: yearName === yr ? '#002147' : '#1E293B',
                          color: yearName === yr ? '#FFFFFF' : '#CBD5E1',
                          border: yearName === yr ? '1.5px solid #EAA812' : '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          fontWeight: yearName === yr ? 800 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Year Name (Custom or Selected)</label>
                  <input
                    type="text"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    placeholder="2026 or 2025-2026"
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAddYearModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleCreateYear} className="btn btn-primary" style={{ padding: '8px 16px', background: '#002147', border: '1px solid #EAA812', color: '#FFF' }}>Save Year</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Add Cohort */}
          {showAddCohortModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 440, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#FFF' }}>Add Cohort</h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Cohort Name</label>
                  <input
                    type="text"
                    value={cohortName}
                    onChange={(e) => setCohortName(e.target.value)}
                    placeholder="B.Tech CSE - 2028 Batch"
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>YOP</label>
                    <input
                      type="number"
                      value={cohortYop}
                      onChange={(e) => setCohortYop(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Degree</label>
                    <input
                      type="text"
                      value={cohortDegree}
                      onChange={(e) => setCohortDegree(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Branch</label>
                    <input
                      type="text"
                      value={cohortBranch}
                      onChange={(e) => setCohortBranch(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAddCohortModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleCreateCohort} className="btn btn-primary" style={{ padding: '8px 16px', background: '#002147', border: '1px solid #EAA812', color: '#FFF' }}>Save Cohort</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Add Section */}
          {showAddSectionModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 420, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#FFF' }}>Add Section</h3>
                
                {/* Quick Presets for Sections A, B, C, D, E */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#EAA812', fontWeight: 700, marginBottom: 6 }}>
                    ⚡ Quick Section Presets (A, B, C, D, E):
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['A', 'B', 'C', 'D', 'E'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSectionName(s)}
                        style={{
                          padding: '5px 14px',
                          fontSize: '0.82rem',
                          borderRadius: 6,
                          background: sectionName === s ? '#002147' : '#1E293B',
                          color: sectionName === s ? '#FFFFFF' : '#CBD5E1',
                          border: sectionName === s ? '1.5px solid #EAA812' : '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          fontWeight: sectionName === s ? 800 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Section {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Section Name</label>
                  <input
                    type="text"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="A or CSE-A"
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAddSectionModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleCreateSection} className="btn btn-primary" style={{ padding: '8px 16px', background: '#002147', border: '1px solid #EAA812', color: '#FFF' }}>Save Section</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Add Batch */}
          {showAddBatchModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 400, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#FFF' }}>Add Batch</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>Batch Name (e.g. 1, 2, B1)</label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="1"
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAddBatchModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleCreateBatch} className="btn btn-primary" style={{ padding: '8px 16px' }}>Save Batch</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Add Single Student */}
          {showAddStudentModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 460, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#FFF' }}>Add Student</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  Section: <strong>{sections.find((s) => s.id === selectedSectionId)?.section_name}</strong> | Batch: <strong>{batches.find((b) => b.id === selectedBatchId)?.batch_name}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Roll Number / Hall Ticket *</label>
                    <input
                      type="text"
                      value={studentForm.roll_number}
                      onChange={(e) => setStudentForm({ ...studentForm, roll_number: e.target.value })}
                      placeholder="2201A0599"
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Full Name *</label>
                    <input
                      type="text"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      placeholder="Student Full Name"
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Email Address *</label>
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      placeholder="student@college.edu"
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1E293B', color: '#FFF', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setShowAddStudentModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                  <button onClick={handleCreateStudent} className="btn btn-primary" style={{ padding: '8px 16px' }}>Enroll & Send Welcome Email</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Bulk Import */}
          {showBulkImportModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 520, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#FFF' }}>Bulk Import Students (Excel / CSV)</h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Upload an Excel (.xlsx/.xls) or CSV spreadsheet containing columns: <code>roll_number</code>, <code>name</code>, <code>email</code>.
                  Each student will be enrolled in the active Section and Batch, assigned a temporary password, and sent a welcome email.
                </p>

                <div
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 10,
                    padding: 24,
                    textAlign: 'center',
                    marginBottom: 16,
                    cursor: 'pointer',
                    background: 'rgba(30, 41, 59, 0.4)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv, .xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: '0.9rem', color: '#FFF', fontWeight: 600 }}>
                    {importFile ? importFile.name : 'Click to select spreadsheet (.xlsx, .csv)'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <button
                    type="button"
                    disabled={!importFile || previewing || importing}
                    onClick={handlePreview}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '9px 14px' }}
                  >
                    {previewing ? 'Analyzing...' : '🔍 Preview & Validate Spreadsheet'}
                  </button>
                </div>

                {/* Validation Preview & Duplicate Detection Report */}
                {previewData && (
                  <div style={{ padding: 14, background: 'rgba(30, 41, 59, 0.7)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', fontSize: '0.78rem', fontWeight: 700 }}>
                        ✓ {previewData.valid_count ?? previewData.preview?.length ?? 0} Valid Rows
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', fontSize: '0.78rem', fontWeight: 700 }}>
                        🔁 {previewData.duplicate_count ?? previewData.duplicates?.length ?? 0} Duplicates (Idempotent update)
                      </span>
                      {previewData.error_count > 0 && (
                        <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', fontSize: '0.78rem', fontWeight: 700 }}>
                          ⚠️ {previewData.error_count} Invalid
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 8 }}>
                      ✨ <em>Roster rows will auto-link students to the right section without manual assignment.</em>
                    </div>

                    {previewData.duplicates?.length > 0 && (
                      <div style={{ fontSize: '0.74rem', color: '#FCD34D', marginBottom: 6 }}>
                        Duplicate notice: {previewData.duplicates.length} students already exist and will be idempotently updated.
                      </div>
                    )}

                    {previewData.errors?.length > 0 && (
                      <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: '0.74rem', color: '#F87171', background: 'rgba(239, 68, 68, 0.08)', padding: 6, borderRadius: 6 }}>
                        Errors: {previewData.errors.map((e: any, i: number) => (
                          <div key={i}>Row {e.row}: {e.reason}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {importResult && (
                  <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ color: '#34D399', fontWeight: 700, fontSize: '0.86rem' }}>
                      Import Summary: {importResult.summary?.inserted} Inserted / {importResult.summary?.total} Total
                    </div>
                    {importResult.errors?.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#F87171', marginTop: 6 }}>
                        Errors: {importResult.errors.map((e: any) => `Row ${e.row}: ${e.reason}`).join('; ')}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => { setShowBulkImportModal(false); setImportFile(null); setImportResult(null); setPreviewData(null); }} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Close</button>
                  <button disabled={!importFile || importing} onClick={handleBulkImportSubmit} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    {importing ? 'Processing & Dispatching...' : 'Execute Idempotent Import'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: 2FA TOTP Protection */}
          {show2faModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: 440, padding: 24, borderRadius: 12, background: '#0F172A', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: '#FFF' }}>🛡️ Two-Factor Authentication (TOTP)</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0' }}>
                  Protect your Admin/Inspector account using standard Google Authenticator or Microsoft Authenticator (RFC 6238).
                </p>

                {twoFaData?.qr_code_url ? (
                  <div style={{ margin: '16px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src={twoFaData.qr_code_url} alt="TOTP QR Code" style={{ width: 180, height: 180, borderRadius: 10, border: '2px solid var(--color-border)' }} />
                    <div style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                      Manual Secret Key: <code style={{ color: '#60A5FA', letterSpacing: '0.1em' }}>{twoFaData.secret}</code>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>Loading 2FA Key...</div>
                )}

                <div style={{ margin: '16px 0' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Enter 6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{
                      width: 180,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#1E293B',
                      color: '#FFF',
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                      fontSize: '1.2rem',
                      letterSpacing: '0.2em',
                      fontWeight: 700,
                    }}
                  />
                </div>

                {twoFaStatus && (
                  <div style={{ fontSize: '0.82rem', marginBottom: 14, color: twoFaStatus.startsWith('✅') ? '#34D399' : '#F87171' }}>
                    {twoFaStatus}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <button onClick={() => setShow2faModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Close</button>
                  <button onClick={handleVerify2fa} className="btn btn-primary" style={{ padding: '8px 16px' }}>Verify & Activate</button>
                  <button onClick={handleDisable2fa} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.2)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer', fontSize: '0.84rem' }}>
                    Disable
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
