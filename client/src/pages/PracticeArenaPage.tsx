import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import GlowCard from '../components/3d/GlowCard';
import MagneticButton from '../components/3d/MagneticButton';
import FlightPathLines from '../components/3d/FlightPathLines';
import CodeEditorHolo from '../components/3d/CodeEditorHolo';

interface Challenge {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xp: number;
  topic: string;
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

const DAILY_CHALLENGES: Challenge[] = [
  {
    id: 'ch-1',
    title: 'Aerospace Telemetry: Frequency Match',
    difficulty: 'Easy',
    xp: 100,
    topic: 'Algorithms (Hash Table)',
    description: `Given a sequence of telemetry signal frequencies and a target beacon frequency, find two distinct signal values whose sum equals the target. Print the two 0-based indices separated by a space.\n\nInput format:\nLine 1: Space-separated integers (the signals)\nLine 2: Target integer\n\nExample:\nInput:\n2 7 11 15\n9\nOutput:\n0 1`,
    starterCode: `import sys

def solve():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 2:
        return
    nums = [int(x) for x in lines[0].split()]
    target = int(lines[1].strip())
    
    seen = {}
    for i, num in enumerate(nums):
        comp = target - num
        if comp in seen:
            print(f"{seen[comp]} {i}")
            return
        seen[num] = i

if __name__ == '__main__':
    solve()
`,
    testCases: [
      { id: '1', input_text: '2 7 11 15\n9', expected_output: '0 1', is_hidden: false, marks: 50 },
      { id: '2', input_text: '3 2 4\n6', expected_output: '1 2', is_hidden: false, marks: 30 },
      { id: '3', input_text: '3 3\n6', expected_output: '0 1', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-2',
    title: 'Flight Envelope: Maximum Peak Velocity',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Dynamic Programming',
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
    id: 'ch-3',
    title: 'Orbital Packet: Valid Parity Checksum',
    difficulty: 'Easy',
    xp: 80,
    topic: 'Bit Manipulation',
    description: `Write an algorithm that takes an integer N from stdin and prints the total number of set bits (1s) in its binary representation.\n\nExample:\nInput: 11\nOutput: 3 (11 in binary is 1011)`,
    starterCode: `import sys

def main():
    val = sys.stdin.read().strip()
    if not val:
        return
    n = int(val)
    print(bin(n).count('1'))

if __name__ == '__main__':
    main()
`,
    testCases: [
      { id: '1', input_text: '11', expected_output: '3', is_hidden: false, marks: 40 },
      { id: '2', input_text: '128', expected_output: '1', is_hidden: false, marks: 20 },
      { id: '3', input_text: '255', expected_output: '8', is_hidden: true, marks: 20 },
    ],
  },
];

export default function PracticeArenaPage() {
  const navigate = useNavigate();
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge>(DAILY_CHALLENGES[0]);
  const [streakDays, setStreakDays] = useState(7);
  const [xp, setXp] = useState(1450);
  const [solvedCount, setSolvedCount] = useState(2);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'coding' | 'blitz'>('coding');
  const [xpBanner, setXpBanner] = useState<string | null>(null);

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
    { q: 'Which CPU cache is closest to execution cores?', opts: ['L3', 'L2', 'L1', 'RAM'], ans: 2 },
  ];

  // Listen for beforeinstallprompt event for PWA
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      alert('To install GROWTHRAN: Click browser menu (⋮ or share) -> "Install App" or "Add to Home Screen"');
    }
  };

  const handleTestPass = (earnedScore: number, maxScore: number) => {
    if (earnedScore === maxScore) {
      setXp(prev => prev + selectedChallenge.xp);
      setSolvedCount(prev => prev + 1);
      setXpBanner(`🎉 Outstanding! All test cases passed! +${selectedChallenge.xp} XP added!`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  // Blitz Timer
  useEffect(() => {
    let t: any;
    if (blitzActive && blitzTimer > 0) {
      t = setInterval(() => setBlitzTimer(p => p - 1), 1000);
    } else if (blitzTimer === 0 && blitzActive) {
      setBlitzActive(false);
    }
    return () => clearInterval(t);
  }, [blitzActive, blitzTimer]);

  const handleBlitzAnswer = (idx: number) => {
    if (idx === BLITZ_QUESTIONS[blitzIndex].ans) {
      setBlitzScore(p => p + 20);
    }
    if (blitzIndex + 1 < BLITZ_QUESTIONS.length) {
      setBlitzIndex(p => p + 1);
    } else {
      setBlitzActive(false);
      setXp(p => p + blitzScore + 50);
      setXpBanner(`⚡ Blitz Completed! Final Score: ${blitzScore + (idx === BLITZ_QUESTIONS[blitzIndex].ans ? 20 : 0)}/100 (+50 Bonus XP)`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 90% 60% at 50% -10%, #0d1b3e 0%, #050814 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#F0F4FF',
      position: 'relative',
    }}>
      {/* Background Flight Paths */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.45 }}>
        <FlightPathLines />
      </div>

      <SiteHeader />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 80px', position: 'relative', zIndex: 1 }}>

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
        <div style={{
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
        }}>
          {/* Daily Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
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
            }}>
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
            <div style={{
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
            }}>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'rgba(43, 127, 255, 0.18)',
                border: '1px solid rgba(43, 127, 255, 0.5)',
                borderRadius: 10,
                padding: '9px 16px',
                color: '#93C5FD',
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
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12 }}>
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
            <span>💻</span> Daily Code Sprint
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

        {activeTab === 'coding' ? (
          /* CODING ARENA SPLIT VIEW */
          <div className="arena-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24 }}>
            
            {/* Left Column: Challenge Selector & Problem Spec */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Daily Challenge Carousel / List */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(43, 127, 255, 0.2)',
                borderRadius: 16,
                padding: '16px',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60A5FA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Today's Retention Sprints
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DAILY_CHALLENGES.map((ch) => {
                    const isSelected = selectedChallenge.id === ch.id;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => setSelectedChallenge(ch)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(43, 127, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isSelected ? 'rgba(43, 127, 255, 0.6)' : 'rgba(255, 255, 255, 0.06)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#93C5FD' : '#E2E8F0' }}>
                            {ch.title}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: ch.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: ch.difficulty === 'Easy' ? '#34D399' : '#FBBF24',
                          }}>
                            {ch.difficulty}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B' }}>
                          <span>{ch.topic}</span>
                          <span style={{ color: '#A78BFA', fontWeight: 600 }}>+{ch.xp} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Problem Description Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(43, 127, 255, 0.2)',
                borderRadius: 16,
                padding: '20px',
                flex: 1,
              }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {selectedChallenge.title}
                </h3>
                <p style={{
                  color: '#CBD5E1',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                  margin: '0 0 20px',
                }}>
                  {selectedChallenge.description}
                </p>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
                    Sample Verification Criteria
                  </div>
                  {selectedChallenge.testCases.map((tc, i) => (
                    <div key={tc.id} style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      marginBottom: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>Case {i + 1}: {tc.is_hidden ? '🔒 [Hidden Edge Case]' : `Input: ${(tc.input_text || '').replace('\n', ' ')}`}</span>
                      <span style={{ color: '#38BDF8' }}>{tc.marks} pts</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Embedded CodeEditorHolo with Live Execution */}
            <div style={{ minHeight: 560 }}>
              <CodeEditorHolo
                value={selectedChallenge.starterCode}
                language="python"
                testCases={selectedChallenge.testCases}
                onRunComplete={(res) => {
                  handleTestPass(res.score || 0, res.maxScore || 100);
                }}
              />
            </div>

          </div>
        ) : (
          /* 60-SECOND RAPID BLITZ MODE */
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 20,
              padding: '36px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(239, 68, 68, 0.2)',
            }}>
              {!blitzActive && blitzTimer === 45 && blitzIndex === 0 ? (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚡</div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 10px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    60-Second Knowledge Sprint
                  </h2>
                  <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: 28, lineHeight: 1.6 }}>
                    Answer 5 rapid engineering questions against the clock. Build instant recall and earn up to +150 bonus XP toward your daily streak!
                  </p>
                  <button
                    onClick={() => setBlitzActive(true)}
                    style={{
                      padding: '12px 32px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #EF4444, #F97316)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '1rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    ▶ Start Sprint Now
                  </button>
                </div>
              ) : blitzActive ? (
                <div>
                  {/* Timer & Progress */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8' }}>
                      Question {blitzIndex + 1} of {BLITZ_QUESTIONS.length}
                    </span>
                    <span style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: blitzTimer <= 10 ? '#EF4444' : '#FBBF24',
                      fontFamily: 'monospace',
                    }}>
                      ⏱️ {blitzTimer}s
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34D399' }}>
                      Score: {blitzScore}
                    </span>
                  </div>

                  {/* Question */}
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: 24, textAlign: 'left' }}>
                    {BLITZ_QUESTIONS[blitzIndex].q}
                  </h3>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {BLITZ_QUESTIONS[blitzIndex].opts.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleBlitzAnswer(i)}
                        style={{
                          padding: '14px 20px',
                          borderRadius: 10,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#fff',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(43, 127, 255, 0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
                    Sprint Complete!
                  </h2>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34D399', margin: '16px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {blitzScore}/100 Points
                  </div>
                  <p style={{ color: '#94A3B8', fontSize: '0.88rem', marginBottom: 24 }}>
                    +50 XP Bonus credited to your account! Daily retention challenge accomplished.
                  </p>
                  <button
                    onClick={() => {
                      setBlitzIndex(0);
                      setBlitzTimer(45);
                      setBlitzScore(0);
                      setBlitzActive(false);
                    }}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      background: '#2B7FFF',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <SiteFooter />
    </div>
  );
}
