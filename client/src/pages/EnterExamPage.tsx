import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
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
        .shake-animation {
          animation: shake 0.45s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}

interface FormState {
  examCode: string
  hallTicket: string
}

export default function EnterExamPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<FormState>(() => {
    const codeFromUrl = (searchParams.get('code') || searchParams.get('examCode') || '').toUpperCase()
    const hallFromUrl = searchParams.get('hallTicket') || searchParams.get('rollNumber') || ''
    let userHall = ''
    try {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('student_user') : null
      if (userStr) {
        const u = JSON.parse(userStr)
        userHall = u.roll_number || u.hall_ticket || ''
      }
    } catch {}
    return {
      examCode: codeFromUrl,
      hallTicket: hallFromUrl || userHall,
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const codeFromUrl = (searchParams.get('code') || searchParams.get('examCode') || '').toUpperCase()
    const hallFromUrl = searchParams.get('hallTicket') || searchParams.get('rollNumber') || ''
    if (codeFromUrl || hallFromUrl) {
      setForm(prev => {
        if ((!codeFromUrl || prev.examCode === codeFromUrl) && (!hallFromUrl || prev.hallTicket === hallFromUrl)) {
          return prev
        }
        return {
          examCode: codeFromUrl || prev.examCode,
          hallTicket: hallFromUrl || prev.hallTicket,
        }
      })
    }
  }, [searchParams])

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: field === 'examCode' ? value.toUpperCase().trim() : value }))
    setError('')
    setErrorCode(null)
  }

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = form.examCode.trim().toUpperCase()
    const cleanHt = form.hallTicket.trim().toUpperCase()

    if (!cleanCode) {
      setError('Please enter your official Exam Code.')
      triggerShake()
      return
    }

    if (!cleanHt) {
      setError('Please enter your University Hall Ticket or Roll Number.')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')
    setErrorCode(null)

    try {
      const BASE = API_BASE_URL
      const { data } = await axios.get(
        `${BASE}/api/exam-code/${encodeURIComponent(cleanCode)}/verify`,
        { params: { hallTicket: cleanHt } }
      )

      if (data.success || data.valid) {
        const canonicalHt = data.hallTicket || cleanHt
        const candidateName = data.studentName || canonicalHt
        const attemptData = JSON.stringify({
          attemptId: data.attempt_id || data.attemptId || `att_${Date.now()}`,
          examCode: cleanCode,
          hallTicket: canonicalHt,
          studentName: candidateName,
          student_gate_pass: data.student_gate_pass,
          candidate_gate_pass: data.candidate_gate_pass,
          examDetails: data.examDetails || data.exam || {
            exam_name: data.exam_name || cleanCode,
            duration_minutes: data.duration_minutes || 45,
            total_questions: data.total_questions || 15,
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

        const candidateProfile = {
          name: candidateName,
          roll_number: canonicalHt,
          hall_ticket: canonicalHt,
          gate_pass: data.student_gate_pass || data.candidate_gate_pass,
        }
        localStorage.setItem('student_user', JSON.stringify(candidateProfile))

        navigate(`/instructions/${encodeURIComponent(cleanCode)}`, {
          state: {
            hallTicket: canonicalHt,
            studentName: candidateName,
            gatePass: data.student_gate_pass || data.candidate_gate_pass,
            examCode: cleanCode,
          }
        })
      } else {
        throw new Error(data.error || data.message || 'Exam code or credentials not recognized.')
      }
    } catch (err: any) {
      const respData = err?.response?.data
      const errStatus = err?.response?.status
      const code = respData?.code || null
      setErrorCode(code)

      if (errStatus === 404) {
        setError(respData?.error || 'Exam code not found. Please verify the code assigned to your college/batch.')
      } else if (code === 'EXAM_NOT_STARTED_BY_ADMIN' || code === 'EXAM_NOT_STARTED_BY_INSPECTOR') {
        setError('This examination has not been started by the Administrator yet. Please wait in the waiting lobby.')
      } else if (code === 'EXAM_NOT_STARTED') {
        setError(respData?.error || 'The examination window has not opened yet. Please check the scheduled start time.')
      } else if (code === 'EXAM_EXPIRED') {
        setError('The examination window for this code has concluded.')
      } else if (code === 'CANDIDATE_NOT_VERIFIED_BY_INSPECTOR' || code === 'EMAIL_NOT_VERIFIED') {
        setError('Candidate profile pending verification by Inspector. Please wait in the waiting lobby for verification.')
      } else if (err?.code === 'ERR_NETWORK' || !err?.response) {
        setError('Assessment gateway is currently unreachable. Please check your internet connection.')
      } else {
        setError(respData?.error || respData?.message || err.message || 'Authorization failed. Please verify your details.')
      }
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleGoToLobby = () => {
    const cleanCode = form.examCode.trim().toUpperCase()
    const cleanHt = form.hallTicket.trim().toUpperCase()
    if (cleanCode && cleanHt) {
      navigate(`/contest/${encodeURIComponent(cleanCode)}/waiting-lobby`, {
        state: { examCode: cleanCode, hallTicket: cleanHt }
      })
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', color: '#F8FAFC', fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif" }}>
      <ExamEntryBg />
      <SiteHeader />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 60px', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 500 }}
          className={shaking ? 'shake-animation' : ''}
        >
          {/* Institutional Security Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(234, 168, 18, 0.3)',
              borderRadius: 30,
              padding: '6px 16px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#E2E8F0', letterSpacing: '0.04em' }}>
                EXAMINATION GATEWAY ACTIVE
              </span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ fontSize: '0.72rem', color: '#EAA812', fontWeight: 700 }}>ZERO OTP AUTH</span>
            </div>
          </div>

          {/* Premium Card */}
          <div style={{
            background: 'rgba(10, 18, 40, 0.94)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderRadius: 22,
            border: '1.5px solid rgba(234, 168, 18, 0.35)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 0 45px rgba(234, 168, 18, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}>
            {/* Header Strip */}
            <div style={{
              background: 'linear-gradient(135deg, #002147 0%, #001535 100%)',
              color: '#FFFFFF',
              padding: '24px 28px',
              textAlign: 'center',
              borderBottom: '2px solid #EAA812',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '100%',
                background: 'radial-gradient(ellipse at 50% 0%, rgba(234, 168, 18, 0.16) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' }}>
                <BrandLogo size="sm" variant="standard" showTagline={true} />
              </div>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                margin: '0 0 4px',
                letterSpacing: '0.04em',
                fontFamily: "'Rajdhani', sans-serif",
                position: 'relative',
              }}>
                SECURE EXAMINATION ENTRANCE
              </h1>
              <p style={{ fontSize: '0.78rem', color: '#EAA812', margin: 0, fontWeight: 700, position: 'relative' }}>
                Authoritative Candidate Verification &amp; Session Dispatch
              </p>
            </div>

            {/* Checklist Strip */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.65)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              fontSize: '0.72rem',
              color: '#94A3B8',
              fontWeight: 700,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#10B981' }}>✓</span> Official Exam Code
              </span>
              <span style={{ color: '#334155' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#10B981' }}>✓</span> University Hall Ticket
              </span>
              <span style={{ color: '#334155' }}>|</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#38BDF8' }}>🔒</span> Direct Gate Pass
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: '26px 28px 30px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Exam Code Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label htmlFor="examCode" style={{ fontSize: '0.72rem', fontWeight: 800, color: '#EAA812', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      1. OFFICIAL EXAM CODE *
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Issued by Institution</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="examCode"
                      type="text"
                      required
                      placeholder="e.g. CS2026 or GR-CSE-A"
                      value={form.examCode}
                      onChange={e => handleChange('examCode', e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={32}
                      style={{
                        width: '100%',
                        padding: '13px 16px',
                        fontSize: '1.05rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        borderRadius: 10,
                        border: '1.5px solid rgba(234, 168, 18, 0.3)',
                        background: 'rgba(234, 168, 18, 0.05)',
                        color: '#FFFFFF',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.25s ease',
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = '#EAA812'
                        e.target.style.boxShadow = '0 0 0 3px rgba(234, 168, 18, 0.2)'
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = 'rgba(234, 168, 18, 0.3)'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    {form.examCode && (
                      <button
                        type="button"
                        onClick={() => handleChange('examCode', '')}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#64748B',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          padding: 4,
                        }}
                        title="Clear exam code"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 5 }}>
                    Enter the exact examination code announced by your supervisor or exam committee.
                  </div>
                </div>

                {/* Hall Ticket Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label htmlFor="hallTicket" style={{ fontSize: '0.72rem', fontWeight: 800, color: '#EAA812', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      2. HALL TICKET / ROLL NUMBER *
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>University Identity</span>
                  </div>
                  <input
                    id="hallTicket"
                    type="text"
                    required
                    placeholder="Enter Hall Ticket (e.g. 24VR1A0501)"
                    value={form.hallTicket}
                    onChange={e => handleChange('hallTicket', e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      fontSize: '1.05rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      borderRadius: 10,
                      border: '1.5px solid rgba(234, 168, 18, 0.3)',
                      background: 'rgba(234, 168, 18, 0.05)',
                      color: '#FFFFFF',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.25s ease',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#EAA812'
                      e.target.style.boxShadow = '0 0 0 3px rgba(234, 168, 18, 0.2)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(234, 168, 18, 0.3)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 5 }}>
                    Your official student registration, university roll number, or admission hall ticket.
                  </div>
                </div>

                {/* Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.14)',
                        border: '1.5px solid rgba(239, 68, 68, 0.45)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        color: '#FCA5A5',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flexShrink: 0, fontSize: '1rem' }}>⚠️</span>
                        <span style={{ lineHeight: 1.4 }}>{error}</span>
                      </div>
                      {(errorCode === 'EXAM_NOT_STARTED_BY_ADMIN' || errorCode === 'EXAM_NOT_STARTED_BY_INSPECTOR' || errorCode === 'CANDIDATE_NOT_VERIFIED_BY_INSPECTOR' || errorCode === 'EMAIL_NOT_VERIFIED') && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(239,68,68,0.25)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={handleGoToLobby}
                            style={{
                              background: '#38BDF8',
                              color: '#041026',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 12px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Enter Waiting Lobby →
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading
                      ? 'rgba(234, 168, 18, 0.5)'
                      : 'linear-gradient(135deg, #EAA812 0%, #F59E0B 100%)',
                    color: loading ? 'rgba(0, 33, 71, 0.6)' : '#002147',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px 20px',
                    fontSize: '0.98rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(234, 168, 18, 0.45)',
                    marginTop: 6,
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(234, 168, 18, 0.6)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = ''
                    e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(234, 168, 18, 0.45)'
                  }}
                >
                  {loading ? (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid rgba(0, 33, 71, 0.3)',
                          borderTopColor: '#002147',
                          animation: 'spin 0.7s linear infinite',
                        }}
                      />
                      <span>Validating Institutional Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>🔐</span>
                      <span>Authorize &amp; Enter Assessment Lobby →</span>
                    </>
                  )}
                </button>
              </form>

              {/* Assistance & Guidelines Strip */}
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <span>ℹ️</span>
                    <span>{showHelp ? 'Hide Exam Code Guidelines' : 'Where do I find my Exam Code?'}</span>
                  </button>

                  <Link
                    to="/student/dashboard"
                    style={{
                      color: '#38BDF8',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Student Dashboard →
                  </Link>
                </div>

                <AnimatePresence>
                  {showHelp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        marginTop: 10,
                        padding: '10px 14px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.74rem',
                        color: '#94A3B8',
                        lineHeight: 1.5,
                      }}
                    >
                      <p style={{ margin: '0 0 6px', color: '#E2E8F0', fontWeight: 700 }}>
                        📌 Institutional Examination Code Guidelines:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        <li>Your Exam Code is provided directly by your department instructor, exam controller, or printed on your formal test schedule.</li>
                        <li>It links your session directly with your designated assessment section and proctoring room.</li>
                        <li>If you do not have an exam code yet, please contact your examination invigilator.</li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Security Footer Note */}
              <div style={{ marginTop: 18, fontSize: '0.73rem', color: '#475569', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span>🔒</span>
                <span>Synchronous assessment engine • Zero OTP required • Authoritative gate pass</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
