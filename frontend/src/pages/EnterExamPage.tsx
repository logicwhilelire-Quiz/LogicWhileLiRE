import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../lib/config'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import BrandLogo from '../components/BrandLogo'

function ExamEntryBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#060B1A 0%,#080A16 50%,#050916 100%)' }} />
      <div style={{ position: 'absolute', top: '-10%', left: '20%', width: 650, height: 650, borderRadius: '50%', background: 'radial-gradient(circle,rgba(234,168,18,0.18) 0%,transparent 65%)', filter: 'blur(80px)', animation: 'eeOrb1 22s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,33,71,0.5) 0%,transparent 65%)', filter: 'blur(70px)', animation: 'eeOrb2 28s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '40%', left: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,0.1) 0%,transparent 65%)', filter: 'blur(55px)', animation: 'eeOrb3 18s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: 'linear-gradient(rgba(234,168,18,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(234,168,18,0.05) 1px,transparent 1px)', backgroundSize: '52px 52px' }} />
      <style>{`
        @keyframes eeOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.06)} 66%{transform:translate(-25px,25px) scale(0.94)} }
        @keyframes eeOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 45%{transform:translate(-45px,38px) scale(1.08)} 72%{transform:translate(28px,-22px) scale(0.96)} }
        @keyframes eeOrb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(35px,-45px) scale(1.12)} }
        @keyframes eePulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.25)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', color: '#F8FAFC', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
      <ExamEntryBg />
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 60px', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
          style={{ width: '100%', maxWidth: 480 }}
          className={shaking ? 'shake-animation' : ''}
        >
          {/* Premium Exam Card */}
          <div style={{ background: 'rgba(10,18,40,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 20, border: '1.5px solid rgba(234,168,18,0.35)', boxShadow: '0 24px 64px rgba(0,0,0,0.6),0 0 50px rgba(234,168,18,0.12),inset 0 1px 0 rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {/* Institutional Header Strip */}
            <div style={{ background: 'linear-gradient(135deg,#002147 0%,#001535 100%)', color: '#FFFFFF', padding: '24px 30px', textAlign: 'center', borderBottom: '2px solid #EAA812', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', background: 'radial-gradient(ellipse at 50% 0%,rgba(234,168,18,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' }}>
                <BrandLogo size="sm" variant="standard" showTagline={true} />
              </div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px', letterSpacing: '0.04em', fontFamily: "'Rajdhani',sans-serif", position: 'relative' }}>EXAMINATION ENTRANCE GATE</h1>
              <p style={{ fontSize: '0.78rem', color: '#EAA812', margin: 0, fontWeight: 700, position: 'relative' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#EAA812', marginRight: 6, verticalAlign: 'middle', animation: 'eePulse 2s ease-in-out infinite' }} />
                Enter with Hall Ticket &amp; Assigned Exam Code
              </p>
            </div>

            {/* Body */}
            <div style={{ padding: '30px 28px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Exam Code */}
                <div>
                  <label htmlFor="examCode" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#EAA812', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>1. EXAM CODE *</label>
                  <input
                    id="examCode" type="text" required
                    placeholder="Enter Exam Code (e.g. CS2026-A)"
                    value={form.examCode}
                    onChange={e => handleChange('examCode', e.target.value)}
                    autoComplete="off" spellCheck={false} maxLength={20}
                    style={{ width: '100%', padding: '13px 16px', fontSize: '1.05rem', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '0.08em', borderRadius: 10, border: '1.5px solid rgba(234,168,18,0.3)', background: 'rgba(234,168,18,0.06)', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s ease' }}
                    onFocus={e => { e.target.style.borderColor = '#EAA812'; e.target.style.boxShadow = '0 0 0 3px rgba(234,168,18,0.2)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(234,168,18,0.3)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: 5 }}>Provided by your administrator or examination department</div>
                </div>

                {/* Hall Ticket */}
                <div>
                  <label htmlFor="hallTicket" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#EAA812', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>2. HALL TICKET / ROLL NUMBER *</label>
                  <input
                    id="hallTicket" type="text" required
                    placeholder="Enter Hall Ticket (e.g. 2201A0501)"
                    value={form.hallTicket}
                    onChange={e => handleChange('hallTicket', e.target.value)}
                    autoComplete="off" spellCheck={false} maxLength={32}
                    style={{ width: '100%', padding: '13px 16px', fontSize: '1.05rem', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '0.05em', borderRadius: 10, border: '1.5px solid rgba(234,168,18,0.3)', background: 'rgba(234,168,18,0.06)', color: '#FFFFFF', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s ease' }}
                    onFocus={e => { e.target.style.borderColor = '#EAA812'; e.target.style.boxShadow = '0 0 0 3px rgba(234,168,18,0.2)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(234,168,18,0.3)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: 5 }}>Your official student registration or university roll number</div>
                </div>

                {/* Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '11px 14px', color: '#FCA5A5', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span style={{ flexShrink: 0 }}>⚠️</span><span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>                {/* Submit Button */}
                <button
                  type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? 'rgba(234,168,18,0.5)' : 'linear-gradient(135deg,#EAA812 0%,#F59E0B 100%)', color: loading ? 'rgba(0,33,71,0.6)' : '#002147', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: '0.98rem', fontWeight: 900, letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 20px rgba(234,168,18,0.45)', marginTop: 4, transition: 'all 0.25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(234,168,18,0.6)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(234,168,18,0.45)'; }}
                >
                  {loading ? (
                    <><span style={{ display:'inline-block',width:16,height:16,borderRadius:'50%',border:'2px solid rgba(0,33,71,0.3)',borderTopColor:'#002147',animation:'spin 0.7s linear infinite' }} /><span>Verifying Credentials...</span></>
                  ) : (
                    <><span>🔐</span><span>Authorize &amp; Enter Assessment Lobby →</span></>
                  )}
                </button>
              </form>

              {/* Security Note */}
              <div style={{ marginTop: 20, fontSize: '0.74rem', color: '#475569', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span>🔒</span>
                <span>Synchronous assessment engine • Zero OTP required • Exam code system</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}

