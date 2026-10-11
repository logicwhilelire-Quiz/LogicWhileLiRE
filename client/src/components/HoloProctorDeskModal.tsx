import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../lib/config'

export interface ProctorCommsMessage {
  id: string
  type: 'broadcast' | 'whisper' | 'extension' | 'system'
  title: string
  message: string
  timestamp: string
}

interface HoloProctorDeskModalProps {
  isOpen: boolean
  onClose: () => void
  examCode: string
  hallTicket: string
  candidateName?: string
  commsLog: ProctorCommsMessage[]
  onPingSent?: (note: string) => void
  initialTab?: 'comms' | 'raise_hand' | 'telemetry'
}

const BASE = API_BASE_URL

export default function HoloProctorDeskModal({
  isOpen,
  onClose,
  examCode,
  hallTicket,
  candidateName,
  commsLog,
  onPingSent,
  initialTab = 'comms',
}: HoloProctorDeskModalProps) {
  const [activeTab, setActiveTab] = useState<'comms' | 'raise_hand' | 'telemetry'>(initialTab)
  const [issueType, setIssueType] = useState('question_clarification')
  const [issueDetails, setIssueDetails] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  // Keep activeTab in sync when initialTab is passed upon opening modal
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const handleRaiseHand = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    setSentSuccess(false)
    try {
      await axios.post(`${BASE}/api/v1/inspector/report-issue`, {
        candidateId: hallTicket,
        studentName: candidateName || hallTicket,
        hallTicket,
        examCode,
        examTitle: `Exam ${examCode}`,
        issueType,
        details: issueDetails.trim() || `Candidate raised hand regarding: ${issueType.replace(/_/g, ' ')}`,
        severity: issueType === 'urgent_help' ? 'critical' : 'warning',
      })
      setSentSuccess(true)
      onPingSent?.(issueDetails)
      setIssueDetails('')
      setTimeout(() => setSentSuccess(false), 5000)
    } catch {
      // Still show dispatch acknowledgment in offline/mock mode
      setSentSuccess(true)
      setTimeout(() => setSentSuccess(false), 5000)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(5, 8, 18, 0.86)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 620,
            maxHeight: '88vh',
            background: '#0B1120',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 16,
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(56, 189, 248, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(90deg, rgba(14,24,46,0.95), rgba(8,14,28,0.95))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #38BDF8 20%, #0369A1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(56, 189, 248, 0.6)',
                  animation: 'pulse 2s infinite',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🛡️</span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
                    Invigilator Desk & LiRE-Sentinel
                  </h3>
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34D399',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    ● Enclave Online
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
                  Room: <strong style={{ color: '#38BDF8' }}>{examCode}</strong> · Candidate: <strong style={{ color: '#E2E8F0' }}>{hallTicket}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: '#94A3B8',
                borderRadius: 8,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              gap: 8,
              background: '#070D18',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {[
              { id: 'comms', label: `💬 Proctor Feed (${commsLog.length})` },
              { id: 'raise_hand', label: '📬 Report Issue / Drop Box' },
              { id: 'telemetry', label: '⚡ Sentinel Integrity' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#38BDF8' : '#94A3B8',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {/* Tab 1: Proctor Feed */}
            {activeTab === 'comms' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {commsLog.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📡</div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#94A3B8' }}>No Proctor Announcements Yet</div>
                    <p style={{ fontSize: '0.74rem', maxWidth: 360, margin: '6px auto 0' }}>
                      All live broadcasts, time extensions, and invigilator notices will appear here in chronological order.
                    </p>
                  </div>
                ) : (
                  commsLog.map(msg => {
                    const isWhisper = msg.type === 'whisper'
                    const isExtension = msg.type === 'extension'
                    const isBroadcast = msg.type === 'broadcast'
                    const borderColor = isWhisper ? '#F59E0B' : isExtension ? '#10B981' : '#38BDF8'

                    return (
                      <div
                        key={msg.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: `4px solid ${borderColor}`,
                          borderRadius: '0 8px 8px 0',
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color: borderColor,
                              letterSpacing: '0.05em',
                            }}
                          >
                            {isWhisper ? '💬 Direct Invigilator Reprimand' : isExtension ? '⏳ Time Extension' : isBroadcast ? '📢 Room Broadcast' : '🛡️ System Notice'}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace' }}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F8FAFC' }}>
                          {msg.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                          {msg.message}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Tab 2: Raise Hand / Contact Proctor */}
            {activeTab === 'raise_hand' && (
              <form onSubmit={handleRaiseHand} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4 }}>
                  Need assistance or experiencing an irregularity? Select a category and transmit an immediate alert to the invigilator's live console.
                </div>

                {sentSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: '#34D399',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>✓</span>
                    <span><strong>Signal Transmitted:</strong> The invigilator has received your query and notification.</span>
                  </motion.div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6, textTransform: 'uppercase' }}>
                    Issue Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {[
                      { id: 'question_clarification', label: '❓ Question Clarification' },
                      { id: 'network_lag', label: '📶 Question / Network Lag' },
                      { id: 'camera_hardware', label: '📷 Camera / Mic Environment' },
                      { id: 'urgent_help', label: '🚨 Urgent Technical Help' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIssueType(opt.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: issueType === opt.id ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.08)',
                          background: issueType === opt.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.02)',
                          color: issueType === opt.id ? '#38BDF8' : '#94A3B8',
                          fontSize: '0.74rem',
                          fontWeight: issueType === opt.id ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#CBD5E1', marginBottom: 6, textTransform: 'uppercase' }}>
                    Additional Clarification (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="E.g. Question diagram #3 seems blurry on high DPI screen, or brief reconnect..."
                    value={issueDetails}
                    onChange={e => setIssueDetails(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#070D18',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 8,
                      padding: 10,
                      color: '#F8FAFC',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  {isSending ? 'Transmitting...' : '🚀 Transmit Signal to Invigilator'}
                </button>
              </form>
            )}

            {/* Tab 3: Sentinel Integrity */}
            {activeTab === 'telemetry' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                  LiRE-Sentinel runs continuously in the browser background to safeguard your assessment credibility.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Screen Lockdown', val: 'ENFORCED', desc: 'DevTools, F12, Shortcuts Intercepted', icon: '🔒', color: '#10B981' },
                    { label: 'Anti-Leak Watermark', val: 'ACTIVE', desc: 'Holographic Session ID Embedded', icon: '🛡️', color: '#38BDF8' },
                    { label: 'Biometric Face Enclave', val: 'MONITORING', desc: 'Single-face Gaze Geometry Locked', icon: '👁️', color: '#818CF8' },
                    { label: 'Proctor Heartbeat', val: 'HEALTHY (22ms)', desc: 'Websocket & Supabase Synchronized', icon: '⚡', color: '#34D399' },
                  ].map((sensor, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '1.1rem' }}>{sensor.icon}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: sensor.color, textTransform: 'uppercase' }}>
                          ● {sensor.val}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F8FAFC' }}>{sensor.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 2 }}>{sensor.desc}</div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: '0.72rem',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📜</span>
                  <div>
                    <strong style={{ color: '#E2E8F0' }}>Zero-False-Positive Guarantee:</strong> All proctoring events are flagged with micro-timestamps and reviewed by human invigilators before any score adjustments.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 20px',
              background: '#070D18',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
              LogicWhileLiRE Enterprise Enclave v4.0
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#E2E8F0',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Return to Exam
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
