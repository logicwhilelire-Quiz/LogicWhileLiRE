import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { API_BASE_URL } from '../lib/config'

export default function InstitutionalStudentReportPage() {
  const { hallTicket: paramHallTicket } = useParams<{ hallTicket?: string }>()
  const navigate = useNavigate()

  // Resolve roll number from URL or logged-in student session
  const storedUserStr = localStorage.getItem('student_user')
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null
  const targetRoll = (paramHallTicket || storedUser?.hall_ticket || storedUser?.roll_number || '24HU1A05F9').trim()

  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'section_analysis' | 'comparison' | 'time_analysis' | 'progress' | 'activity'>('section_analysis')
  const [selectedExams, setSelectedExams] = useState(['Assesment1', 'Assesment2', 'Assesment3', 'Assesment4'])

  useEffect(() => {
    let isMounted = true
    async function loadReport() {
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE_URL}/api/student/report/${encodeURIComponent(targetRoll)}`)
        if (isMounted && res.data?.success) {
          setReportData(res.data)
        }
      } catch (err) {
        console.warn('Could not fetch student report from server, using local session context:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadReport()
    return () => { isMounted = false }
  }, [targetRoll])

  // Resolve student attributes prioritizing remote database -> session storage -> fallback
  const student = reportData?.student || (storedUser && (storedUser.hall_ticket === targetRoll || storedUser.roll_number === targetRoll) ? storedUser : null)

  const resolvedName = student?.name || (student?.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : null) || (targetRoll === '24HU1A05F9' ? 'Charan Sai Krishna Redrowthu' : targetRoll)
  const resolvedCollege = student?.collegeName || student?.college_name || 'RV Institute Of Technology'
  const resolvedBranch = student?.branch || student?.branch_code || 'CSE'
  const resolvedSection = student?.section || 'C'
  const hasAttempts = Boolean(reportData?.hasAttempts)

  const studentMeta = {
    rollNumber: targetRoll,
    studentName: resolvedName,
    college: resolvedCollege,
    branch: resolvedBranch,
    section: resolvedSection,
    testDate: hasAttempts ? 'October 12, 2026' : 'No Assessment Taken Yet',
    testId: hasAttempts ? 'LW-VRSEC-2026' : 'Pre-Exam Baseline',
    totMarks: 70,
    studentScore: hasAttempts ? 56.5 : 0,
    batchAverageScore: 52.4,
    accuracy: hasAttempts ? '82%' : '0%',
    rankInBatch: hasAttempts ? '8/30' : 'Awaiting Attempt',
    topPerformer: 68.0,
    totalPlatformHours: 142.5,
    leetcodeSubmissions: 318,
  }

  // 5 Official Technical Sectors of LogicWhile LiRE (Specification aligned)
  const sectionAnalysisData = [
    { section: 'Sector 1: Quant', fullName: 'Quantitative Velocity', totQue: 10, totMarks: 10, correct: hasAttempts ? 8 : 0, incorrect: hasAttempts ? 2 : 0, score: hasAttempts ? 8.0 : 0, scorePct: '14.2%', accuracy: hasAttempts ? '80%' : '80% (Target)', color: '#F59E0B' },
    { section: 'Sector 2: Logic', fullName: 'Deductive Logic', totQue: 10, totMarks: 10, correct: hasAttempts ? 9 : 0, incorrect: hasAttempts ? 1 : 0, score: hasAttempts ? 9.0 : 0, scorePct: '15.9%', accuracy: hasAttempts ? '90%' : '85% (Target)', color: '#8B5CF6' },
    { section: 'Sector 3: Core CS', fullName: 'Systems & OS', totQue: 10, totMarks: 15, correct: hasAttempts ? 7 : 0, incorrect: hasAttempts ? 3 : 0, score: hasAttempts ? 10.5 : 0, scorePct: '18.6%', accuracy: hasAttempts ? '70%' : '75% (Target)', color: '#10B981' },
    { section: 'Sector 4: DSA', fullName: 'Algorithms & Structures', totQue: 10, totMarks: 20, correct: hasAttempts ? 8 : 0, incorrect: hasAttempts ? 2 : 0, score: hasAttempts ? 16.0 : 0, scorePct: '28.3%', accuracy: hasAttempts ? '80%' : '80% (Target)', color: '#38BDF8' },
    { section: 'Sector 5: Cloud', fullName: 'Full-Stack Architecture', totQue: 5, totMarks: 15, correct: hasAttempts ? 4 : 0, incorrect: hasAttempts ? 1 : 0, score: hasAttempts ? 13.0 : 0, scorePct: '23.0%', accuracy: hasAttempts ? '80%' : '80% (Target)', color: '#F43F5E' },
  ]

  // Page 12 Comparison Report (5 Sectors)
  const comparisonData = [
    { section: 'Sector 1: Quant', totMarks: 10, studentScore: hasAttempts ? 8.0 : 0, batchAvg: 7.2, topScore: 10.0 },
    { section: 'Sector 2: Logic', totMarks: 10, studentScore: hasAttempts ? 9.0 : 0, batchAvg: 7.8, topScore: 10.0 },
    { section: 'Sector 3: Core CS', totMarks: 15, studentScore: hasAttempts ? 10.5 : 0, batchAvg: 11.0, topScore: 15.0 },
    { section: 'Sector 4: DSA', totMarks: 20, studentScore: hasAttempts ? 16.0 : 0, batchAvg: 14.5, topScore: 20.0 },
    { section: 'Sector 5: Cloud', totMarks: 15, studentScore: hasAttempts ? 13.0 : 0, batchAvg: 10.5, topScore: 15.0 },
  ]

  // Page 13 Time Analysis Report (5 Sectors)
  const timeAnalysisData = [
    { section: 'Sector 1: Quant', totTime: 15, studentTime: hasAttempts ? 12 : 0, batchAvgTime: 14 },
    { section: 'Sector 2: Logic', totTime: 15, studentTime: hasAttempts ? 14 : 0, batchAvgTime: 13 },
    { section: 'Sector 3: Core CS', totTime: 20, studentTime: hasAttempts ? 16 : 0, batchAvgTime: 18 },
    { section: 'Sector 4: DSA', totTime: 25, studentTime: hasAttempts ? 22 : 0, batchAvgTime: 24 },
    { section: 'Sector 5: Cloud', totTime: 15, studentTime: hasAttempts ? 11 : 0, batchAvgTime: 13 },
  ]

  // Page 14 Progress Across Multiple Assessments (5 Sectors)
  const progressData = [
    { section: 'Sector 1: Quant', a1: 6, a2: 7, a3: 8, a4: 9 },
    { section: 'Sector 2: Logic', a1: 7, a2: 8, a3: 8.5, a4: 9.5 },
    { section: 'Sector 3: Core CS', a1: 9, a2: 10, a3: 11, a4: 13 },
    { section: 'Sector 4: DSA', a1: 11, a2: 13, a3: 15, a4: 18 },
    { section: 'Sector 5: Cloud', a1: 8, a2: 9.5, a3: 11, a4: 13 },
    { section: 'Total Aggregate', a1: 41, a2: 47.5, a3: 53.5, a4: 62.5 },
  ]

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const rows = [
      ['Section', 'Total Questions', 'Total Marks', 'Correct', 'Incorrect', 'Score', 'Score %', 'Accuracy %'],
      ...sectionAnalysisData.map(r => [r.section, r.totQue, r.totMarks, r.correct, r.incorrect, r.score, r.scorePct, r.accuracy]),
      ['Total', 45, 70, hasAttempts ? 36 : 0, hasAttempts ? 9 : 0, hasAttempts ? 56.5 : 0, hasAttempts ? '80.7%' : '0%', hasAttempts ? '80%' : '0%'],
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `LogicWhileLiRE_Report_${studentMeta.rollNumber}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050814', color: '#E2E8F0', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        {/* Candidate Status Notice Banner */}
        {!hasAttempts && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(15, 23, 42, 0.75))',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.8rem' }}>🎓</span>
              <div>
                <strong style={{ color: '#38BDF8', fontSize: '0.98rem' }}>
                  Candidate Profile Active · {studentMeta.college}
                </strong>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 2 }}>
                  Candidate <strong>{studentMeta.studentName}</strong> ({studentMeta.rollNumber}) is registered in <strong>{studentMeta.branch} - Section {studentMeta.section}</strong>. No examinations completed yet under this roll number. Standard curriculum benchmarks are displayed below as performance targets.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link
                to="/enter-exam"
                style={{
                  background: '#002147',
                  border: '1.5px solid #EAA812',
                  color: '#EAA812',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ⚡ Enter Assessment
              </Link>
              <Link
                to="/practice"
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38BDF8',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                🎯 Practice Arena
              </Link>
            </div>
          </div>
        )}

        {/* Report Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              LogicWhileLiRE Assessment Intelligence · Official Performance Report
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
              Student Analysis Report: {studentMeta.studentName}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
              Roll Number: <strong style={{ color: '#38BDF8' }}>{studentMeta.rollNumber}</strong> · Institution: <strong style={{ color: '#F8FAFC' }}>{studentMeta.college} ({studentMeta.branch} - Sec {studentMeta.section})</strong> · Status: <strong style={{ color: hasAttempts ? '#10B981' : '#EAB308' }}>{hasAttempts ? 'Assessed' : 'Pre-Exam Baseline'}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38BDF8',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>📊</span> Export Excel / CSV
            </button>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563EB',
                border: 'none',
                color: '#FFF',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>📄</span> Print / PDF Report
            </button>
          </div>
        </div>

        {/* Top Summary KPI Cards (Page 11 Spec) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Marks', val: `${studentMeta.totMarks}`, color: '#E2E8F0' },
            { label: "Student's Score", val: hasAttempts ? `${studentMeta.studentScore}` : 'Pending Attempt', color: hasAttempts ? '#38BDF8' : '#94A3B8' },
            { label: 'Batch Average', val: `${studentMeta.batchAverageScore}`, color: '#94A3B8' },
            { label: 'Accuracy', val: hasAttempts ? `${studentMeta.accuracy}` : '--', color: hasAttempts ? '#10B981' : '#64748B' },
            { label: 'Section Rank', val: hasAttempts ? `${studentMeta.rankInBatch}` : 'Enrolled', color: '#F59E0B' },
            { label: 'Top Performer Target', val: `${studentMeta.topPerformer}`, color: '#A78BFA' },
          ].map((kpi, idx) => (
            <div
              key={idx}
              style={{
                background: '#0B1120',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>{kpi.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
            </div>
          ))}
        </div>

        {/* Report Tab Selector (Pages 11-14) */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 24 }}>
          {[
            { id: 'section_analysis', label: '1. Section-Wise Analysis (Page 11)' },
            { id: 'comparison', label: '2. Comparison Report (Page 12)' },
            { id: 'time_analysis', label: '3. Time Analysis Report (Page 13)' },
            { id: 'progress', label: '4. Multi-Assessment Progress (Page 14)' },
            { id: 'activity', label: '5. LeetCode Activity & Coding (Page 5)' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: activeTab === t.id ? '1px solid #38BDF8' : '1px solid transparent',
                background: activeTab === t.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                color: activeTab === t.id ? '#38BDF8' : '#94A3B8',
                fontWeight: activeTab === t.id ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: SECTION-WISE ANALYSIS (Page 11) */}
        {activeTab === 'section_analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Table */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.88rem' }}>
                Section-Wise Breakdown Table
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#070D18', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 16px' }}>Sections / Metrics</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Tot.Que</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Tot.Marks</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Correct</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Incorrect</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Score</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Score (%)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionAnalysisData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFF' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8 }} />
                          {row.section}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{row.totQue}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{row.totMarks}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981', fontWeight: 700 }}>{row.correct}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#EF4444' }}>{row.incorrect}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#38BDF8' }}>{row.score}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#E2E8F0' }}>{row.scorePct}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{row.accuracy}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(56, 189, 248, 0.05)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 16px', color: '#38BDF8' }}>Total Aggregate</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>45</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>70</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981' }}>{hasAttempts ? 36 : 0}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#EF4444' }}>{hasAttempts ? 9 : 0}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#38BDF8', fontSize: '0.94rem' }}>{hasAttempts ? '56.5' : '0.0'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{hasAttempts ? '80.7%' : '0%'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10B981' }}>{hasAttempts ? '80%' : '80% (Benchmark)'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Grid (Page 11 Pie Charts) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Chart A: Score Distribution */}
              <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: '#FFF' }}>
                  Score Distribution by Section (5 Sectors)
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Displays proportion of candidate's points earned across all 5 technical sectors.
                </p>

                {/* SVG Visual Pie Chart */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '10px 0' }}>
                  <svg width="160" height="160" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    {(() => {
                      const C = 157.08;
                      let currentOffset = 0;
                      const slices = [
                        { pct: 0.142, color: '#F59E0B' }, // Quant (14.2%)
                        { pct: 0.159, color: '#8B5CF6' }, // Logic (15.9%)
                        { pct: 0.186, color: '#10B981' }, // Core CS (18.6%)
                        { pct: 0.283, color: '#38BDF8' }, // DSA (28.3%)
                        { pct: 0.230, color: '#F43F5E' }, // Cloud (23.0%)
                      ];
                      return slices.map((s, idx) => {
                        const len = s.pct * C;
                        const offset = currentOffset;
                        currentOffset += len;
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
                        );
                      });
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
              </div>

              {/* Chart B: Accuracy Comparison */}
              <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 700, color: '#FFF' }}>
                  Accuracy Comparison Across Sections
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Percentage of attempted questions answered correctly per section.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sectionAnalysisData.map((d, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                        <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{d.section}</span>
                        <span style={{ color: '#10B981', fontWeight: 800 }}>{d.accuracy}</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: d.accuracy.includes('%') ? d.accuracy.split(' ')[0] : '80%', background: d.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPARISON REPORT (Page 12) */}
        {activeTab === 'comparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Table */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.88rem' }}>
                Comparison Matrix: Student vs. Batch Average vs. Top Score
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#070D18', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 16px' }}>Sections / Metrics</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Tot.Marks</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#38BDF8' }}>Student's Score</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10B981' }}>Batch Average Score</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', color: '#F59E0B' }}>Top Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFF' }}>{row.section}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#94A3B8' }}>{row.totMarks}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#38BDF8' }}>{row.studentScore}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#10B981' }}>{row.batchAvg}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#F59E0B' }}>{row.topScore}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(56, 189, 248, 0.05)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 16px', color: '#38BDF8' }}>Total Aggregate</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>70</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8' }}>{hasAttempts ? '56.5' : '0.0'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981' }}>51.0</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#F59E0B' }}>70.0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Grouped Bar Chart (Page 12 Wireframe) */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#FFF' }}>
                  Section-Wise Comparison of Scores
                </h4>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#2563EB', borderRadius: 2 }} />
                    <span style={{ color: '#CBD5E1' }}>Student's Score</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#16A34A', borderRadius: 2 }} />
                    <span style={{ color: '#CBD5E1' }}>Batch Average</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#EAB308', borderRadius: 2 }} />
                    <span style={{ color: '#CBD5E1' }}>Top Performer</span>
                  </div>
                </div>
              </div>

              {/* Grouped Bar Graph */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'flex-end', height: 220, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
                {comparisonData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%', width: '100%', justifyContent: 'center' }}>
                      {/* Student */}
                      <div style={{ width: 16, height: `${(d.studentScore / 20) * 100}%`, background: '#2563EB', borderRadius: '4px 4px 0 0' }} title={`Student: ${d.studentScore}`} />
                      {/* Batch Avg */}
                      <div style={{ width: 16, height: `${(d.batchAvg / 20) * 100}%`, background: '#16A34A', borderRadius: '4px 4px 0 0' }} title={`Batch: ${d.batchAvg}`} />
                      {/* Top */}
                      <div style={{ width: 16, height: `${(d.topScore / 20) * 100}%`, background: '#EAB308', borderRadius: '4px 4px 0 0' }} title={`Top: ${d.topScore}`} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 10, textAlign: 'center', fontWeight: 600 }}>
                      {d.section}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TIME ANALYSIS REPORT (Page 13) */}
        {activeTab === 'time_analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Table */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.88rem' }}>
                Section-Wise Time Utilization (Minutes)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#070D18', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 16px' }}>Sections / Metrics</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Tot.Time (Min)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#F97316' }}>Student's Time</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', color: '#94A3B8' }}>Batch Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeAnalysisData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFF' }}>{row.section}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8', fontWeight: 700 }}>{row.totTime} min</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#F97316' }}>{row.studentTime} min</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94A3B8' }}>{row.batchAvgTime} min</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(56, 189, 248, 0.05)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 16px', color: '#38BDF8' }}>Total Duration</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8' }}>90 min</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#F97316' }}>{hasAttempts ? '75 min' : '0 min'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94A3B8' }}>82 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time Analysis Bar Graph */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: 700, color: '#FFF' }}>
                Time Consumption Comparison (5 Sectors + Aggregate)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, alignItems: 'flex-end', height: 200, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
                {[...timeAnalysisData, { section: 'Total', totTime: 90, studentTime: hasAttempts ? 75 : 0, batchAvgTime: 82 }].map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
                      <div style={{ width: 12, height: `${(d.totTime / 100) * 100}%`, background: '#2563EB', borderRadius: '3px 3px 0 0' }} title={`Allocated: ${d.totTime} min`} />
                      <div style={{ width: 12, height: `${(d.studentTime / 100) * 100}%`, background: '#F97316', borderRadius: '3px 3px 0 0' }} title={`Student: ${d.studentTime} min`} />
                      <div style={{ width: 12, height: `${(d.batchAvgTime / 100) * 100}%`, background: '#64748B', borderRadius: '3px 3px 0 0' }} title={`Batch: ${d.batchAvgTime} min`} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>{d.section}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROGRESS ACROSS MULTIPLE ASSESSMENTS (Page 14) */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.88rem' }}>
                Multi-Assessment Evolution Table
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#070D18', color: '#94A3B8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 16px' }}>Sections / Metrics</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#38BDF8' }}>Assessment 1</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#F59E0B' }}>Assessment 2</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', color: '#A78BFA' }}>Assessment 3</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', color: '#10B981' }}>Assessment 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: row.section.includes('Total') ? 800 : 500, background: row.section.includes('Total') ? 'rgba(56, 189, 248, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: row.section.includes('Total') ? '#38BDF8' : '#FFF' }}>{row.section}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8' }}>{row.a1}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#F59E0B' }}>{row.a2}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#A78BFA' }}>{row.a3}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10B981', fontWeight: 800 }}>{row.a4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Growth Trajectory Visual */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: 700, color: '#FFF' }}>
                Overall Growth Trajectory across Assessments
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '20px 0' }}>
                {[
                  { exam: 'Assessment 1', score: 17.0, growth: 'Baseline' },
                  { exam: 'Assessment 2', score: 24.5, growth: '+44.1%' },
                  { exam: 'Assessment 3', score: 21.0, growth: '-14.2%' },
                  { exam: 'Assessment 4', score: 33.0, growth: '+57.1% Peak' },
                ].map((step, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{step.exam}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>{step.score}</div>
                    <div style={{ fontSize: '0.7rem', color: step.growth.includes('+') ? '#10B981' : '#F59E0B', fontWeight: 700, marginTop: 2 }}>
                      {step.growth}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LEETCODE ACTIVITY & CODING (Page 5) */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* LeetCode Heatmap */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#FFF' }}>
                    Day-by-Day Student Practice Activity Heatmap
                  </h4>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 2 }}>
                    {studentMeta.leetcodeSubmissions} problem statements solved across 365 days
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 700 }}>
                  🔥 24-Day Active Streak
                </div>
              </div>

              {/* Heatmap Grid */}
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '10px 0' }}>
                {Array.from({ length: 30 }).map((_, weekIdx) => (
                  <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const level = (weekIdx * 7 + dayIdx) % 5
                      const bg = level === 0 ? 'rgba(255,255,255,0.04)' : level === 1 ? '#0E4429' : level === 2 ? '#006D32' : level === 3 ? '#26A641' : '#39D353'
                      return (
                        <div
                          key={dayIdx}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: bg,
                          }}
                          title={`Day ${weekIdx * 7 + dayIdx + 1}: ${level * 2} submissions`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Total Platform Hours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>Total Hours on Platform</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>{studentMeta.totalPlatformHours} hrs</div>
              </div>
              <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>Coding Problems Solved</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>48 Problems</div>
              </div>
              <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>Attendance Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>96.2%</div>
              </div>
            </div>
          </div>
        )}

        {/* AI Recommendations & Diagnostic Insights (Page 10 Spec) */}
        <div
          style={{
            marginTop: 28,
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.2), rgba(15, 23, 42, 0.6))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.3rem' }}>🤖</span>
            <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#38BDF8' }}>
              LogicWhileLiRE AI Faculty Diagnostic & Suggestions
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            <strong>Strengths:</strong> Candidate demonstrates superior aptitude velocity in <em>Technical MCQ</em> (51.1% of points with 60% accuracy).<br />
            <strong>Focus Area:</strong> <em>Verbal Ability</em> time utilization was minimal (10 mins used out of 15), resulting in unattempted comprehension items. Recommended remedial: Sector 2 Critical Reasoning module drills.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
