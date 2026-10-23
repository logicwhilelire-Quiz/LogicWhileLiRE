import { memo, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLeaderboard, type LeaderboardEntry } from '../hooks/useLeaderboard';
import BrandLogo from '../components/BrandLogo';
import LogicWhileLiRELoader from '../components/LogicWhileLiRELoader';
import SiteFooter from '../components/SiteFooter';
import AnimatedPage from '../components/AnimatedPage';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

// Memoized table row to prevent entire table re-renders on Realtime event pushes
const LeaderboardRow = memo(({ entry }: { entry: LeaderboardEntry }) => {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      key={entry.hall_ticket}
    >
      <td>
        <div className={`rank-badge ${entry.rank <= 3 ? `rank-${entry.rank}` : 'rank-other'}`}>
          {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
        </div>
      </td>
      <td className="font-bold">{entry.name}</td>
      <td className="font-mono text-sm text-muted">{entry.hall_ticket}</td>
      <td>
        <span className="font-bold text-primary">{entry.total_score}</span>
        <span className="text-muted text-xs"> /{entry.max_score}</span>
      </td>
      <td><span className="text-success font-bold">{entry.correct_count}</span></td>
      <td><span className="text-danger">{entry.wrong_count}</span></td>
      <td className="font-mono text-sm">{formatTime(entry.time_taken_seconds)}</td>
    </motion.tr>
  );
});

LeaderboardRow.displayName = 'LeaderboardRow';

export default function LeaderboardPage() {
  const { examId } = useParams<{ examId: string }>();
  const { entries, loading, error, lastUpdated, refresh } = useLeaderboard(examId!);

  // Memoize sorted entries to prevent redundant sort passes
  const memoizedEntries = useMemo(() => entries, [entries]);

  return (
    <AnimatedPage>
      <div className="app-layout">
        <nav className="navbar">
          <BrandLogo size="sm" />
          <button id="leaderboard-refresh-btn" className="btn btn-secondary btn-sm" onClick={refresh}>
            🔄 Refresh
          </button>
        </nav>

        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: '2.2rem',
                fontWeight: 900,
                marginBottom: 8,
                background: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              🏆 Live Standings & Leaderboard
            </h1>
            {lastUpdated && (
              <p className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Live • Last updated {lastUpdated.toLocaleTimeString()}</span>
                <span className="badge badge-primary">⚡ Supabase Realtime</span>
              </p>
            )}
          </div>

          {loading && (
            <div style={{ padding: '60px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogicWhileLiRELoader size="md" message="Synchronizing live LogicWhileLiRE leaderboard standings..." />
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          {!loading && memoizedEntries.length === 0 && (
            <div className="card text-center" style={{ padding: 64 }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>No results recorded yet</h3>
              <p className="text-muted">Results will populate automatically as candidates submit their exams.</p>
            </div>
          )}

          {!loading && memoizedEntries.length > 0 && (
            <>
              {/* Top 3 podium with staggered entrance */}
              {memoizedEntries.length >= 3 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 18, marginBottom: 44 }}>
                  {/* 2nd place (Left) */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="card text-center"
                    style={{ padding: '24px 20px', width: 170, order: 1 }}
                  >
                    <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🥈</div>
                    <div className="font-bold" style={{ fontSize: '0.95rem', marginBottom: 4 }}>{memoizedEntries[1]?.name}</div>
                    <div className="text-muted text-xs font-mono">{memoizedEntries[1]?.hall_ticket}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8', marginTop: 8 }}>
                      {memoizedEntries[1]?.total_score}
                    </div>
                  </motion.div>

                  {/* 1st place (Center, Elevated) */}
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: -12 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="card text-center"
                    style={{
                      padding: '34px 24px',
                      width: 200,
                      order: 2,
                      border: '1.5px solid rgba(245,158,11,0.6)',
                      boxShadow: '0 0 36px rgba(245,158,11,0.25)',
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: 8, animation: 'pulse 2s infinite' }}>👑</div>
                    <div className="font-bold" style={{ fontSize: '1.1rem', marginBottom: 4 }}>{memoizedEntries[0]?.name}</div>
                    <div className="text-muted text-xs font-mono">{memoizedEntries[0]?.hall_ticket}</div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fbbf24', marginTop: 8 }}>
                      {memoizedEntries[0]?.total_score}
                    </div>
                    <div className="badge badge-warning" style={{ marginTop: 8, fontWeight: 700 }}>Top Score</div>
                  </motion.div>

                  {/* 3rd place (Right) */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="card text-center"
                    style={{ padding: '24px 20px', width: 170, order: 3 }}
                  >
                    <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🥉</div>
                    <div className="font-bold" style={{ fontSize: '0.95rem', marginBottom: 4 }}>{memoizedEntries[2]?.name}</div>
                    <div className="text-muted text-xs font-mono">{memoizedEntries[2]?.hall_ticket}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: 8 }}>
                      {memoizedEntries[2]?.total_score}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Full Leaderboard Table with Layout Animations */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>Rank</th>
                      <th>Candidate Name</th>
                      <th>Hall Ticket</th>
                      <th>Score</th>
                      <th>Correct</th>
                      <th>Wrong</th>
                      <th>Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memoizedEntries.map((entry) => (
                      <LeaderboardRow key={entry.hall_ticket} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <SiteFooter />
      </div>
    </AnimatedPage>
  );
}
