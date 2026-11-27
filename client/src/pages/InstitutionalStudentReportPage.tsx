import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { API_BASE_URL } from '../lib/config'
import {
  IconDownload,
  IconPrinter,
  IconCpu,
  IconGraduation,
  IconFlash,
  IconTarget,
  IconTrophy,
  IconClock,
  IconLock,
  IconTerminal,
  IconPulse,
  IconCheck,
} from '../components/icons/HumanIcons'

const SECTORS = [
  { key: 'quant', match: ['quant', 'math', 'numerical', 'velocity'], label: 'Sector 1: Quant', fullName: 'Quantitative Velocity', color: '#FFB400' },
  { key: 'logic', match: ['logic', 'reasoning', 'deductive'], label: 'Sector 2: Logic', fullName: 'Deductive Logic', color: '#8B5CF6' },
  { key: 'core', match: ['core', 'systems', 'os', 'network'], label: 'Sector 3: Core CS', fullName: 'Systems & OS', color: '#10B981' },
  { key: 'dsa', match: ['dsa', 'algorithm', 'structure'], label: 'Sector 4: DSA', fullName: 'Algorithms & Structures', color: '#3B82F6' },
  { key: 'cloud', match: ['cloud', 'fullstack', 'web', 'architecture'], label: 'Sector 5: Cloud', fullName: 'Full-Stack Architecture', color: '#FF7A00' },
]

function sanitizeCsvCell(v: unknown): string {
  const s = String(v ?? '')
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export default function InstitutionalStudentReportPage() {
  const { hallTicket: paramHallTicket } = useParams<{ hallTicket?: string }>()

  const storedUserStr = localStorage.getItem('student_user')
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null
  const targetRoll = (paramHallTicket || storedUser?.hall_ticket || storedUser?.roll_number || '').trim()

  const [reportData, setReportData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'section_analysis' | 'comparison' | 'time_analysis' | 'progress' | 'activity'>('section_analysis')

  useEffect(() => {
    let isMounted = true
    async function loadReport() {
      if (!targetRoll) return
      try {
        const res = await axios.get(`${API_BASE_URL}/api/student/report/${encodeURIComponent(targetRoll)}`)
        if (isMounted && res.data?.success) {
          setReportData(res.data)
        }
      } catch (err) {
        console.warn('Could not fetch student report from server, using local session context:', err)
      }
    }
    loadReport()
    return () => { isMounted = false }
  }, [targetRoll])

  const student = reportData?.student || (storedUser && (storedUser.hall_ticket === targetRoll || storedUser.roll_number === targetRoll) ? storedUser : null)

  const resolvedName = student?.name || (student?.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : null) || targetRoll || 'Candidate'
  const resolvedCollege = student?.collegeName || student?.college_name || 'Institutional Enrollment'
  const resolvedBranch = student?.branch || student?.branch_code || 'General'
  const resolvedSection = student?.section || '—'
  const hasAttempts = Boolean(reportData?.hasAttempts)
  const summary = hasAttempts ? (reportData?.summary || null) : null
  const cohortStats = hasAttempts ? (reportData?.cohortStats || null) : null
  const assessmentHistory: any[] = hasAttempts && Array.isArray(reportData?.assessmentHistory) ? reportData.assessmentHistory : []

  const totalScoreVal = hasAttempts && summary?.totalScore !== undefined && summary?.totalScore !== null ? Number(summary.totalScore) : null
  const maxScoreVal = hasAttempts && summary?.maxScore !== undefined && summary?.maxScore !== null ? Number(summary.maxScore) : null
  const accuracyVal = hasAttempts && summary?.percentage !== undefined && summary?.percentage !== null ? `${summary.percentage}%` : '—'

  const batchAvgDisplay = cohortStats?.batchAverageScore !== null && cohortStats?.batchAverageScore !== undefined ? `${cohortStats.batchAverageScore}` : '—'
  const topScoreDisplay = cohortStats?.topPerformerScore !== null && cohortStats?.topPerformerScore !== undefined ? `${cohortStats.topPerformerScore}` : '—'
  const rankDisplay = hasAttempts
    ? (cohortStats?.sectionRank && cohortStats?.totalInCohort ? `#${cohortStats.sectionRank} / ${cohortStats.totalInCohort}` : 'Recorded')
    : 'Not Ranked'

  const studentMeta = {
    rollNumber: targetRoll || '—',
    studentName: resolvedName,
    college: resolvedCollege,
    branch: resolvedBranch,
    section: resolvedSection,
    testId: hasAttempts ? (summary?.examTitle || summary?.examCode || 'Assessment') : 'Pre-Exam Baseline',
    totMarks: maxScoreVal !== null ? `${maxScoreVal}` : '—',
    studentScore: totalScoreVal !== null ? `${totalScoreVal}` : '—',
    batchAverageScore: batchAvgDisplay,
    accuracy: accuracyVal,
    rankInBatch: rankDisplay,
    topPerformer: topScoreDisplay,
    examsCompleted: summary?.examsCompleted ?? assessmentHistory.length ?? (hasAttempts ? 1 : 0),
    timeTakenMinutes: hasAttempts && summary?.timeTakenSeconds ? Math.round((Number(summary.timeTakenSeconds) / 60) * 10) / 10 : 0,
  }

  const topicStats = hasAttempts ? (reportData?.topicBreakdown || null) : null

  const sectionAnalysisData = SECTORS.map((sec) => {
    let correct = 0
    let incorrect = 0
    let score = 0
    let totQue = 0
    let totMarks = 0

    if (hasAttempts && topicStats) {
      for (const key of Object.keys(topicStats)) {
        const lower = key.toLowerCase()
        if (sec.match.some((tk) => lower.includes(tk))) {
          const t = topicStats[key]
          correct += Number(t?.correct) || 0
          incorrect += Number(t?.wrong) || 0
          score += Math.max(0, Number(t?.score) || 0)
          totQue += (Number(t?.correct) || 0) + (Number(t?.wrong) || 0)
          totMarks += Number(t?.maxScore) || 0
        }
      }
    }

    const scorePct = hasAttempts && totalScoreVal && totalScoreVal > 0 && totQue > 0
      ? `${Math.round((score / totalScoreVal) * 1000) / 10}%`
      : '—'
    const accuracy = hasAttempts && totQue > 0
      ? `${Math.round((correct / totQue) * 100)}%`
      : '—'

    return {
      section: sec.label,
      fullName: sec.fullName,
      totQue,
      totMarks,
      correct,
      incorrect,
      score,
      scorePct,
      accuracy,
      color: sec.color,
    }
  })

  const totalTopicQuestions = sectionAnalysisData.reduce((s, r) => s + r.totQue, 0)
  const totalTopicCorrect = sectionAnalysisData.reduce((s, r) => s + r.correct, 0)
  const totalTopicWrong = sectionAnalysisData.reduce((s, r) => s + r.incorrect, 0)

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const rows = [
      ['Section', 'Total Questions', 'Total Marks', 'Correct', 'Incorrect', 'Score', 'Score %', 'Accuracy %'],
      ...sectionAnalysisData.map((r) => [
        r.section,
        r.totQue,
        r.totMarks,
        r.correct,
        r.incorrect,
        hasAttempts ? r.score : 0,
        r.scorePct,
        r.accuracy,
      ]),
      [
        'Total',
        hasAttempts ? (totalTopicQuestions || (summary?.correctCount ?? 0) + (summary?.wrongCount ?? 0)) : 0,
        hasAttempts ? (maxScoreVal ?? 0) : 0,
        hasAttempts ? (totalTopicCorrect || summary?.correctCount || 0) : 0,
        hasAttempts ? (totalTopicWrong || summary?.wrongCount || 0) : 0,
        hasAttempts ? (totalScoreVal ?? 0) : 0,
        hasAttempts ? studentMeta.accuracy : '—',
        hasAttempts ? studentMeta.accuracy : '—',
      ],
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((row) => row.map(sanitizeCsvCell).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `LogicWhile_LiRE_Report_${studentMeta.rollNumber}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #050B22 0%, #07134B 48%, #04091E 100%)', color: '#E2E8F0', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Candidate Status Notice Banner */}
        {!hasAttempts ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(10, 28, 104, 0.72), rgba(5, 11, 34, 0.92))',
              border: '1.5px solid rgba(255, 180, 0, 0.42)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'inline-flex', padding: 10, borderRadius: 10, background: 'rgba(255, 180, 0, 0.14)', border: '1px solid rgba(255, 180, 0, 0.35)' }}>
                <IconGraduation size={26} color="#FFD000" />
              </div>
              <div>
                <strong style={{ color: '#FFD000', fontSize: '0.96rem' }}>
                  First-Login Baseline Active · {studentMeta.college}
                </strong>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 2 }}>
                  Candidate <strong>{studentMeta.studentName}</strong> ({studentMeta.rollNumber}) is verified in <strong>{studentMeta.branch}{studentMeta.section !== '—' ? ` - Sec ${studentMeta.section}` : ''}</strong> with <strong>0 completed exams</strong>. Scores, batch averages, and sector charts will populate once an assessment is submitted.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                to="/enter-exam"
                style={{
                  background: 'linear-gradient(135deg, #FF7A00 0%, #FFB400 100%)',
                  color: '#07134B',
                  padding: '9px 15px',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconFlash size={14} color="#07134B" />
                <span>Enter Assessment</span>
              </Link>
              <Link
                to="/practice"
                style={{
                  background: 'rgba(255, 180, 0, 0.12)',
                  border: '1px solid rgba(255, 180, 0, 0.38)',
                  color: '#FFD000',
                  padding: '9px 15px',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconTarget size={14} color="#FFD000" />
                <span>Practice Arena</span>
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(7, 19, 75, 0.85))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'inline-flex', padding: 10, borderRadius: 10, background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <IconTrophy size={26} color="#10B981" />
              </div>
              <div>
                <strong style={{ color: '#34D399', fontSize: '0.96rem' }}>
                  Verified Assessment Record · {studentMeta.college}
                </strong>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 2 }}>
                  Official results for <strong>{studentMeta.studentName}</strong> ({studentMeta.rollNumber}) &bull; {studentMeta.examsCompleted} completed assessment{studentMeta.examsCompleted === 1 ? '' : 's'}.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: 5 }}>
              <span style={{ color: '#FF7A00' }}>LogicWhile</span> <span style={{ color: '#64748B' }}>›</span> <span style={{ color: '#FFB400' }}>LiRE Assessment Sub-Branch · Performance Dossier</span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 600, margin: 0, color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>
              Student Analysis Report: {studentMeta.studentName}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
              Roll Number: <strong style={{ color: '#FFB400', fontWeight: 600 }}>{studentMeta.rollNumber}</strong> · Institution: <strong style={{ color: '#F8FAFC', fontWeight: 600 }}>{studentMeta.college} ({studentMeta.branch}{studentMeta.section !== '—' ? ` - Sec ${studentMeta.section}` : ''})</strong> · Status: <strong style={{ color: hasAttempts ? '#10B981' : '#FFB400', fontWeight: 600 }}>{hasAttempts ? 'Assessed' : 'Pre-Exam Baseline (0 Exams)'}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 180, 0, 0.1)',
                border: '1px solid rgba(255, 180, 0, 0.3)',
                color: '#FFB400',
                borderRadius: 8,
                height: 36,
                padding: '0 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <IconDownload size={15} color="#FFB400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              style={{
                background: '#1D4ED8',
                border: '1px solid rgba(96, 165, 250, 0.35)',
                color: '#FFFFFF',
                borderRadius: 8,
                height: 36,
                padding: '0 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <IconPrinter size={15} color="#FFFFFF" />
              <span>Print / PDF Report</span>
            </button>
          </div>
        </div>

        {/* Top Summary KPI Cards — Zero Fake Numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Marks', val: studentMeta.totMarks, sub: hasAttempts ? 'Latest exam max' : 'No exam taken', color: '#E2E8F0' },
            { label: "Student's Score", val: studentMeta.studentScore, sub: hasAttempts ? 'Scored marks' : 'Pending first exam', color: hasAttempts ? '#FFB400' : '#94A3B8' },
            { label: 'Batch Average', val: studentMeta.batchAverageScore, sub: hasAttempts && cohortStats?.batchAverageScore !== null ? 'Cohort mean' : 'Awaiting cohort data', color: hasAttempts && cohortStats?.batchAverageScore !== null ? '#34D399' : '#94A3B8' },
            { label: 'Accuracy', val: studentMeta.accuracy, sub: hasAttempts ? 'Verified accuracy' : 'Not recorded', color: hasAttempts ? '#10B981' : '#94A3B8' },
            { label: 'Cohort Rank', val: studentMeta.rankInBatch, sub: hasAttempts ? 'In active exam' : 'Awaiting submission', color: '#FFB400' },
            { label: hasAttempts ? 'Top Score' : 'Exams Taken', val: hasAttempts ? studentMeta.topPerformer : `${studentMeta.examsCompleted}`, sub: hasAttempts ? 'Cohort highest' : 'Completed attempts', color: '#FB923C' },
          ].map((kpi, idx) => (
            <div
              key={idx}
              style={{
                background: '#081232',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>{kpi.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600, color: kpi.color, marginTop: 4, fontFamily: "'Rajdhani', sans-serif", fontVariantNumeric: 'tabular-nums' }}>{kpi.val}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Report Tab Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid rgba(255, 180, 0, 0.18)', paddingBottom: 12, marginBottom: 24 }}>
          {[
            { id: 'section_analysis', label: '1. Section-Wise Analysis' },
            { id: 'comparison', label: '2. Cohort Comparison' },
            { id: 'time_analysis', label: '3. Time Analysis' },
            { id: 'progress', label: '4. Multi-Assessment Progress' },
            { id: 'activity', label: '5. Practice & Attendance' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '8px 15px',
                borderRadius: 8,
                border: activeTab === t.id ? '1px solid #FFB400' : '1px solid rgba(255,255,255,0.06)',
                background: activeTab === t.id ? 'rgba(255, 180, 0, 0.16)' : 'rgba(8, 18, 50, 0.65)',
                color: activeTab === t.id ? '#FFD000' : '#94A3B8',
                fontWeight: activeTab === t.id ? 800 : 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: SECTION-WISE ANALYSIS */}
        {activeTab === 'section_analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'rgba(10, 28, 104, 0.45)', borderBottom: '1px solid rgba(255, 180, 0, 0.16)', fontWeight: 700, fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span>Section-Wise Breakdown Table</span>
                <span style={{ fontSize: '0.75rem', color: hasAttempts ? '#10B981' : '#FFB400', fontWeight: 700 }}>
                  {hasAttempts ? 'Verified Assessment Breakdown' : 'No Exams Completed (Awaiting First Submission)'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#050B22', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255, 180, 0, 0.14)' }}>
                      <th style={{ padding: '10px 16px' }}>Sections / Metrics</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Questions</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Max Marks</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Correct</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Incorrect</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Score</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Share (%)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionAnalysisData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFF' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8 }} />
                          {row.section}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{row.totQue}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{row.totMarks}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: hasAttempts && row.correct > 0 ? '#10B981' : '#64748B', fontWeight: 700 }}>{row.correct}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: hasAttempts && row.incorrect > 0 ? '#EF4444' : '#64748B' }}>{row.incorrect}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: hasAttempts && row.totQue > 0 ? '#FFD000' : '#64748B' }}>{hasAttempts ? row.score : '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#E2E8F0' }}>{row.scorePct}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: hasAttempts && row.totQue > 0 ? '#10B981' : '#64748B' }}>
                          {row.accuracy}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(255, 180, 0, 0.08)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 16px', color: '#FFD000' }}>Total Aggregate</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {hasAttempts ? (totalTopicQuestions || (summary?.correctCount ?? 0) + (summary?.wrongCount ?? 0)) : 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{hasAttempts ? (maxScoreVal ?? 0) : 0}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: hasAttempts ? '#10B981' : '#64748B' }}>
                        {hasAttempts ? (totalTopicCorrect || summary?.correctCount || 0) : 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: hasAttempts ? '#EF4444' : '#64748B' }}>
                        {hasAttempts ? (totalTopicWrong || summary?.wrongCount || 0) : 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#FFD000', fontSize: '0.94rem' }}>
                        {hasAttempts ? studentMeta.studentScore : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{hasAttempts ? studentMeta.accuracy : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: hasAttempts ? '#10B981' : '#64748B' }}>
                        {studentMeta.accuracy}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Chart A: Score Distribution */}
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 12, padding: 20 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: '#FFF' }}>
                  Score Distribution by Sector
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Proportion of verified points earned across the 5 technical sectors.
                </p>

                {hasAttempts && totalScoreVal && totalScoreVal > 0 && sectionAnalysisData.some((d) => d.score > 0) ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '10px 0', flexWrap: 'wrap' }}>
                    <svg width="160" height="160" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      {(() => {
                        const C = 157.08
                        const sumSec = sectionAnalysisData.reduce((s, r) => s + r.score, 0) || 1
                        let currentOffset = 0
                        return sectionAnalysisData.map((s, idx) => {
                          const len = (s.score / sumSec) * C
                          const offset = currentOffset
                          currentOffset += len
                          if (len <= 0) return null
                          return (
                            <circle
                              key={idx}
                              r="25"
                              cx="50"
                              cy="50"
                              fill="transparent"
                              stroke={s.color}
                              strokeWidth="50"
                              strokeDasharray={`${len.toFixed(1)} ${C.toFixed(1)}`}
                              strokeDashoffset={(-offset).toFixed(1)}
                            />
                          )
                        })
                      })()}
                    </svg>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.74rem' }}>
                      {sectionAnalysisData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                          <span style={{ color: '#CBD5E1' }}>{d.section}:</span>
                          <strong style={{ color: '#FFF' }}>{d.scorePct}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', textAlign: 'center' }}>
                    <div style={{ width: 96, height: 96, borderRadius: '50%', border: '2px dashed rgba(255, 180, 0, 0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 12, background: 'rgba(255, 180, 0, 0.05)' }}>
                      <IconTarget size={26} color="#FFD000" />
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, marginTop: 4 }}>No Score Yet</span>
                    </div>
                    <strong style={{ color: '#F8FAFC', fontSize: '0.88rem' }}>Awaiting First Assessment</strong>
                    <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#94A3B8', maxWidth: 300, lineHeight: 1.45 }}>
                      Sector distribution will populate dynamically once the candidate completes a proctored exam.
                    </p>
                  </div>
                )}
              </div>

              {/* Chart B: Accuracy Comparison */}
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 12, padding: 20 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: '#FFF' }}>
                  Accuracy Across Sectors
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Verified accuracy percentage per technical sector.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sectionAnalysisData.map((d, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                        <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{d.section}</span>
                        <span style={{ color: hasAttempts && d.totQue > 0 ? '#10B981' : '#64748B', fontWeight: 700 }}>
                          {d.accuracy}
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: hasAttempts && d.accuracy.endsWith('%') ? d.accuracy : '0%',
                            background: d.color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COHORT COMPARISON */}
        {activeTab === 'comparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {hasAttempts ? (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(10, 28, 104, 0.45)', borderBottom: '1px solid rgba(255, 180, 0, 0.16)', fontWeight: 700, fontSize: '0.88rem' }}>
                  Cohort Standing: Candidate vs. Batch Average vs. Top Score ({cohortStats?.examCode || studentMeta.testId})
                </div>
                <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div style={{ background: '#050B22', borderRadius: 10, padding: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase' }}>Candidate Score</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFF', marginTop: 4 }}>{studentMeta.studentScore} / {studentMeta.totMarks}</div>
                  </div>
                  <div style={{ background: '#050B22', borderRadius: 10, padding: 16, border: '1px solid rgba(16,185,129,0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#6EE7B7', fontWeight: 700, textTransform: 'uppercase' }}>Batch Average</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10B981', marginTop: 4 }}>{studentMeta.batchAverageScore}</div>
                  </div>
                  <div style={{ background: '#050B22', borderRadius: 10, padding: 16, border: '1px solid rgba(255,180,0,0.35)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#FFD000', fontWeight: 700, textTransform: 'uppercase' }}>Top Score</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFD000', marginTop: 4 }}>{studentMeta.topPerformer}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <IconTrophy size={34} color="#FFB400" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFF', margin: '12px 0 6px' }}>
                  No Cohort Comparison Data Yet
                </h3>
                <p style={{ margin: '0 auto', maxWidth: 460, fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.55 }}>
                  Batch averages, top performer benchmarks, and percentile standing will populate strictly from real exam submissions once {studentMeta.studentName} completes an assessment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIME ANALYSIS */}
        {activeTab === 'time_analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {hasAttempts ? (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFF', marginBottom: 14 }}>
                  Recorded Exam Time Utilization
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ background: '#050B22', borderRadius: 10, padding: 16, border: '1px solid rgba(255, 122, 0, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#FDBA74', fontWeight: 700, textTransform: 'uppercase' }}>Time Taken</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FF7A00', marginTop: 4 }}>{studentMeta.timeTakenMinutes} min</div>
                  </div>
                  <div style={{ background: '#050B22', borderRadius: 10, padding: 16, border: '1px solid rgba(255, 180, 0, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#FFD000', fontWeight: 700, textTransform: 'uppercase' }}>Latest Exam</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFF', marginTop: 6 }}>{studentMeta.testId}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <IconClock size={34} color="#FF7A00" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFF', margin: '12px 0 6px' }}>
                  No Time Telemetry Recorded
                </h3>
                <p style={{ margin: '0 auto', maxWidth: 460, fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.55 }}>
                  Server-authoritative completion duration and pacing metrics will be recorded automatically when the candidate completes their first live assessment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MULTI-ASSESSMENT PROGRESS */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {hasAttempts && assessmentHistory.length > 0 ? (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: 'rgba(10, 28, 104, 0.45)', borderBottom: '1px solid rgba(255, 180, 0, 0.16)', fontWeight: 700, fontSize: '0.88rem' }}>
                  Verified Assessment History ({assessmentHistory.length})
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#050B22', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255, 180, 0, 0.14)' }}>
                        <th style={{ padding: '10px 16px' }}>#</th>
                        <th style={{ padding: '10px 16px' }}>Exam Code</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center' }}>Score</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center' }}>Max Marks</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentHistory.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{item.index}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFD000', fontFamily: 'monospace' }}>{item.examCode}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#FFF' }}>{item.totalScore}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{item.maxScore}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.2)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: 14, borderRadius: 14, background: 'rgba(255, 180, 0, 0.12)', border: '1px solid rgba(255, 180, 0, 0.3)', marginBottom: 14 }}>
                  <IconPulse size={36} color="#FFD000" />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 8px 0', color: '#FFF' }}>
                  Milestone 0: Enrolled Candidate Baseline
                </h3>
                <p style={{ margin: '0 auto 20px', fontSize: '0.84rem', color: '#94A3B8', maxWidth: 480, lineHeight: 1.5 }}>
                  Multi-assessment progress requires at least 1 completed exam submission. Once {studentMeta.studentName} submits their first exam, verified scores will appear here automatically.
                </p>
                <div style={{ display: 'inline-flex', gap: 16, background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: 8, fontSize: '0.78rem', color: '#CBD5E1', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconCheck size={13} color="#10B981" />
                    <span>1. Directory Enrollment (Done)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#FFB400' }}>
                    <IconClock size={13} color="#FFB400" />
                    <span>2. First Assessment (Pending)</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748B' }}>
                    <IconLock size={13} color="#64748B" />
                    <span>3. Multi-Exam Trend</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PRACTICE ACTIVITY & ATTENDANCE */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Enrollment Status</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>Active &amp; Verified</div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>{studentMeta.college}</div>
              </div>
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Proctored Exams Taken</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFD000', marginTop: 4 }}>
                  {studentMeta.examsCompleted} Assessment{studentMeta.examsCompleted === 1 ? '' : 's'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
                  {hasAttempts ? 'Official score recorded' : 'Awaiting first exam'}
                </div>
              </div>
              <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Cohort Placement</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FF7A00', marginTop: 4 }}>
                  {studentMeta.branch}{studentMeta.section !== '—' ? ` · Sec ${studentMeta.section}` : ''}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>Registered directory cohort</div>
              </div>
            </div>

            <div style={{ background: 'rgba(8, 18, 50, 0.85)', border: '1px solid rgba(255, 180, 0, 0.18)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconTerminal size={16} color="#FFD000" />
                <span>Practice arena sprints and scheduled exam records update automatically from candidate submissions.</span>
              </p>
            </div>
          </div>
        )}

        {/* Diagnostic Insights */}
        <div
          style={{
            marginTop: 28,
            background: 'linear-gradient(135deg, rgba(10, 28, 104, 0.6), rgba(5, 11, 34, 0.88))',
            border: '1px solid rgba(255, 180, 0, 0.35)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <IconCpu size={20} color="#FFD000" />
            <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#FFD000' }}>
              LogicWhile › LiRE Assessment Intelligence &bull; {hasAttempts ? 'Official Diagnostic Evaluation' : 'Pre-Exam Enrollment Status'}
            </h4>
          </div>
          {hasAttempts ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.55 }}>
              <strong>Verified Performance:</strong> Candidate completed <strong>{studentMeta.testId}</strong> with score <strong>{studentMeta.studentScore} / {studentMeta.totMarks}</strong> ({studentMeta.accuracy} accuracy).
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.55 }}>
              <strong>Enrollment Status:</strong> Candidate <strong>{studentMeta.studentName}</strong> (Roll No: <strong style={{ color: '#FFD000' }}>{studentMeta.rollNumber}</strong>) is verified in <strong>{studentMeta.college}</strong>.<br />
              <strong>Diagnostic Status:</strong> Pre-Exam Baseline (0 exams completed). No synthetic or placeholder marks are shown — verified scores, sector accuracy, and cohort comparisons will appear after the first assessment submission.
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
