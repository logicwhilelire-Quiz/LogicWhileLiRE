import React from 'react'

export default function HoloScan({
  children,
  color = '#06B6D4',
}: {
  children?: React.ReactNode
  color?: string
  [key: string]: any
} = {}) {
  const scanLine = (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-[#06B6D4] to-transparent animate-[scan_2s_linear_infinite]"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          width: '100%',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: 'scan 2s linear infinite',
        }}
      />
    </div>
  )

  if (children) {
    return (
      <div className="relative overflow-hidden" style={{ position: 'relative' }}>
        {children}
        {scanLine}
      </div>
    )
  }

  return scanLine
}
