import { supabase } from '../db/supabase';

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Deterministic shuffle seeded by participant_id ensures the same
 * question order is returned on every page request for the same participant.
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a UUID string to a 32-bit integer seed for the PRNG.
 */
function uuidToSeed(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 8);
  return parseInt(hex, 16);
}

/**
 * Fisher-Yates shuffle using a seeded PRNG.
 */
function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Start an exam session:
 * - Set status to 'in_progress'
 * - Compute server-authoritative end_time = now() + duration_minutes
 * - Compute and store randomized question order (seeded by participant_id)
 * Returns { endTime, sessionId }
 */
export async function startSession(
  sessionId: string,
  participantId: string,
  examId: string,
  browserFingerprint?: string
): Promise<{ endTime: Date; questionCount: number; questionSet: string; setNumber: number }> {
  // Fetch exam duration
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('duration_minutes, start_time')
    .eq('id', examId)
    .single();

  if (examError || !exam) throw new Error('Exam not found');

  const now = new Date();
  const effectiveStart = exam.start_time && new Date(exam.start_time) > now
    ? new Date(exam.start_time)
    : now;

  const endTime = new Date(effectiveStart.getTime() + exam.duration_minutes * 60 * 1000);

  // Fetch questions for this exam to determine available sets
  const { data: allQuestions, error: qError } = await supabase
    .from('questions')
    .select('id, question_set, set_number')
    .eq('exam_id', examId);

  if (qError) throw new Error('Failed to load questions');

  // Determine rotating question set deterministically seeded by participantId
  const availableSetNumbers = Array.from(
    new Set((allQuestions || []).map((q) => q.set_number || 1))
  ).sort((a, b) => a - b);

  const seed = uuidToSeed(participantId);
  const assignedSetNumber = availableSetNumbers.length > 0
    ? availableSetNumbers[seed % availableSetNumbers.length]
    : (seed % 2) + 1;
  const assignedSetLetter = String.fromCharCode(64 + (((assignedSetNumber - 1) % 26) + 1));

  // Filter questions for the participant's assigned set (or 'ALL' / default)
  // If exam has no set-specific questions, fallback to all questions
  const setSpecificQuestions = (allQuestions || []).filter(
    (q) =>
      q.set_number === assignedSetNumber ||
      q.question_set === assignedSetLetter ||
      q.question_set === 'ALL'
  );
  const eligibleQuestions = setSpecificQuestions.length > 0 ? setSpecificQuestions : allQuestions || [];
  const questionIds = eligibleQuestions.map((q) => q.id);

  // Shuffle question order seeded by participant_id (deterministic)
  const rand = mulberry32(seed);
  const shuffledIds = seededShuffle(questionIds, rand);

  // Check for suspicious duplicate browser fingerprint across different hall tickets within same exam
  const flags: unknown[] = [];
  if (browserFingerprint && browserFingerprint.trim()) {
    const cleanFp = browserFingerprint.trim();

    // Get current participant info
    const { data: currentParticipant } = await supabase
      .from('participants')
      .select('id, hall_ticket, name')
      .eq('id', participantId)
      .single();
    const currentTicket = currentParticipant?.hall_ticket || 'Unknown';

    // Get all other participants for this exam
    const { data: examParticipants } = await supabase
      .from('participants')
      .select('id, hall_ticket, name')
      .eq('exam_id', examId);

    const pMap = new Map((examParticipants || []).map((p) => [p.id, p]));
    const otherPids = (examParticipants || [])
      .map((p) => p.id)
      .filter((id) => id !== participantId);

    if (otherPids.length > 0) {
      const { data: conflictSessions } = await supabase
        .from('exam_sessions')
        .select('id, participant_id, status, started_at, fingerprint, browser_fingerprint')
        .in('participant_id', otherPids)
        .in('status', ['in_progress', 'submitted'])
        .or(`fingerprint.eq.${cleanFp},browser_fingerprint.eq.${cleanFp}`);

      if (conflictSessions && conflictSessions.length > 0) {
        for (const conflict of conflictSessions) {
          const conflictParticipant = pMap.get(conflict.participant_id);
          const conflictTicket = conflictParticipant?.hall_ticket || 'Unknown';
          const flagItem = {
            type: 'duplicate_fingerprint',
            fingerprint: cleanFp,
            conflict_session_id: conflict.id,
            conflict_participant_id: conflict.participant_id,
            conflict_hall_ticket: conflictTicket,
            at: now.toISOString(),
          };
          flags.push(flagItem);

          // Record in suspicious_activity table for manual admin review (never auto-block)
          try {
            const { data: existingFlag } = await supabase
              .from('suspicious_activity')
              .select('id')
              .eq('session_id', sessionId)
              .eq('conflict_session_id', conflict.id)
              .maybeSingle();

            if (!existingFlag) {
              await supabase.from('suspicious_activity').insert({
                exam_id: examId,
                session_id: sessionId,
                participant_id: participantId,
                hall_ticket: currentTicket,
                conflict_session_id: conflict.id,
                conflict_participant_id: conflict.participant_id,
                conflict_hall_ticket: conflictTicket,
                activity_type: 'duplicate_fingerprint',
                fingerprint: cleanFp,
                details: {
                  current_participant_name: currentParticipant?.name,
                  conflict_participant_name: conflictParticipant?.name,
                  conflict_session_status: conflict.status,
                  detected_at: now.toISOString(),
                },
                status: 'pending_review',
              });
            }
          } catch (dbErr) {
            console.warn('[Session] Failed to insert suspicious activity:', dbErr);
          }
        }
      }
    }
  }

  // Update session
  const updatePayload: Record<string, unknown> = {
    status: 'in_progress',
    started_at: now.toISOString(),
    end_time: endTime.toISOString(),
    question_order: shuffledIds,
    question_set: assignedSetLetter,
    set_number: assignedSetNumber,
  };

  if (browserFingerprint) {
    updatePayload.fingerprint = browserFingerprint.trim();
    updatePayload.browser_fingerprint = browserFingerprint.trim();
  }
  if (flags.length > 0) {
    updatePayload.suspicious_flags = flags;
  }

  const { error: updateError } = await supabase
    .from('exam_sessions')
    .update(updatePayload)
    .eq('id', sessionId);

  if (updateError) throw new Error('Failed to start session');

  return {
    endTime,
    questionCount: shuffledIds.length,
    questionSet: assignedSetLetter,
    setNumber: assignedSetNumber,
  };
}

/**
 * Get time remaining for a session (in seconds).
 * This is the server truth — client uses this to resync its displayed countdown.
 */
export async function getTimeRemaining(
  sessionId: string
): Promise<{ remainingSeconds: number; serverTime: string; status: string }> {
  const { data: session, error } = await supabase
    .from('exam_sessions')
    .select('end_time, status, submitted_at')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error('Session not found');

  if (session.status === 'submitted' || session.status === 'terminated') {
    return { remainingSeconds: 0, serverTime: new Date().toISOString(), status: session.status };
  }

  const now = new Date();
  const endTime = new Date(session.end_time);
  const remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

  // Auto-submit if expired
  if (remainingSeconds === 0 && session.status === 'in_progress') {
    await autoSubmitSession(sessionId, 'timer_expired');
  }

  return {
    remainingSeconds,
    serverTime: now.toISOString(),
    status: remainingSeconds === 0 ? 'submitted' : session.status,
  };
}

/**
 * Get a page of questions for a session (no correct_option included).
 * Respects the stored randomized question order.
 */
export async function getSessionQuestions(
  sessionId: string,
  participantId: string,
  page: number,
  pageSize: number = 10
): Promise<{ questions: unknown[]; totalCount: number; totalPages: number }> {
  // Fetch stored question order
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('question_order, status')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) throw new Error('Session not found');
  if (session.status === 'not_started') throw new Error('Session has not started yet');

  const questionOrder: string[] = session.question_order || [];
  const totalCount = questionOrder.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const pageIndex = Math.max(0, page - 1);
  const pageIds = questionOrder.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  if (pageIds.length === 0) {
    return { questions: [], totalCount, totalPages };
  }

  // Fetch questions — NEVER include correct_option
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, question, options, marks, topic')  // ← correct_option excluded
    .in('id', pageIds);

  if (qError) throw new Error('Failed to fetch questions');

  // Restore page order (Supabase .in() doesn't guarantee order)
  const ordered = pageIds
    .map((id) => questions?.find((q) => q.id === id))
    .filter(Boolean);

  // Shuffle option order per participant (seeded)
  const seed = uuidToSeed(participantId);
  const rand = mulberry32(seed);

  const shuffledQuestions = ordered.map((q: any) => {
    const optionKeys = ['a', 'b', 'c', 'd'] as const;
    const shuffledKeys = seededShuffle([...optionKeys], rand);
    const optionMap: Record<string, string> = {};
    const displayOptions: Record<string, string> = {};

    shuffledKeys.forEach((originalKey, newIndex) => {
      const newKey = optionKeys[newIndex];
      displayOptions[newKey] = q.options[originalKey];
      optionMap[newKey] = originalKey; // client's new key -> original key
    });

    return {
      id: q.id,
      question: q.question,
      options: displayOptions,
      marks: q.marks,
      topic: q.topic,
      _optionMap: optionMap, // included so server can reverse-map chosen option
    };
  });

  // We strip _optionMap before sending to client (it would defeat the shuffle)
  // The mapping is stored server-side via the participant's seed — it's always reconstructible
  const clientQuestions = shuffledQuestions.map(({ _optionMap, ...q }) => q);

  return { questions: clientQuestions, totalCount, totalPages };
}

/**
 * Save a participant's answer for a question.
 * Validates session is active and not expired.
 * Maps the client's (possibly shuffled) option back to the canonical option.
 */
export async function saveAnswer(
  sessionId: string,
  participantId: string,
  questionId: string,
  chosenOption: string,
  answerLatencyMs?: number
): Promise<void> {
  // Validate session
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('status, end_time, question_order')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) throw new Error('Session not found');

  if (session.status === 'terminated') {
    throw Object.assign(new Error('Session terminated'), { code: 'SESSION_TERMINATED' });
  }
  if (session.status === 'submitted') {
    throw Object.assign(new Error('Exam already submitted'), { code: 'ALREADY_SUBMITTED' });
  }

  // Server-side timer check
  const now = new Date();
  if (new Date(session.end_time) <= now) {
    await autoSubmitSession(sessionId, 'timer_expired');
    throw Object.assign(new Error('Time is up'), { code: 'TIME_EXPIRED' });
  }

  // Ensure questionId is part of this session's questions
  const questionOrder: string[] = session.question_order || [];
  if (!questionOrder.includes(questionId)) {
    throw new Error('Question does not belong to this session');
  }

  // Reverse-map the shuffled option to the canonical option
  // The shuffle is deterministic from participant_id seed — reconstruct the mapping
  const canonicalOption = reverseMapOption(participantId, questionId, chosenOption);

  // Flag suspicious speed
  const suspiciousSpeed = answerLatencyMs !== undefined && answerLatencyMs < 2000;

  // Upsert answer (update if already answered)
  const { error: answerError } = await supabase
    .from('session_answers')
    .upsert(
      {
        session_id: sessionId,
        question_id: questionId,
        chosen_option: canonicalOption,
        answered_at: now.toISOString(),
        answer_latency_ms: answerLatencyMs,
      },
      { onConflict: 'session_id,question_id' }
    );

  if (answerError) throw new Error('Failed to save answer');

  // Flag suspicious speed for manual review (don't auto-terminate)
  if (suspiciousSpeed) {
    const { data: currentSession } = await supabase
      .from('exam_sessions')
      .select('suspicious_flags')
      .eq('id', sessionId)
      .single();

    const flags: unknown[] = currentSession?.suspicious_flags || [];
    flags.push({ type: 'fast_answer', questionId, latency_ms: answerLatencyMs, at: now.toISOString() });

    await supabase
      .from('exam_sessions')
      .update({ suspicious_flags: flags })
      .eq('id', sessionId);
  }
}

/**
 * Reverse-map a displayed option key back to the canonical option key.
 * Uses the same seeded PRNG as getSessionQuestions to reconstruct the shuffle mapping.
 */
function reverseMapOption(
  participantId: string,
  questionId: string,
  displayedOption: string
): string {
  const seed = uuidToSeed(participantId);
  const rand = mulberry32(seed);
  const optionKeys = ['a', 'b', 'c', 'd'] as const;
  const shuffledKeys = seededShuffle([...optionKeys], rand);

  // displayedKey is what client sees at position `index`
  // shuffledKeys[index] is the original canonical key at that position
  const displayIndex = optionKeys.indexOf(displayedOption as 'a' | 'b' | 'c' | 'd');
  if (displayIndex === -1) return displayedOption;

  return shuffledKeys[displayIndex];
}

/**
 * Auto-submit a session (called by cron or timer expiry detection).
 * Idempotent — safe to call multiple times.
 */
export async function autoSubmitSession(
  sessionId: string,
  reason: string = 'timer_expired'
): Promise<void> {
  // Only update if session is still in_progress
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session || session.status !== 'in_progress') return;

  const now = new Date();
  await supabase
    .from('exam_sessions')
    .update({
      status: 'submitted',
      submitted_at: now.toISOString(),
      termination_reason: reason,
    })
    .eq('id', sessionId)
    .eq('status', 'in_progress'); // race condition guard

  // Trigger grading asynchronously
  const { gradeSession } = await import('./gradingService');
  gradeSession(sessionId).catch((err) =>
    console.error(`[AutoSubmit] Grading failed for session ${sessionId}:`, err)
  );
}

/**
 * Submit a session manually by the participant.
 */
export async function submitSession(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('exam_sessions')
    .select('status, end_time')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error('Session not found');

  if (session.status === 'submitted') return; // already done
  if (session.status === 'terminated') {
    throw Object.assign(new Error('Session terminated'), { code: 'SESSION_TERMINATED' });
  }

  const now = new Date();
  await supabase
    .from('exam_sessions')
    .update({ status: 'submitted', submitted_at: now.toISOString() })
    .eq('id', sessionId)
    .eq('status', 'in_progress');

  const { gradeSession } = await import('./gradingService');
  gradeSession(sessionId).catch((err) =>
    console.error(`[Submit] Grading failed for session ${sessionId}:`, err)
  );
}

/**
 * Check for suspicious IP patterns: multiple hall tickets from same IP in same exam.
 * Records a flag for manual admin review (does NOT auto-terminate).
 */
export async function checkIpSuspicion(
  sessionId: string,
  examId: string,
  ip: string
): Promise<void> {
  // Count sessions for this exam from this IP (two-step: fetch participant IDs first)
  const { data: participantRows } = await supabase
    .from('participants')
    .select('id')
    .eq('exam_id', examId);

  const participantIds = (participantRows || []).map((p) => p.id);
  if (participantIds.length === 0) return;

  const { count } = await supabase
    .from('exam_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .in('participant_id', participantIds);

  if ((count ?? 0) > 1) {
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('suspicious_flags')
      .eq('id', sessionId)
      .single();

    const flags: unknown[] = session?.suspicious_flags || [];
    flags.push({ type: 'shared_ip', ip, count, at: new Date().toISOString() });

    await supabase
      .from('exam_sessions')
      .update({ suspicious_flags: flags })
      .eq('id', sessionId);
  }
}
