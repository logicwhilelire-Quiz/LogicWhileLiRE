import { supabase } from '../db/supabase';
import { sendResultEmail } from './emailService';

interface TopicBreakdown {
  [topic: string]: {
    correct: number;
    wrong: number;
    score: number;
    maxScore: number;
  };
}

/**
 * Grade a submitted session.
 * Compares stored session_answers against questions.correct_option server-side.
 * NEVER uses any client-provided score — all computation is server-side.
 * Idempotent: re-grading overwrites existing result.
 */
export async function gradeSession(sessionId: string): Promise<void> {
  // 1. Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('id, participant_id, started_at, submitted_at, question_order, question_set, set_number')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) throw new Error(`Session ${sessionId} not found`);

  // 2. Fetch all answers for this session
  const { data: answers, error: answerError } = await supabase
    .from('session_answers')
    .select('question_id, chosen_option')
    .eq('session_id', sessionId);

  if (answerError) throw new Error('Failed to fetch session answers');

  // 3. Fetch questions for this session's exam
  // Get exam_id and contact details via participant
  const { data: participant } = await supabase
    .from('participants')
    .select('exam_id, name, email, hall_ticket')
    .eq('id', session.participant_id)
    .single();

  if (!participant) throw new Error('Participant not found');

  const { data: allQuestions, error: qError } = await supabase
    .from('questions')
    .select('id, correct_option, marks, topic, set_number, question_set')
    .eq('exam_id', participant.exam_id);

  if (qError || !allQuestions) throw new Error('Failed to fetch questions');

  // Filter questions for the session's assigned set / randomized question_order
  let questions = allQuestions;
  if (session.question_order && Array.isArray(session.question_order) && session.question_order.length > 0) {
    const orderSet = new Set(session.question_order);
    questions = allQuestions.filter((q) => orderSet.has(q.id));
  } else if (session.set_number) {
    const setQuestions = allQuestions.filter(
      (q) =>
        q.set_number === session.set_number ||
        q.question_set === session.question_set ||
        q.question_set === 'ALL'
    );
    if (setQuestions.length > 0) {
      questions = setQuestions;
    }
  }

  // 4. Score computation
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  const topicBreakdown: TopicBreakdown = {};

  const answerMap = new Map(answers?.map((a) => [a.question_id, a.chosen_option]) ?? []);

  for (const question of questions) {
    const topic = question.topic || 'General';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { correct: 0, wrong: 0, score: 0, maxScore: 0 };
    }

    maxScore += Number(question.marks);
    topicBreakdown[topic].maxScore += Number(question.marks);

    const given = answerMap.get(question.id);
    if (given === undefined) continue; // unanswered

    if (given === question.correct_option) {
      totalScore += Number(question.marks);
      topicBreakdown[topic].score += Number(question.marks);
      topicBreakdown[topic].correct++;
      correctCount++;
    } else {
      topicBreakdown[topic].wrong++;
      wrongCount++;
    }
  }

  // Normalize score to 100% scale for cross-set equity
  const normalizedScore = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;

  // 5. Compute time taken
  const startedAt = session.started_at ? new Date(session.started_at) : null;
  const submittedAt = session.submitted_at ? new Date(session.submitted_at) : new Date();
  const timeTakenSeconds = startedAt
    ? Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000)
    : 0;

  // 6. Upsert result (idempotent)
  const { error: resultError } = await supabase.from('results').upsert(
    {
      session_id: sessionId,
      participant_id: session.participant_id,
      total_score: totalScore,
      max_score: maxScore,
      normalized_score: normalizedScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      time_taken_seconds: timeTakenSeconds,
      topic_breakdown: topicBreakdown,
      graded_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  );

  if (resultError) throw new Error(`Failed to save result: ${resultError.message}`);

  console.log(
    `[Grading] Session ${sessionId}: score=${totalScore}/${maxScore} (${normalizedScore}%) correct=${correctCount} wrong=${wrongCount}`
  );

  // 7. Auto-send result email to participant asynchronously via non-blocking queue
  if (participant.email) {
    (async () => {
      try {
        const { data: examData } = await supabase
          .from('exams')
          .select('title, is_leaderboard_public')
          .eq('id', participant.exam_id)
          .single();

        const isPublic = examData?.is_leaderboard_public !== false;

        // Calculate rank based on normalized_score first
        const { count: higherScoresCount } = await supabase
          .from('results')
          .select('session_id', { count: 'exact', head: true })
          .gt('normalized_score', normalizedScore);

        const currentRank = isPublic ? (higherScoresCount || 0) + 1 : null;

        const { emailQueue } = await import('./emailQueue');
        emailQueue.enqueueResultEmail({
          toEmail: participant.email,
          recipientName: participant.name,
          hallTicket: participant.hall_ticket,
          examTitle: examData?.title || 'Exam',
          result: {
            totalScore,
            maxScore,
            normalizedScore,
            correctCount,
            wrongCount,
            timeTakenSeconds,
            rank: currentRank,
            isLeaderboardPublic: isPublic,
            topicBreakdown,
          },
          examId: participant.exam_id,
          sessionId,
          participantId: session.participant_id,
        });
      } catch (emailErr) {
        console.error(`[Grading] Failed to enqueue result email for ${participant.email}:`, emailErr);
      }
    })();
  }
}

