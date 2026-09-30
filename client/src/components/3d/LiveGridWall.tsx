import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface StudentTile {
  id: string
  name: string
  hallTicket?: string
  status: 'active' | 'idle' | 'cheating' | 'offline'
  score?: number
  flagCount?: number
  joinedAt?: string
  lastSeen?: string
  currentQuestion?: number
}

interface LiveGridWallProps {
  students: StudentTile[]
  onSelectStudent?: (s: StudentTile) => void
  selectedId?: string | null
  className?: string
  onWarnStudent?: (s: StudentTile) => void
  onTerminateStudent?: (s: StudentTile) => void
  onExtendTime?: (s: StudentTile) => void
  onPauseResume?: (s: StudentTile) => void
  onOpenDossier?: (s: StudentTile) => void
}

export const STATUS_CONFIG: Record<StudentTile['status'], { color: string; label: string; dot: string; bg: string }> = {
  active:   { color: '#10B981', label: 'Active',    dot: 'status-active',   bg: 'rgba(16,185,129,0.12)' },
  idle:     { color: '#F59E0B', label: 'Idle',      dot: 'status-idle',     bg: 'rgba(245,158,11,0.12)' },
  cheating: { color: '#EF4444', label: 'Flagged!',  dot: 'status-cheating', bg: 'rgba(239,68,68,0.15)' },
  offline:  { color: '#64748B', label: 'Submitted', dot: 'status-offline',  bg: 'rgba(100,116,139,0.12)' },
}

export default function LiveGridWall({
  students = [],
  onSelectStudent,
  selectedId,
  className = '',
  onWarnStudent,
  onTerminateStudent,
  onExtendTime,
  onPauseResume,
  onOpenDossier,
}: LiveGridWallProps) {
  const [selected, setSelected] = useState<string | null>(selectedId || null)
  const [filter, setFilter] = useState<StudentTile['status'] | 'all'>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cams' | 'wall' | 'cards'>('cams')

  const activeSelected = selectedId !== undefined ? selectedId : selected

  const counts = useMemo(() => ({
    all:      students.length,
    active:   students.filter(s => s.status === 'active').length,
    idle:     students.filter(s => s.status === 'idle').length,
    cheating: students.filter(s => s.status === 'cheating').length,
    offline:  students.filter(s => s.status === 'offline').length,
  }), [students])

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchFilter = filter === 'all' || s.status === filter
      const matchSearch = !search.trim() ||
        (s.hallTicket && s.hallTicket.toLowerCase().includes(search.toLowerCase())) ||
        (s.name && s.name.toLowerCase().includes(search.toLowerCase()))
      return matchFilter && matchSearch
    })
  }, [students, filter, search])

  const handleSelect = (s: StudentTile) => {
    setSelected(s.id)
    onSelectStudent?.(s)
  }

  return (
    <div className={className}>
      {/* ─── Control Header ─── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Left: Filter Buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'active', 'idle', 'cheating', 'offline'] as const).map(f => {
            const isAll = f === 'all'
            const cfg = !isAll ? STATUS_CONFIG[f] : null
            const isActive = filter === f

            return (
              <motion.button
                key={f}
                onClick={() => setFilter(f)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '5px 12px', borderRadius: 999,
                  fontSize: '0.76rem', fontWeight: 600,
                  border: '1px solid',
                  borderColor: isActive
                    ? (isAll ? 'rgba(43,127,255,0.6)' : cfg!.color + '90')
                    : 'var(--color-border)',
                  background: isActive
                    ? (isAll ? 'rgba(43,127,255,0.15)' : cfg!.color + '20')
                    : 'rgba(255,255,255,0.02)',
                  color: isActive
                    ? (isAll ? 'var(--color-primary)' : cfg!.color)
                    : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                {!isAll && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: cfg!.color,
                    boxShadow: isActive ? `0 0 6px ${cfg!.color}` : 'none',
                  }} />
                )}
                {isAll ? 'All Candidates' : cfg!.label}
                <span style={{ opacity: 0.75, fontSize: '0.7rem', fontWeight: 700 }}>
                  ({counts[f]})
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Right: Search + Mode toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search candidate..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px 4px 26px',
                fontSize: '0.78rem',
                color: 'var(--color-text)',
                width: 140,
                outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', opacity: 0.5, pointerEvents: 'none' }}>
              🔍
            </span>
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                ×
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 6, border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setViewMode('cams')}
              title="Live Biometric Video Cam Feeds (All Candidates Visible)"
              style={{
                padding: '4px 10px', borderRadius: 4, border: 'none',
                background: viewMode === 'cams' ? 'rgba(0,242,254,0.3)' : 'transparent',
                color: viewMode === 'cams' ? '#00F2FE' : 'var(--color-text-faint)',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span>📷 Cams Grid</span>
            </button>
            <button
              onClick={() => setViewMode('wall')}
              title="100-Tile Dense Wall"
              style={{
                padding: '4px 8px', borderRadius: 4, border: 'none',
                background: viewMode === 'wall' ? 'rgba(43,127,255,0.3)' : 'transparent',
                color: viewMode === 'wall' ? '#fff' : 'var(--color-text-faint)',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
              }}
            >
              ▦ Dense
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Card View"
              style={{
                padding: '4px 8px', borderRadius: 4, border: 'none',
                background: viewMode === 'cards' ? 'rgba(43,127,255,0.3)' : 'transparent',
                color: viewMode === 'cards' ? '#fff' : 'var(--color-text-faint)',
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
              }}
            >
              ▤ Cards
            </button>
          </div>
        </div>
      </div>

      {/* ─── LIVE VIDEO & BIOMETRIC CAMS MONITOR (100 CAMS VISIBLE) ─── */}
      {viewMode === 'cams' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          maxHeight: 600,
          overflowY: 'auto',
          padding: 4,
        }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((student) => {
              const cfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.offline
              const isCheating = student.status === 'cheating'
              const isIdle = student.status === 'idle'
              const isSelected = activeSelected === student.id
              const confidence = isCheating ? '44.8%' : isIdle ? '68.2%' : '98.6%'
              const audioDb = isCheating ? -14 : isIdle ? -36 : -48

              return (
                <motion.div
                  key={student.id}
                  layout
                  className={`monitor-cam-card ${isCheating ? 'flagged' : ''}`}
                  onClick={() => handleSelect(student)}
                  style={{
                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(3, 7, 18, 0.98) 100%)',
                    border: `1.5px solid ${isSelected ? '#38BDF8' : isCheating ? '#EF4444' : cfg.color + '40'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    position: 'relative',
                    boxShadow: isCheating
                      ? '0 0 20px rgba(239, 68, 68, 0.35)'
                      : isSelected
                      ? '0 0 16px rgba(56, 189, 248, 0.3)'
                      : '0 4px 14px rgba(0, 0, 0, 0.4)',
                    cursor: 'pointer',
                  }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Cam Video Screen Area */}
                  <div style={{
                    position: 'relative',
                    height: 135,
                    background: '#040714',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  }}>
                    {/* Subtle video scanlines overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                      backgroundSize: '100% 4px',
                      pointerEvents: 'none',
                      opacity: 0.6,
                    }} />

                    {/* Simulated Face Bounding Box & Target Reticle */}
                    <div style={{
                      position: 'relative',
                      width: 68,
                      height: 68,
                      borderRadius: isCheating ? 4 : '50%',
                      border: `2px ${isCheating ? 'dashed #EF4444' : isIdle ? 'dashed #F59E0B' : 'solid #00F2FE'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isCheating ? '0 0 16px rgba(239, 68, 68, 0.5)' : '0 0 12px rgba(0, 242, 254, 0.3)',
                    }}>
                      <span style={{ fontSize: '1.6rem' }}>
                        {isCheating ? '⚠️' : isIdle ? '👤' : '👨‍💻'}
                      </span>
                      <span style={{
                        position: 'absolute',
                        bottom: -15,
                        fontSize: '0.52rem',
                        fontWeight: 800,
                        background: 'rgba(0, 0, 0, 0.85)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        color: isCheating ? '#EF4444' : isIdle ? '#F59E0B' : '#00F2FE',
                        whiteSpace: 'nowrap',
                      }}>
                        {isCheating ? 'MULTIPLE FACES' : isIdle ? 'GAZE DEVIATED' : `CONF: ${confidence}`}
                      </span>
                    </div>

                    {/* Top Cam Bar: Candidate Tag + LIVE indicator */}
                    <div style={{
                      position: 'absolute',
                      top: 6, left: 8, right: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      pointerEvents: 'none',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#F8FAFC',
                        background: 'rgba(0, 0, 0, 0.75)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {student.hallTicket || student.name}
                      </span>

                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: student.status === 'offline' ? 'rgba(100, 116, 139, 0.7)' : 'rgba(239, 68, 68, 0.85)',
                        padding: '2px 6px', borderRadius: 999,
                        fontSize: '0.56rem', fontWeight: 800, color: '#FFF',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF' }} />
                        <span>{student.status === 'offline' ? 'SUBMITTED' : 'REC • LIVE'}</span>
                      </div>
                    </div>

                    {/* Audio dB Meter Bottom-Left */}
                    <div style={{
                      position: 'absolute',
                      bottom: 6, left: 8,
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(0,0,0,0.65)',
                      padding: '2px 6px', borderRadius: 4,
                      fontSize: '0.58rem', color: isCheating ? '#F87171' : '#94A3B8',
                    }}>
                      <span>🎙️</span>
                      <span>{audioDb} dB</span>
                    </div>

                    {/* Screen Share Status Bottom-Right */}
                    <div style={{
                      position: 'absolute',
                      bottom: 6, right: 8,
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: 'rgba(0,0,0,0.65)',
                      padding: '2px 6px', borderRadius: 4,
                      fontSize: '0.56rem', fontWeight: 700,
                      color: isCheating ? '#FCA5A5' : '#34D399',
                    }}>
                      <span>🖥️</span>
                      <span>{student.status === 'offline' ? 'OFF' : 'SCREEN ON'}</span>
                    </div>
                  </div>

                  {/* Candidate Details & Stats */}
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                        {student.name || student.hallTicket}
                      </div>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 800,
                        color: cfg.color, background: cfg.bg,
                        padding: '1px 6px', borderRadius: 999,
                        border: `1px solid ${cfg.color}40`,
                      }}>
                        {cfg.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#94A3B8', marginBottom: 8 }}>
                      <span>Progress: <strong>Q{student.currentQuestion || 1}/15</strong></span>
                      <span>Score: <strong style={{ color: '#38BDF8' }}>{student.score !== undefined ? `${student.score}%` : 'Evaluating'}</strong></span>
                      <span>Flags: <strong style={{ color: (student.flagCount || 0) > 0 ? '#EF4444' : '#10B981' }}>{student.flagCount || 0}</strong></span>
                    </div>

                    {/* 1-Click Inspector Quick Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onWarnStudent?.(student) }}
                        title="Send Instant Warning to Student"
                        style={{
                          padding: '4px 2px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.4)',
                          background: 'rgba(245, 158, 11, 0.1)', color: '#FBBF24', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ⚠️ Warn
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onExtendTime?.(student) }}
                        title="Grant +5 Minutes Extension"
                        style={{
                          padding: '4px 2px', borderRadius: 4, border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ⏱️ +5m
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPauseResume?.(student) }}
                        title="Pause or Resume Student Exam"
                        style={{
                          padding: '4px 2px', borderRadius: 4, border: '1px solid rgba(168, 85, 247, 0.4)',
                          background: 'rgba(168, 85, 247, 0.1)', color: '#C084FC', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ⏸️ Pause
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenDossier ? onOpenDossier(student) : handleSelect(student) }}
                        title="Inspect Full Candidate Dossier"
                        style={{
                          padding: '4px 2px', borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.05)', color: '#E2E8F0', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        📋 Dossier
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── DENSE 100-TILE MISSION-CONTROL WALL ─── */}
      {viewMode === 'wall' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
          gap: 6,
          maxHeight: 560,
          overflowY: 'auto',
          padding: 4,
        }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((student, i) => {
              const cfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.offline
              const isFlagged = student.status === 'cheating'
              const isSelected = activeSelected === student.id

              return (
                <motion.div
                  key={student.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleSelect(student)}
                  title={`${student.hallTicket || student.name}\nStatus: ${cfg.label}\nScore: ${student.score !== undefined ? student.score + '%' : 'In progress'}\nFlags: ${student.flagCount || 0}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 6,
                    background: isSelected ? 'rgba(43,127,255,0.25)' : cfg.bg,
                    border: `1.5px solid ${isSelected ? '#2B7FFF' : isFlagged ? '#EF4444' : cfg.color + '40'}`,
                    boxShadow: isFlagged
                      ? '0 0 10px rgba(239,68,68,0.4)'
                      : isSelected ? '0 0 12px rgba(43,127,255,0.5)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: 3,
                    transition: 'all 0.15s ease',
                  }}
                  whileHover={{ scale: 1.08, zIndex: 10 }}
                >
                  {/* Glowing Status Dot */}
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 6, height: 6, borderRadius: '50%',
                    background: cfg.color,
                    boxShadow: `0 0 6px ${cfg.color}`,
                    animation: isFlagged ? 'blink 0.6s infinite' : student.status === 'active' ? 'blink 2s infinite' : 'none',
                  }} />

                  {/* Cheat count badge */}
                  {isFlagged && (student.flagCount || 0) > 0 && (
                    <div style={{
                      position: 'absolute', top: 2, left: 3,
                      background: '#EF4444', color: '#fff',
                      fontSize: '0.52rem', fontWeight: 800,
                      borderRadius: 3, padding: '0 3px', lineHeight: 1.2,
                    }}>
                      {student.flagCount}x
                    </div>
                  )}

                  {/* Center: ID / Index */}
                  <div style={{
                    fontSize: '0.62rem', fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: isSelected ? '#fff' : 'var(--color-text)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                    textAlign: 'center',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {student.hallTicket ? student.hallTicket.slice(-4) : `#${i + 1}`}
                  </div>

                  {/* Bottom: Score or status */}
                  <div style={{
                    fontSize: '0.55rem', fontWeight: 700,
                    color: cfg.color,
                    marginTop: 3,
                  }}>
                    {student.score !== undefined ? `${student.score}%` : cfg.label.slice(0, 3)}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── EXPANDED CARD VIEW ─── */}
      {viewMode === 'cards' && (
        <div className="monitor-grid" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((student, i) => {
              const cfg = STATUS_CONFIG[student.status] || STATUS_CONFIG.offline
              const isCheating = student.status === 'cheating'
              const isSelected = activeSelected === student.id

              return (
                <motion.div
                  key={student.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.25 }}
                  className={`monitor-tile ${isCheating ? 'flagged' : ''}`}
                  onClick={() => handleSelect(student)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'rgba(43,127,255,0.8)' : isCheating ? '#EF4444' : undefined,
                    boxShadow: isSelected ? '0 0 20px rgba(43,127,255,0.4)' : undefined,
                  }}
                >
                  <div className={`monitor-tile-status ${cfg.dot}`} />

                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 4,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${cfg.color}40, ${cfg.color}20)`,
                      border: `1.5px solid ${cfg.color}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.95rem',
                    }}>
                      {isCheating ? '⚠️' : student.status === 'offline' ? '✅' : student.status === 'idle' ? '⏳' : '👤'}
                    </div>

                    <div style={{
                      fontSize: '0.66rem', fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text)',
                      textAlign: 'center', lineHeight: 1.2,
                      padding: '0 6px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}>
                      {student.hallTicket || student.name || `Student ${i + 1}`}
                    </div>

                    {student.score !== undefined ? (
                      <div style={{
                        fontSize: '0.62rem', fontWeight: 800,
                        color: cfg.color, letterSpacing: '0.04em',
                      }}>
                        {student.score}%
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.58rem', color: 'var(--color-text-faint)' }}>
                        In progress
                      </div>
                    )}

                    {isCheating && (student.flagCount ?? 0) > 0 && (
                      <div style={{
                        position: 'absolute', top: 4, left: 6,
                        background: 'rgba(239,68,68,0.95)',
                        borderRadius: 4, padding: '1px 5px',
                        fontSize: '0.55rem', fontWeight: 800, color: '#fff',
                      }}>
                        {student.flagCount}x
                      </div>
                    )}
                  </div>

                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '3px 6px',
                    background: `${cfg.color}22`,
                    fontSize: '0.6rem', fontWeight: 700, color: cfg.color,
                    textAlign: 'center',
                    borderTop: `1px solid ${cfg.color}35`,
                  }}>
                    {cfg.label}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '48px',
            textAlign: 'center', color: 'var(--color-text-faint)',
            fontSize: '0.9rem',
          }}
        >
          {students.length === 0
            ? '⏳ Waiting for students to join this exam...'
            : `No students matching "${search || filter}" found`}
        </motion.div>
      )}
    </div>
  )
}
