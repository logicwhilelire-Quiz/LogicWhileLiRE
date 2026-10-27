import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import GlowCard from '../../components/3d/GlowCard'
import MagneticButton from '../../components/3d/MagneticButton'
import ShimmerText from '../../components/3d/ShimmerText'
import FlightPathLines from '../../components/3d/FlightPathLines'
import TypingDots from '../../components/3d/TypingDots'
import AdminSidebar from '../../components/layout/AdminSidebar'
import { API_BASE_URL } from '../../lib/config'

const BASE = API_BASE_URL

/* ── Dynamic Study Year Derivation (Zero Hardcoding) ── */
export function deriveStudyYearClient(passoutYear: number, currentDate: Date = new Date()) {
  const currentMonth = currentDate.getMonth() // 0-11
  const currentCalYear = currentDate.getFullYear()
  const academicStartYear = currentMonth >= 6 ? currentCalYear : currentCalYear - 1
  const academicEndYear = academicStartYear + 1
  const academicYearStr = `${academicStartYear}-${String(academicEndYear).slice(-2)}`
  
  const yearsRemaining = passoutYear - academicEndYear
  const rawStudyYear = 4 - yearsRemaining

  if (rawStudyYear > 4) {
    return { studyYear: 5, academicYearStr, label: 'Alumni / Graduated', yearsRemaining }
  }
  if (rawStudyYear < 1) {
    return { studyYear: 0, academicYearStr, label: 'Prospective / Incoming', yearsRemaining }
  }

  const studyYear = Math.min(Math.max(rawStudyYear, 1), 4)
  
  const labels: Record<number, string> = {
    1: '1st Year (Freshman)',
    2: '2nd Year (Sophomore)',
    3: '3rd Year (Junior)',
    4: '4th Year (Final / Senior)',
  }
  const label = labels[studyYear] || `Year ${studyYear}`
  
  return { studyYear, academicYearStr, label, yearsRemaining }
}

/* ── Types ─────────────────────────────────────────── */
export interface ExamMeta {
  college_id: string | number
  branch: string
  passout_year: number
  section_ids: string[]
  section_id: string
  batch_id: string
  assigned_faculty_id: string
  assigned_inspector_id: string
  exam_name: string
  code: string
  subject: string
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

interface CollegeOption {
  id: number | string
  college_name: string
  college_code: string
  city?: string
}

interface StaffOption {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

/* ── Wizard Steps (Strict Flow: College > Branch > Passout Year > Section/Batch > Question Paper) ── */
const STEPS = [
  { id: 1, label: 'Target College', icon: '🏛️' },
  { id: 2, label: 'Target Branch',  icon: '🎓' },
  { id: 3, label: 'Passout Year',   icon: '📅' },
  { id: 4, label: 'Section & Batch',icon: '👥' },
  { id: 5, label: 'Question Paper', icon: '📝' },
  { id: 6, label: 'Review & Launch',icon: '🚀' },
]

const STANDARD_BRANCHES = [
  { code: 'CSE', name: 'Computer Science & Engineering', icon: '💻' },
  { code: 'CSM', name: 'Artificial Intelligence & Machine Learning', icon: '🤖' },
  { code: 'CSD', name: 'Data Science & Analytics', icon: '📊' },
  { code: 'CSBS', name: 'Computer Science & Business Systems', icon: '💼' },
  { code: 'IT',  name: 'Information Technology', icon: '🌐' },
  { code: 'AIDS', name: 'Artificial Intelligence & Data Science', icon: '🧠' },
  { code: 'ECE', name: 'Electronics & Communication', icon: '📡' },
  { code: 'EEE', name: 'Electrical & Electronics', icon: '⚡' },
  { code: 'MECH', name: 'Mechanical Engineering', icon: '⚙️' },
  { code: 'CIVIL', name: 'Civil Engineering', icon: '🏗️' },
  { code: 'CSIT', name: 'Computer Science & Info Tech', icon: '🖥️' },
  { code: 'MCA', name: 'Master of Computer Applications', icon: '🎓' },
  { code: 'MBA', name: 'Master of Business Administration', icon: '📈' },
]

const STANDARD_SECTIONS = ['A', 'B', 'C', 'D', 'E']
const STANDARD_BATCHES = ['All Batches', 'Batch 1', 'Batch 2', 'Batch 3']

/* ── Step Indicator ───────────────────────────────── */
function WizardSteps({ current }: { current: number }) {
  return (
    <div className="wizard-steps" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 8 }}>
      {STEPS.map((step, i) => (
        <div key={step.id} className="wizard-step" style={{ flex: '1 0 auto', display: 'flex', alignItems: 'center', minWidth: 120 }}>
          <motion.div
            className={`wizard-step-num ${current === step.id ? 'active' : current > step.id ? 'done' : ''}`}
            animate={current === step.id ? {
              boxShadow: ['0 0 0 0 rgba(43,127,255,0)', '0 0 0 8px rgba(43,127,255,0.2)', '0 0 0 0 rgba(43,127,255,0)'],
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display, sans-serif)', fontSize: '0.85rem', fontWeight: 700,
              border: '2px solid',
              borderColor: current > step.id ? '#10B981'
                : current === step.id ? 'var(--color-primary, #2b7fff)' : 'var(--color-border, #334155)',
              background: current > step.id ? 'rgba(16,185,129,0.15)'
                : current === step.id ? 'var(--color-primary, #2b7fff)' : 'transparent',
              color: current > step.id ? '#10B981'
                : current === step.id ? '#fff' : 'var(--color-text-faint, #64748b)',
              flexShrink: 0, transition: 'all 0.3s ease', marginRight: 10,
            }}
          >
            {current > step.id ? '✓' : step.icon}
          </motion.div>
          <div style={{ flex: 1, minWidth: 70 }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 700,
              color: current >= step.id ? 'var(--color-text, #f8fafc)' : 'var(--color-text-faint, #64748b)',
              whiteSpace: 'nowrap'
            }}>
              {step.label}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-faint, #64748b)' }}>Step {step.id}</div>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: 24, height: 2, margin: '0 8px',
              background: current > step.id
                ? 'linear-gradient(90deg, #10B981, rgba(16,185,129,0.3))'
                : 'var(--color-border, #334155)',
              borderRadius: 999, flexShrink: 0,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Step 1: Target College ───────────────────────── */
function Step1College({
  colleges,
  selectedCollegeId,
  onSelect,
}: {
  colleges: CollegeOption[]
  selectedCollegeId: string | number
  onSelect: (id: string | number) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = colleges.filter(c =>
    c.college_name.toLowerCase().includes(search.toLowerCase()) ||
    c.college_code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          🏛️ Step 1: Select Target College
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          This assessment will only be visible to verified students enrolled in the selected institution.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search college by name or code (e.g. UNIV)..."
          className="form-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
        />
      </div>

      {colleges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(30,41,59,0.3)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏛️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>No Colleges Found in Database</div>
          <p style={{ color: '#94a3b8', fontSize: '0.86rem', maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.5 }}>
            The exam targeting wizard requires at least one registered institutional campus. No colleges have been created yet. Please create your college in the Colleges portal first.
          </p>
          <a
            href="/admin/colleges"
            style={{
              display: 'inline-block',
              padding: '10px 22px',
              borderRadius: 8,
              background: 'var(--color-primary, #2b7fff)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
            }}
          >
            🏛️ Go to Colleges &amp; Institutions &rarr;
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(c => {
            const isSelected = String(c.id) === String(selectedCollegeId)
            return (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelect(c.id)}
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--color-primary, #2b7fff)' : '1px solid var(--color-border, #334155)',
                  background: isSelected ? 'rgba(43,127,255,0.12)' : 'rgba(30,41,59,0.4)',
                  boxShadow: isSelected ? '0 0 20px rgba(43,127,255,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    fontSize: '0.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                    background: isSelected ? 'var(--color-primary, #2b7fff)' : 'rgba(255,255,255,0.08)',
                    color: isSelected ? '#fff' : 'var(--color-text-muted, #94a3b8)',
                    fontFamily: 'monospace'
                  }}>
                    {c.college_code}
                  </span>
                  {isSelected && <span style={{ color: '#10B981', fontWeight: 800, fontSize: '0.85rem' }}>✓ Selected</span>}
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                  {c.college_name}
                </div>
                {c.city && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint, #64748b)' }}>
                    📍 {c.city}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Step 2: Target Branch ────────────────────────── */
function Step2Branch({
  selectedBranch,
  onSelect,
}: {
  selectedBranch: string
  onSelect: (branch: string) => void
}) {
  const [customBranch, setCustomBranch] = useState('')

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          🎓 Step 2: Select Academic Branch
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          Only students belonging to this branch can discover or access this examination.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        {STANDARD_BRANCHES.map(b => {
          const isSelected = selectedBranch.toUpperCase() === b.code.toUpperCase()
          return (
            <motion.div
              key={b.code}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(b.code)}
              style={{
                padding: '16px 18px',
                borderRadius: 12,
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--color-primary, #2b7fff)' : '1px solid var(--color-border, #334155)',
                background: isSelected ? 'rgba(43,127,255,0.12)' : 'rgba(30,41,59,0.4)',
                boxShadow: isSelected ? '0 0 16px rgba(43,127,255,0.2)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.4rem' }}>{b.icon}</span>
                <span style={{
                  fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800,
                  color: isSelected ? 'var(--color-primary, #2b7fff)' : '#f8fafc'
                }}>
                  {b.code}
                </span>
                {isSelected && <span style={{ marginLeft: 'auto', color: '#10B981', fontWeight: 800 }}>✓</span>}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.4 }}>
                {b.name}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Custom Branch Input */}
      <div style={{ padding: '14px 18px', background: 'rgba(15,23,42,0.6)', border: '1px dashed var(--color-border, #334155)', borderRadius: 10 }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>
          Or Enter Custom Branch Code:
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="e.g. AIDS, CSIT, ROBOTICS"
            className="form-input"
            value={customBranch}
            onChange={e => setCustomBranch(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase', fontFamily: 'monospace', maxWidth: 260 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (customBranch.trim()) onSelect(customBranch.trim())
            }}
          >
            Apply Custom Branch
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Step 3: Passout Year & Dynamic Study Year Preview ─ */
function Step3PassoutYear({
  passoutYear,
  onSelect,
}: {
  passoutYear: number
  onSelect: (year: number) => void
}) {
  const currentCalYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const active4thYearPassout = currentMonth >= 6 ? currentCalYear + 1 : currentCalYear
  // Active undergrad cohorts (4th, 3rd, 2nd, 1st year)
  const candidateYears = [active4thYearPassout, active4thYearPassout + 1, active4thYearPassout + 2, active4thYearPassout + 3]
  const derived = deriveStudyYearClient(passoutYear)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          📅 Step 3: Passout Year &amp; Dynamic Study Year
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          The study year is derived automatically from passout_year and the current date. Nothing is stored hard-coded.
        </p>
      </div>

      {/* Year Selection Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {candidateYears.map(yr => {
          const isSelected = yr === passoutYear
          const yrDerived = deriveStudyYearClient(yr)
          return (
            <motion.div
              key={yr}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(yr)}
              style={{
                flex: '1 1 140px',
                padding: '16px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                border: isSelected ? '2px solid #10B981' : '1px solid var(--color-border, #334155)',
                background: isSelected ? 'rgba(16,185,129,0.12)' : 'rgba(30,41,59,0.4)',
                boxShadow: isSelected ? '0 0 20px rgba(16,185,129,0.2)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: isSelected ? '#10B981' : '#f8fafc' }}>
                {yr}
              </div>
              <div style={{ fontSize: '0.74rem', color: isSelected ? '#10B981' : 'var(--color-text-muted, #94a3b8)', fontWeight: 600, marginTop: 4 }}>
                {yrDerived.label}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Live Academic Calculation Badge */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.85) 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '1.3rem' }}>⚡</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981' }}>
            Automated Academic Year Derivation Engine
          </span>
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>
          Passout {passoutYear} → <span style={{ color: '#10B981' }}>{derived.label}</span> in Academic Session {derived.academicYearStr}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)', margin: 0, lineHeight: 1.5 }}>
          Formula: <code>4 - (passout_year - academic_end_year)</code>. Because collegiate academic calendars run July to June, passout {passoutYear} maps directly to Year {derived.studyYear} in session {derived.academicYearStr}.
          This ensures zero hardcoded year tables and perpetual freshness across calendar transitions.
        </p>
      </div>
    </div>
  )
}

/* ── Step 4: Section & Batch Targeting ────────────── */
function Step4SectionBatch({
  selectedSections,
  selectedBatch,
  onToggleSection,
  onSelectAllSections,
  onSelectBatch,
}: {
  selectedSections: string[]
  selectedBatch: string
  onToggleSection: (sec: string) => void
  onSelectAllSections: () => void
  onSelectBatch: (batch: string) => void
}) {
  const isAllSelected = STANDARD_SECTIONS.every(s => selectedSections.includes(s))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          👥 Step 4: Section &amp; Batch Eligibility
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          Target specific sections or batches. Students outside this target will receive an HTTP 404 Not Found response and cannot tell this exam exists.
        </p>
      </div>

      {/* Section Selection */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
            Target Sections *
          </label>
          <button
            type="button"
            onClick={onSelectAllSections}
            style={{
              background: 'none', border: 'none', color: 'var(--color-primary, #2b7fff)',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {isAllSelected ? 'Deselect All' : 'Select All Sections'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {STANDARD_SECTIONS.map(sec => {
            const isSelected = selectedSections.includes(sec)
            return (
              <motion.button
                key={sec}
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onToggleSection(sec)}
                style={{
                  width: 58, height: 58, borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: isSelected ? '2px solid var(--color-primary, #2b7fff)' : '1px solid var(--color-border, #334155)',
                  background: isSelected ? 'rgba(43,127,255,0.2)' : 'rgba(30,41,59,0.4)',
                  color: isSelected ? 'var(--color-primary, #2b7fff)' : '#f8fafc',
                  fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 16px rgba(43,127,255,0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{sec}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 600, opacity: 0.8 }}>Sec</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Batch Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: 10 }}>
          Target Batch (Optional Filter)
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {STANDARD_BATCHES.map(b => {
            const isSelected = selectedBatch === b || (b === 'All Batches' && !selectedBatch)
            return (
              <button
                key={b}
                type="button"
                onClick={() => onSelectBatch(b === 'All Batches' ? '' : b)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: isSelected ? '1px solid #10B981' : '1px solid var(--color-border, #334155)',
                  background: isSelected ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.3)',
                  color: isSelected ? '#10B981' : 'var(--color-text-muted, #94a3b8)',
                  fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {isSelected ? '✓ ' : ''}{b}
              </button>
            )
          })}
        </div>
      </div>

      {/* Security Privacy Callout */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 10,
        fontSize: '0.82rem',
        color: '#f8fafc',
        lineHeight: 1.5,
      }}>
        🛡️ <strong>Zero-Leakage Secrecy Rule:</strong> Students outside Sections [{selectedSections.join(', ')}] will see an empty state (<em>"No exam available"</em>). Any attempt to probe this exam code directly via REST or Socket will return an indistinguishable <strong>HTTP 404 Not Found</strong>.
      </div>
    </div>
  )
}

/* ── Step 5: Question Paper, Details & Allocation ─── */
function Step5QuestionPaper({
  form,
  setForm,
  questions,
  setQuestions,
  staffList,
  colleges,
}: {
  form: ExamMeta
  setForm: React.Dispatch<React.SetStateAction<ExamMeta>>
  questions: ParsedQuestion[]
  setQuestions: React.Dispatch<React.SetStateAction<ParsedQuestion[]>>
  staffList: StaffOption[]
  colleges: CollegeOption[]
}) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedCollege = colleges.find(c => String(c.id) === String(form.college_id))
  const collegeCode = (selectedCollege?.college_code || form.branch || 'CAMPUS').toUpperCase().replace(/[^A-Z0-9]/g, '')

  const generateRandomCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let rand = ''
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm(prev => ({ ...prev, code: `GR-${collegeCode}-${rand}` }))
  }

  useEffect(() => {
    if (!form.code) {
      generateRandomCode()
    }
  }, [form.college_id])

  const downloadSampleTemplate = () => {
    const headers = 'question_text,type,option1 | option2 | option3 | option4,correct_index,marks\n'
    const sampleRows = [
      '"What is the average time complexity of searching in a Hash Map?",mcq,"O(1) | O(N) | O(log N) | O(N log N)",0,2',
      '"Which scheduling algorithm selects the process with the shortest execution time?",mcq,"Round Robin | Shortest Job First | Priority Scheduling | Multi-level Queue",1,2',
      '"Write a function to check if an input string is a valid palindrome.",code,"Submission | - | - | -",0,10',
    ].join('\n')
    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'questions_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parseCSVText = (text: string): ParsedQuestion[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length < 2) return []
    const parsed: ParsedQuestion[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim())
      if (parts.length >= 2) {
        const [qText, qType, optionsRaw = '', correctIdx = '0', marks = '2'] = parts
        const opts = optionsRaw.split('|').map(o => o.trim())
        const cIdx = parseInt(correctIdx, 10) || 0
        const correctLetter = ['A', 'B', 'C', 'D'][cIdx] || 'A'
        parsed.push({
          question_text: qText,
          option_a: opts[0] || 'Option A',
          option_b: opts[1] || 'Option B',
          option_c: opts[2] || 'Option C',
          option_d: opts[3] || 'Option D',
          correct_answer: correctLetter,
          marks: Number(marks) || 2,
          difficulty: 'medium',
          topic: form.subject || 'Engineering',
          question_type: qType === 'code' ? 'code' : 'mcq',
        })
      }
    }
    return parsed
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      if (text) {
        const parsed = parseCSVText(text)
        if (parsed.length > 0) {
          setQuestions(prev => [...prev, ...parsed])
        }
      }
    }
    reader.readAsText(file)
  }

  const facultyStaff = staffList.filter(s => s.role === 'faculty' || s.role === 'super_admin' || s.role === 'admin')
  const inspectorStaff = staffList.filter(s => s.role === 'inspector' || s.role === 'super_admin' || s.role === 'admin')

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          📝 Step 5: Question Paper &amp; Staff Allocation
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          Configure assessment parameters, allocate question paper to section faculty, assign an inspector, and prepare questions.
        </p>
      </div>

      {/* Meta Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Exam Title *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. LogicWhileLiRE Section A Engineering Qualifier"
            value={form.exam_name}
            onChange={e => setForm(p => ({ ...p, exam_name: e.target.value }))}
            required
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="form-label" style={{ margin: 0 }}>Exam Code *</label>
            <button
              type="button"
              onClick={generateRandomCode}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary, #2b7fff)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🎲 Auto Generate
            </button>
          </div>
          <input
            type="text"
            className="form-input"
            value={form.code}
            onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. GR-CRT-2026"
            style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            required
          />
        </div>

        <div>
          <label className="form-label">Subject / Domain</label>
          <input
            type="text"
            className="form-input"
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="e.g. Data Structures & Algorithms"
          />
        </div>

        <div>
          <label className="form-label">Duration (Minutes)</label>
          <input
            type="number"
            className="form-input"
            value={form.duration_minutes}
            onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
            min={10}
            max={360}
          />
        </div>

        <div>
          <label className="form-label">Total / Passing Marks</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              className="form-input"
              value={form.total_marks}
              onChange={e => setForm(p => ({ ...p, total_marks: Number(e.target.value) }))}
              placeholder="Total"
            />
            <input
              type="number"
              className="form-input"
              value={form.passing_marks}
              onChange={e => setForm(p => ({ ...p, passing_marks: Number(e.target.value) }))}
              placeholder="Pass"
            />
          </div>
        </div>
      </div>

      {/* Staff Allocation Section (Requirement 2 & 3) */}
      <div style={{
        padding: '18px 20px',
        background: 'rgba(30,41,59,0.5)',
        border: '1px solid var(--color-border, #334155)',
        borderRadius: 12,
        marginBottom: 24,
      }}>
        <h4 style={{ fontSize: '0.96rem', fontWeight: 800, margin: '0 0 12px 0', color: '#f8fafc' }}>
          🛡️ Role &amp; Permission Allocation (RBAC Scoped)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="form-label">Allocate Question Paper to Faculty Member</label>
            <select
              className="form-input"
              value={form.assigned_faculty_id}
              onChange={e => setForm(p => ({ ...p, assigned_faculty_id: e.target.value }))}
            >
              <option value="">Unassigned (Admin Managed)</option>
              {facultyStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email}) {s.department ? `· ${s.department}` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint, #64748b)', marginTop: 4 }}>
              Faculty member can only view and manage papers allocated to their section.
            </div>
          </div>

          <div>
            <label className="form-label">Assign Exam Inspector</label>
            <select
              className="form-input"
              value={form.assigned_inspector_id}
              onChange={e => setForm(p => ({ ...p, assigned_inspector_id: e.target.value }))}
            >
              <option value="">Unassigned (Super Admin)</option>
              {inspectorStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint, #64748b)', marginTop: 4 }}>
              Inspector will land straight on the live leaderboard with start/stop controls for this exam.
            </div>
          </div>
        </div>
      </div>

      {/* Question Upload Dropzone */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>
            Question Paper Questions ({questions.length} prepared)
          </label>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
          >
            📥 Download Sample Template (.csv)
          </button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0])
          }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: dragging ? '2px dashed var(--color-primary, #2b7fff)' : '2px dashed var(--color-border, #334155)',
            borderRadius: 12,
            padding: '24px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(43,127,255,0.1)' : 'rgba(15,23,42,0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            type="file"
            ref={fileRef}
            accept=".csv, .xlsx, .xls"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
            }}
          />
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>📥</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
            Click or drag &amp; drop Question Paper CSV / Excel
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint, #64748b)' }}>
            Supports MCQ (4 options) and Coding challenge test cases
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'is_proctored', label: 'AI Face Proctoring', icon: '🎥' },
          { key: 'is_randomized', label: 'Randomize Questions', icon: '🔀' },
          { key: 'is_leaderboard_public', label: 'Live Public Leaderboard', icon: '🏆' },
        ].map(t => (
          <label
            key={t.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem',
              fontWeight: 600, color: '#f8fafc', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border, #334155)'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(form[t.key as keyof ExamMeta])}
              onChange={e => setForm(p => ({ ...p, [t.key]: e.target.checked }))}
            />
            <span>{t.icon} {t.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/* ── Step 6: Review & Launch ──────────────────────── */
function Step6Review({
  form,
  colleges,
  questions,
  staffList,
}: {
  form: ExamMeta
  colleges: CollegeOption[]
  questions: ParsedQuestion[]
  staffList: StaffOption[]
}) {
  const selectedCollege = colleges.find(c => String(c.id) === String(form.college_id))
  const derived = deriveStudyYearClient(form.passout_year)
  const allocatedFaculty = staffList.find(s => String(s.id) === String(form.assigned_faculty_id))
  const assignedInspector = staffList.find(s => String(s.id) === String(form.assigned_inspector_id))

  const checks = [
    { ok: !!form.college_id, label: `College selected: ${selectedCollege?.college_code || 'Yes'}` },
    { ok: !!form.branch, label: `Branch targeted: ${form.branch}` },
    { ok: form.passout_year > 2000, label: `Passout Year ${form.passout_year} (${derived.label})` },
    { ok: form.section_ids.length > 0, label: `Targeted Sections: ${form.section_ids.join(', ')}` },
    { ok: !!form.exam_name, label: `Exam Name: ${form.exam_name}` },
    { ok: !!form.code, label: `Exam Code: ${form.code}` },
  ]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
          🚀 Step 6: Review &amp; Launch Section-Targeted Exam
        </h3>
        <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>
          Verify the hierarchy targeting and security parameters before publishing.
        </p>
      </div>

      {/* Comprehensive Targeting Overview Card */}
      <div style={{
        padding: '22px 24px',
        background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1px solid rgba(43,127,255,0.3)',
        borderRadius: 14,
        marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Target College
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
              🏛️ {selectedCollege?.college_name || 'All Institutional Units'} ({selectedCollege?.college_code || 'ALL'})
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Academic Target
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>
              🎓 {form.branch} · Passout {form.passout_year}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>
              Derived Study Year: {derived.label}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Sections &amp; Batches
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>
              👥 Section(s): {form.section_ids.join(', ') || 'A'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted, #94a3b8)' }}>
              Batch: {form.batch_id || 'All Batches'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Staff Allocation
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
              Faculty: {allocatedFaculty?.name || 'Unallocated'}
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
              Inspector: {assignedInspector?.name || 'Super Admin'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Exam Details
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
              {form.exam_name}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted, #94a3b8)' }}>
              {form.duration_minutes} mins · {questions.length} questions · {form.total_marks} marks
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-faint, #64748b)', fontWeight: 700 }}>
              Join Passcode
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#60a5fa' }}>
              {form.code}
            </div>
          </div>
        </div>
      </div>

      {/* Pre-flight Checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8, marginBottom: 20 }}>
        {checks.map(({ ok, label }) => (
          <div
            key={label}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: 8,
              background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            <span>{ok ? '✅' : '❌'}</span>
            <span style={{ color: ok ? '#f8fafc' : '#f87171', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Wizard Component ────────────────────────── */
export default function CreateExamPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ code: string; examId: string; questionsCount: number } | null>(null)
  const [error, setError] = useState('')

  // Hierarchy reference data
  const [colleges, setColleges] = useState<CollegeOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])

  const defaultPassoutYear = (() => {
    const d = new Date()
    return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear()
  })()

  const [form, setForm] = useState<ExamMeta>({
    college_id: 0,
    branch: 'CSE',
    passout_year: defaultPassoutYear,
    section_ids: ['A'],
    section_id: 'A',
    batch_id: '',
    assigned_faculty_id: '',
    assigned_inspector_id: '',
    exam_name: '',
    code: '',
    subject: 'Computer Science & Engineering',
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

  // Load institutional colleges and staff on mount
  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || ''
      if (!token) {
        navigate('/admin');
        return;
      }
      try {
        const colRes = await axios.get(`${BASE}/api/colleges`)
        if (colRes.data?.colleges && colRes.data.colleges.length > 0) {
          setColleges(colRes.data.colleges)
          setForm(p => ({
            ...p,
            college_id: colRes.data.colleges[0].id
          }))
        } else {
          setColleges([])
          setForm(p => ({ ...p, college_id: 0 }))
        }
      } catch {
        setColleges([])
      }

      try {
        const staffRes = await axios.get(`${BASE}/api/admin/staff`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (staffRes.data?.staff && staffRes.data.staff.length > 0) {
          setStaffList(staffRes.data.staff)
        } else {
          setStaffList([])
        }
      } catch {
        setStaffList([])
      }
    }
    loadData()
  }, [])

  const canNext = () => {
    if (step === 1) return colleges.length > 0 && !!form.college_id
    if (step === 2) return !!form.branch
    if (step === 3) return form.passout_year > 2000
    if (step === 4) return form.section_ids.length > 0
    if (step === 5) return !!form.exam_name.trim() && !!form.code.trim() && form.duration_minutes > 0
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
        college_id: Number(form.college_id),
        branch: form.branch.toUpperCase(),
        passout_year: Number(form.passout_year),
        section_id: form.section_ids[0] || 'A',
        section_ids: form.section_ids,
        batch_id: form.batch_id || null,
        assigned_faculty_id: form.assigned_faculty_id || null,
        assigned_inspector_id: form.assigned_inspector_id || null,
        questions,
      }

      // Submit to unified create-exam-wizard route
      const { data } = await axios.post(`${BASE}/api/admin/create-exam-wizard`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setSuccess({
        code: form.code.toUpperCase(),
        examId: data.examId || data.examCode || form.code.toUpperCase(),
        questionsCount: data.questionsCount || questions.length,
      })
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to launch section-targeted exam'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success Screen ── */
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg, #050814)', position: 'relative' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.05 }}>
          <FlightPathLines color="#10B981" opacity={1} count={12} className="" />
        </div>
        <div className="page-center" style={{ position: 'relative', zIndex: 1, padding: '40px 20px' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 540, width: '100%', margin: '0 auto' }}
          >
            <GlowCard glowColor="rgba(16,185,129,0.4)" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '3.6rem', marginBottom: 12 }}>🚀</div>
              <h2 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: '1.8rem', fontWeight: 800, marginBottom: 6, color: '#f8fafc' }}>
                Section Exam Launched!
              </h2>
              <p style={{ color: 'var(--color-text-muted, #94a3b8)', marginBottom: 20, fontSize: '0.88rem' }}>
                <strong>{form.exam_name}</strong> is live for Section(s) [{form.section_ids.join(', ')}] with {success.questionsCount} questions.
              </p>

              <div style={{
                padding: '20px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 12, marginBottom: 24,
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint, #64748b)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Targeted Candidate Code
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '2.4rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.12em' }}>
                  {success.code}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: 6 }}>
                  Target: <strong>{form.branch}</strong> · Passout <strong>{form.passout_year}</strong> · Section <strong>{form.section_ids.join(', ')}</strong>
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
                  🔑 All Exam Codes
                </MagneticButton>
                <MagneticButton
                  className="btn btn-ghost"
                  onClick={() => {
                    setSuccess(null)
                    setStep(1)
                    setQuestions([])
                    setForm(p => ({ ...p, exam_name: '', code: '' }))
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg, #050814)', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04 }}>
        <FlightPathLines color="#2B7FFF" opacity={1} count={8} className="" />
      </div>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <AdminSidebar activeTab="create" />


        {/* Main Wizard Area */}
        <main className="admin-content" style={{ position: 'relative', zIndex: 1, maxWidth: 840, width: '100%', padding: '32px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: '1.8rem', fontWeight: 800, marginBottom: 4, color: '#f8fafc' }}>
              <ShimmerText text="Create Section-Targeted Exam" shimmer={false} />
            </h1>
            <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.88rem', margin: 0 }}>
              Step-by-step targeting wizard: College → Branch → Passout Year → Section/Batch → Question Paper &amp; Staff Allocation
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
              transition={{ duration: 0.25 }}
            >
              <GlowCard glowColor="rgba(43,127,255,0.2)" style={{ marginBottom: 24, padding: 28 }}>
                {step === 1 && (
                  <Step1College
                    colleges={colleges}
                    selectedCollegeId={form.college_id}
                    onSelect={id => setForm(p => ({ ...p, college_id: id }))}
                  />
                )}
                {step === 2 && (
                  <Step2Branch
                    selectedBranch={form.branch}
                    onSelect={branch => setForm(p => ({ ...p, branch }))}
                  />
                )}
                {step === 3 && (
                  <Step3PassoutYear
                    passoutYear={form.passout_year}
                    onSelect={passout_year => setForm(p => ({ ...p, passout_year }))}
                  />
                )}
                {step === 4 && (
                  <Step4SectionBatch
                    selectedSections={form.section_ids}
                    selectedBatch={form.batch_id}
                    onToggleSection={sec => {
                      setForm(p => {
                        const exists = p.section_ids.includes(sec)
                        const nextSecs = exists
                          ? p.section_ids.filter(s => s !== sec)
                          : [...p.section_ids, sec]
                        return { ...p, section_ids: nextSecs, section_id: nextSecs[0] || 'A' }
                      })
                    }}
                    onSelectAllSections={() => {
                      const allSelected = STANDARD_SECTIONS.every(s => form.section_ids.includes(s))
                      setForm(p => ({
                        ...p,
                        section_ids: allSelected ? ['A'] : [...STANDARD_SECTIONS],
                        section_id: allSelected ? 'A' : 'A',
                      }))
                    }}
                    onSelectBatch={batch_id => setForm(p => ({ ...p, batch_id }))}
                  />
                )}
                {step === 5 && (
                  <Step5QuestionPaper
                    form={form}
                    setForm={setForm}
                    questions={questions}
                    setQuestions={setQuestions}
                    staffList={staffList}
                    colleges={colleges}
                  />
                )}
                {step === 6 && (
                  <Step6Review
                    form={form}
                    colleges={colleges}
                    questions={questions}
                    staffList={staffList}
                  />
                )}
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
              {step === 5 && questions.length === 0 && (
                <MagneticButton
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep(6)}
                  style={{ color: 'var(--color-text-faint, #64748b)' }}
                >
                  Skip Questions (Draft Paper) →
                </MagneticButton>
              )}
              {step < 6 ? (
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
                    : '🚀 Launch Section-Targeted Exam'}
                </MagneticButton>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
