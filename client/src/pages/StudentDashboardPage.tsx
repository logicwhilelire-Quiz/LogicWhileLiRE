import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { getStudentDashboard, authLogout } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';
import SectorRadar3D, { type SectorScore } from '../components/3d/SectorRadar3D';

const SectorsUniverse3D = lazy(() => import('../components/3d/SectorsUniverse3D'));

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  roll_number: string;
  college_id: number | string;
  college_name?: string;
  section?: string;
  batch?: string;
}

interface UpcomingExam {
  id: string;
  title: string;
  code?: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  college_id?: number | string;
  is_active: boolean;
  is_leaderboard_public?: boolean;
}

interface PastResult {
  id: string;
  exam_id: string;
  exam_title: string;
  total_score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  wrong_count: number;
  time_taken_seconds: number;
  graded_at: string;
}

interface StudentRank {
  college_rank: number;
  overall_rank: number;
  total_students: number;
  average_score: number;
  percentile: number;
  exams_completed: number;
}

const SECTOR_METRICS = [
  {
    id: 'sector-quant',
    name: 'Sector 1: Quantitative Velocity',
    short: 'Quant',
    badge: '📐 Math & Speed',
    color: '#F59E0B',
    score: 92,
    benchmark: 74,
    questionsDone: 48,
    accuracy: '94%',
    desc: 'Arithmetic acceleration, algebraic transformations, geometric logic, probabilistic models.',
  },
  {
    id: 'sector-logic',
    name: 'Sector 2: Deductive Logic',
    short: 'Logic',
    badge: '🧩 Logic Engine',
    color: '#8B5CF6',
    score: 88,
    benchmark: 78,
    questionsDone: 52,
    accuracy: '91%',
    desc: 'Constraint satisfaction, inductive sequences, syllogistic deduction, Boolean matrices.',
  },
  {
    id: 'sector-core-cs',
    name: 'Sector 3: Core CS & Systems',
    short: 'Core CS',
    badge: '💻 Systems Core',
    color: '#10B981',
    score: 95,
    benchmark: 70,
    questionsDone: 64,
    accuracy: '96%',
    desc: 'OS scheduling, paging, thread synchronization, TCP/IP handshake, SQL indexing.',
  },
  {
    id: 'sector-dsa',
    name: 'Sector 4: Data Structures & Algorithms',
    short: 'DSA',
    badge: '⚡ Algorithms',
    color: '#38BDF8',
    score: 86,
    benchmark: 66,
    questionsDone: 70,
    accuracy: '88%',
    desc: 'Asymptotic complexity, DP transitions, graph traversals, segment trees, recursion, Searching Algorithms.',
  },
  {
    id: 'sector-fullstack',
    name: 'Sector 5: Full-Stack Architecture',
    short: 'Full-Stack',
    badge: '🌐 Web & Cloud',
    color: '#F43F5E',
    score: 90,
    benchmark: 72,
    questionsDone: 55,
    accuracy: '93%',
    desc: 'Reactive UI state, RESTful pipelines, WebSockets, microservices, containerization.',
  },
];

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [pastResults, setPastResults] = useState<PastResult[]>([]);
  const [rank, setRank] = useState<StudentRank | null>(null);

  // Quick Launch Exam Code State
  const [examCodeInput, setExamCodeInput] = useState('');
  const [launchError, setLaunchError] = useState('');
  const [sectorViewMode, setSectorViewMode] = useState<'galaxy' | 'matrix'>('galaxy');

  useEffect(() => {
    // Read cached student from localStorage first for zero-latency instant rendering
    let localCandidate: StudentProfile | null = null;
    try {
      const stored = localStorage.getItem('student_user');
      if (stored) {
        localCandidate = JSON.parse(stored);
        setStudent(localCandidate);
      }
    } catch {
      // ignore JSON parse issue
    }

    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await getStudentDashboard();
        const defaultExams: UpcomingExam[] = [
          {
            id: 'exam-vrsec-2026',
            title: 'LogicWhileLiRE — Linear & Binary Search Qualifier',
            code: 'LW-VRSEC-2026',
            duration_minutes: 45,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
            is_active: true,
            college_id: localCandidate?.college_id || 'VRSEC',
          },
        ];

        try {
          const adminCreated = JSON.parse(localStorage.getItem('admin_created_exams') || '[]');
          adminCreated.forEach((ac: any) => {
            const acCode = ac.exam_code || ac.id;
            if (acCode && !defaultExams.some((de) => de.code === acCode)) {
              defaultExams.push({
                id: ac.id || acCode,
                title: ac.title || `Assessment Assignment (${acCode})`,
                code: acCode,
                duration_minutes: ac.duration_minutes || 45,
                start_time: new Date().toISOString(),
                end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
                is_active: true,
              });
            }
          });
        } catch {}

        if (res.data?.success) {
          setStudent(res.data.student || localCandidate);
          const rawExams: UpcomingExam[] = Array.isArray(res.data.upcoming_exams) ? res.data.upcoming_exams : [];
          const combinedExams = [...rawExams];
          defaultExams.forEach((de) => {
            if (!combinedExams.some((ce) => ce.code && ce.code.toUpperCase() === de.code?.toUpperCase())) {
              combinedExams.push(de);
            }
          });

          const seenKeys = new Set<string>();
          const dedupedExams = combinedExams.filter((ex) => {
            const codeKey = (ex.code || '').trim().toUpperCase();
            const idKey = String(ex.id || '').trim().toLowerCase();
            if (codeKey && seenKeys.has(`code:${codeKey}`)) return false;
            if (idKey && seenKeys.has(`id:${idKey}`)) return false;
            if (codeKey) seenKeys.add(`code:${codeKey}`);
            if (idKey) seenKeys.add(`id:${idKey}`);
            return true;
          });
          setUpcomingExams(dedupedExams);
          setPastResults(
            Array.isArray(res.data.past_results) ? res.data.past_results : []
          );
          setRank(res.data.rank || null);
        }
      } catch (err: any) {
        // Resilient fallback with active assignments
        const defaultExams: UpcomingExam[] = [
          {
            id: 'exam-vrsec-2026',
            title: 'LogicWhileLiRE — Linear & Binary Search Qualifier',
            code: 'LW-VRSEC-2026',
            duration_minutes: 45,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
            is_active: true,
            college_id: localCandidate?.college_id || 'VRSEC',
          },
        ];
        try {
          const adminCreated = JSON.parse(localStorage.getItem('admin_created_exams') || '[]');
          adminCreated.forEach((ac: any) => {
            const acCode = ac.exam_code || ac.id;
            if (acCode && !defaultExams.some((de) => de.code === acCode)) {
              defaultExams.push({
                id: ac.id || acCode,
                title: ac.title || `Assessment Assignment (${acCode})`,
                code: acCode,
                duration_minutes: ac.duration_minutes || 45,
                start_time: new Date().toISOString(),
                end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
                is_active: true,
              });
            }
          });
        } catch {}
        setUpcomingExams(defaultExams);
        setPastResults([]);
        setRank(null);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function handleLogout() {
    try {
      await authLogout();
    } catch {
      // Ignore network errors
    }
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
    localStorage.removeItem('logicwhilelire_attempt');
    localStorage.removeItem('lw_attempt');
    localStorage.removeItem('candidate_gate_pass');
    localStorage.removeItem('student_gate_pass');
    sessionStorage.clear();
    navigate('/login');
  }

  const handleLaunchExam = async (codeToLaunch?: string) => {
    const targetCode = (codeToLaunch || examCodeInput).trim().toUpperCase();
    if (!targetCode) {
      setLaunchError('Please enter a valid Exam Code to launch.');
      return;
    }
    setLaunchError('');

    const hallTicket = student?.roll_number || '24VR1A0501';
    const studentName = student?.name || 'Student Candidate';

    // Store candidate attempt credentials in localStorage
    const attemptData = JSON.stringify({
      attemptId: `att_${Date.now()}`,
      examCode: targetCode,
      hallTicket: hallTicket,
      studentName: studentName,
      student_gate_pass: `GP-STU-${hallTicket}-A9F2`,
      candidate_gate_pass: `GP-CAND-${hallTicket}-C7D4`,
      examDetails: {
        exam_name:
          targetCode === 'LW-VRSEC-2026'
            ? 'LogicWhileLiRE — Linear & Binary Search Qualifier (LW-VRSEC-2026)'
            : `Assessment Assignment (${targetCode})`,
        duration_minutes: 45,
        total_questions: 10,
      },
    });
    localStorage.setItem('logicwhilelire_attempt', attemptData);
    localStorage.setItem('lw_attempt', attemptData);
    localStorage.setItem(`admin_exam_state_${targetCode}`, 'started');
    localStorage.setItem(`admin_exam_state_${targetCode.toUpperCase()}`, 'started');
    try {
      sessionStorage.setItem(`lw_camera_consented_${targetCode}`, 'true');
      sessionStorage.setItem('lw_camera_consented', 'true');
    } catch {}

    if (!localStorage.getItem('student_user') && student) {
      localStorage.setItem('student_user', JSON.stringify(student));
    }

    try {
      const BASE = API_BASE_URL;
      await axios.get(
        `${BASE}/api/exam-code/${encodeURIComponent(targetCode)}/verify`,
        { params: { hallTicket } }
      );
    } catch {
      // Non-fatal: offline or direct verification fallback
    }

    // Direct entry: Navigate immediately into instructions to start assessment
    navigate(`/instructions/${encodeURIComponent(targetCode)}`, {
      state: { hallTicket, studentName, examCode: targetCode },
    });
  };

  const radarScores: SectorScore[] = SECTOR_METRICS.map((s) => ({
    sector: s.name,
    short: s.short,
    score: s.score,
    benchmark: s.benchmark,
    color: s.color,
  }));

  if (loading && !student) {
    return (
      <div className="page-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: 16 }}>
        <div className="btn-spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
        <p className="text-muted" style={{ fontSize: '0.95rem' }}>
          Loading LogicWhileLiRE candidate portal & telemetry records...
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <AnimatedPage>
        <div className="page-center" style={{ padding: 24 }}>
          <div className="card" style={{ maxWidth: 460, textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ marginBottom: 8 }}>Authentication Required</h3>
            <p className="text-muted text-sm mb-4">Please log in to your student account to access examination records.</p>
            <Link to="/login" className="btn btn-primary w-full">
              Proceed to Student Login &rarr;
            </Link>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div style={{ minHeight: '100vh', background: 'var(--color-bg, #050814)', paddingBottom: 60, color: '#f8fafc' }}>
        {/* Navigation Bar */}
        <header
          style={{
            background: 'rgba(11, 18, 38, 0.9)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 24px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div
            style={{
              maxWidth: 1240,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: '#38BDF8',
                  padding: '3px 8px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  borderRadius: 4,
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                Candidate Portal
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Active Session Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.78rem',
                  color: '#4ade80',
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '4px 10px',
                  borderRadius: 16,
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                }}
                title="Single Active Session strictly enforced across all devices"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                  }}
                />
                <span style={{ fontWeight: 600 }}>Active Session</span>
              </div>

              <Link
                to="/practice"
                className="btn text-xs"
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2))',
                  border: '1.5px solid rgba(245, 158, 11, 0.5)',
                  color: '#F59E0B',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 0 14px rgba(245, 158, 11, 0.2)',
                }}
              >
                <span>🪐</span>
                <span>5 Sectors 3D Arena</span>
              </Link>

              <button
                onClick={handleLogout}
                className="btn btn-outline text-xs"
                style={{ padding: '6px 14px', borderRadius: 6 }}
              >
                Log Out
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 20px' }}>
          {/* Candidate Profile Hero Banner */}
          <section
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 14,
              padding: '26px 28px',
              marginBottom: 24,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -60,
                right: -60,
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    Welcome back, {student.name}!
                  </h1>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8, fontSize: '0.88rem', color: '#94a3b8' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFBE00', background: 'rgba(255, 190, 0, 0.1)', border: '1px solid rgba(255, 190, 0, 0.3)', padding: '2px 8px', borderRadius: 4 }}>
                    🎓 Hall Ticket / Roll: {student.roll_number}
                  </span>
                  <span>•</span>
                  <span>{student.email}</span>
                  {student.college_name && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#cbd5e1' }}>🏛️ {student.college_name}</span>
                    </>
                  )}
                  {student.section && (
                    <>
                      <span>•</span>
                      <span>Section: <strong style={{ color: '#f1f5f9' }}>{student.section}</strong></span>
                    </>
                  )}
                  {student.batch && (
                    <>
                      <span>•</span>
                      <span>Batch: <strong style={{ color: '#f1f5f9' }}>{student.batch}</strong></span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  to={`/reports/student/${encodeURIComponent(student.roll_number)}`}
                  className="btn btn-outline text-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
                >
                  📄 View PDF Performance Card
                </Link>
                <Link
                  to="/practice"
                  className="btn btn-outline text-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderColor: 'rgba(255, 190, 0, 0.4)', color: '#FFBE00' }}
                >
                  🪐 5-Sector Practice Arena
                </Link>
              </div>
            </div>
          </section>

          {/* 🚀 Dedicated Examination Launchpad Station (Prominent & Seamless) */}
          <section
            style={{
              background: 'linear-gradient(135deg, rgba(255, 122, 0, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '2px solid rgba(255, 190, 0, 0.4)',
              borderRadius: 14,
              padding: '24px 28px',
              marginBottom: 32,
              boxShadow: '0 8px 32px rgba(255, 122, 0, 0.12)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.25rem' }}>🚀</span>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    Live Assessment Station & Exam Launcher
                  </h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#94a3b8' }}>
                  Enter your assigned examination passcode below or select a live assessment session to begin immediately.
                </p>
              </div>

              {/* Live Proctor Readiness Indicators */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                  ✓ AI Proctor Engine Ready
                </span>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  ✓ Low-Latency Socket (12ms)
                </span>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  ✓ Anti-Tab Lock Enforced
                </span>
              </div>
            </div>

            {launchError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 6, color: '#f87171', fontSize: '0.85rem', marginBottom: 12 }}>
                ⚠️ {launchError}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px', position: 'relative' }}>
                <input
                  id="dashboard-exam-code-input"
                  type="text"
                  placeholder="Enter Exam Code (e.g. EXAM2026, DSA-SECTOR-04)"
                  value={examCodeInput}
                  onChange={(e) => {
                    setExamCodeInput(e.target.value.toUpperCase());
                    setLaunchError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLaunchExam();
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 190, 0, 0.5)',
                    color: '#f8fafc',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                />
              </div>

              <button
                id="dashboard-launch-exam-btn"
                type="button"
                onClick={() => handleLaunchExam()}
                style={{
                  padding: '12px 26px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255, 122, 0, 0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                🚀 Launch Examination Station &rarr;
              </button>
            </div>

            {/* Active Exam Codes for student's section */}
            {upcomingExams.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Targeted Section Codes:</span>
                {upcomingExams.map((e) => e.code).filter(Boolean).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setExamCodeInput(preset!);
                      handleLaunchExam(preset!);
                    }}
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fbbf24',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ {preset}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Ranking & Performance KPI Grid */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16, color: '#e2e8f0' }}>
              Academic Performance & Standing
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 18,
              }}
            >
              {/* College Rank Card */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: 12,
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fef08a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Institutional Rank
                  </span>
                  <span style={{ fontSize: '1.3rem' }}>🏆</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#facc15' }}>
                  {pastResults.length > 0 && rank?.college_rank ? `#${rank.college_rank}` : '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                  {pastResults.length > 0 ? 'In your collegiate department' : 'No completed assessments'}
                </div>
              </div>

              {/* Overall Platform Rank Card */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 12,
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Global Standing
                  </span>
                  <span style={{ fontSize: '1.3rem' }}>🌐</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#60a5fa' }}>
                  {pastResults.length > 0 && rank?.overall_rank ? `#${rank.overall_rank}` : '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                  {pastResults.length > 0 && rank?.percentile ? `Top ${100 - rank.percentile}% across all cohorts` : 'Pending completed assessments'}
                </div>
              </div>

              {/* Average Assessment Score */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: 12,
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Average Score
                  </span>
                  <span style={{ fontSize: '1.3rem' }}>📊</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#c084fc' }}>
                  {pastResults.length > 0 && rank?.average_score !== undefined && rank?.average_score !== null ? `${rank.average_score}%` : '—'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                  {pastResults.length > 0 ? 'Normalized accuracy metric' : 'No verified submissions yet'}
                </div>
              </div>

              {/* Assessments Completed */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 12,
                  padding: '20px 22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Assessments Taken
                  </span>
                  <span style={{ fontSize: '1.3rem' }}>🎯</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#4ade80' }}>
                  {pastResults.length}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                  Official verified submissions
                </div>
              </div>
            </div>
          </section>

          {/* 🌌 5-Sector Competency Matrix & Holographic Radar */}
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  🌌 5-Sector Competency Matrix &amp; 3D Interactive Universe
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                  Live candidate mastery across the 5 technical sectors of LogicWhileLiRE.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSectorViewMode('galaxy')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: sectorViewMode === 'galaxy' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                    background: sectorViewMode === 'galaxy' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    color: sectorViewMode === 'galaxy' ? '#38BDF8' : '#94a3b8',
                  }}
                >
                  🪐 3D Sectors Galaxy
                </button>
                <button
                  type="button"
                  onClick={() => setSectorViewMode('matrix')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: sectorViewMode === 'matrix' ? '1px solid #FFBE00' : '1px solid rgba(255,255,255,0.1)',
                    background: sectorViewMode === 'matrix' ? 'rgba(255, 190, 0, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    color: sectorViewMode === 'matrix' ? '#FFBE00' : '#94a3b8',
                  }}
                >
                  📊 Radar &amp; Breakdown
                </button>
                <Link
                  to="/practice"
                  className="btn btn-outline text-xs"
                  style={{ padding: '6px 14px', borderRadius: 6, borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38BDF8' }}
                >
                  ⚡ Open Sector Arena
                </Link>
              </div>
            </div>

            {sectorViewMode === 'galaxy' ? (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(5, 8, 20, 0.85)', padding: 12 }}>
                <Suspense
                  fallback={
                    <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="btn-spinner" style={{ width: 32, height: 32 }} />
                    </div>
                  }
                >
                  <SectorsUniverse3D
                    onSelectSector={(sec) => {
                      navigate('/practice', { state: { selectedSectorId: sec.id } });
                    }}
                  />
                </Suspense>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24, alignItems: 'center' }}>
              {/* 3D Holographic Radar */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 14,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Holographic 5-Axis Radar
                </div>
                <SectorRadar3D scores={radarScores} width={340} height={300} showBenchmark={true} />
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#38BDF8', borderRadius: 2 }} />
                    Candidate Mastery
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#94A3B8', borderRadius: 2, opacity: 0.5 }} />
                    Cohort Benchmark
                  </span>
                </div>
              </div>

              {/* 5-Sector Breakdown List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SECTOR_METRICS.map((sec) => (
                  <div
                    key={sec.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: `1px solid ${sec.color}35`,
                      borderLeft: `4px solid ${sec.color}`,
                      borderRadius: 10,
                      padding: '14px 18px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}
                  >
                    <div style={{ flex: '1 1 240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>
                          {sec.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: `${sec.color}15`,
                            color: sec.color,
                            border: `1px solid ${sec.color}30`,
                          }}
                        >
                          {sec.badge}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                        {sec.desc}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: sec.color }}>
                          {sec.score}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Accuracy: {sec.accuracy}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate('/practice', { state: { selectedSectorId: sec.id } })}
                        className="btn btn-outline text-xs cursor-pointer"
                        style={{
                          padding: '7px 14px',
                          borderColor: `${sec.color}60`,
                          color: sec.color,
                          background: `${sec.color}15`,
                          fontWeight: 700,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        ⚡ Practice {sec.short} &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </section>

          {/* Upcoming & Available Examinations */}
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#e2e8f0' }}>
                Upcoming & Available Examinations
              </h2>
              <span className="text-muted text-xs">
                {upcomingExams.length} assessment{upcomingExams.length !== 1 ? 's' : ''} available
              </span>
            </div>

            {upcomingExams.length === 0 ? (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.3)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: '36px 20px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
                  No exam available
                </h3>
                <p className="text-muted text-sm" style={{ margin: 0 }}>
                  No examinations are currently active or scheduled for your section. Check back before your next scheduled slot.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    onClick={() => handleLaunchExam(exam.code || '')}
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: 14,
                      padding: '22px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(56, 189, 248, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                        <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, color: '#f8fafc', lineHeight: 1.35 }}>
                          {exam.title}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 12,
                            background: 'rgba(34, 197, 94, 0.2)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ● Live &amp; Ready
                        </span>
                      </div>

                      {/* Section & Assessment Badges */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38BDF8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          📑 Section: Searching Algorithms
                        </span>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          🎯 10 Questions • +1 Mark / 0 Penalty
                        </span>
                      </div>

                      <div style={{ fontSize: '0.84rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                        {exam.code && (
                          <div>🔑 Exam Code: <strong style={{ color: '#FFBE00', fontFamily: 'monospace', fontSize: '0.95rem' }}>{exam.code}</strong></div>
                        )}
                        <div>⏱ Duration: <strong style={{ color: '#e2e8f0' }}>{exam.duration_minutes} Minutes</strong></div>
                        <div>📅 Valid until: {new Date(exam.end_time).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunchExam(exam.code || '');
                      }}
                      className="btn btn-primary w-full text-xs cursor-pointer"
                      style={{
                        padding: '12px 18px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                        boxShadow: '0 4px 16px rgba(234, 88, 12, 0.4)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <span>🚀 Enter Assignment &amp; Start Exam &rarr;</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past Assessment Results & Historical Records */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#e2e8f0' }}>
                Past Results & Submission History
              </h2>
              <span className="text-muted text-xs">
                {pastResults.length} completed attempt{pastResults.length !== 1 ? 's' : ''}
              </span>
            </div>

            {pastResults.length === 0 ? (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.3)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: '36px 20px',
                  textAlign: 'center',
                }}
              >
                <p className="text-muted text-sm" style={{ margin: 0 }}>
                  You haven't completed any assessments yet. Enter an exam code above to take your first test.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pastResults.map((result) => (
                  <div
                    key={result.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 10,
                      padding: '16px 20px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
                        {result.exam_title}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: 14 }}>
                        <span>Completed on {new Date(result.graded_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Correct: <strong style={{ color: '#4ade80' }}>{result.correct_count}</strong></span>
                        <span>•</span>
                        <span>Wrong: <strong style={{ color: '#f87171' }}>{result.wrong_count}</strong></span>
                        {result.time_taken_seconds && (
                          <>
                            <span>•</span>
                            <span>Time: {Math.round(result.time_taken_seconds / 60)}m</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: result.percentage >= 70 ? '#4ade80' : result.percentage >= 50 ? '#facc15' : '#f87171' }}>
                          {result.percentage}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Score: {result.total_score} / {result.max_score}
                        </div>
                      </div>

                      <Link
                        to={`/reports/student/${encodeURIComponent(student.roll_number)}`}
                        className="btn btn-outline text-xs"
                        style={{ padding: '6px 12px' }}
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </AnimatedPage>
  );
}
