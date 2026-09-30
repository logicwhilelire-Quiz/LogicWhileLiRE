import React, { useMemo } from 'react'

interface AntiLeakWatermarkProps {
  hallTicket: string
  candidateName?: string
  examCode?: string
}

export const AntiLeakWatermark: React.FC<AntiLeakWatermarkProps> = ({
  hallTicket,
  candidateName,
  examCode,
}) => {
  const watermarkText = useMemo(() => {
    const timeStamp = new Date().toISOString().substring(11, 19)
    const name = candidateName ? ` • ${candidateName}` : ''
    const code = examCode ? ` • ${examCode}` : ''
    return `LogicWhileLiRE${code} • ${hallTicket}${name} • [SEC-HASH: ${hallTicket.slice(-4)}${timeStamp}]`
  }, [hallTicket, candidateName, examCode])

  // Generate a 4x4 distributed grid pattern
  const gridPositions = useMemo(() => {
    const items = []
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        items.push({
          top: `${row * 22 + 4}%`,
          left: `${col * 26 + 2}%`,
          id: `${row}-${col}`,
        })
      }
    }
    return items
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        pointerEvents: 'none',
        userSelect: 'none',
        overflow: 'hidden',
        opacity: 0.045,
      }}
      aria-hidden="true"
    >
      {gridPositions.map(pos => (
        <div
          key={pos.id}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'rotate(-25deg)',
            fontFamily: 'monospace',
            fontSize: '0.74rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            textShadow: '0 0 1px rgba(0,0,0,0.5)',
          }}
        >
          {watermarkText}
        </div>
      ))}
    </div>
  )
}

export default AntiLeakWatermark
