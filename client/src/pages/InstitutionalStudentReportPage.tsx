import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

export default function InstitutionalStudentReportPage() {
  const { hallTicket: paramHallTicket } = useParams<{ hallTicket?: string }>()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'section_analysis' | 'comparison' | 'time_analysis' | 'progress' | 'activity'>('section_analysis')
  const [selectedExams, setSelectedExams] = useState(['Assesment1', 'Assesment2', 'Assesment3', 'Assesment4'])

  // Exact reference data from PDF Pages 11-14
  const studentMeta = {
    rollNumber: paramHallTicket || '22R1KA0584',
    studentName: 'K V Srinivas',
    testDate: 'November 2, 2024',
    testId: 'Week1-All',
    totMarks: 45,
    studentScore: 23.5,
    batchAverageScore: 30.2,
    accuracy: '50%',
    rankInBatch: '8/30',
    topPerformer: 40.0,
    birthday: 'September 30',
    isBirthdayToday: true,
    totalPlatformHours: 142.5,
    leetcodeSubmissions: 318,
  }

  // Page 11 Section-Wise Analysis
  const sectionAnalysisData = [
    { section: 'Technical MCQ', totQue: 10, totMarks: 20, correct: 6, incorrect: 4, score: 12.0, scorePct: '51.1%', accuracy: '60%', color: '#38BDF8' },
    { section: 'Coding', totQue: 2, totMarks: 10, correct: 1, incorrect: 1, score: 5.0, scorePct: '21.3%', accuracy: '50%', color: '#F59E0B' },
    { section: 'Aptitude', totQue: 10, totMarks: 10, correct: 4, incorrect: 6, score: 4.0, scorePct: '17.0%', accuracy: '40%', color: '#10B981' },
    { section: 'Verbal', totQue: 10, totMarks: 5, correct: 5, incorrect: 5, score: 2.5, scorePct: '10.6%', accuracy: '50%', color: '#F43F5E' },
  ]

  // Page 12 Comparison Report
  const comparisonData = [
    { section: 'Technical MCQ', totMarks: 20, studentScore: 12.0, batchAvg: 12.0, topScore: 20.0 },
    { section: 'Coding', totMarks: 10, studentScore: 5.0, batchAvg: 8.0, topScore: 10.0 },
    { section: 'Aptitude', totMarks: 10, studentScore: 4.0, batchAvg: 6.2, topScore: 10.0 },
    { section: 'Verbal', totMarks: 5, studentScore: 2.5, batchAvg: 4.0, topScore: 5.0 },
  ]

  // Page 13 Time Analysis Report
  const timeAnalysisData = [
    { section: 'Technical MCQ', totTime: 20, studentTime: 15, batchAvgTime: 12 },
    { section: 'Coding', totTime: 40, studentTime: 30, batchAvgTime: 35 },
    { section: 'Aptitude', totTime: 30, studentTime: 20, batchAvgTime: 25 },
    { section: 'Verbal', totTime: 15, studentTime: 10, batchAvgTime: 15 },
  ]

  // Page 14 Progress Across Multiple Assessments
  const progressData = [
    { section: 'Technical MCQ', a1: 8, a2: 10, a3: 9, a4: 12 },
    { section: 'Coding', a1: 4, a2: 5, a3: 5, a4: 7 },
    { section: 'Aptitude', a1: 3, a2: 6, a3: 4, a4: 9 },
    { section: 'Verbal', a1: 2, a2: 3.5, a3: 3, a4: 5 },
    { section: 'Total', a1: 17, a2: 24.5, a3: 21, a4: 33 },
  ]

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const rows = [
      ['Section', 'Total Questions', 'Total Marks', 'Correct', 'Incorrect', 'Score', 'Score %', 'Accuracy %'],
      ...sectionAnalysisData.map(r => [r.section, r.totQue, r.totMarks, r.correct, r.incorrect, r.score, r.scorePct, r.accuracy]),
      ['Total', 32, 45, 16, 16, 23.5, '52.2%', '50%'],
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
        {/* Birthday Wish Banner (Page 5 Requirement) */}
        {studentMeta.isBirthdayToday && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'linear-gradient(90deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))',
              border: '1px solid rgba(236,72,153,0.4)',
              borderRadius: 12,
              padding: '12px 20px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.8rem' }}>🎂</span>
              <div>
                <strong style={{ color: '#F472B6', fontSize: '1rem' }}>Happy Birthday, {studentMeta.studentName}! 🎉</strong>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>
                  The entire LogicWhileLiRE academic faculty and placement cell wish you great success in your career.
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.74rem', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
              Special Birthday Badge Unlocked
            </span>
          </motion.div>
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
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
              Roll Number: <strong style={{ color: '#38BDF8' }}>{studentMeta.rollNumber}</strong> · Test ID: <strong style={{ color: '#F8FAFC' }}>{studentMeta.testId}</strong> · Date: <strong>{studentMeta.testDate}</strong>
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
            { label: "Student's Score", val: `${studentMeta.studentScore}`, color: '#38BDF8' },
            { label: 'Batch Average', val: `${studentMeta.batchAverageScore}`, color: '#94A3B8' },
            { label: 'Accuracy', val: `${studentMeta.accuracy}`, color: '#10B981' },
            { label: 'Section Rank', val: `${studentMeta.rankInBatch}`, color: '#F59E0B' },
            { label: 'Top Performer', val: `${studentMeta.topPerformer}`, color: '#A78BFA' },
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
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>32</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>45</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981' }}>16</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#EF4444' }}>16</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#38BDF8', fontSize: '0.94rem' }}>23.5</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>52.2%</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10B981' }}>50%</td>
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
                  Score Distribution by Section
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Displays proportion of candidate's points earned across sections.
                </p>

                {/* SVG Visual Pie Chart */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '10px 0' }}>
                  <svg width="160" height="160" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Technical MCQ 51.1% -> 184 deg */}
                    <circle r="25" cx="50" cy="50" fill="transparent" stroke="#38BDF8" strokeWidth="50" strokeDasharray="80.2 157" strokeDashoffset="0" />
                    {/* Coding 21.3% */}
                    <circle r="25" cx="50" cy="50" fill="transparent" stroke="#F59E0B" strokeWidth="50" strokeDasharray="33.4 157" strokeDashoffset="-80.2" />
                    {/* Aptitude 17% */}
                    <circle r="25" cx="50" cy="50" fill="transparent" stroke="#10B981" strokeWidth="50" strokeDasharray="26.7 157" strokeDashoffset="-113.6" />
                    {/* Verbal 10.6% */}
                    <circle r="25" cx="50" cy="50" fill="transparent" stroke="#F43F5E" strokeWidth="50" strokeDasharray="16.7 157" strokeDashoffset="-140.3" />
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
                        <div style={{ height: '100%', width: d.accuracy, background: d.color, borderRadius: 4 }} />
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
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>45</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8' }}>23.5</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#10B981' }}>30.2</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#F59E0B' }}>40.0</td>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, alignItems: 'flex-end', height: 220, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
                {comparisonData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%', width: '100%', justifyContent: 'center' }}>
                      {/* Student */}
                      <div style={{ width: 18, height: `${(d.studentScore / 20) * 100}%`, background: '#2563EB', borderRadius: '4px 4px 0 0' }} title={`Student: ${d.studentScore}`} />
                      {/* Batch Avg */}
                      <div style={{ width: 18, height: `${(d.batchAvg / 20) * 100}%`, background: '#16A34A', borderRadius: '4px 4px 0 0' }} title={`Batch: ${d.batchAvg}`} />
                      {/* Top */}
                      <div style={{ width: 18, height: `${(d.topScore / 20) * 100}%`, background: '#EAB308', borderRadius: '4px 4px 0 0' }} title={`Top: ${d.topScore}`} />
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
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#38BDF8' }}>105 min</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#F97316' }}>75 min</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94A3B8' }}>87 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time Analysis Bar Graph */}
            <div style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: 700, color: '#FFF' }}>
                Time Consumption Comparison
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'flex-end', height: 200, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
                {[...timeAnalysisData, { section: 'Total', totTime: 105, studentTime: 75, batchAvgTime: 87 }].map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
                      <div style={{ width: 14, height: `${(d.totTime / 120) * 100}%`, background: '#2563EB', borderRadius: '3px 3px 0 0' }} title={`Allocated: ${d.totTime}`} />
                      <div style={{ width: 14, height: `${(d.studentTime / 120) * 100}%`, background: '#F97316', borderRadius: '3px 3px 0 0' }} title={`Student: ${d.studentTime}`} />
                      <div style={{ width: 14, height: `${(d.batchAvgTime / 120) * 100}%`, background: '#64748B', borderRadius: '3px 3px 0 0' }} title={`Batch: ${d.batchAvgTime}`} />
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
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: row.section === 'Total' ? 800 : 500 }}>
                        <td style={{ padding: '12px 16px', color: row.section === 'Total' ? '#38BDF8' : '#FFF' }}>{row.section}</td>
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
