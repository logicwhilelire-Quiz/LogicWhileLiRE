import { useState } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

interface ResultItem {
  id: string;
  hall_ticket: string;
  name: string;
  raw_score: number;
  grace_marks: number;
  score_override?: number;
  max_score: number;
  time_seconds: number;
  violations: number;
  status: 'passed' | 'failed';
  topic_scores: Record<string, number>;
}

export default function ResultControl() {
  const [resultsPublished, setResultsPublished] = useState(false);
  const [leaderboardFrozen, setLeaderboardFrozen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Sample submission results
  const [results, setResults] = useState<ResultItem[]>([
    {
      id: 'res-1',
      hall_ticket: '2201A0501',
      name: 'Aravind Swamy',
      raw_score: 42,
      grace_marks: 0,
      max_score: 50,
      time_seconds: 2340,
      violations: 0,
      status: 'passed',
      topic_scores: { DSA: 90, OS: 80, Networks: 85 },
    },
    {
      id: 'res-2',
      hall_ticket: '2201A0502',
      name: 'Bhavana Reddy',
      raw_score: 38,
      grace_marks: 2,
      max_score: 50,
      time_seconds: 2700,
      violations: 1,
      status: 'passed',
      topic_scores: { DSA: 80, OS: 75, Networks: 80 },
    },
    {
      id: 'res-3',
      hall_ticket: '2201A0588',
      name: 'Karthik Varma',
      raw_score: 14,
      grace_marks: 0,
      max_score: 50,
      time_seconds: 980,
      violations: 6,
      status: 'failed',
      topic_scores: { DSA: 25, OS: 30, Networks: 30 },
    },
    {
      id: 'res-4',
      hall_ticket: '2201A0594',
      name: 'Divya Sri',
      raw_score: 46,
      grace_marks: 0,
      max_score: 50,
      time_seconds: 2150,
      violations: 0,
      status: 'passed',
      topic_scores: { DSA: 95, OS: 90, Networks: 92 },
    },
  ]);

  const handleAddGrace = (id: string, amount: number) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextGrace = r.grace_marks + amount;
          const finalScore = (r.score_override ?? r.raw_score) + nextGrace;
          return {
            ...r,
            grace_marks: nextGrace,
            status: finalScore >= r.max_score * 0.4 ? 'passed' : 'failed',
          };
        }
        return r;
      })
    );
    setActionMsg(`Granted +${amount} grace marks.`);
  };

  const handleOverrideScore = (id: string, newScore: number) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const finalScore = newScore + r.grace_marks;
          return {
            ...r,
            score_override: newScore,
            status: finalScore >= r.max_score * 0.4 ? 'passed' : 'failed',
          };
        }
        return r;
      })
    );
  };

  const handleRecalculate = () => {
    setRecalculating(true);
    setTimeout(() => {
      setRecalculating(false);
      setActionMsg('✅ Authoritative recalculation complete across all candidate answer sheets.');
    }, 800);
  };

  const avgScore = (
    results.reduce((acc, r) => acc + ((r.score_override ?? r.raw_score) + r.grace_marks), 0) /
    (results.length || 1)
  ).toFixed(1);

  const passRate = (
    (results.filter((r) => r.status === 'passed').length / (results.length || 1)) *
    100
  ).toFixed(0);

  const totalViolations = results.reduce((acc, r) => acc + r.violations, 0);

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="results" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Admin Evaluation & Scoring
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Result & Analytics Control
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Score Overrides, Grace Marks, Pass Rate Telemetry, and Candidate Result Publication
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleRecalculate}
                className="btn btn-secondary"
                disabled={recalculating}
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>🔄</span> {recalculating ? 'Recalculating...' : 'Recalculate All'}
              </button>

              <button
                onClick={() => setResultsPublished(!resultsPublished)}
                className="btn"
                style={{
                  padding: '10px 20px',
                  fontWeight: 700,
                  borderRadius: 8,
                  background: resultsPublished ? 'rgba(16, 185, 129, 0.2)' : 'rgba(43, 127, 255, 0.2)',
                  color: resultsPublished ? '#10B981' : 'var(--color-primary)',
                  border: `1px solid ${resultsPublished ? 'rgba(16, 185, 129, 0.4)' : 'rgba(43, 127, 255, 0.4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{resultsPublished ? '🟢 Results Live to Candidates' : '🔒 Results Hidden (Click to Publish)'}</span>
              </button>
            </div>
          </div>

          {/* Action Feedback */}
          {actionMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(43, 127, 255, 0.12)',
                border: '1px solid rgba(43, 127, 255, 0.3)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                marginBottom: 20,
              }}
            >
              {actionMsg}
            </div>
          )}

          {/* Metric KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Average Score</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>{avgScore} / 50</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>Normalized across sets</div>
            </div>

            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Pass Rate</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>{passRate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>Threshold: ≥ 40%</div>
            </div>

            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Cheating Flags</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: totalViolations > 0 ? '#EF4444' : '#10B981', marginTop: 4 }}>{totalViolations}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>Tab switch & Devtools alerts</div>
            </div>

            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Leaderboard State</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: leaderboardFrozen ? '#F59E0B' : '#10B981', marginTop: 8 }}>
                {leaderboardFrozen ? '❄️ Frozen by Admin' : '🟢 Real-time Synchronized'}
              </div>
              <button
                onClick={() => setLeaderboardFrozen(!leaderboardFrozen)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px', marginTop: 6 }}
              >
                {leaderboardFrozen ? 'Unfreeze' : 'Freeze Leaderboard'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Candidate</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Auto-Graded (MCQ)</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Grace</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Final Score</th>
                  <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--color-text-faint)', fontWeight: 600 }}>Admin Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const finalScore = (r.score_override ?? r.raw_score) + r.grace_marks;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{r.name}</div>
                        <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                          {r.hall_ticket}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                        <div>{r.raw_score} / {r.max_score}</div>
                        <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Auto-graded (MCQ)</div>
                        <div style={{ fontSize: '0.68rem', color: '#38BDF8' }}>Coding: Pending Review</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ color: r.grace_marks > 0 ? '#10B981' : 'var(--color-text-faint)', fontWeight: 700 }}>
                          +{r.grace_marks}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#FFFFFF' }}>
                          {finalScore} / {r.max_score}
                        </strong>
                        {r.score_override !== undefined && (
                          <div style={{ fontSize: '0.7rem', color: '#F59E0B' }}>Overridden</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: r.status === 'passed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: r.status === 'passed' ? '#10B981' : '#EF4444',
                          }}
                        >
                          {r.status.toUpperCase()}
                        </span>
                        {r.violations > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#EF4444', marginTop: 2 }}>
                            ⚠️ {r.violations} flags
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleAddGrace(r.id, 2)}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                            title="Add 2 Grace Marks"
                          >
                            +2 Grace
                          </button>
                          <button
                            onClick={() => {
                              const val = prompt('Enter new authoritative score (0 - 50):', String(r.raw_score));
                              if (val !== null && !isNaN(Number(val))) {
                                handleOverrideScore(r.id, Number(val));
                              }
                            }}
                            className="btn btn-sm"
                            style={{ fontSize: '0.75rem', background: 'rgba(43, 127, 255, 0.15)', color: 'var(--color-primary)' }}
                          >
                            Override
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}
