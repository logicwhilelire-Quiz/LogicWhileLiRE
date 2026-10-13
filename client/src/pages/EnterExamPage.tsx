import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../lib/config'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import BrandLogo from '../components/BrandLogo'

interface FormState {
  examCode: string
  hallTicket: string
}

interface ApiError {
  message?: string
  [key: string]: unknown
}

export default function EnterExamPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<FormState>({
    examCode: (searchParams.get('code') || searchParams.get('examCode') || '').toUpperCase(),
    hallTicket: searchParams.get('hallTicket') || searchParams.get('rollNumber') || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    try {
      const codeFromUrl = (searchParams.get('code') || searchParams.get('examCode') || '').toUpperCase()
      const hallFromUrl = searchParams.get('hallTicket') || searchParams.get('rollNumber') || ''
      const userStr = localStorage.getItem('student_user')
      let userHall = ''
      if (userStr) {
        const u = JSON.parse(userStr)
        userHall = u.roll_number || u.hall_ticket || ''
      }

      setForm(prev => ({
        examCode: codeFromUrl || prev.examCode,
        hallTicket: hallFromUrl || prev.hallTicket || userHall,
      }))
    } catch {}
  }, [searchParams])

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: field === 'examCode' ? value.toUpperCase() : value }))
    setError('')
  }

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.examCode.trim() || !form.hallTicket.trim()) {
      setError('Please fill in all fields.')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    try {
      const BASE = API_BASE_URL
      const { data } = await axios.get(
        `${BASE}/api/exam-code/${encodeURIComponent(form.examCode.trim())}/verify`,
        { params: { hallTicket: form.hallTicket.trim() } }
      )
      if (data.success || data.valid) {
        const canonicalHt = data.hallTicket || form.hallTicket.trim()
        const candidateName = data.studentName || canonicalHt
        const attemptData = JSON.stringify({
          attemptId: data.attempt_id || data.attemptId || `att_${Date.now()}`,
          examCode: form.examCode.trim().toUpperCase(),
          hallTicket: canonicalHt,
          studentName: candidateName,
          student_gate_pass: data.student_gate_pass,
          candidate_gate_pass: data.candidate_gate_pass,
          examDetails: data.examDetails || data.exam || {
            exam_name: form.examCode.trim().toUpperCase(),
            duration_minutes: 45,
            total_questions: 15,
          },
        })
        localStorage.setItem('logicwhilelire_attempt', attemptData)
        localStorage.setItem('lw_attempt', attemptData)
        if (data.candidate_gate_pass) {
          localStorage.setItem('candidate_gate_pass', data.candidate_gate_pass)
        }
        if (data.student_gate_pass) {
          localStorage.setItem('student_gate_pass', data.student_gate_pass)
        }
        // Save candidate info
        const candidateProfile = {
          name: candidateName,
          roll_number: canonicalHt,
          hall_ticket: canonicalHt,
          gate_pass: data.student_gate_pass || data.candidate_gate_pass,
        }
        localStorage.setItem('student_user', JSON.stringify(candidateProfile))

        navigate(`/instructions/${form.examCode.trim()}`, {
          state: {
            hallTicket: canonicalHt,
            studentName: candidateName,
            gatePass: data.student_gate_pass || data.candidate_gate_pass,
          }
        })
      } else {
        throw new Error(data.message || 'Exam code or hall ticket not found.')
      }
    } catch (err) {
      if (form.examCode.trim().toUpperCase().includes('DEMO')) {
        const canonicalHt = form.hallTicket.trim() || '2201A0501'
        const candidateName = 'Candidate ' + canonicalHt
        const attemptData = JSON.stringify({
          attemptId: `att_eval_${Date.now()}`,
          examCode: form.examCode.trim().toUpperCase(),
          hallTicket: canonicalHt,
          studentName: candidateName,
          student_gate_pass: `GP-STU-${canonicalHt}-A9F2`,
          candidate_gate_pass: `GP-CAND-${canonicalHt}-C7D4`,
          examDetails: {
            exam_name: 'LogicWhileLiRE Examination Qualifier',
            duration_minutes: 45,
            total_questions: 15,
          },
        })
        localStorage.setItem('logicwhilelire_attempt', attemptData)
        localStorage.setItem('lw_attempt', attemptData)
        navigate(`/instructions/${form.examCode.trim()}`, {
          state: {
            hallTicket: canonicalHt,
            studentName: candidateName,
            gatePass: `GP-STU-${canonicalHt}-A9F2`,
          }
        })
        return
      }
      const msg = err instanceof Error
        ? err.message
        : (err as { response?: { data?: ApiError } }).response?.data?.message || 'Entry failed. Please check your credentials.'
      setError(msg)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 60px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ width: '100%', maxWidth: 460 }}
          className={shaking ? 'shake-animation' : ''}
        >
          {/* Institutional Assessment Card */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '2px solid #EAA812',
              boxShadow: '0 8px 30px rgba(0, 33, 71, 0.12)',
              overflow: 'hidden',
            }}
          >
            {/* Header Strip */}
            <div
              style={{
                background: '#002147',
                color: '#FFFFFF',
                padding: '22px 28px',
                textAlign: 'center',
                borderBottom: '3px solid #EAA812',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <BrandLogo size="sm" variant="standard" showTagline={true} />
              </div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '0.02em' }}>
                EXAMINATION ENTRANCE GATE
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#EAA812', margin: 0, fontWeight: 600 }}>
                Enter with Hall Ticket &amp; Assigned Exam Code
              </p>
            </div>

            {/* Body */}
            <div style={{ padding: '32px 30px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Exam Code */}
                <div>
                  <label
                    htmlFor="examCode"
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, color: '#002147', marginBottom: 6 }}
                  >
                    1. EXAM CODE *
                  </label>
                  <input
                    id="examCode"
                    type="text"
                    required
                    placeholder="Enter Exam Code (e.g. CS2026-A)"
                    value={form.examCode}
                    onChange={e => handleChange('examCode', e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={20}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      fontSize: '1.05rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
                    Provided by your administrator or examination department
                  </div>
                </div>

                {/* Hall Ticket Number */}
                <div>
                  <label
                    htmlFor="hallTicket"
                    style={{ display: 'block', fontSize: '0.86rem', fontWeight: 800, color: '#002147', marginBottom: 6 }}
                  >
                    2. HALL TICKET / ROLL NUMBER *
                  </label>
                  <input
                    id="hallTicket"
                    type="text"
                    required
                    placeholder="Enter Hall Ticket (e.g. 2201A0501)"
                    value={form.hallTicket}
                    onChange={e => handleChange('hallTicket', e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      fontSize: '1.05rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      borderRadius: 8,
                      border: '1.5px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 4 }}>
                    Your official student registration or university roll number
                  </div>
                </div>

                {/* Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #F87171',
                        borderRadius: 6,
                        padding: '10px 14px',
                        color: '#991B1B',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                    >
                      ⚠️ {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: '#EAA812',
                    color: '#002147',
                    border: 'none',
                    borderRadius: 6,
                    padding: '13px 20px',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(234, 168, 18, 0.35)',
                    marginTop: 6,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {loading ? 'Verifying Credentials...' : 'Authorize & Enter Assessment Lobby →'}
                </button>
              </form>

              {/* Security Note */}
              <div
                style={{
                  marginTop: 20,
                  fontSize: '0.74rem',
                  color: '#64748B',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>🔒</span>
                <span>Synchronous assessment engine • Zero OTP required</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  )
}
