import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExams, getExcelReportUrl, getPdfReportUrl } from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import {
  IconClipboard,
  IconBook,
  IconSettings,
  IconBuilding,
  IconChart,
  IconFileText,
  IconTrophy,
  IconCheck,
  IconShare,
  IconShield,
  IconAnalytics,
} from '../../components/icons/HumanIcons';


interface ExamItem {
  id: string;
  title: string;
  exam_code?: string;
  total_questions?: number;
  duration_minutes?: number;
  is_published?: boolean;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    listExams()
      .then((r) => {
        if (r.data?.exams) {
          setExams(r.data.exams);
          if (r.data.exams.length > 0) {
            setSelectedExamId(r.data.exams[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load exams for reports:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.exam_code && e.exam_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopyLink = (url: string, type: string) => {
    navigator.clipboard.writeText(url);
    showToast(`${type} link copied to clipboard.`);
  };

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="results" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#EAA812', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                LogicWhile LiRE Institutional Intelligence
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text, #FFFFFF)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Executive Reports &amp; Exports
              </h1>
              <p style={{ color: 'var(--color-text-muted, #94A3B8)', fontSize: '0.9rem', margin: '6px 0 0' }}>
                Generate certified Excel workbooks, print-ready PDF grade sheets, and live leaderboard feeds for institutional assessment.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate('/admin/questions')}
                className="btn btn-secondary"
                style={{ padding: '9px 16px', fontWeight: 700, borderRadius: 8, fontSize: '0.84rem' }}
              >
                Question Bank
              </button>
              <button
                onClick={() => navigate('/admin/exams')}
                className="btn btn-primary"
                style={{
                  padding: '9px 18px',
                  fontWeight: 700,
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  background: 'linear-gradient(135deg, #EAA812 0%, #D97706 100%)',
                  color: '#002147',
                  border: 'none',
                }}
              >
                Exam Management
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div
              className="animate-slide-up"
              style={{
                position: 'fixed',
                bottom: 30,
                right: 30,
                zIndex: 9999,
                background: '#0F172A',
                border: '1.5px solid #10B981',
                borderRadius: 10,
                padding: '12px 20px',
                color: '#34D399',
                fontWeight: 700,
                fontSize: '0.88rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.25)',
              }}
            >
              {toastMessage}
            </div>
          )}

          {/* Exam Selector Strip */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: '18px 24px',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 320px' }}>
              <IconBuilding size={22} color="#38BDF8" />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Active Examination Assessment
                </label>
                <select
                  id="reports-exam-select"
                  className="form-input"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: '#090E1D',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#F8FAFC',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {exams.length === 0 ? (
                    <option value="">No examinations created yet</option>
                  ) : (
                    filteredExams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} {e.exam_code ? `(${e.exam_code})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="text"
                placeholder="Filter exam title or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  background: '#090E1D',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#F8FAFC',
                  fontSize: '0.84rem',
                  width: 220,
                }}
              />
            </div>
          </div>

          {selectedExam && (
            <>
              {/* Executive Summary Metrics Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    borderTop: '3px solid #EAA812',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Exam Designation
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                    {selectedExam.exam_code || 'CS-2026'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#EAA812', marginTop: 2, fontWeight: 600 }}>
                    Official LiRE Code
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    borderTop: '3px solid #10B981',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Telemetry Mode
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                    Server Authoritative
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#34D399', marginTop: 2, fontWeight: 600 }}>
                    Synchronized Anti-Cheat Mesh
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    borderTop: '3px solid #0284c7',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Export Standard
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>
                    AICTE / NAAC Format
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#93C5FD', marginTop: 2, fontWeight: 600 }}>
                    Dual-Sheet Accreditation Ready
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    borderTop: '3px solid #8B5CF6',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Integrity Verification
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#C084FC', marginTop: 4 }}>
                    Audit Ledger Active
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#DDD6FE', marginTop: 2, fontWeight: 600 }}>
                    Full Tab &amp; Hardware Logs
                  </div>
                </div>
              </div>

              {/* 3 Executive Export Workbenches */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 24,
                  marginBottom: 32,
                }}
              >
                {/* 1. Official Excel Master Ledger */}
                <div
                  className="card animate-slide-up"
                  style={{
                    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(6, 12, 30, 0.92))',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 16,
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <IconChart size={32} color="#10B981" />
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#34D399',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 20,
                          textTransform: 'uppercase',
                        }}
                      >
                        Institutional Ledger (.xlsx)
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px' }}>
                      Master Excel Assessment Ledger
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 16px' }}>
                      Certified multi-sheet workbook containing comprehensive participant results, rank ordering, 5-sector score distribution, and synchronous anti-cheat violations log.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#10B981" />
                        <span><strong>Sheet 1: Ranked Performance</strong> (Rank, Name, Hall Ticket, Score, Max, Graded At)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#10B981" />
                        <span><strong>Sheet 2: Violations &amp; Telemetry</strong> (Session ID, Incident Type, Exact Timestamp, Notes)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#10B981" />
                        <span><strong>Compliance:</strong> Faculty privacy PII masking enabled automatically</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <a
                      id="download-excel-btn"
                      href={getExcelReportUrl(selectedExamId)}
                      download
                      onClick={() => showToast('⬇️ Dispatching Official Excel Ledger (.xlsx)...')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        padding: '12px 20px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>⬇️</span>
                      <span>Download Excel Workbook (.xlsx)</span>
                    </a>
                  </div>
                </div>

                {/* 2. Executive PDF Dossier */}
                <div
                  className="card animate-slide-up"
                  style={{
                    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(6, 12, 30, 0.92))',
                    border: '1.5px solid rgba(2, 132, 199, 0.35)',
                    borderRadius: 16,
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <IconFileText size={32} color="#0284c7" />
                      <span
                        style={{
                          background: 'rgba(2, 132, 199, 0.15)',
                          border: '1px solid rgba(2, 132, 199, 0.4)',
                          color: '#38BDF8',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 20,
                          textTransform: 'uppercase',
                        }}
                      >
                        Archival Dossier (.pdf)
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px' }}>
                      Certified PDF Grade Sheet
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 16px' }}>
                      Formal printable document formatted for departmental records, board evaluations, and candidate certification with official LogicWhile seals.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#0284c7" />
                        <span><strong>Official Seal &amp; Header:</strong> LogicWhile LiRE certified banner</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#0284c7" />
                        <span><strong>Ranked Merit Roster:</strong> Individual student scores, accuracy, and honors</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#0284c7" />
                        <span><strong>Sign-off Section:</strong> Dedicated Inspector &amp; Chief Examiner signatures</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <a
                      id="download-pdf-btn"
                      href={getPdfReportUrl(selectedExamId)}
                      download
                      onClick={() => showToast('⬇️ Compiling Certified PDF Grade Dossier...')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        padding: '12px 20px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(2, 132, 199, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>⬇️</span>
                      <span>Download Certified PDF Dossier</span>
                    </a>
                  </div>
                </div>

                {/* 3. Live Synchronous Leaderboard */}
                <div
                  className="card animate-slide-up"
                  style={{
                    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(6, 12, 30, 0.92))',
                    border: '1.5px solid rgba(234, 168, 18, 0.35)',
                    borderRadius: 16,
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <IconTrophy size={32} color="#EAA812" />
                      <span
                        style={{
                          background: 'rgba(234, 168, 18, 0.15)',
                          border: '1px solid rgba(234, 168, 18, 0.4)',
                          color: '#EAA812',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 20,
                          textTransform: 'uppercase',
                        }}
                      >
                        Real-Time Telemetry
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px' }}>
                      Synchronous Live Leaderboard
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 16px' }}>
                      Interactive, real-time board powered by live websocket channels. Designed for campus projection, faculty invigilation boards, or candidate view.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#EAA812" />
                        <span><strong>Zero Latency:</strong> Real-time rank animations on each submission</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#EAA812" />
                        <span><strong>Projection Mode:</strong> High-contrast stage view for auditoriums</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1' }}>
                        <IconCheck size={14} color="#EAA812" />
                        <span><strong>Direct Sharing:</strong> Public URL accessible without admin credentials</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      id="open-leaderboard-btn"
                      onClick={() => window.open(`/leaderboard/${selectedExamId}`, '_blank')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: 'linear-gradient(135deg, #EAA812 0%, #D97706 100%)',
                        color: '#002147',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(234, 168, 18, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <IconShare size={14} />
                      <span>Launch Board</span>
                    </button>
                    <button
                      onClick={() => handleCopyLink(`${window.location.origin}/leaderboard/${selectedExamId}`, 'Leaderboard')}
                      title="Copy Public Leaderboard Link"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#F8FAFC',
                        borderRadius: 10,
                        padding: '12px 16px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                      }}
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Assistance & Protocol Bar */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <IconShield size={24} color="#38BDF8" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.02em' }}>
                    Institutional Compliance &amp; Audit Trail Guarantee
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 3, lineHeight: 1.5 }}>
                    All exported results and proctoring telemetry are cryptographically indexed under the Super Admin authoritative ledger. Excel and PDF files maintain unalterable graded timestamps, preventing retroactive grade tampering and guaranteeing full NIRF/AICTE examination accreditation integrity.
                  </div>
                </div>
              </div>
            </>
          )}

          {!selectedExam && !loading && (
            <div className="card text-center" style={{ padding: 60, maxWidth: 540, margin: '40px auto' }}>
              <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', marginBottom: 16 }}><IconAnalytics size={40} color="#38BDF8" /></div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 8, color: '#FFF' }}>
                Select an Assessment to Begin
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                Choose an examination from the top selector to access certified multi-sheet Excel records, high-resolution PDF dossiers, and synchronous live leaderboard feeds.
              </p>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
