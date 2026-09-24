import { supabase } from '../db/supabase';
import { getCache, setCache } from './cacheService';

export interface QuestionAnalytics {
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

export interface TopicAnalytics {
  topic: string;
  questionCount: number;
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  accuracyPct: number;
  avgScore: number;
  maxScore: number;
}

export interface ParticipantExamHistory {
  examId: string;
  examTitle: string;
  enrolledAt: string;
  sessionStatus: string;
  startedAt: string | null;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  rank: number | null;
  totalParticipants: number;
  violationCount: number;
  terminationReason: string | null;
  timeTakenSeconds: number | null;
}

export interface ScoreTrendPoint {
  examTitle: string;
  date: string;
  percentage: number;
  score: number;
  maxScore: number;
  rank: number | null;
}

export interface ParticipantHistoryResult {
  hallTicket: string;
  name: string | null;
  email: string | null;
  history: ParticipantExamHistory[];
  trend: ScoreTrendPoint[];
}

const CACHE_TTL_SECONDS = 30; // 30-second TTL to avoid re-aggregating on every page refresh

/**
 * Question-level correct-rate, avg time-per-question, skip rate, and review recommendations.
 */
export async function getExamQuestionAnalytics(examId: string): Promise<QuestionAnalytics[]> {
  const cacheKey = `analytics:questions:${examId}`;
  const cached = getCache<QuestionAnalytics[]>(cacheKey);
  if (cached) return cached;

  // 1. Fetch questions for the exam
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, question, marks, topic, correct_option')
    .eq('exam_id', examId);

  if (qErr || !questions) {
    throw new Error(`Failed to fetch questions for exam ${examId}: ${qErr?.message}`);
  }

  if (questions.length === 0) return [];

  // Fetch total participants who enrolled in this exam
  const { count: participantCount } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId);

  const totalSessions = participantCount || 0;
  const questionIds = questions.map((q) => q.id);

  // 2. Fetch answers for these questions
  const { data: answers, error: aErr } = await supabase
    .from('session_answers')
    .select('question_id, chosen_option, answer_latency_ms')
    .in('question_id', questionIds);

  if (aErr) {
    throw new Error(`Failed to fetch answers for analytics: ${aErr.message}`);
  }

  // 3. Group answers by question_id
  const answerStatsMap = new Map<
    string,
    { total: number; correct: number; totalLatencyMs: number; latencyCount: number }
  >();

  for (const q of questions) {
    answerStatsMap.set(q.id, { total: 0, correct: 0, totalLatencyMs: 0, latencyCount: 0 });
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  for (const ans of answers || []) {
    const stats = answerStatsMap.get(ans.question_id);
    const q = questionMap.get(ans.question_id);
    if (!stats || !q) continue;

    stats.total++;
    if (ans.chosen_option === q.correct_option) {
      stats.correct++;
    }

    if (ans.answer_latency_ms && ans.answer_latency_ms > 0) {
      stats.totalLatencyMs += ans.answer_latency_ms;
      stats.latencyCount++;
    }
  }

  // 4. Transform into analytics array
  const result: QuestionAnalytics[] = questions.map((q) => {
    const stats = answerStatsMap.get(q.id) || { total: 0, correct: 0, totalLatencyMs: 0, latencyCount: 0 };
    const correctRatePct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const avgLatencyMs = stats.latencyCount > 0 ? Math.round(stats.totalLatencyMs / stats.latencyCount) : 0;
    const avgTimeSeconds = Math.round(avgLatencyMs / 1000);

    // Skip rate: participants who didn't answer this question
    const skippedCount = Math.max(0, totalSessions - stats.total);
    const skipRatePct = totalSessions > 0 ? Math.round((skippedCount / totalSessions) * 100) : 0;

    // Difficulty classification
    let difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unattempted' = 'Unattempted';
    if (stats.total > 0) {
      if (correctRatePct >= 70) difficulty = 'Easy';
      else if (correctRatePct >= 40) difficulty = 'Medium';
      else difficulty = 'Hard';
    }

    // Flag questions with correct-rate < 30% or > 95%
    let reviewFlag: 'too_hard' | 'too_easy' | 'none' = 'none';
    let reviewRecommendation: string | null = null;
    if (stats.total > 0) {
      if (correctRatePct < 30) {
        reviewFlag = 'too_hard';
        reviewRecommendation = 'Review: Likely too hard or poorly worded (< 30%)';
      } else if (correctRatePct > 95) {
        reviewFlag = 'too_easy';
        reviewRecommendation = 'Review: Likely too easy or has an obvious tell (> 95%)';
      }
    }

    return {
      id: q.id,
      question: q.question,
      topic: q.topic || 'General',
      marks: Number(q.marks),
      correctOption: q.correct_option,
      totalAttempts: stats.total,
      totalSessions,
      correctCount: stats.correct,
      wrongCount: stats.total - stats.correct,
      correctRatePct,
      avgTimeSeconds,
      skipRatePct,
      difficulty,
      reviewFlag,
      reviewRecommendation,
    };
  });

  setCache(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}

/**
 * Topic-wise performance breakdown per exam.
 */
export async function getExamTopicBreakdown(examId: string): Promise<TopicAnalytics[]> {
  const cacheKey = `analytics:topics:${examId}`;
  const cached = getCache<TopicAnalytics[]>(cacheKey);
  if (cached) return cached;

  // 1. Fetch questions to count questions and max score per topic
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('topic, marks')
    .eq('exam_id', examId);

  if (qErr || !questions) throw new Error('Failed to fetch questions');

  const topicConfigMap = new Map<string, { count: number; maxScore: number }>();
  for (const q of questions) {
    const topic = q.topic || 'General';
    const existing = topicConfigMap.get(topic) || { count: 0, maxScore: 0 };
    existing.count++;
    existing.maxScore += Number(q.marks);
    topicConfigMap.set(topic, existing);
  }

  // 2. Fetch results for participants of this exam
  const { data: participants } = await supabase
    .from('participants')
    .select('id')
    .eq('exam_id', examId);

  const participantIds = (participants || []).map((p) => p.id);
  if (participantIds.length === 0) {
    const defaultList = Array.from(topicConfigMap.entries()).map(([topic, cfg]) => ({
      topic,
      questionCount: cfg.count,
      totalAttempts: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracyPct: 0,
      avgScore: 0,
      maxScore: cfg.maxScore,
    }));
    setCache(cacheKey, defaultList, CACHE_TTL_SECONDS);
    return defaultList;
  }

  const { data: results } = await supabase
    .from('results')
    .select('topic_breakdown')
    .in('participant_id', participantIds);

  const topicAggregateMap = new Map<
    string,
    { totalCorrect: number; totalWrong: number; totalScore: number; submissions: number }
  >();

  for (const res of results || []) {
    const tb = (res.topic_breakdown as Record<string, { correct: number; wrong: number; score: number }>) || {};
    for (const [topic, metrics] of Object.entries(tb)) {
      const agg = topicAggregateMap.get(topic) || {
        totalCorrect: 0,
        totalWrong: 0,
        totalScore: 0,
        submissions: 0,
      };
      agg.totalCorrect += metrics.correct || 0;
      agg.totalWrong += metrics.wrong || 0;
      agg.totalScore += metrics.score || 0;
      agg.submissions++;
      topicAggregateMap.set(topic, agg);
    }
  }

  const result: TopicAnalytics[] = Array.from(topicConfigMap.entries()).map(([topic, cfg]) => {
    const agg = topicAggregateMap.get(topic) || {
      totalCorrect: 0,
      totalWrong: 0,
      totalScore: 0,
      submissions: 0,
    };
    const totalAttempts = agg.totalCorrect + agg.totalWrong;
    const accuracyPct = totalAttempts > 0 ? Math.round((agg.totalCorrect / totalAttempts) * 100) : 0;
    const avgScore = agg.submissions > 0 ? Math.round((agg.totalScore / agg.submissions) * 10) / 10 : 0;

    return {
      topic,
      questionCount: cfg.count,
      totalAttempts,
      totalCorrect: agg.totalCorrect,
      totalWrong: agg.totalWrong,
      accuracyPct,
      avgScore,
      maxScore: cfg.maxScore,
    };
  });

  setCache(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}

/**
 * Participant history view: lookup performance and score trend across all exams for a hall ticket.
 */
export async function getParticipantHistory(hallTicket: string): Promise<ParticipantHistoryResult> {
  const cleanTicket = hallTicket.trim();

  // Find all participant records with this hall_ticket
  const { data: participants, error: pErr } = await supabase
    .from('participants')
    .select('id, exam_id, name, email, enrolled_at')
    .ilike('hall_ticket', cleanTicket);

  if (pErr) throw new Error(`Failed to query participant history: ${pErr.message}`);
  if (!participants || participants.length === 0) {
    return { hallTicket: cleanTicket, name: null, email: null, history: [], trend: [] };
  }

  const primaryName = participants[0]?.name || null;
  const primaryEmail = participants[0]?.email || null;

  const history: ParticipantExamHistory[] = [];

  for (const p of participants) {
    const { data: exam } = await supabase
      .from('exams')
      .select('id, title')
      .eq('id', p.exam_id)
      .single();

    const { data: session } = await supabase
      .from('exam_sessions')
      .select('id, status, started_at, submitted_at, violation_count, termination_reason')
      .eq('participant_id', p.id)
      .maybeSingle();

    let totalScore: number | null = null;
    let maxScore: number | null = null;
    let percentage: number | null = null;
    let rank: number | null = null;
    let timeTakenSeconds: number | null = null;
    let totalParticipants = 0;

    const { count: examParticipantsCount } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', p.exam_id);

    totalParticipants = examParticipantsCount || 1;

    if (session) {
      const { data: result } = await supabase
        .from('results')
        .select('total_score, max_score, time_taken_seconds')
        .eq('session_id', session.id)
        .maybeSingle();

      if (result) {
        totalScore = Number(result.total_score);
        maxScore = Number(result.max_score);
        percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        timeTakenSeconds = result.time_taken_seconds;

        const { data: allResults } = await supabase
          .from('results')
          .select('total_score, time_taken_seconds, participant_id')
          .in(
            'participant_id',
            (
              await supabase
                .from('participants')
                .select('id')
                .eq('exam_id', p.exam_id)
            ).data?.map((x) => x.id) || []
          );

        if (allResults) {
          allResults.sort((a, b) => {
            if (Number(b.total_score) !== Number(a.total_score)) {
              return Number(b.total_score) - Number(a.total_score);
            }
            return (a.time_taken_seconds || 0) - (b.time_taken_seconds || 0);
          });

          const idx = allResults.findIndex((r) => r.participant_id === p.id);
          rank = idx !== -1 ? idx + 1 : null;
        }
      }
    }

    history.push({
      examId: p.exam_id,
      examTitle: exam?.title || 'Unknown Exam',
      enrolledAt: p.enrolled_at,
      sessionStatus: session?.status || 'not_enrolled',
      startedAt: session?.started_at || null,
      submittedAt: session?.submitted_at || null,
      totalScore,
      maxScore,
      percentage,
      rank,
      totalParticipants,
      violationCount: session?.violation_count || 0,
      terminationReason: session?.termination_reason || null,
      timeTakenSeconds,
    });
  }

  // Sort history chronologically descending
  history.sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());

  // Build trend points chronologically ascending for chart visualization
  const trend: ScoreTrendPoint[] = [...history]
    .reverse()
    .filter((h) => h.percentage !== null)
    .map((h) => ({
      examTitle: h.examTitle,
      date: new Date(h.enrolledAt).toLocaleDateString(),
      percentage: h.percentage || 0,
      score: h.totalScore || 0,
      maxScore: h.maxScore || 0,
      rank: h.rank,
    }));

  return {
    hallTicket: cleanTicket,
    name: primaryName,
    email: primaryEmail,
    history,
    trend,
  };
}
