import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import { API_BASE_URL } from '../../lib/config';

interface ExamOption {
  exam_code: string;
  exam_name?: string;
  total_questions?: number;
  total_marks?: number;
  results_published?: boolean;
}

interface ResultItem {
  id: string;
  attempt_id?: string;
  exam_code: string;
  hall_ticket: string;
  name: string;
  raw_score: number;
  grace_marks: number;
  score_override?: number;
  override_reason?: string | null;
  final_score: number;
  max_score: number;
  time_seconds: number;
  violations: number;
  status: 'passed' | 'failed' | 'in_progress' | 'terminated_cheating' | string;
  created_at?: string;
  end_time?: string;
}

interface ExamStats {
  average_score: number;
  max_score: number;
  pass_rate: number;
  total_violations: number;
  results_published: boolean;
  total_candidates: number;
}

export default function ResultControl() {
  const [selectedExam, setSelectedExam] = useState<string>('GR-LOGICWHILE-285G9G');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [stats, setStats] = useState<ExamStats>({
    average_score: 0,
    max_score: 10,
    pass_rate: 0,
    total_violations: 0,
    results_published: false,
    total_candidates: 0,
  });
  const [resultsPublished, setResultsPublished] = useState(false);
  const [leaderboardFrozen, setLeaderboardFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('inspector_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchResults = useCallback(async (examCodeToFetch?: string) => {
    setLoading(true);
    try {
      const code = examCodeToFetch !== undefined ? examCodeToFetch : selectedExam;
      const res = await axios.get(`${API_BASE_URL}/api/admin/results`, {
        params: code && code !== 'ALL' ? { examCode: code } : {},
        headers: getAuthHeaders(),
      });

      if (res.data?.success) {
        const fetchedExams: ExamOption[] = res.data.exams || [];
        setExams(fetchedExams);

        if (!code && fetchedExams.length > 0) {
          const defaultCode = fetchedExams.find(e => e.exam_code.includes('285G9G') || e.exam_code.includes('28SG9G'))?.exam_code || fetchedExams[0].exam_code;
          setSelectedExam(defaultCode);
        } else if (res.data.selectedExam && !examCodeToFetch) {
          setSelectedExam(res.data.selectedExam);
        }

        setResults(res.data.results || []);
        if (res.data.stats) {
          setStats(res.data.stats);
          setResultsPublished(Boolean(res.data.stats.results_published));
        }
      }
    } catch (err: any) {
      console.warn('[ResultControl] Failed to load live results from API:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [selectedExam]);

  useEffect(() => {
    fetchResults();
  }, []);

  const handleExamChange = (newCode: string) => {
    setSelectedExam(newCode);
    setActionMsg('');
    fetchResults(newCode);
  };

  const handleTogglePublish = async () => {
    if (!selectedExam || selectedExam === 'ALL') {
      setActionMsg('⚠️ Please select a specific exam code to toggle result publication.');
      return;
    }
    setTogglingPublish(true);
    try {
      const nextState = !resultsPublished;
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/results/toggle-publish`,
        { examCode: selectedExam, publish: nextState },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setResultsPublished(res.data.results_published);
        setActionMsg(`✅ ${res.data.message}`);
      }
    } catch (err: any) {
      setActionMsg(`❌ Failed to update publish status: ${err?.response?.data?.error || err.message}`);
    } finally {
      setTogglingPublish(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedExam || selectedExam === 'ALL') {
      setActionMsg('⚠️ Please select a specific exam code to recalculate.');
      return;
    }
    setRecalculating(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/results/recalculate`,
        { examCode: selectedExam },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setActionMsg(`✅ ${res.data.message}`);
        await fetchResults(selectedExam);
      }
    } catch (err: any) {
      setActionMsg(`❌ Recalculation failed: ${err?.response?.data?.error || err.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleAddGrace = async (item: ResultItem, amount: number) => {
    try {
      const nextGrace = item.grace_marks + amount;
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/results/${item.id}/override`,
        { grace_marks: nextGrace },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setActionMsg(`✅ Granted +${amount} grace marks to ${item.name} (${item.hall_ticket}).`);
        setResults(prev => prev.map(r => r.id === item.id ? {
          ...r,
          grace_marks: nextGrace,
          final_score: (r.score_override ?? r.raw_score) + nextGrace,
          status: ((r.score_override ?? r.raw_score) + nextGrace) >= r.max_score * 0.4 ? 'passed' : 'failed',
        } : r));
      }
    } catch (err: any) {
      setActionMsg(`❌ Failed to apply grace marks: ${err?.response?.data?.error || err.message}`);
    }
  };

  const handleOverrideScore = async (item: ResultItem) => {
    const promptVal = prompt(
      `Enter new authoritative score for ${item.name} (0 - ${item.max_score}):`,
      String(item.score_override ?? item.raw_score)
    );
    if (promptVal === null) return;
    const num = Number(promptVal);
    if (isNaN(num) || num < 0) {
      alert('Invalid score entered.');
      return;
    }

    const reason = prompt('Enter audit reason for this score override (optional):', 'Administrative review');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/results/${item.id}/override`,
        { score_override: num, reason },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setActionMsg(`✅ Score overridden to ${num} for ${item.name}.`);
        setResults(prev => prev.map(r => r.id === item.id ? {
          ...r,
          score_override: num,
          override_reason: reason,
          final_score: num + r.grace_marks,
          status: (num + r.grace_marks) >= r.max_score * 0.4 ? 'passed' : 'failed',
        } : r));
      }
    } catch (err: any) {
      setActionMsg(`❌ Failed to override score: ${err?.response?.data?.error || err.message}`);
    }
  };

  const maxScoreDisplay = stats.max_score || 10;
  const avgScore = stats.average_score.toFixed(1);
  const passRate = stats.pass_rate;
  const totalViolations = stats.total_violations;

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="results" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary, #38BDF8)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Admin Evaluation & Scoring
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text, #F8FAFC)', margin: 0, fontFamily: 'var(--font-display, sans-serif)' }}>
                Result & Analytics Control
              </h1>
              <p style={{ color: 'var(--color-text-muted, #94A3B8)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Live database scores, score overrides, grace marks, and candidate result publication
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleRecalculate}
                className="btn btn-secondary"
                disabled={recalculating || loading}
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>🔄</span> {recalculating ? 'Recalculating...' : 'Recalculate All'}
              </button>

              <button
                onClick={handleTogglePublish}
                disabled={togglingPublish || loading}
                className="btn"
                style={{
                  padding: '10px 20px',
                  fontWeight: 700,
                  borderRadius: 8,
                  background: resultsPublished ? 'rgba(16, 185, 129, 0.2)' : 'rgba(43, 127, 255, 0.2)',
                  color: resultsPublished ? '#10B981' : 'var(--color-primary, #38BDF8)',
                  border: `1px solid ${resultsPublished ? 'rgba(16, 185, 129, 0.4)' : 'rgba(43, 127, 255, 0.4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <span>{resultsPublished ? '🟢 Results Live to Candidates' : '🔒 Results Hidden (Click to Publish)'}</span>
              </button>
            </div>
          </div>

          {/* Exam Filter Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 10,
              padding: '14px 20px',
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F8FAFC' }}>Selected Examination:</span>
            </div>

            <div style={{ flex: '1 1 300px', maxWidth: 420 }}>
              <select
                id="exam-select-dropdown"
                value={selectedExam}
                onChange={(e) => handleExamChange(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.95)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {exams.map((ex) => (
                  <option key={ex.exam_code} value={ex.exam_code}>
                    {ex.exam_code} — {ex.exam_name || 'Examination'} ({ex.total_questions || 10} Qs / {ex.total_marks || 10} M)
                  </option>
                ))}
                <option value="ALL">🌐 All Examinations (Combined View)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              <button
                onClick={() => fetchResults(selectedExam)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '6px 12px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                ⚡ Refresh Live Data
              </button>
            </div>
          </div>

          {/* Action Feedback Banner */}
          {actionMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(43, 127, 255, 0.12)',
                border: '1px solid rgba(43, 127, 255, 0.3)',
                color: 'var(--color-primary, #38BDF8)',
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
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-primary, #38BDF8)', marginTop: 4 }}>
                {avgScore} / {maxScoreDisplay}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>Normalized across {results.length} candidate(s)</div>
            </div>

            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Pass Rate</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10B981', marginTop: 4 }}>{passRate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>Threshold: ≥ 40%</div>
            </div>

            <div className="card" style={{ padding: '18px 22px', borderRadius: 10, background: 'rgba(11, 18, 38, 0.7)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>Cheating Flags</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: totalViolations > 0 ? '#EF4444' : '#10B981', marginTop: 4 }}>
                {totalViolations}
              </div>
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

          {/* Results Table or Empty State */}
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>⚡</div>
              <div>Loading real candidate attempts and scores from database...</div>
            </div>
          ) : results.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '48px 32px',
                textAlign: 'center',
                borderRadius: 12,
                border: '1px dashed rgba(56, 189, 248, 0.3)',
                background: 'rgba(15, 23, 42, 0.6)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>
                No Candidate Submissions Found for {selectedExam}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', maxWidth: 500, margin: '0 auto 20px auto' }}>
                Candidates who enter the examination portal and submit their answers will appear here with instant auto-grading, cheating logs, and rank telemetry.
              </p>
              <button
                onClick={() => fetchResults(selectedExam)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontWeight: 600 }}
              >
                🔄 Refresh Attempts
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Candidate</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Exam Code</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--color-text-faint)', fontWeight: 600 }}>Auto-Graded</th>
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
                          <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-primary, #38BDF8)' }}>
                            {r.hall_ticket}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {r.exam_code}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--color-text-muted)' }}>
                          <div>{r.raw_score} / {r.max_score}</div>
                          <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Auto-graded</div>
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
                            <div style={{ fontSize: '0.7rem', color: '#F59E0B' }}>
                              Overridden {r.override_reason ? `(${r.override_reason})` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: r.status === 'passed'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : r.status === 'in_progress'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                              color: r.status === 'passed'
                                ? '#10B981'
                                : r.status === 'in_progress'
                                ? '#38BDF8'
                                : '#EF4444',
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
                              onClick={() => handleAddGrace(r, 2)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                              title="Add 2 Grace Marks"
                            >
                              +2 Grace
                            </button>
                            <button
                              onClick={() => handleOverrideScore(r)}
                              className="btn btn-sm"
                              style={{ fontSize: '0.75rem', background: 'rgba(43, 127, 255, 0.15)', color: 'var(--color-primary, #38BDF8)' }}
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
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
