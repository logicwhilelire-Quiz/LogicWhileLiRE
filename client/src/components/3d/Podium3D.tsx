import { motion } from 'framer-motion';

export interface PodiumCandidate {
  rank: 1 | 2 | 3;
  name: string;
  hallTicket: string;
  collegeName?: string;
  score: number;
  accuracy?: number;
}

interface Podium3DProps {
  first?: PodiumCandidate;
  second?: PodiumCandidate;
  third?: PodiumCandidate;
}

export default function Podium3D({ first, second, third }: Podium3DProps) {
  const springTransition = {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 16,
        padding: '30px 10px 10px',
        maxWidth: 700,
        margin: '0 auto',
        perspective: 1000,
      }}
    >
      {/* ── 2ND PLACE (SILVER) ── */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 0.85 }}
        transition={{ ...springTransition, delay: 0.1 }}
        style={{
          flex: '1 1 180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Candidate Avatar / Info */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              margin: '0 auto 8px',
              boxShadow: '0 0 25px rgba(226, 232, 240, 0.4)',
              border: '2px solid #ffffff',
            }}
          >
            🥈
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
            {second?.name || 'Rank 2'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
            {second?.hallTicket || '—'}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
            {second?.score !== undefined ? `${second.score} pts` : '—'}
          </div>
        </div>

        {/* 2nd Place Column: Height 140px, 80% scale */}
        <div
          style={{
            width: '100%',
            height: 140,
            background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.35) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            borderRadius: '14px 14px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#e2e8f0', fontFamily: "'Space Grotesk', sans-serif" }}>
            2
          </span>
          <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 700 }}>
            SILVER
          </span>
        </div>
      </motion.div>

      {/* ── 1ST PLACE (GOLD) ── */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...springTransition, delay: 0 }}
        style={{
          flex: '1 1 200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        {/* Floating Animation for 1st Place */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ textAlign: 'center', marginBottom: 12 }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              margin: '0 auto 8px',
              boxShadow: '0 0 40px gold',
              border: '3px solid #fef08a',
            }}
          >
            👑
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
            {first?.name || 'Rank 1 Champion'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#fde047', fontFamily: "'JetBrains Mono', monospace" }}>
            {first?.hallTicket || '—'}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#facc15', marginTop: 2 }}>
            {first?.score !== undefined ? `${first.score} pts` : '—'}
          </div>
        </motion.div>

        {/* 1st Place Column: Height 180px, Gold glow */}
        <div
          style={{
            width: '100%',
            height: 180,
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.4) 0%, rgba(69, 26, 3, 0.95) 100%)',
            border: '2px solid rgba(251, 191, 36, 0.8)',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px gold, 0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ fontSize: '3rem', fontWeight: 900, color: '#fef08a', fontFamily: "'Space Grotesk', sans-serif" }}>
            1
          </span>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.12em', color: '#fde047', textTransform: 'uppercase', fontWeight: 800 }}>
            CHAMPION
          </span>
        </div>
      </motion.div>

      {/* ── 3RD PLACE (BRONZE) ── */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 0.75 }}
        transition={{ ...springTransition, delay: 0.2 }}
        style={{
          flex: '1 1 180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Candidate Avatar / Info */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              margin: '0 auto 8px',
              boxShadow: '0 0 20px rgba(217, 119, 6, 0.4)',
              border: '2px solid #fdba74',
            }}
          >
            🥉
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fed7aa' }}>
            {third?.name || 'Rank 3'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#fdba74', fontFamily: "'JetBrains Mono', monospace" }}>
            {third?.hallTicket || '—'}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f97316', marginTop: 2 }}>
            {third?.score !== undefined ? `${third.score} pts` : '—'}
          </div>
        </div>

        {/* 3rd Place Column: Height 100px, 70% scale */}
        <div
          style={{
            width: '100%',
            height: 100,
            background: 'linear-gradient(180deg, rgba(180, 83, 9, 0.35) 0%, rgba(41, 15, 4, 0.9) 100%)',
            border: '2px solid rgba(249, 115, 22, 0.5)',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fed7aa', fontFamily: "'Space Grotesk', sans-serif" }}>
            3
          </span>
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#fdba74', textTransform: 'uppercase', fontWeight: 700 }}>
            BRONZE
          </span>
        </div>
      </motion.div>
    </div>
  );
}
