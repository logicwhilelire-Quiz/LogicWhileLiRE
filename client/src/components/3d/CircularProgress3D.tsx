import { motion } from 'framer-motion'

export default function CircularProgress3D({ timeLeft, totalTime }: { timeLeft: number, totalTime: number }){
  const pct = Math.max(0, Math.min(100, (timeLeft / (totalTime || 1)) * 100))
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (pct / 100) * circumference
  const color = pct > 50 ? '#10B981' : pct > 15 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative w-[80px] h-[80px]" style={{ width: 80, height: 80, position: 'relative' }}>
      <svg className="w-full h-full -rotate-90" viewBox="-20 -20 120 120" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
        <circle cx="40" cy="40" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx="40" cy="40" r="52" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-[10px] text-white/50 font-mono" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>TIME</span>
        <span className="text-sm font-bold font-mono" style={{ color, fontSize: '0.875rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
