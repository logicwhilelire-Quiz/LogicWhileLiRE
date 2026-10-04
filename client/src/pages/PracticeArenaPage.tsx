import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import GlowCard from '../components/3d/GlowCard';
import MagneticButton from '../components/3d/MagneticButton';
import FlightPathLines from '../components/3d/FlightPathLines';
import CodeEditorHolo from '../components/3d/CodeEditorHolo';
import SectorRadar3D, { type SectorScore } from '../components/3d/SectorRadar3D';
import SectorsUniverse3D from '../components/3d/SectorsUniverse3D';

interface Challenge {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xp: number;
  topic: string;
  sectorId: string;
  sectorName: string;
  sectorBadge: string;
  sectorColor: string;
  description: string;
  starterCode: string;
  testCases: Array<{
    id: string;
    input_text: string;
    expected_output: string;
    is_hidden: boolean;
    marks?: number;
  }>;
}

const SECTOR_CATEGORIES = [
  { id: 'all', label: 'All 5 Sectors', icon: '🪐' },
  { id: 'sector-quant', label: 'Sector 1: Quant', icon: '📐', color: '#F59E0B' },
  { id: 'sector-logic', label: 'Sector 2: Logic', icon: '🧩', color: '#8B5CF6' },
  { id: 'sector-core-cs', label: 'Sector 3: Core CS', icon: '💻', color: '#10B981' },
  { id: 'sector-dsa', label: 'Sector 4: DSA', icon: '⚡', color: '#38BDF8' },
  { id: 'sector-fullstack', label: 'Sector 5: Full-Stack', icon: '🌐', color: '#F43F5E' },
];

const DAILY_CHALLENGES: Challenge[] = [
  {
    id: 'ch-quant',
    title: 'Velocity Equations: Fuel Burn Vector',
    difficulty: 'Easy',
    xp: 100,
    topic: 'Quantitative Aptitude (Relative Speed & Rate)',
    sectorId: 'sector-quant',
    sectorName: 'Quantitative Aptitude & Velocity',
    sectorBadge: '📐 Sector 1 · Set A',
    sectorColor: '#F59E0B',
    description: `A spacecraft engine consumes fuel at a rate inversely proportional to thruster efficiency. Given two integers: fuel mass M (kg) and burn rate R (kg/s), calculate and print the total burn duration in integer seconds.\n\nInput format:\nLine 1: Two space-separated integers M and R\n\nExample:\nInput:\n1200 40\nOutput:\n30`,
    starterCode: `import sys

def solve():
    data = sys.stdin.read().split()
    if len(data) < 2:
        return
    mass, rate = int(data[0]), int(data[1])
    print(mass // rate)

if __name__ == '__main__':
    solve()
`,
    testCases: [
      { id: '1', input_text: '1200 40', expected_output: '30', is_hidden: false, marks: 50 },
      { id: '2', input_text: '500 25', expected_output: '20', is_hidden: false, marks: 30 },
      { id: '3', input_text: '9999 33', expected_output: '303', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-logic',
    title: 'LogicWhile Cipher: Deductive Invariant Decryptor',
    difficulty: 'Easy',
    xp: 110,
    topic: 'Logical Reasoning (Pattern Decoders)',
    sectorId: 'sector-logic',
    sectorName: 'Logical Reasoning & Deduction',
    sectorBadge: '🧩 Sector 2 · Set B',
    sectorColor: '#8B5CF6',
    description: `The LogicWhileLiRE platform encodes transmission packets by shifting uppercase letters by +1 then +2 alternately (A->B, B->D). Write a program that takes an encrypted uppercase string from stdin and prints the deciphered word.\n\nExample:\nInput:\nMQHKE\nOutput:\nLOGIC`,
    starterCode: `import sys

def decrypt():
    s = sys.stdin.read().strip()
    if not s:
        return
    res = []
    for i, ch in enumerate(s):
        shift = 1 if i % 2 == 0 else 2
        orig = chr((ord(ch) - 65 - shift) % 26 + 65)
        res.append(orig)
    print("".join(res))

if __name__ == '__main__':
    decrypt()
`,
    testCases: [
      { id: '1', input_text: 'MQHKE', expected_output: 'LOGIC', is_hidden: false, marks: 50 },
      { id: '2', input_text: 'XIKMG', expected_output: 'WHILE', is_hidden: false, marks: 30 },
      { id: '3', input_text: 'B', expected_output: 'A', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-corecs',
    title: 'Operating Systems: FIFO Page Faults',
    difficulty: 'Medium',
    xp: 140,
    topic: 'Operating Systems (Virtual Memory)',
    sectorId: 'sector-core-cs',
    sectorName: 'Core Computer Science Systems',
    sectorBadge: '💻 Sector 3 · Set C',
    sectorColor: '#10B981',
    description: `Given a page reference string and number of physical memory frames K, compute the total number of page faults using the FIFO page replacement algorithm.\n\nInput:\nLine 1: Integer K (frame capacity)\nLine 2: Space-separated page requests\n\nExample:\nInput:\n3\n7 0 1 2 0 3 0 4 2 3 0 3 2\nOutput:\n12`,
    starterCode: `import sys

def fifo_page_faults():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 2:
        return
    capacity = int(lines[0].strip())
    pages = [int(x) for x in lines[1].split()]
    
    memory = []
    faults = 0
    for p in pages:
        if p not in memory:
            faults += 1
            if len(memory) == capacity:
                memory.pop(0)
            memory.append(p)
    print(faults)

if __name__ == '__main__':
    fifo_page_faults()
`,
    testCases: [
      { id: '1', input_text: '3\n7 0 1 2 0 3 0 4 2 3 0 3 2', expected_output: '12', is_hidden: false, marks: 60 },
      { id: '2', input_text: '4\n1 2 3 4 1 2 5 1 2 3 4 5', expected_output: '10', is_hidden: false, marks: 40 },
    ],
  },
  {
    id: 'ch-dsa',
    title: 'Flight Envelope: Maximum Peak Velocity',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Data Structures & Algorithms (LIS)',
    sectorId: 'sector-dsa',
    sectorName: 'Data Structures & Algorithms',
    sectorBadge: '⚡ Sector 4 · Set D',
    sectorColor: '#38BDF8',
    description: `A spacecraft's altitude readings are captured across consecutive sensor intervals. Write a program to read N altitude values from stdin and output the length of the longest strictly increasing sub-sequence of sensor values.\n\nInput:\n10 9 2 5 3 7 101 18\nOutput:\n4`,
    starterCode: `import sys

def length_of_lis():
    data = sys.stdin.read().split()
    if not data:
        print(0)
        return
    nums = [int(x) for x in data]
    
    tails = []
    import bisect
    for x in nums:
        idx = bisect.bisect_left(tails, x)
        if idx == len(tails):
            tails.append(x)
        else:
            tails[idx] = x
    print(len(tails))

if __name__ == '__main__':
    length_of_lis()
`,
    testCases: [
      { id: '1', input_text: '10 9 2 5 3 7 101 18', expected_output: '4', is_hidden: false, marks: 75 },
      { id: '2', input_text: '0 1 0 3 2 3', expected_output: '4', is_hidden: false, marks: 45 },
      { id: '3', input_text: '7 7 7 7 7 7 7', expected_output: '1', is_hidden: true, marks: 30 },
    ],
  },
  {
    id: 'ch-fullstack',
    title: 'Distributed System: Token Bucket Rate Limiter',
    difficulty: 'Hard',
    xp: 180,
    topic: 'Full-Stack Architecture (Rate Limiting)',
    sectorId: 'sector-fullstack',
    sectorName: 'Full-Stack & Distributed Architecture',
    sectorBadge: '🌐 Sector 5 · Set E',
    sectorColor: '#F43F5E',
    description: `Simulate a token bucket rate limiter with burst capacity C and refill rate R (tokens per second). Given arrival timestamps of request packet arrivals, output 1 if packet is accepted, 0 if rate-limited.\n\nInput:\nLine 1: Capacity C and Refill Rate R\nLine 2: Integer N (number of arrivals)\nLine 3: N space-separated arrival seconds (strictly increasing integers)\n\nExample:\nInput:\n2 1\n3\n0 0 1\nOutput:\n1 1 1`,
    starterCode: `import sys

def rate_limiter():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 3:
        return
    c, r = [int(x) for x in lines[0].split()]
    arrivals = [int(x) for x in lines[2].split()]
    
    tokens = c
    last_time = arrivals[0] if arrivals else 0
    results = []
    
    for t in arrivals:
        delta = t - last_time
        tokens = min(c, tokens + delta * r)
        last_time = t
        if tokens >= 1:
            tokens -= 1
            results.append("1")
        else:
            results.append("0")
    print(" ".join(results))

if __name__ == '__main__':
    rate_limiter()
`,
    testCases: [
      { id: '1', input_text: '2 1\n3\n0 0 1', expected_output: '1 1 1', is_hidden: false, marks: 60 },
      { id: '2', input_text: '1 1\n3\n0 0 1', expected_output: '1 0 1', is_hidden: false, marks: 40 },
    ],
  },
];

export default function PracticeArenaPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // If navigated from 3D galaxy with state
  const initialSectorId = (location.state as { selectedSectorId?: string } | null)?.selectedSectorId || 'all';

  const [sectorFilter, setSectorFilter] = useState<string>(initialSectorId);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge>(DAILY_CHALLENGES[0]);
  const [streakDays, setStreakDays] = useState(7);
  const [xp, setXp] = useState(1450);
  const [solvedCount, setSolvedCount] = useState(2);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'coding' | 'blitz' | 'sectors'>('coding');
  const [xpBanner, setXpBanner] = useState<string | null>(null);

  // Require student authentication to access the 5 Technical Sectors Arena
  useEffect(() => {
    const token = localStorage.getItem('student_token');
    if (!token) {
      navigate('/login', {
        state: {
          from: '/practice',
          message: 'The 5 Technical Sectors Arena is reserved for enrolled candidates. Please sign in to access.',
        },
      });
    }
  }, [navigate]);

  // Filtered challenges based on sector
  const filteredChallenges = DAILY_CHALLENGES.filter((ch) =>
    sectorFilter === 'all' ? true : ch.sectorId === sectorFilter
  );

  // Quick Blitz Mode State
  const [blitzScore, setBlitzScore] = useState(0);
  const [blitzTimer, setBlitzTimer] = useState(45);
  const [blitzActive, setBlitzActive] = useState(false);
  const [blitzIndex, setBlitzIndex] = useState(0);

  const BLITZ_QUESTIONS = [
    { q: 'Which data structure enforces LIFO behavior?', opts: ['Queue', 'Stack', 'Heap', 'Tree'], ans: 1 },
    { q: 'Time complexity of Binary Search on sorted array?', opts: ['O(N)', 'O(1)', 'O(log N)', 'O(N²)'], ans: 2 },
    { q: 'Which protocol is connectionless and header-light?', opts: ['TCP', 'UDP', 'HTTP', 'FTP'], ans: 1 },
    { q: 'What does SQL stand for?', opts: ['Structured Query Language', 'Standard Question Logic', 'Sequential Query Loop', 'System Quick Link'], ans: 0 },
    { q: 'In Node.js event loop, where does setImmediate() run?', opts: ['Timers Phase', 'Poll Phase', 'Check Phase', 'Close Phase'], ans: 2 },
  ];

  // Live 3D Radar dynamic score
  const liveRadarScores: SectorScore[] = [
    { sector: 'Quantitative Aptitude', short: 'Quant', score: 86, benchmark: 72, color: '#F59E0B' },
    { sector: 'Logical Reasoning', short: 'Logic', score: 92, benchmark: 76, color: '#8B5CF6' },
    { sector: 'Core Computer Science', short: 'Core CS', score: 79, benchmark: 68, color: '#10B981' },
    { sector: 'Data Structures & Algorithms', short: 'DSA', score: 84, benchmark: 64, color: '#38BDF8' },
    { sector: 'Full-Stack & System Design', short: 'Full-Stack', score: 88, benchmark: 71, color: '#F43F5E' },
  ];

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Blitz countdown
  useEffect(() => {
    let t: any;
    if (blitzActive && blitzTimer > 0) {
      t = setInterval(() => setBlitzTimer((prev) => prev - 1), 1000);
    } else if (blitzTimer === 0 && blitzActive) {
      setBlitzActive(false);
    }
    return () => clearInterval(t);
  }, [blitzActive, blitzTimer]);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      alert('To install LogicWhileLiRE: Click browser menu (⋮ or share) -> "Install App" or "Add to Home Screen"');
    }
  };

  const handleTestPass = (earnedScore: number, maxScore: number) => {
    if (earnedScore === maxScore) {
      setXp((prev) => prev + selectedChallenge.xp);
      setSolvedCount((prev) => prev + 1);
      setXpBanner(`🎉 Sector Challenge Solved! +${selectedChallenge.xp} XP credited to your ${selectedChallenge.sectorName} mastery profile!`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  const handleBlitzAnswer = (idx: number) => {
    const isCorrect = idx === BLITZ_QUESTIONS[blitzIndex].ans;
    if (isCorrect) setBlitzScore((p) => p + 20);

    if (blitzIndex < BLITZ_QUESTIONS.length - 1) {
      setBlitzIndex((p) => p + 1);
    } else {
      setBlitzActive(false);
      setXp((p) => p + blitzScore + 50);
      setXpBanner(`⚡ Blitz Completed! Final Score: ${blitzScore + (idx === BLITZ_QUESTIONS[blitzIndex].ans ? 20 : 0)}/100 (+50 Bonus XP)`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 90% 60% at 50% -10%, #0d1b3e 0%, #050814 100%)',
        fontFamily: "'Inter', sans-serif",
        color: '#F0F4FF',
        position: 'relative',
      }}
    >
      {/* Background Flight Paths */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.45 }}>
        <FlightPathLines />
      </div>

      <SiteHeader />

      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '32px 20px 80px', position: 'relative', zIndex: 1 }}>
        {/* XP Toast Notification */}
        <AnimatePresence>
          {xpBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              style={{
                background: 'linear-gradient(90deg, #10B981, #2B7FFF)',
                color: '#fff',
                padding: '14px 24px',
                borderRadius: 12,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 24,
                boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {xpBanner}
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO / GAMIFICATION DASHBOARD BAR */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(43, 127, 255, 0.25)',
            borderRadius: 20,
            padding: '24px 28px',
            marginBottom: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Daily Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
              }}
            >
              🔥
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F87171', fontFamily: "'Space Grotesk', sans-serif" }}>
                {streakDays} Days Streak
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Streak Shield Active • Daily Goal: 3 Problems
              </div>
            </div>
          </div>

          {/* XP & Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(43, 127, 255, 0.2), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(43, 127, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 0 20px rgba(43, 127, 255, 0.3)',
              }}
            >
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60A5FA', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {xp.toLocaleString()} XP
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A78BFA' }}>
                  Lvl 8 Architect
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: '74%', height: '100%', background: 'linear-gradient(90deg, #2B7FFF, #A78BFA)', borderRadius: 999 }} />
              </div>
            </div>
          </div>

          {/* Daily Retention Progress & PWA Button */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34D399' }}>
                {solvedCount}/3 Daily Sprints
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                +150 XP on completion
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'rgba(43, 127, 255, 0.15)',
                border: '1px solid rgba(43, 127, 255, 0.35)',
                color: '#60A5FA',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>📱</span> Install PWA App
            </button>
          </div>
        </div>

        {/* ARENA MODE SWITCHER TABS */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('coding')}
            style={{
              background: activeTab === 'coding' ? 'rgba(43, 127, 255, 0.2)' : 'transparent',
              border: activeTab === 'coding' ? '1px solid #2B7FFF' : '1px solid transparent',
              color: activeTab === 'coding' ? '#60A5FA' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>💻</span> Sector Code Sprints
          </button>

          <button
            onClick={() => setActiveTab('sectors')}
            style={{
              background: activeTab === 'sectors' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: activeTab === 'sectors' ? '1px solid #38BDF8' : '1px solid transparent',
              color: activeTab === 'sectors' ? '#38BDF8' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>🪐</span> 3D Technical Sectors Hub
          </button>

          <button
            onClick={() => setActiveTab('blitz')}
            style={{
              background: activeTab === 'blitz' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: activeTab === 'blitz' ? '1px solid #EF4444' : '1px solid transparent',
              color: activeTab === 'blitz' ? '#F87171' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>⚡</span> 60-Sec Quiz Blitz
          </button>
        </div>

        {/* ── TAB 1: CODING ARENA WITH SECTOR FILTER & 3D RADAR ── */}
        {activeTab === 'coding' && (
          <div>
            {/* Sector Quick Filter Toolbar */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
              {SECTOR_CATEGORIES.map((sec) => {
                const isActive = sectorFilter === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setSectorFilter(sec.id);
                      const matching = DAILY_CHALLENGES.find((c) => sec.id === 'all' || c.sectorId === sec.id);
                      if (matching) setSelectedChallenge(matching);
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: isActive ? `1.5px solid ${sec.color || '#38BDF8'}` : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isActive ? `${sec.color || '#38BDF8'}25` : 'rgba(15, 23, 42, 0.6)',
                      color: isActive ? (sec.color || '#38BDF8') : '#94A3B8',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? `0 0 16px ${sec.color || '#38BDF8'}33` : 'none',
                    }}
                  >
                    <span>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="arena-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 390px) 1fr', gap: 24 }}>
              {/* Left Column: Challenge Selector & 3D Radar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Daily Challenge List */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(43, 127, 255, 0.2)',
                    borderRadius: 16,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#60A5FA', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Sector Practice Sprints
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      {filteredChallenges.length} Available
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredChallenges.map((ch) => {
                      const isSelected = selectedChallenge.id === ch.id;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => setSelectedChallenge(ch)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: isSelected ? 'rgba(43, 127, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? ch.sectorColor : 'rgba(255, 255, 255, 0.06)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: ch.sectorColor }}>
                              {ch.sectorBadge}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: ch.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.2)' : ch.difficulty === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: ch.difficulty === 'Easy' ? '#34D399' : ch.difficulty === 'Medium' ? '#FBBF24' : '#F87171',
                              }}
                            >
                              {ch.difficulty}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#FFFFFF' : '#E2E8F0', marginBottom: 4 }}>
                            {ch.title}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748B' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{ch.topic}</span>
                            <span style={{ color: '#A78BFA', fontWeight: 700 }}>+{ch.xp} XP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Technical Competency Radar */}
                <SectorRadar3D scores={liveRadarScores} width={340} height={280} />
              </div>

              {/* Right Column: Interactive Code Editor Hologram */}
              <div>
                <CodeEditorHolo
                  challengeTitle={`${selectedChallenge.sectorBadge}: ${selectedChallenge.title}`}
                  starterCode={selectedChallenge.starterCode}
                  language="python"
                  testCases={selectedChallenge.testCases}
                  onTestPass={handleTestPass}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: FULL 3D SECTORS UNIVERSE ── */}
        {activeTab === 'sectors' && (
          <div style={{ marginTop: 12 }}>
            <SectorsUniverse3D
              onSelectSector={(sector) => {
                const match = DAILY_CHALLENGES.find((c) => c.sectorId === sector.id);
                if (match) {
                  setSelectedChallenge(match);
                  setSectorFilter(sector.id);
                  setActiveTab('coding');
                }
              }}
            />
          </div>
        )}

        {/* ── TAB 3: 60-SEC QUIZ BLITZ ── */}
        {activeTab === 'blitz' && (
          <div style={{ maxWidth: 640, margin: '0 auto', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 20, padding: '36px 32px', textAlign: 'center' }}>
            {!blitzActive && blitzScore === 0 ? (
              <div>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⚡</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: '0 0 10px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  60-Second Sector Rapid Sprint
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 28 }}>
                  Rapid-fire questions sampled across all 5 technical sectors. Test speed, analytical reflexes, and earn bonus XP!
                </p>
                <button
                  onClick={() => {
                    setBlitzActive(true);
                    setBlitzTimer(45);
                    setBlitzScore(0);
                    setBlitzIndex(0);
                  }}
                  style={{
                    padding: '14px 32px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  🚀 Start 45-Sec Sprint
                </button>
              </div>
            ) : blitzActive ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 700 }}>
                    Question {blitzIndex + 1}/{BLITZ_QUESTIONS.length}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: blitzTimer <= 10 ? '#EF4444' : '#F59E0B', fontFamily: 'monospace' }}>
                    ⏱ {blitzTimer}s
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: 28, lineHeight: 1.5 }}>
                  {BLITZ_QUESTIONS[blitzIndex].q}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {BLITZ_QUESTIONS[blitzIndex].opts.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleBlitzAnswer(i)}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#E2E8F0',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 8px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Sector Sprint Complete!
                </h2>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#34D399', margin: '16px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {blitzScore}/100 Points
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.92rem', marginBottom: 28 }}>
                  +50 XP Bonus credited! Your multi-sector analytical reflexes have been recorded.
                </p>
                <button
                  onClick={() => {
                    setBlitzIndex(0);
                    setBlitzTimer(45);
                    setBlitzScore(0);
                    setBlitzActive(false);
                  }}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 10,
                    background: '#2B7FFF',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
