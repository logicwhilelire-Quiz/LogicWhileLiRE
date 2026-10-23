import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function ExamDemoPage() {
  useEffect(() => {
    document.title = 'LogicWhile LiRE — Exam Colour Coding & Live Demo'
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050810', overflow: 'hidden' }}>
      {/* Mini top toolbar */}
      <div
        style={{
          height: 42,
          background: 'rgba(5, 8, 16, 0.95)',
          borderBottom: '1px solid rgba(234, 168, 18, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 10,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              color: '#94A3B8',
              textDecoration: 'none',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#EAA812')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
          >
            ← Exit to Home
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ color: '#EAA812', fontWeight: 700, letterSpacing: '0.04em' }}>
            ⚡ Live Interactive Exam Demo
          </span>
          <span
            style={{
              background: 'rgba(74, 222, 128, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.4)',
              color: '#4ADE80',
              padding: '1px 8px',
              borderRadius: 999,
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            Vibrant Colour Coding Active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="/demo/exam-demo.html"
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#38BDF8',
              textDecoration: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>↗</span> Open Standalone Tab
          </a>
        </div>
      </div>

      {/* Embedded Demo Canvas */}
      <iframe
        src="/demo/exam-demo.html"
        title="LogicWhile LiRE Exam Demo"
        style={{
          flex: 1,
          width: '100%',
          height: 'calc(100vh - 42px)',
          border: 'none',
          background: '#050810',
        }}
      />
    </div>
  )
}
