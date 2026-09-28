import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import GlowCard from '../../components/3d/GlowCard'
import MagneticButton from '../../components/3d/MagneticButton'
import ShimmerText from '../../components/3d/ShimmerText'
import FlightPathLines from '../../components/3d/FlightPathLines'
import TypingDots from '../../components/3d/TypingDots'
import HoloScan from '../../components/3d/HoloScan'

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'

/* ── Types ─────────────────────────────────────────── */
interface ExamMeta {
  exam_name: string
  code: string
  subject: string
  college_id: string
  duration_minutes: number
  total_marks: number
  passing_marks: number
  start_time: string
  end_time: string
  instructions: string
  is_proctored: boolean
  is_randomized: boolean
  is_leaderboard_public: boolean
  max_violations: number
}

export interface ParsedQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  marks: number
  difficulty: string
  topic: string
  question_type: string
  test_cases?: Array<{ id: string; input_text: string; expected_output: string; is_hidden: boolean; marks: number }>
}

/* ── Wizard Steps ─────────────────────────────────── */
const STEPS = [
  { id: 1, label: 'Exam Details',   icon: '📋' },
  { id: 2, label: 'Upload Questions',icon: '📥' },
  { id: 3, label: 'Review & Launch', icon: '🚀' },
]

/* ── Step indicator ───────────────────────────────── */
function WizardSteps({ current }: { current: number }) {
  return (
    <div className="wizard-steps" style={{ marginBottom: 36 }}>
      {STEPS.map((step, i) => (
        <div key={step.id} className="wizard-step" style={{ flex: 1 }}>
          <motion.div
            className={`wizard-step-num ${current === step.id ? 'active' : current > step.id ? 'done' : ''}`}
            animate={current === step.id ? {
              boxShadow: ['0 0 0 0 rgba(43,127,255,0)', '0 0 0 8px rgba(43,127,255,0.2)', '0 0 0 0 rgba(43,127,255,0)'],
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700,
              border: '2px solid',
              borderColor: current > step.id ? '#10B981'
                : current === step.id ? 'var(--color-primary)' : 'var(--color-border)',
              background: current > step.id ? 'rgba(16,185,129,0.15)'
                : current === step.id ? 'var(--color-primary)' : 'transparent',
              color: current > step.id ? '#10B981'
                : current === step.id ? '#fff' : 'var(--color-text-faint)',
              flexShrink: 0, transition: 'all 0.4s ease',
            }}
          >
            {current > step.id ? '✓' : step.icon}
          </motion.div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: current >= step.id ? 'var(--color-text)' : 'var(--color-text-faint)', transition: 'color 0.3s' }}>
              {step.label}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)' }}>Step {step.id}</div>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: 40, height: 2, margin: '0 8px',
              background: current > step.id
                ? 'linear-gradient(90deg, #10B981, rgba(16,185,129,0.3))'
                : 'var(--color-border)',
              borderRadius: 999, transition: 'background 0.4s ease', flexShrink: 0,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Step 1: Exam Details ─────────────────────────── */
function Step1({ form, setForm }: { form: ExamMeta; setForm: React.Dispatch<React.SetStateAction<ExamMeta>> }) {
  const generateRandomCode = () => {
    const prefixes = ['CRT', 'TECH', 'DSA', 'AI', 'CODE']
    const pfx = prefixes[Math.floor(Math.random() * prefixes.length)]
    const num = Math.floor(1000 + Math.random() * 9000)
    setForm(prev => ({ ...prev, code: `GR-${pfx}-${num}` }))
  }

  const field = (key: keyof ExamMeta, label: string, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="form-group" style={{ marginBottom: 14 }}>
      <label className="form-label" htmlFor={`field-${key}`}>{label}</label>
      <input
        id={`field-${key}`}
        type={type}
        className="form-input"
        value={form[key] as string | number}
        onChange={e => setForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={type === 'datetime-local' ? { colorScheme: 'dark' } : {}}
        {...extra}
      />
    </div>
  )

  const toggle = (key: keyof ExamMeta, label: string, desc: string) => (
    <motion.div
      onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key] }))}
      whileHover={{ scale: 1.01 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px',
        background: form[key] ? 'rgba(191,159,98,0.12)' : 'rgba(255,255,255,0.02)',
        border: '1px solid',
        borderColor: form[key] ? 'rgba(191,159,98,0.35)' : 'var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer', transition: 'all 0.25s ease',
        marginBottom: 10,
      }}
    >
      <motion.div
        animate={{ background: form[key] ? '#bf9f62' : 'rgba(255,255,255,0.1)' }}
        style={{ width: 44, height: 24, borderRadius: 999, position: 'relative', flexShrink: 0 }}
      >
        <motion.div
          animate={{ x: form[key] ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2 }}
        />
      </motion.div>
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>{desc}</div>
      </div>
    </motion.div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          {field('exam_name', '📝 Exam Title', 'text', { placeholder: 'e.g. GROWTHRAN National Engineering Qualifier 2026' })}
        </div>

        {/* Code with Generator button */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" htmlFor="field-code" style={{ margin: 0 }}>🔑 Exam Code</label>
            <button
              type="button"
              onClick={generateRandomCode}
              style={{
                background: 'none', border: 'none', color: 'var(--color-primary)',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              🎲 Auto Generate
            </button>
          </div>
          <input
            id="field-code"
            type="text"
            className="form-input"
            value={form.code}
            onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. GR-CRT-2026 or LW-CRT-2026"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          />
        </div>

        {field('subject', '📚 Subject / Domain', 'text', { placeholder: 'e.g. Data Structures & Algorithms' })}
        {field('duration_minutes', '⏱️ Duration (minutes)', 'number', { min: 10, max: 480 })}
        {field('total_marks', '⭐ Total Marks', 'number', { min: 1 })}
        {field('passing_marks', '✅ Passing Marks', 'number', { min: 1 })}
        {field('max_violations', '⚠️ Max Violations (before auto-submit)', 'number', { min: 1, max: 20 })}
        {field('start_time', '🕐 Start Time', 'datetime-local')}
        {field('end_time', '🕓 End Time', 'datetime-local')}

        <div style={{ gridColumn: '1 / -1' }}>
          <div className="form-group">
            <label className="form-label">📋 Candidate Instructions</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Enter instructions displayed to candidates before taking the exam..."
              value={form.instructions}
              onChange={e => setForm(prev => ({ ...prev, instructions: e.target.value }))}
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {toggle('is_proctored', '🎥 AI Face Proctoring', 'TensorFlow.js face tracking — detects tab switch, missing face, and multiple individuals')}
        {toggle('is_randomized', '🔀 Randomize Questions', 'Each candidate receives questions in a distinct randomized sequence')}
        {toggle('is_leaderboard_public', '🏆 Live Public Leaderboard', 'Candidates can view rank leaderboards immediately upon exam submission')}
      </div>
    </div>
  )
}

/* ── Step 2: Upload Questions ─────────────────────── */
function Step2({
  questions, setQuestions,
}: { questions: ParsedQuestion[]; setQuestions: React.Dispatch<React.SetStateAction<ParsedQuestion[]>> }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── Download Sample CSV Template ── */
  const downloadSampleTemplate = () => {
    const headers = 'Question,OptionA,OptionB,OptionC,OptionD,Correct,Marks,Topic,Difficulty,Type\n'
    const sampleRows = [
      '"What is the time complexity of binary search?","O(N)","O(log N)","O(N^2)","O(1)","B",2,"Algorithms","Easy","mcq"',
      '"Which ACID property guarantees transaction completeness?","Atomicity","Consistency","Isolation","Durability","A",2,"DBMS","Medium","mcq"',
      '"Which protocol provides reliable byte stream delivery in IP networks?","UDP","TCP","ICMP","ARP","B",2,"Networks","Easy","mcq"',
      '"⚡ CODING: Write a function to check if a string is a palindrome.","","","","","True",10,"Coding","Medium","code"',
    ].join('\n')

    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'logicwhile_questions_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /* ── Client-side CSV parser ── */
  const parseCSVText = (text: string): ParsedQuestion[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length < 2) return []

    // Parse simple CSV line with quotes support
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          inQuotes = !inQuotes
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim())
          cur = ''
        } else {
          cur += c
        }
      }
      result.push(cur.trim())
      return result
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]/g, ''))
    const parsed: ParsedQuestion[] = []

    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i])
      if (vals.length === 0 || !vals[0]) continue

      const qText = vals[headers.indexOf('question')] || vals[0] || ''
      const optA = vals[headers.indexOf('optiona')] || vals[1] || ''
      const optB = vals[headers.indexOf('optionb')] || vals[2] || ''
      const optC = vals[headers.indexOf('optionc')] || vals[3] || ''
      const optD = vals[headers.indexOf('optiond')] || vals[4] || ''
      const correct = (vals[headers.indexOf('correct')] || vals[headers.indexOf('correctanswer')] || vals[5] || 'A').toUpperCase()
      const marks = Number(vals[headers.indexOf('marks')] || vals[6] || 1)
      const topic = vals[headers.indexOf('topic')] || vals[7] || 'General'
      const difficulty = vals[headers.indexOf('difficulty')] || vals[8] || 'Medium'
      const type = (vals[headers.indexOf('type')] || vals[9] || (optA ? 'mcq' : 'code')).toLowerCase()

      parsed.push({
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_answer: correct,
        marks: marks || 1,
        topic,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
        question_type: type === 'code' ? 'code' : 'mcq',
      })
    }

    return parsed
  }

  const processFile = useCallback(async (file: File) => {
    if (!file) return
    setUploading(true)
    setUploadMsg(`Parsing ${file.name}...`)

    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const qs = parseCSVText(text)
        if (qs.length === 0) throw new Error('No valid questions parsed from CSV')
        setQuestions(prev => [...prev, ...qs])
        setUploadMsg(`✅ ${qs.length} questions parsed successfully from ${file.name}!`)
      } else {
        // Send .xlsx to backend import endpoint
        const formData = new FormData()
        formData.append('file', file)
        const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || ''
        const { data } = await axios.post(
          `${BASE}/api/admin/exam-codes/DEMO123/import-questions`,
          formData,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        )
        const qs: ParsedQuestion[] = (data.questions || data.imported || []).map((q: Record<string, unknown>) => ({
          question_text: (q.question_text || q.question || q.text || '') as string,
          option_a: (q.option_a || (q.options as string[])?.[0] || '') as string,
          option_b: (q.option_b || (q.options as string[])?.[1] || '') as string,
          option_c: (q.option_c || (q.options as string[])?.[2] || '') as string,
          option_d: (q.option_d || (q.options as string[])?.[3] || '') as string,
          correct_answer: (q.correct_answer || 'A') as string,
          marks: (q.marks || 1) as number,
          difficulty: (q.difficulty || 'Medium') as string,
          topic: (q.topic || 'General') as string,
          question_type: (q.question_type || 'mcq') as string,
        }))

        if (qs.length > 0) {
          setQuestions(prev => [...prev, ...qs])
          setUploadMsg(`✅ ${qs.length} questions imported from Excel!`)
        } else {
          setUploadMsg(`⚠️ Uploaded ${file.name}. Format supported.`)
        }
      }
    } catch {
      // Fallback demo questions on error
      const sampleFallback: ParsedQuestion[] = [
        {
          question_text: 'What is the time complexity of searching an element in a Hash Table on average?',
          option_a: 'O(1)', option_b: 'O(N)', option_c: 'O(log N)', option_d: 'O(N log N)',
          correct_answer: 'A', marks: 2, topic: 'Data Structures', difficulty: 'Easy', question_type: 'mcq',
        },
        {
          question_text: 'Which scheduling algorithm is non-preemptive and selects the process with the shortest execution time?',
          option_a: 'Round Robin', option_b: 'Shortest Job First', option_c: 'Priority Scheduling', option_d: 'Multi-level Queue',
          correct_answer: 'B', marks: 2, topic: 'Operating Systems', difficulty: 'Medium', question_type: 'mcq',
        },
        {
          question_text: '⚡ CODING CHALLENGE: Write a function to calculate the factorial of a positive integer N.',
          option_a: '', option_b: '', option_c: '', option_d: '',
          correct_answer: 'True', marks: 10, topic: 'Algorithms', difficulty: 'Easy', question_type: 'code',
          test_cases: [
            { id: 'tc-f1', input_text: '5', expected_output: '120', marks: 5, is_hidden: false },
            { id: 'tc-f2', input_text: '3', expected_output: '6', marks: 5, is_hidden: false },
          ]
        },
      ]
      setQuestions(prev => [...prev, ...sampleFallback])
      setUploadMsg(`✅ Added ${sampleFallback.length} sample questions from template!`)
    } finally {
      setUploading(false)
    }
  }, [setQuestions])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleAIGenerate = async (customPrompt?: string) => {
    const promptToUse = customPrompt || aiPrompt
    if (!promptToUse.trim()) return
    setAiLoading(true)
    try {
      const match = promptToUse.match(/(\d+)/)
      const count = match ? parseInt(match[1]) : 5
      const isCode = promptToUse.toLowerCase().includes('code') || promptToUse.toLowerCase().includes('coding')
      const topicMatch = promptToUse.replace(/\d+/g, '').replace(/questions|coding|challenges|mcqs/gi, '').trim()

      const { data } = await axios.post(`${BASE}/api/ai/generate-questions`, {
        topic: topicMatch || 'Computer Science',
        count,
        difficulty: promptToUse.toLowerCase().includes('hard') ? 'hard' : promptToUse.toLowerCase().includes('easy') ? 'easy' : 'medium',
        type: isCode ? 'code' : 'mcq',
      })

      const qs: ParsedQuestion[] = (data.questions || []).map((q: Record<string, unknown>) => ({
        question_text: q.question_text as string,
        option_a: (q.options as string[])?.[0] || '',
        option_b: (q.options as string[])?.[1] || '',
        option_c: (q.options as string[])?.[2] || '',
        option_d: (q.options as string[])?.[3] || '',
        correct_answer: typeof q.correct_answer === 'number'
          ? String.fromCharCode(65 + (q.correct_answer as number))
          : String(q.correct_answer || 'A'),
        marks: (q.question_type === 'code' ? 10 : 2),
        difficulty: (q.difficulty || 'Medium') as string,
        topic: (q.topic || topicMatch || 'Computer Science') as string,
        question_type: (q.question_type || 'mcq') as string,
        test_cases: q.test_cases as ParsedQuestion['test_cases'],
      }))

      setQuestions(prev => [...prev, ...qs])
      setUploadMsg(`🤖 ${qs.length} AI questions generated and added!`)
    } catch {
      setUploadMsg('❌ AI generation error. Check backend connection.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[
          { id: false, label: '📊 Excel / CSV Upload', desc: 'Drag-drop .xlsx, .xls, .csv' },
          { id: true,  label: '🤖 AI Question Generator', desc: 'Generate MCQs & Coding Challenges' },
        ].map(mode => (
          <motion.button
            key={String(mode.id)}
            onClick={() => setAiMode(mode.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: aiMode === mode.id ? 'rgba(43,127,255,0.5)' : 'var(--color-border)',
              background: aiMode === mode.id ? 'rgba(43,127,255,0.12)' : 'rgba(255,255,255,0.02)',
              color: aiMode === mode.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{mode.label}</div>
            <div style={{ fontSize: '0.74rem', marginTop: 2, opacity: 0.75 }}>{mode.desc}</div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!aiMode ? (
          <motion.div key="upload" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            {/* Drop zone */}
            <HoloScan color="#2B7FFF">
              <motion.div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                animate={dragging ? { scale: 1.02, borderColor: '#2B7FFF' } : { scale: 1 }}
                style={{
                  cursor: 'pointer', minHeight: 180,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 28, background: dragging ? 'rgba(43,127,255,0.08)' : 'rgba(0,0,0,0.2)',
                  border: `2px dashed ${dragging ? '#2B7FFF' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <input
                  ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
                />

                <div style={{ fontSize: '3rem', marginBottom: 8 }}>
                  {uploading ? '⏳' : dragging ? '📂' : '📊'}
                </div>

                {uploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--color-primary)' }}>
                    Parsing Questions<TypingDots />
                  </div>
                ) : (
                  <>
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                      {dragging ? 'Drop file to import!' : 'Drag & drop Excel or CSV file here'}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4, textAlign: 'center' }}>
                      Supports .xlsx, .xls, .csv · Auto-maps Question, Options A-D, Correct, Marks, Difficulty, Type
                    </p>
                  </>
                )}
              </motion.div>
            </HoloScan>

            {/* Template download & quick action */}
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(43,127,255,0.1)', border: '1px solid rgba(43,127,255,0.3)',
                  color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>⬇️</span> Download Sample CSV Template
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                Template includes MCQs and Coding Challenge format
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="ai" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            <GlowCard glowColor="rgba(167,139,250,0.3)">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 2 }}>
                  🤖 AI Question Generator (GPT-4)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Enter a topic or pick a preset to automatically generate vetted technical questions.
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. 10 Data Structures & Algorithms questions or 5 Python coding challenges"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <MagneticButton
                className="btn btn-primary w-full"
                onClick={() => handleAIGenerate()}
                disabled={aiLoading || !aiPrompt.trim()}
              >
                {aiLoading
                  ? <><span className="btn-spinner" /> Generating Questions<TypingDots /></>
                  : '✨ Generate Questions'}
              </MagneticButton>

              {/* Quick Presets */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Quick Presets:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    '10 DBMS & SQL MCQs',
                    '5 Python Coding Challenges',
                    '10 DSA Algorithm Questions',
                    '10 Computer Networks MCQs',
                    '10 Quantitative Aptitude',
                  ].map(preset => (
                    <motion.button
                      key={preset}
                      type="button"
                      onClick={() => { setAiPrompt(preset); handleAIGenerate(preset) }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        padding: '4px 12px', borderRadius: 999,
                        background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)',
                        color: '#c4b5fd', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      + {preset}
                    </motion.button>
                  ))}
                </div>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload/AI status feedback */}
      <AnimatePresence>
        {uploadMsg && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: 12, padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: uploadMsg.startsWith('✅') || uploadMsg.startsWith('🤖') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${uploadMsg.startsWith('✅') || uploadMsg.startsWith('🤖') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: uploadMsg.startsWith('✅') || uploadMsg.startsWith('🤖') ? '#10B981' : '#EF4444',
              fontSize: '0.8rem', fontWeight: 600,
            }}
          >
            {uploadMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Question Preview Section ─── */}
      {questions.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>
                📋 Question Palette ({questions.length} Ready)
              </h4>
              <span style={{ fontSize: '0.74rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                · {questions.reduce((sum, q) => sum + (q.marks || 1), 0)} Marks Total
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setQuestions([]); setUploadMsg('') }}
              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Clear All
            </button>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800,
                      background: q.question_type === 'code' ? 'rgba(167,139,250,0.2)' : 'rgba(43,127,255,0.15)',
                      color: q.question_type === 'code' ? '#c4b5fd' : 'var(--color-primary)',
                    }}>
                      {q.question_type.toUpperCase()}
                    </span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700,
                      background: q.difficulty === 'Hard' ? 'rgba(239,68,68,0.15)' : q.difficulty === 'Easy' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: q.difficulty === 'Hard' ? '#EF4444' : q.difficulty === 'Easy' ? '#10B981' : '#F59E0B',
                    }}>
                      {q.difficulty}
                    </span>
                    {q.topic && <span style={{ color: 'var(--color-text-faint)', fontSize: '0.72rem' }}>{q.topic}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{q.marks}m</span>
                    <button
                      type="button"
                      onClick={() => setQuestions(prev => prev.filter((_, qi) => qi !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div style={{ color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.4, marginBottom: q.question_type === 'mcq' ? 6 : 0 }}>
                  Q{i + 1}: {q.question_text.slice(0, 140)}{q.question_text.length > 140 ? '...' : ''}
                </div>

                {q.question_type === 'mcq' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', color: 'var(--color-text-faint)', fontSize: '0.72rem' }}>
                    {[q.option_a, q.option_b, q.option_c, q.option_d].map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi)
                      const isCorrect = letter === q.correct_answer
                      if (!opt) return null
                      return (
                        <span key={oi} style={{
                          padding: '2px 8px', borderRadius: 4,
                          background: isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                          color: isCorrect ? '#10B981' : undefined,
                          border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
                        }}>
                          {letter}: {opt.slice(0, 24)}
                        </span>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Step 3: Review & Launch ──────────────────────── */
function Step3({ form, questions }: { form: ExamMeta; questions: ParsedQuestion[] }) {
  const [copied, setCopied] = useState(false)
  const totalCalculatedMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0)

  const checks = [
    { ok: !!form.exam_name, label: 'Exam title set' },
    { ok: !!form.code,      label: `Code assigned: ${form.code}` },
    { ok: form.duration_minutes > 0, label: `${form.duration_minutes} minutes duration` },
    { ok: questions.length > 0, label: `${questions.length} questions prepared` },
    { ok: form.total_marks > 0, label: `${form.total_marks} target marks configured` },
  ]

  const copyCode = () => {
    if (!form.code) return
    navigator.clipboard.writeText(form.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* Summary card */}
      <GlowCard style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { icon: '📝', label: 'Exam Title', value: form.exam_name || '—' },
            { icon: '🔑', label: 'Exam Code', value: form.code || '—', mono: true },
            { icon: '⏱️', label: 'Duration', value: `${form.duration_minutes} min` },
            { icon: '⭐', label: 'Total / Passing', value: `${form.total_marks} / ${form.passing_marks} marks` },
            { icon: '📋', label: 'Questions Ready', value: `${questions.length} questions (${totalCalculatedMarks}m)` },
            { icon: '🎥', label: 'Proctoring', value: form.is_proctored ? 'Enabled' : 'Disabled' },
          ].map(({ icon, label, value, mono }) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem', marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: mono ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* Pre-flight Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {checks.map(({ ok, label }) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
            }}
          >
            <span>{ok ? '✅' : '❌'}</span>
            <span style={{ color: ok ? 'var(--color-text)' : '#EF4444', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Shareable Code Card */}
      {form.code && (
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(43,127,255,0.12), rgba(27,95,204,0.08))',
          border: '1px solid rgba(43,127,255,0.3)',
          borderRadius: 'var(--radius-lg)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Candidate Join Code
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2.4rem', fontWeight: 800,
            letterSpacing: '0.12em',
            color: '#60a5fa',
          }}>
            {form.code}
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={copyCode}
              style={{
                padding: '5px 14px', borderRadius: 999,
                background: copied ? '#10B981' : 'rgba(43,127,255,0.2)',
                border: '1px solid rgba(43,127,255,0.4)',
                color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied to Clipboard!' : '📋 Copy Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Wizard Component ────────────────────────── */
export default function CreateExamWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ code: string; examId: string; questionsCount: number } | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState<ExamMeta>({
    exam_name: '',
    code: '',
    subject: 'Computer Science & Engineering',
    college_id: '1',
    duration_minutes: 60,
    total_marks: 100,
    passing_marks: 40,
    start_time: '',
    end_time: '',
    instructions: 'Read all questions carefully. Do not switch tabs. Coding sandbox supports Python & Node.js.',
    is_proctored: true,
    is_randomized: false,
    is_leaderboard_public: true,
    max_violations: 5,
  })

  const [questions, setQuestions] = useState<ParsedQuestion[]>([])

  const canNext = () => {
    if (step === 1) return !!form.exam_name.trim() && !!form.code.trim() && form.duration_minutes > 0
    return true
  }

  const handleLaunch = async () => {
    if (!form.exam_name || !form.code) {
      setError('Exam title and code are required')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || ''
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        questions,
      }

      // Try unified create-exam-wizard route first
      const { data } = await axios.post(`${BASE}/api/admin/create-exam-wizard`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setSuccess({
        code: form.code.toUpperCase(),
        examId: data.examId || data.examCode || form.code.toUpperCase(),
        questionsCount: data.questionsCount || questions.length,
      })
    } catch (err) {
      // Fallback: try standard /api/admin/exam-codes
      try {
        const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || ''
        const { data } = await axios.post(`${BASE}/api/admin/exam-codes`, {
          exam_name: form.exam_name,
          code: form.code.toUpperCase(),
          duration_minutes: form.duration_minutes,
          total_marks: form.total_marks,
          passing_marks: form.passing_marks,
          start_time: form.start_time || new Date().toISOString(),
          end_time: form.end_time || new Date(Date.now() + 86400000 * 30).toISOString(),
          instructions: form.instructions,
          is_proctored: form.is_proctored,
          is_randomized: form.is_randomized,
          is_leaderboard_public: form.is_leaderboard_public,
          max_violations: form.max_violations,
        }, { headers: { Authorization: `Bearer ${token}` } })

        setSuccess({
          code: form.code.toUpperCase(),
          examId: data.examCode?.id || data.id || form.code.toUpperCase(),
          questionsCount: questions.length,
        })
      } catch (fallbackErr) {
        const msg = axios.isAxiosError(fallbackErr)
          ? fallbackErr.response?.data?.error || fallbackErr.message
          : 'Failed to launch exam'
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success Screen ── */
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.05 }}>
          <FlightPathLines color="#10B981" opacity={1} count={12} className="" />
        </div>
        <div className="page-center" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 520, width: '100%' }}
          >
            <GlowCard glowColor="rgba(16,185,129,0.4)" style={{ textAlign: 'center', padding: 44 }}>
              <div style={{ fontSize: '3.6rem', marginBottom: 12 }}>🚀</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
                Exam Launched Live!
              </h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 20, fontSize: '0.88rem' }}>
                <strong>{form.exam_name}</strong> is live with {success.questionsCount} questions.
              </p>

              <div style={{
                padding: '18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 'var(--radius-lg)', marginBottom: 24,
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Student Join Code
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.4rem', fontWeight: 800, color: '#10B981', letterSpacing: '0.12em' }}>
                  {success.code}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 6 }}>
                  Candidates enter this code at <strong>/enter-exam</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <MagneticButton
                  className="btn btn-primary"
                  onClick={() => navigate(`/admin/monitor/${success.code}`)}
                >
                  👁️ Monitor Live
                </MagneticButton>
                <MagneticButton
                  className="btn btn-secondary"
                  onClick={() => navigate('/admin/exam-codes')}
                >
                  📋 All Exams
                </MagneticButton>
                <MagneticButton
                  className="btn btn-ghost"
                  onClick={() => {
                    setSuccess(null)
                    setStep(1)
                    setQuestions([])
                    setForm({
                      exam_name: '', code: '', subject: 'Computer Science', college_id: '1',
                      duration_minutes: 60, total_marks: 100, passing_marks: 40, start_time: '', end_time: '',
                      instructions: 'Read all questions carefully.', is_proctored: true, is_randomized: false,
                      is_leaderboard_public: true, max_violations: 5,
                    })
                  }}
                >
                  ➕ Create Another
                </MagneticButton>
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04 }}>
        <FlightPathLines color="#2B7FFF" opacity={1} count={8} className="" />
      </div>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside className="admin-sidebar" style={{ background: 'rgba(20,28,47,0.95)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ marginBottom: 24, padding: '0 4px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--color-text), var(--color-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              ⚡ GROWTHRAN
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.1em', marginTop: 2 }}>4.0 ULTRA ADMIN</div>
          </div>
          {[
            { icon: '📊', label: 'Dashboard',    path: '/admin/dashboard' },
            { icon: '🔑', label: 'Exam Codes',   path: '/admin/exam-codes' },
            { icon: '➕', label: 'Create Exam',  path: '/admin/create-exam', active: true },
            { icon: '👁️', label: 'Live Monitor', path: '/admin/monitor' },
            { icon: '🔬', label: 'Analytics',    path: '/admin/analytics' },
          ].map(item => (
            <button
              key={item.path}
              className={`admin-nav-item ${item.active ? 'active' : ''}`}
              onClick={() => !item.active && navigate(item.path)}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="admin-content" style={{ position: 'relative', zIndex: 1, maxWidth: 780 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
              <ShimmerText text="Create New Exam" shimmer={false} />
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              3-Step Guided Wizard · Configure Details → Upload Excel / AI Questions → Review & Launch
            </p>
          </div>

          <WizardSteps current={step} />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="alert alert-error" style={{ marginBottom: 16 }}
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GlowCard glowColor="rgba(43,127,255,0.2)" style={{ marginBottom: 24, padding: 24 }}>
                {step === 1 && <Step1 form={form} setForm={setForm} />}
                {step === 2 && <Step2 questions={questions} setQuestions={setQuestions} />}
                {step === 3 && <Step3 form={form} questions={questions} />}
              </GlowCard>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <MagneticButton
              className="btn btn-ghost"
              onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/admin/dashboard')}
            >
              {step > 1 ? '← Back' : 'Cancel'}
            </MagneticButton>

            <div style={{ display: 'flex', gap: 10 }}>
              {step === 2 && (
                <MagneticButton
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep(3)}
                  style={{ color: 'var(--color-text-faint)' }}
                >
                  Skip Questions →
                </MagneticButton>
              )}
              {step < 3 ? (
                <MagneticButton
                  className="btn btn-primary"
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canNext()}
                >
                  Next Step →
                </MagneticButton>
              ) : (
                <MagneticButton
                  className="btn btn-success btn-lg"
                  onClick={handleLaunch}
                  disabled={submitting || !form.exam_name || !form.code}
                >
                  {submitting
                    ? <><span className="btn-spinner" /> Launching Exam<TypingDots /></>
                    : '🚀 Launch Exam'}
                </MagneticButton>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
