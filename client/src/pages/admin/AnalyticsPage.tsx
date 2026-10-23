import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  listExams,
  getQuestionAnalytics,
  getTopicAnalytics,
  getParticipantHistory,
  adminLogout,
} from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

interface Exam {
  id: string;
  title: string;
}

interface QuestionStat {
  id: string;
  question: string;
  topic: string;
  marks: number;
  correctOption: string;
  totalAttempts: number;
  totalSessions: number;
  correctCount: number;
  wrongCount: number;
  correctRatePct: number;
  avgTimeSeconds: number;
  skipRatePct: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unattempted';
  reviewFlag: 'too_hard' | 'too_easy' | 'none';
  reviewRecommendation: string | null;
}

interface TopicStat {
  topic: string;
  questionCount: number;
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  accuracyPct: number;
  avgScore: number;
  maxScore: number;
}

interface ParticipantHistoryItem {
  examId: string;
  examTitle: string;
  enrolledAt: string;
  sessionStatus: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  rank: number | null;
  totalParticipants: number;
  violationCount: number;
  timeTakenSeconds: number | null;
}

interface ScoreTrendPoint {
  examTitle: string;
  date: string;
  percentage: number;
  score: number;
  maxScore: number;
  rank: number | null;
}

type SortField = 'question' | 'topic' | 'correctRatePct' | 'avgTimeSeconds' | 'skipRatePct';
type SortOrder = 'asc' | 'desc';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { examId: routeExamId } = useParams();

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(routeExamId || '');
  const [loading, setLoading] = useState(false);

  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);

  // Sorting state for questions table
  const [sortField, setSortField] = useState<SortField>('correctRatePct');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter flagged questions
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);

  // Hall ticket lookup
  const [searchHallTicket, setSearchHallTicket] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [participantResult, setParticipantResult] = useState<{
    hallTicket: string;
    name: string | null;
    email: string | null;
    history: ParticipantHistoryItem[];
    trend?: ScoreTrendPoint[];
  } | null>(null);

  // Load exam list on mount
  useEffect(() => {
    listExams()
      .then((r) => {
        const examList: Exam[] = r.data.exams;
        setExams(examList);
        if (examList.length > 0) {
          const initialId = routeExamId && examList.some((e) => e.id === routeExamId)
            ? routeExamId
            : examList[0].id;
          setSelectedExamId(initialId);
        }
      })
      .catch(() => navigate('/admin'));
  }, [routeExamId]);

  // Sync selected exam from URL if param changes
  useEffect(() => {
    if (routeExamId && routeExamId !== selectedExamId) {
      setSelectedExamId(routeExamId);
    }
  }, [routeExamId]);

  // Load analytics when exam is selected
  useEffect(() => {
    if (!selectedExamId) return;
    setLoading(true);

    Promise.all([
      getQuestionAnalytics(selectedExamId),
      getTopicAnalytics(selectedExamId),
    ])
      .then(([qRes, tRes]) => {
        setQuestionStats(qRes.data.analytics || []);
        setTopicStats(tRes.data.topics || []);
      })
      .catch((err) => {
        console.error('Failed to load analytics:', err);
      })
      .finally(() => setLoading(false));
  }, [selectedExamId]);

  function handleExamChange(newId: string) {
    setSelectedExamId(newId);
    navigate(`/admin/analytics/${newId}`);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'question' || field === 'topic' ? 'asc' : 'desc');
    }
  }

  // Sorted and filtered questions
  const sortedQuestions = useMemo(() => {
    let list = [...questionStats];
    if (filterFlaggedOnly) {
      list = list.filter((q) => q.reviewFlag !== 'none');
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'question') {
        cmp = a.question.localeCompare(b.question);
      } else if (sortField === 'topic') {
        cmp = a.topic.localeCompare(b.topic);
      } else {
        cmp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [questionStats, sortField, sortOrder, filterFlaggedOnly]);

  async function handleHistorySearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchHallTicket.trim()) return;

    setHistoryLoading(true);
    try {
      const res = await getParticipantHistory(searchHallTicket.trim());
      setParticipantResult(res.data);
    } catch (err) {
      console.error('Failed to search participant history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await adminLogout();
    } catch (_) {}
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  // Aggregate metrics
  const totalQuestions = questionStats.length;
  const flaggedCount = questionStats.filter((q) => q.reviewFlag !== 'none').length;
  const totalAttempts = questionStats.reduce((acc, q) => acc + q.totalAttempts, 0);
  const totalCorrect = questionStats.reduce((acc, q) => acc + q.correctCount, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const avgQuestionTime =
    questionStats.length > 0
      ? Math.round(
          questionStats.reduce((acc, q) => acc + q.avgTimeSeconds, 0) / questionStats.length
        )
      : 0;

  // Chart data for topic breakdown
  const topicChartData = topicStats.map((t) => ({
    name: t.topic.length > 18 ? t.topic.substring(0, 16) + '…' : t.topic,
    fullName: t.topic,
    accuracy: t.accuracyPct,
    questions: t.questionCount,
    avgScore: t.avgScore,
    maxScore: t.maxScore,
  }));

  return (
    <AnimatedPage>
      <div className="admin-layout">
        {/* Sidebar */}
        <AdminSidebar activeTab="analytics" />


        {/* Main Content */}
        <main className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: 4 }}>Exam Analytics Engine</h1>
              <p className="text-muted text-sm">
                Question correct-rate, average time per question, skip rate, and topic mastery breakdown.
              </p>
            </div>

            {/* Exam selector */}
            <div style={{ minWidth: 260 }}>
              <select
                id="analytics-exam-select"
                className="form-input"
                value={selectedExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                style={{ cursor: 'pointer', background: 'var(--color-surface-2)' }}
              >
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Total Questions
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalQuestions}</div>
            </div>

            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Total Attempts
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                {totalAttempts}
              </div>
            </div>

            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Overall Accuracy
              </div>
              <div
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  color: overallAccuracy >= 60 ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              >
                {overallAccuracy}%
              </div>
            </div>

            <div className="card card-sm">
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Avg Time / Question
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary-light)' }}>
                {avgQuestionTime}s
              </div>
            </div>

            <div className="card card-sm" style={{ borderLeft: flaggedCount > 0 ? '3px solid var(--color-danger)' : '1px solid var(--color-border)' }}>
              <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                Flagged for Review
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: flaggedCount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                {flaggedCount}
              </div>
            </div>
          </div>

          {/* Topic-Wise Breakdown Section with Bar Chart */}
          <div className="card" style={{ padding: 24, marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>
                  📊 Topic-Wise Accuracy Breakdown
                </h2>
                <p className="text-muted text-xs">
                  Average score percentage per topic across all submitted sessions.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="skeleton" style={{ height: 260, borderRadius: 12 }} />
            ) : topicChartData.length > 0 ? (
              <div style={{ width: '100%', height: 280, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicChartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--color-text-muted)"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                      interval={0}
                    />
                    <YAxis
                      stroke="var(--color-text-muted)"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                      unit="%"
                      domain={[0, 100]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div
                              style={{
                                background: '#111118',
                                border: '1px solid rgba(255,255,255,0.12)',
                                padding: '10px 14px',
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#f0f0f8', marginBottom: 4 }}>
                                {data.fullName}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                                Accuracy: <strong>{data.accuracy}%</strong>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                Questions: {data.questions}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                Avg Score: {data.avgScore} / {data.maxScore}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {topicChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.accuracy >= 70
                              ? '#10b981'
                              : entry.accuracy >= 40
                              ? '#f59e0b'
                              : '#ef4444'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted text-sm text-center" style={{ padding: 32 }}>
                No topic performance data available for this exam yet.
              </p>
            )}
          </div>

          {/* Question-Level Analytics Table */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>
                  🎯 Question-Level Analytics & Outlier Detection
                </h2>
                <p className="text-muted text-xs">
                  Sortable table with correct rates, average time spent, and skip rates. Outliers (&lt;30% or &gt;95%) are flagged for review.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className={`btn btn-sm ${filterFlaggedOnly ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={() => setFilterFlaggedOnly((prev) => !prev)}
                >
                  {filterFlaggedOnly ? 'Show All Questions' : `⚠️ Show Review Flags Only (${flaggedCount})`}
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 50, borderRadius: 10 }} />
                ))}
              </div>
            ) : sortedQuestions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th
                        style={{ width: '38%', cursor: 'pointer' }}
                        onClick={() => handleSort('question')}
                      >
                        Question {sortField === 'question' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('topic')}>
                        Topic {sortField === 'topic' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>Key</th>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('correctRatePct')}
                      >
                        Correct Rate {sortField === 'correctRatePct' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('avgTimeSeconds')}
                      >
                        Avg Time {sortField === 'avgTimeSeconds' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('skipRatePct')}
                      >
                        Skip Rate {sortField === 'skipRatePct' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuestions.map((q) => {
                      const isTooHard = q.reviewFlag === 'too_hard';
                      const isTooEasy = q.reviewFlag === 'too_easy';

                      return (
                        <tr
                          key={q.id}
                          style={{
                            background: isTooHard
                              ? 'rgba(239,68,68,0.04)'
                              : isTooEasy
                              ? 'rgba(245,158,11,0.04)'
                              : undefined,
                          }}
                        >
                          <td>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                marginBottom: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 420,
                              }}
                              title={q.question}
                            >
                              {q.question}
                            </div>
                            <span className="text-xs text-muted">
                              {q.marks} marks • {q.totalAttempts} attempts
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-neutral text-xs">{q.topic}</span>
                          </td>
                          <td>
                            <span className="badge badge-primary font-mono text-xs uppercase">
                              {q.correctOption}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                className="font-bold text-sm"
                                style={{
                                  color: isTooHard
                                    ? 'var(--color-danger)'
                                    : isTooEasy
                                    ? 'var(--color-warning)'
                                    : q.correctRatePct >= 70
                                    ? 'var(--color-success)'
                                    : 'var(--color-text)',
                                }}
                              >
                                {q.correctRatePct}%
                              </span>
                              <span className="text-xs text-muted">
                                ({q.correctCount}/{q.totalAttempts})
                              </span>
                            </div>
                          </td>
                          <td className="font-mono text-sm">
                            {q.avgTimeSeconds > 0 ? `${q.avgTimeSeconds}s` : '—'}
                          </td>
                          <td className="font-mono text-sm">
                            <span style={{ color: q.skipRatePct >= 40 ? 'var(--color-danger)' : undefined }}>
                              {q.skipRatePct}%
                            </span>
                          </td>
                          <td>
                            {isTooHard ? (
                              <span className="badge badge-danger text-xs" title="Correct rate < 30%">
                                ⚠️ Review: Too Hard / Worded
                              </span>
                            ) : isTooEasy ? (
                              <span className="badge badge-warning text-xs" title="Correct rate > 95%">
                                🔍 Review: Too Easy / Tell
                              </span>
                            ) : (
                              <span className="badge badge-neutral text-xs">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card text-center" style={{ padding: 32 }}>
                <p className="text-muted">No questions found matching the filter.</p>
              </div>
            )}
          </div>

          {/* Participant Cross-Exam History View & Trend Line */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
              🔍 Participant Cross-Exam History & Score Trend
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
              Search any Hall Ticket to inspect multi-exam performance, progression trend over time, and violation track records.
            </p>

            <form onSubmit={handleHistorySearch} style={{ display: 'flex', gap: 12, maxWidth: 500, marginBottom: 24 }}>
              <input
                id="participant-history-input"
                type="text"
                className="form-input"
                placeholder="Enter Hall Ticket (e.g. HT-2024-001)"
                value={searchHallTicket}
                onChange={(e) => setSearchHallTicket(e.target.value)}
              />
              <button
                id="participant-history-btn"
                type="submit"
                className="btn btn-primary"
                disabled={historyLoading || !searchHallTicket.trim()}
              >
                {historyLoading ? 'Searching...' : 'Lookup'}
              </button>
            </form>

            {participantResult && (
              <div>
                <div style={{ display: 'flex', gap: 24, marginBottom: 20, background: 'var(--color-surface-2)', padding: 16, borderRadius: 10, flexWrap: 'wrap' }}>
                  <div>
                    <span className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Hall Ticket</span>
                    <div className="font-bold font-mono">{participantResult.hallTicket}</div>
                  </div>
                  {participantResult.name && (
                    <div>
                      <span className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Name</span>
                      <div className="font-bold">{participantResult.name}</div>
                    </div>
                  )}
                  {participantResult.email && (
                    <div>
                      <span className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Email</span>
                      <div className="font-bold">{participantResult.email}</div>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted font-mono" style={{ textTransform: 'uppercase' }}>Exams Taken</span>
                    <div className="font-bold">{participantResult.history.length}</div>
                  </div>
                </div>

                {/* Score Trend Chart if participant took >= 2 exams */}
                {participantResult.trend && participantResult.trend.length >= 2 && (
                  <div style={{ marginBottom: 24, padding: 16, background: 'var(--color-surface-2)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>
                      📈 Performance Trend Over Time
                    </div>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={participantResult.trend} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="examTitle" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                          <YAxis stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} unit="%" domain={[0, 100]} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const pt = payload[0].payload;
                                return (
                                  <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 12px', borderRadius: 8 }}>
                                    <div style={{ fontWeight: 700 }}>{pt.examTitle}</div>
                                    <div style={{ color: 'var(--color-success)', fontSize: 12 }}>Score: {pt.percentage}% ({pt.score}/{pt.maxScore})</div>
                                    {pt.rank && <div style={{ color: 'var(--color-warning)', fontSize: 12 }}>Rank: #{pt.rank}</div>}
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Date: {pt.date}</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line type="monotone" dataKey="percentage" stroke="var(--color-primary-light)" strokeWidth={3} dot={{ r: 5, fill: 'var(--color-accent)' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {participantResult.history.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Rank</th>
                        <th>Violations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantResult.history.map((h, idx) => (
                        <tr key={idx}>
                          <td className="font-bold">{h.examTitle}</td>
                          <td className="text-sm text-muted">{new Date(h.enrolledAt).toLocaleDateString()}</td>
                          <td>
                            <span
                              className={`badge ${
                                h.sessionStatus === 'submitted' || h.sessionStatus === 'completed'
                                  ? 'badge-success'
                                  : h.sessionStatus === 'terminated' || h.sessionStatus === 'terminated_cheating' || h.sessionStatus === 'Terminated - violation'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {h.sessionStatus}
                            </span>
                          </td>
                          <td className="font-mono text-sm">
                            {h.totalScore !== null ? `${h.totalScore} / ${h.maxScore}` : '—'}
                          </td>
                          <td className="font-mono font-bold">
                            {h.percentage !== null ? `${h.percentage}%` : '—'}
                          </td>
                          <td>
                            {h.rank !== null ? (
                              <span className="badge badge-primary font-mono text-xs">
                                #{h.rank} of {h.totalParticipants}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span className={h.violationCount > 0 ? 'text-warning font-bold' : 'text-muted'}>
                              {h.violationCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted text-sm">No exam records found for this hall ticket.</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}
