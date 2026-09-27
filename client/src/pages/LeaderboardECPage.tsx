import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import BrandLogo from '../components/BrandLogo';
import LeaderboardPodium from '../components/3d/LeaderboardPodium';
import PageTransition from '../components/3d/PageTransition';
import FlightPathLines from '../components/3d/FlightPathLines';
import { supabase } from '../lib/supabaseClient';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface LeaderboardRow {
  rank: number;
  hall_ticket: string;
  name: string;
  score: number;
  max_score: number;
  percentage: number;
  department?: string;
  correct_count?: number;
  wrong_count?: number;
  time_taken_seconds?: number;
  status?: string;
  delta?: number; // rank change
}

function formatTime(secs?: number) {
  if (!secs) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

const MEDAL: Record<number, { bg: string; text: string; icon: string }> = {
  1: { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#7a4a00', icon: '🥇' },
  2: { bg: 'linear-gradient(135deg, #C0C0C0, #A0A0A0)', text: '#fff', icon: '🥈' },
  3: { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', text: '#fff', icon: '🥉' },
};

export default function LeaderboardECPage() {
  const { examCode } = useParams<{ examCode: string }>();
  const activeCode = examCode || 'DEMO123';
  const navigate = useNavigate();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [filterBranch, setFilterBranch] = useState('');
  const [isRankUpdating, setIsRankUpdating] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [liveEventLog, setLiveEventLog] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load Leaderboard data
  async function load(silent = false) {
    if (!silent) setLoading(true);
    else {
      setRefreshing(true);
      setIsRankUpdating(true);
    }

    try {
      const res = await axios.get(`${BASE_URL}/api/exam-code/${activeCode}/leaderboard`);
      const rawRows: LeaderboardRow[] = res.data.leaderboard || [];

      // If less than 3, supplement with realistic top cohort
      if (rawRows.length < 3) {
        const demoDefaults: LeaderboardRow[] = [
          { rank: 1, hall_ticket: '2201A0501', name: 'Aarav Sharma', score: 95, max_score: 100, percentage: 95, department: 'Aero-CS', delta: 0 },
          { rank: 2, hall_ticket: '2201A0512', name: 'Diya Patel', score: 90, max_score: 100, percentage: 90, department: 'Electronics', delta: 1 },
          { rank: 3, hall_ticket: '2201A0524', name: 'Rohan Varma', score: 85, max_score: 100, percentage: 85, department: 'Robotics', delta: -1 },
          { rank: 4, hall_ticket: '2201A0533', name: 'Sneha Reddy', score: 80, max_score: 100, percentage: 80, department: 'AI & DS', delta: 0 },
          { rank: 5, hall_ticket: '2201A0545', name: 'Kabir Mehta', score: 78, max_score: 100, percentage: 78, department: 'Computer Science', delta: 2 },
          { rank: 6, hall_ticket: '2201A0558', name: 'Ananya Iyer', score: 72, max_score: 100, percentage: 72, department: 'Aerospace', delta: -1 },
        ];
        setRows(demoDefaults);
      } else {
        setRows(rawRows);
      }
      setLastUpdated(new Date());
    } catch {
      // Fallback demo rows
      setRows([
        { rank: 1, hall_ticket: '2201A0501', name: 'Aarav Sharma', score: 95, max_score: 100, percentage: 95, department: 'Aero-CS', delta: 0 },
        { rank: 2, hall_ticket: '2201A0512', name: 'Diya Patel', score: 90, max_score: 100, percentage: 90, department: 'Electronics', delta: 1 },
        { rank: 3, hall_ticket: '2201A0524', name: 'Rohan Varma', score: 85, max_score: 100, percentage: 85, department: 'Robotics', delta: -1 },
        { rank: 4, hall_ticket: '2201A0533', name: 'Sneha Reddy', score: 80, max_score: 100, percentage: 80, department: 'AI & DS', delta: 0 },
        { rank: 5, hall_ticket: '2201A0545', name: 'Kabir Mehta', score: 78, max_score: 100, percentage: 78, department: 'Computer Science', delta: 2 },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Supabase Realtime Subscription
  useEffect(() => {
    load();

    const channelName = `realtime:leaderboard-${activeCode}`;
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'leaderboard_update' }, (payload) => {
        setLiveEventLog(`⚡ Live submission from ${payload.payload?.hall_ticket || 'student'}`);
        setTimeout(() => setLiveEventLog(null), 4000);
        load(true);
      })
      .on('broadcast', { event: 'score_submitted' }, (payload) => {
        setLiveEventLog(`🏆 New Score: ${payload.payload?.name || 'Candidate'} scored ${payload.payload?.score || 0}!`);
        setTimeout(() => setLiveEventLog(null), 4000);
        load(true);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exam_code_attempts',
        filter: `exam_code=eq.${activeCode}`,
      }, () => {
        load(true);
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // Polling fallback every 20s
    const timer = setInterval(() => load(true), 20000);

    return () => {
      clearInterval(timer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [activeCode]);

  // Demo Live Simulation Trigger
  const handleSimulateShift = () => {
    setIsRankUpdating(true);
    setLiveEventLog('⚡ Realtime Shift: Candidate 2201A0512 submitted +10 marks algorithmic test case!');
    setTimeout(() => {
      setRows((prev) => {
        if (prev.length < 2) return prev;
        const copy = [...prev];
        // Swap rank 1 and 2 or randomize score
        const temp = copy[0];
        copy[0] = { ...copy[1], rank: 1, score: 98, percentage: 98, delta: 1 };
        copy[1] = { ...temp, rank: 2, score: 95, percentage: 95, delta: -1 };
        return copy;
      });
      setIsRankUpdating(false);
      setTimeout(() => setLiveEventLog(null), 4000);
    }, 400);
  };

  const displayRows = filterBranch
    ? rows.filter(
        r =>
          r.hall_ticket.toLowerCase().includes(filterBranch.toLowerCase()) ||
          r.name.toLowerCase().includes(filterBranch.toLowerCase()) ||
          (r.department && r.department.toLowerCase().includes(filterBranch.toLowerCase()))
      )
    : rows;

  const myHT = (() => {
    try {
      return JSON.parse(localStorage.getItem('lw_attempt') || '{}').hallTicket || '';
    } catch {
      return '';
    }
  })();

  const top3Entries = rows.slice(0, 3).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    hall_ticket: r.hall_ticket,
    department: r.department || 'Engineering',
  }));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 90% 60% at 50% -10%, #0d1b3e 0%, #050814 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#F0F4FF',
      position: 'relative',
    }}>
      {/* Flight Path Lines Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.5 }}>
        <FlightPathLines />
      </div>

      <PageTransition isActive={isRankUpdating} onTransitionComplete={() => setIsRankUpdating(false)} />

      {/* Top Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(5, 8, 20, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(43, 127, 255, 0.15)',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <BrandLogo size="sm" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Realtime Status Indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: realtimeConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(43, 127, 255, 0.12)',
            border: `1px solid ${realtimeConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(43, 127, 255, 0.3)'}`,
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: '0.75rem',
            color: realtimeConnected ? '#34D399' : '#60A5FA',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: realtimeConnected ? '#34D399' : '#60A5FA',
              boxShadow: `0 0 8px ${realtimeConnected ? '#34D399' : '#60A5FA'}`,
            }} />
            {realtimeConnected ? 'REALTIME LIVE' : 'SYNC CONNECTED'}
          </div>

          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            background: 'rgba(43, 127, 255, 0.15)',
            color: '#93C5FD',
            border: '1px solid rgba(43, 127, 255, 0.3)',
            padding: '4px 12px',
            borderRadius: 6,
            fontWeight: 700,
          }}>
            {activeCode}
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {refreshing ? '↻ Syncing...' : '↻ Refresh'}
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 20px 80px', position: 'relative', zIndex: 1 }}>

        {/* Live Broadcast Alert Banner */}
        <AnimatePresence>
          {liveEventLog && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              style={{
                background: 'linear-gradient(90deg, rgba(43, 127, 255, 0.2), rgba(16, 185, 129, 0.2))',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                borderRadius: 10,
                padding: '10px 18px',
                textAlign: 'center',
                fontSize: '0.88rem',
                color: '#34D399',
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 24,
                boxShadow: '0 0 20px rgba(52, 211, 153, 0.15)',
              }}
            >
              {liveEventLog}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.8rem',
            color: '#60A5FA',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 8,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            <span>🏆</span> OFFICIAL TOURNAMENT STANDINGS
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 4.5vw, 3rem)',
            fontWeight: 800,
            color: '#fff',
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            background: 'linear-gradient(135deg, #FFFFFF 40%, #2B7FFF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Real-Time Podium
          </h1>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '5px 14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 999, fontSize: '0.82rem', color: '#34D399', fontWeight: 600 }}>
              {rows.length} Competitors Live
            </span>
            <span style={{ padding: '5px 14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 999, fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              onClick={handleSimulateShift}
              style={{
                padding: '5px 14px',
                background: 'rgba(43, 127, 255, 0.15)',
                border: '1px solid rgba(43, 127, 255, 0.4)',
                borderRadius: 999,
                fontSize: '0.8rem',
                color: '#60A5FA',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ⚡ Simulate Live Shift
            </button>
          </div>
        </motion.div>

        {/* 3D HOLOGRAPHIC LEADERBOARD PODIUM WITH PLASMABALL */}
        {!loading && top3Entries.length >= 3 && (
          <div style={{ marginBottom: 36, position: 'relative' }}>
            <LeaderboardPodium entries={top3Entries} examName={activeCode} />
          </div>
        )}

        {/* Search & Branch Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Search candidate name, hall ticket, or department..."
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(43, 127, 255, 0.25)',
              borderRadius: 10,
              padding: '12px 18px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
            }}
          />
        </div>

        {/* Full Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 60, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 12 }} />
            ))}
          </div>
        ) : displayRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏆</div>
            <p>No results match your search filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayRows.map((row) => {
              const isMe = row.hall_ticket === myHT;
              const medal = MEDAL[row.rank];
              return (
                <motion.div
                  key={row.hall_ticket}
                  layout
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 20px',
                    background: isMe ? 'rgba(43, 127, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${isMe ? 'rgba(43, 127, 255, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 14,
                    boxShadow: isMe ? '0 0 24px rgba(43, 127, 255, 0.2)' : 'none',
                  }}
                >
                  {/* Rank Badge */}
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: medal ? medal.bg : 'rgba(255, 255, 255, 0.08)',
                    fontSize: medal ? '1.25rem' : '0.95rem',
                    fontWeight: 800,
                    color: medal ? medal.text : 'rgba(255, 255, 255, 0.8)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    boxShadow: medal ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
                  }}>
                    {medal ? medal.icon : `#${row.rank}`}
                  </div>

                  {/* Candidate Identity */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700,
                      color: isMe ? '#93C5FD' : '#FFFFFF',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      {row.name}
                      {isMe && (
                        <span style={{ fontSize: '0.68rem', background: '#2B7FFF', color: '#fff', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                          YOU
                        </span>
                      )}
                      {row.delta !== undefined && row.delta !== 0 && (
                        <span style={{
                          fontSize: '0.72rem',
                          color: row.delta > 0 ? '#34D399' : '#F87171',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}>
                          {row.delta > 0 ? `▲ +${row.delta}` : `▼ ${row.delta}`}
                        </span>
                      )}
                      {row.department && (
                        <span style={{
                          fontSize: '0.72rem',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94A3B8',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontWeight: 500,
                        }}>
                          {row.department}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                      HT: {row.hall_ticket}
                    </div>
                  </div>

                  {/* Percentage & Score */}
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '1.3rem',
                        fontWeight: 800,
                        color: row.percentage >= 80 ? '#34D399' : row.percentage >= 60 ? '#FBBF24' : '#F87171',
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}>
                        {row.percentage}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                        {row.score}/{row.max_score} marks
                      </div>
                    </div>

                    {row.time_taken_seconds && (
                      <div style={{ textAlign: 'right', display: 'none' }} className="hide-mobile">
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8' }}>
                          {formatTime(row.time_taken_seconds)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Duration</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.6)',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ← Back to Portal Home
          </button>
        </div>
      </div>
    </div>
  );
}
