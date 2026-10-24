import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { supabase } from '../db/supabase';
import { adminAuth, requireRole } from '../middleware/adminAuth';
import { auditLog } from '../middleware/auditLog';
import { answerRateLimit } from '../middleware/rateLimiter';
import { verifyExamEntry, deterministicShuffle, validateStudentEligibility } from '../controllers/examCodeController';

const router = Router();

// ─── LOCAL FALLBACK ENGINE ────────────────────────────────────
async function runLocalCode(language: string, code: string, stdin = ''): Promise<{ stdout: string; stderr: string; code: number }> {
  const norm = language.toLowerCase();
  const tmpDir = os.tmpdir();

  let cmd = '';
  let args: string[] = [];
  let tmpFile = '';

  if (norm === 'python' || norm === 'python3' || norm === 'py') {
    cmd = 'python';
    tmpFile = path.join(tmpDir, `sol_${Date.now()}_${Math.random().toString(36).substring(2)}.py`);
    fs.writeFileSync(tmpFile, code, 'utf8');
    args = [tmpFile];
  } else if (norm === 'javascript' || norm === 'js' || norm === 'node') {
    cmd = 'node';
    tmpFile = path.join(tmpDir, `sol_${Date.now()}_${Math.random().toString(36).substring(2)}.js`);
    fs.writeFileSync(tmpFile, code, 'utf8');
    args = [tmpFile];
  } else {
    return {
      stdout: '',
      stderr: `Runtime for '${language}' requires remote compiler. Host supports: python, javascript.`,
      code: 1,
    };
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const timeout = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve({ stdout, stderr: 'Time Limit Exceeded (5s)', code: 124 });
      if (tmpFile && fs.existsSync(tmpFile)) { try { fs.unlinkSync(tmpFile); } catch {} }
    }, 5000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (exitCode) => {
      if (!killed) {
        clearTimeout(timeout);
        if (tmpFile && fs.existsSync(tmpFile)) { try { fs.unlinkSync(tmpFile); } catch {} }
        resolve({ stdout, stderr, code: exitCode ?? 0 });
      }
    });

    child.on('error', (err) => {
      if (!killed) {
        clearTimeout(timeout);
        if (tmpFile && fs.existsSync(tmpFile)) { try { fs.unlinkSync(tmpFile); } catch {} }
        resolve({ stdout, stderr: err.message, code: 1 });
      }
    });

    if (stdin) {
      try { child.stdin.write(stdin); } catch {}
    }
    try { child.stdin.end(); } catch {}
  });
}

// ─── WANDBOX REMOTE COMPILER (C++, Java, Rust, Go) ────────────
async function runWandbox(language: string, code: string, stdin = ''): Promise<{ stdout: string; stderr: string; hasError: boolean } | null> {
  const compilerMap: Record<string, string> = {
    'c++': 'gcc-head',
    'cpp': 'gcc-head',
    'c': 'gcc-head-c',
    'java': 'openjdk-head',
    'rust': 'rust-head',
    'go': 'go-head',
    'ruby': 'ruby-head',
  };
  const compiler = compilerMap[language.toLowerCase()];
  if (!compiler) return null;

  try {
    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler,
        code,
        stdin,
      }),
    });
    if (res.ok) {
      const data = await res.json() as {
        status?: string | number;
        program_output?: string;
        program_error?: string;
        compiler_error?: string;
      };
      const stdout = data.program_output || '';
      const stderr = data.compiler_error || data.program_error || '';
      const hasError = (data.status !== undefined && data.status !== 0 && data.status !== '0') || !!data.compiler_error;
      return { stdout, stderr, hasError };
    }
  } catch {}
  return null;
}

async function executeProgram(language: string, code: string, stdin = ''): Promise<{ stdout: string; stderr: string; hasError: boolean }> {
  const norm = language.toLowerCase();

  // Tier 1: Local execution for Python & JavaScript (sub-50ms)
  if (norm === 'python' || norm === 'python3' || norm === 'py' || norm === 'javascript' || norm === 'js' || norm === 'node') {
    const local = await runLocalCode(norm, code, stdin);
    return {
      stdout: local.stdout,
      stderr: local.stderr,
      hasError: local.code !== 0 || !!local.stderr,
    };
  }

  // Tier 2: Piston API (if private or configured PISTON_URL/PISTON_API is set, or public fallback)
  const rawPiston = process.env.PISTON_URL || process.env.PISTON_API || 'https://emkc.org/api/v2/piston';
  if (rawPiston) {
    const pistonUrl = rawPiston.endsWith('/execute') ? rawPiston : `${rawPiston.replace(/\/$/, '')}/execute`;
    try {
      const pistonRes = await fetch(pistonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: norm,
          version: '*',
          files: [{ content: code }],
          stdin,
          run_timeout: 5000,
          compile_timeout: 10000,
        }),
      });

      if (pistonRes.ok) {
        const pistonData = await pistonRes.json() as {
          run?: { stdout?: string; stderr?: string; code?: number };
          compile?: { stderr?: string; code?: number };
        };
        const stdout = pistonData.run?.stdout || '';
        const stderr = pistonData.run?.stderr || pistonData.compile?.stderr || '';
        const hasError = (pistonData.run?.code !== undefined && pistonData.run.code !== 0) || !!stderr;
        return { stdout, stderr, hasError };
      }
    } catch {}
  }

  // Tier 3: Wandbox for C++, Java, Rust, Go
  const wandboxRes = await runWandbox(norm, code, stdin);
  if (wandboxRes) return wandboxRes;

  // Tier 4: Fallback to local
  const local = await runLocalCode(language, code, stdin);
  return {
    stdout: local.stdout,
    stderr: local.stderr,
    hasError: local.code !== 0 || !!local.stderr,
  };
}

// ─── CODE EXECUTION — Multi-tier (Local + Wandbox + Piston) ─────
router.post('/execute', answerRateLimit, async (req: Request, res: Response) => {
  try {
    const { language, code, testCases = [] } = req.body;

    if (!language || !code) {
      return res.status(400).json({ success: false, error: 'language and code are required' });
    }

    if (!testCases || testCases.length === 0) {
      const result = await executeProgram(language, code, '');
      return res.json({
        success: true,
        output: result.stdout,
        stdout: result.stdout,
        stderr: result.stderr,
        hasError: result.hasError,
        verdict: result.hasError ? 'Error' : 'Accepted',
      });
    }

    // Parallel execution across all test cases with multi-layer cross-checks and timing
    const startExecTime = Date.now();
    const normalizeOutput = (val: string) => {
      return val
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
    };

    const results = await Promise.all(
      testCases.map(async (tc: any, index: number) => {
        const input = (tc.input_text !== undefined ? tc.input_text : tc.input) || '';
        const rawExpected = String((tc.expected_output !== undefined ? tc.expected_output : tc.output) || '');
        const expected = normalizeOutput(rawExpected);
        
        const tcStart = Date.now();
        const runRes = await executeProgram(language, code, input);
        const durationMs = Date.now() - tcStart;

        const rawActual = runRes.stdout || '';
        const actual = normalizeOutput(rawActual);

        // Multi-layer cross-checks:
        // 1. Exact normalized string match
        let isPassed = !runRes.hasError && (actual === expected);

        // 2. Case-insensitive boolean comparison (e.g., 'True' vs 'true', 'False' vs 'false')
        if (!isPassed && !runRes.hasError) {
          if (actual.toLowerCase() === expected.toLowerCase() && (expected.toLowerCase() === 'true' || expected.toLowerCase() === 'false')) {
            isPassed = true;
          }
        }

        // 3. Floating-point numerical comparison if both represent numbers
        if (!isPassed && !runRes.hasError && actual.length > 0 && expected.length > 0) {
          const numActual = Number(actual);
          const numExpected = Number(expected);
          if (!isNaN(numActual) && !isNaN(numExpected) && Math.abs(numActual - numExpected) < 1e-5) {
            isPassed = true;
          }
        }

        // 4. Line-by-line whitespace-trimmed array comparison
        if (!isPassed && !runRes.hasError) {
          const actLines = actual.split('\n').map(l => l.trim()).filter(Boolean);
          const expLines = expected.split('\n').map(l => l.trim()).filter(Boolean);
          if (actLines.length > 0 && actLines.length === expLines.length) {
            if (actLines.every((l, idx) => l === expLines[idx])) {
              isPassed = true;
            }
          }
        }

        // 5. Array / List comparison (e.g., [1, 2, 3] vs [1,2,3] or comma-separated)
        if (!isPassed && !runRes.hasError) {
          try {
            const cleanAct = actual.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
            const cleanExp = expected.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
            if (cleanAct.length > 0 && cleanAct.length === cleanExp.length) {
              if (cleanAct.every((val, idx) => val === cleanExp[idx])) {
                isPassed = true;
              }
            }
          } catch {}
        }

        // 6. JSON object equality
        if (!isPassed && !runRes.hasError && ((actual.startsWith('{') && expected.startsWith('{')) || (actual.startsWith('[') && expected.startsWith('[')))) {
          try {
            if (JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected))) {
              isPassed = true;
            }
          } catch {}
        }

        return {
          id: tc.id || index + 1,
          test_index: index + 1,
          passed: isPassed,
          input: tc.is_hidden ? '[hidden]' : input,
          expected: tc.is_hidden ? '[hidden]' : expected,
          actual: tc.is_hidden ? (isPassed ? '✓' : '✗') : actual,
          stderr: runRes.stderr,
          marks: isPassed ? (tc.marks || 1) : 0,
          duration_ms: durationMs,
        };
      })
    );

    const passed = results.filter(r => r.passed).length;
    const fullOutput = results
      .map((r, i) => `Test ${i + 1}: ${r.passed ? '✓ PASS' : '✗ FAIL'}${r.stderr ? ` (${r.stderr.trim()})` : ''} [${r.duration_ms}ms]`)
      .join('\n') + '\n';

    const totalMarks = results.reduce((sum, r) => sum + (r.marks || 0), 0);
    const maxMarks = testCases.reduce((sum: number, tc: { marks?: number }) => sum + (tc.marks || 1), 0);
    const totalExecutionTimeMs = Date.now() - startExecTime;

    return res.json({
      success: true,
      output: fullOutput,
      results,
      passed,
      total: testCases.length,
      score: totalMarks,
      maxScore: maxMarks,
      execution_time_ms: totalExecutionTimeMs,
      verdict: passed === testCases.length ? 'Accepted' : passed > 0 ? 'Partial' : 'Wrong Answer',
    });

  } catch (err) {
    console.error('[Execute]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Execution failed' });
  }
});

// ─── AI QUESTION GENERATION ────────────────────────────────────
router.post(
  '/ai/generate-questions',
  adminAuth,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
  try {
    const { topic = 'Computer Science', count = 5, difficulty = 'medium', type = 'mixed' } = req.body;
    const reqCount = Math.min(Math.max(Number(count) || 5, 1), 20);

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey && apiKey.startsWith('sk-')) {
      try {
        const systemPrompt = `You are a premier technical assessment author for university engineering and coding exams.
Generate ${reqCount} rigorous, high-quality questions on the topic "${topic}" with difficulty "${difficulty}".
Question mix type: "${type}" (if 'mixed': include both multiple-choice and practical coding problems with test cases; if 'mcq': only multiple-choice; if 'code': only coding challenges).

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "question_text": "string (clear technical question or problem description)",
      "question_type": "mcq" | "code",
      "options": ["Option A", "Option B", "Option C", "Option D"], // empty array [] if code
      "correct_answer": 0, // integer index 0-3 for mcq, 0 if code
      "difficulty": "${difficulty}",
      "topic": "${topic}",
      "marks": 10,
      "explanation": "concise technical explanation",
      "test_cases": [ // ONLY for question_type == 'code'
        { "id": "tc-1", "input_text": "sample input", "expected_output": "expected output", "marks": 5, "is_hidden": false },
        { "id": "tc-2", "input_text": "hidden edge case", "expected_output": "expected output", "marks": 5, "is_hidden": true }
      ]
    }
  ]
}`;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Generate ${reqCount} questions on ${topic}` }],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
          const raw = openaiData.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(raw);
          const qList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          if (qList.length > 0) {
            return res.json({ success: true, questions: qList.slice(0, reqCount), source: 'openai' });
          }
        }
      } catch (aiErr) {
        console.warn('[OpenAI Generation Fallback]', aiErr);
      }
    }

    // High-quality intelligent synthesizer fallback (domain tailored)
    const normalizedTopic = String(topic).toLowerCase();
    const synthQuestions = [];

    // Question 1 (MCQ: Core Principle)
    synthQuestions.push({
      question_text: `In modern ${topic}, which architectural pattern or principle is considered foundational for minimizing system coupling and maximizing testability?`,
      options: [
        'Dependency Inversion / Decoupled Interfaces',
        'Direct Global State Mutation',
        'Monolithic Shared Memory Pointers',
        'Tight Hardware Coupling',
      ],
      correct_answer: 0,
      difficulty,
      topic: `${topic} Core`,
      question_type: 'mcq',
      marks: 10,
      explanation: 'Decoupling components via dependency inversion allows components to be tested, scaled, and refactored independently.',
    });

    // Question 2 (Coding: Algorithmic Challenge)
    if (type !== 'mcq') {
      synthQuestions.push({
        question_text: `Given an integer N representing data points in ${topic}, write an algorithm to read N from stdin and output the sum of all prime numbers less than or equal to N.`,
        options: [],
        correct_answer: 0,
        difficulty,
        topic: `${topic} Algorithmics`,
        question_type: 'code',
        marks: 20,
        explanation: 'Compute sum of primes using Sieve of Eratosthenes or trial division up to sqrt(N).',
        test_cases: [
          { id: 'tc-1', input_text: '10', expected_output: '17', marks: 10, is_hidden: false },
          { id: 'tc-2', input_text: '20', expected_output: '77', marks: 5, is_hidden: false },
          { id: 'tc-3', input_text: '30', expected_output: '129', marks: 5, is_hidden: true },
        ],
      });
    }

    // Question 3 (MCQ: Time / Space Complexity)
    synthQuestions.push({
      question_text: `What is the worst-case asymptotic time complexity of searching and balancing in an AVL or Red-Black Tree during ${topic} pipeline operations?`,
      options: ['O(N²)', 'O(log N)', 'O(N log N)', 'O(1)'],
      correct_answer: 1,
      difficulty,
      topic: `${topic} Data Structures`,
      question_type: 'mcq',
      marks: 10,
      explanation: 'Self-balancing binary trees maintain height h <= 1.44 log2(N), guaranteeing logarithmic search and insertion.',
    });

    // Question 4 (Coding: Practical Data Processing)
    if (type !== 'mcq') {
      synthQuestions.push({
        question_text: `Write a program that reads a string of space-separated integers from stdin and prints the maximum consecutive difference between any two adjacent elements.`,
        options: [],
        correct_answer: 0,
        difficulty,
        topic: `${topic} Numerical Computing`,
        question_type: 'code',
        marks: 20,
        explanation: 'Parse array of integers and iterate calculating Math.abs(arr[i] - arr[i-1]).',
        test_cases: [
          { id: 'tc-1', input_text: '1 7 3 10 5', expected_output: '7', marks: 10, is_hidden: false },
          { id: 'tc-2', input_text: '10 20 30', expected_output: '10', marks: 5, is_hidden: false },
          { id: 'tc-3', input_text: '100 50 150 25', expected_output: '125', marks: 5, is_hidden: true },
        ],
      });
    }

    // Question 5 (MCQ: Concurrency / Safety)
    synthQuestions.push({
      question_text: `When processing high-throughput telemetry streams in ${topic}, which synchronization hazard occurs when two concurrent threads read and write shared memory without synchronization?`,
      options: ['Race Condition', 'Deadlock Inversion', 'Memory Leakage', 'Buffer Overrun'],
      correct_answer: 0,
      difficulty,
      topic: `${topic} Systems`,
      question_type: 'mcq',
      marks: 10,
      explanation: 'A race condition arises when state integrity depends on indeterminate thread execution timing.',
    });

    // Question 6 (MCQ: Distributed Systems / Protocol)
    synthQuestions.push({
      question_text: `Under the CAP Theorem in distributed ${topic} backends, what guarantee must be traded off to ensure Consistency and Partition Tolerance?`,
      options: ['Availability', 'Atomicity', 'Durability', 'Linearizability'],
      correct_answer: 0,
      difficulty,
      topic: `${topic} Distributed Systems`,
      question_type: 'mcq',
      marks: 10,
      explanation: 'In the presence of network partitions (P), a distributed system must sacrifice Availability (A) to guarantee strict Consistency (C).',
    });

    // Question 7 (Coding: String / Cryptography challenge)
    if (type !== 'mcq') {
      synthQuestions.push({
        question_text: `Write a program that takes a single word string from stdin and prints 'VALID' if all opening and closing parentheses/brackets in the string are properly balanced, else prints 'INVALID'.`,
        options: [],
        correct_answer: 0,
        difficulty,
        topic: `${topic} Parser Logic`,
        question_type: 'code',
        marks: 20,
        explanation: 'Use stack to push openers and pop matching closers.',
        test_cases: [
          { id: 'tc-1', input_text: '({[]})', expected_output: 'VALID', marks: 10, is_hidden: false },
          { id: 'tc-2', input_text: '([)]', expected_output: 'INVALID', marks: 5, is_hidden: false },
          { id: 'tc-3', input_text: '{[()()]}', expected_output: 'VALID', marks: 5, is_hidden: true },
        ],
      });
    }

    // Question 8 (MCQ: Optimization & Memory)
    synthQuestions.push({
      question_text: `In performance-critical ${topic} workloads, what is the primary benefit of L1/L2 cache locality and contiguous memory allocation?`,
      options: [
        'Dramatic reduction in CPU memory stall cycles and cache misses',
        'Automatic compilation into WebAssembly',
        'Zero garbage collection pause times regardless of language',
        'Automatic elimination of deadlock',
      ],
      correct_answer: 0,
      difficulty,
      topic: `${topic} Optimization`,
      question_type: 'mcq',
      marks: 10,
      explanation: 'Sequential cache-friendly data structures utilize cache lines efficiently, avoiding main memory fetch delays.',
    });

    const finalQuestions = synthQuestions.slice(0, reqCount);
    res.json({ success: true, questions: finalQuestions, source: 'synthesizer' });

  } catch (err) {
    console.error('[AI Generate]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'AI generation failed' });
  }
});

// ─── PROCTOR LOG ───────────────────────────────────────────────
router.post('/proctor/log', async (req: Request, res: Response) => {
  try {
    const { candidateId, examCode, eventType, metadata } = req.body;

    const { error } = await supabase.from('proctor_logs').insert({
      candidate_id: candidateId,
      exam_id: examCode,
      event_type: eventType,
      metadata: metadata || {},
    });

    if (error) console.warn('[ProctorLog]', error.message);

    res.json({ success: true });
  } catch (err) {
    console.warn('[ProctorLog]', err);
    res.json({ success: true, warning: 'Log failed but non-critical' });
  }
});

// ─── RETIRED CERTIFICATE VERIFICATION (Phase C4 Spec) ──────────
// Old public verification URLs must not 404 or crash. Serves status 200 with retirement explanation.
router.get('/certificate/verify/:token', (req: Request, res: Response) => {
  const accepts = req.headers['accept'] || '';
  const isHtml = accepts.includes('text/html') && !accepts.includes('application/json');

  if (isHtml) {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LogicWhileLiRE — Certificate Verification Retired</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #050814; color: #F0F4FC; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    .card { max-width: 520px; width: 100%; padding: 40px; background: #0C1222; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 999px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #EF4444; font-size: 12px; font-weight: 700; margin-bottom: 20px; letter-spacing: 0.04em; }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 14px; color: #F0F4FC; }
    p { font-size: 15px; color: #94A3B8; line-height: 1.6; margin: 0 0 28px; }
    a { display: inline-block; padding: 12px 28px; background: #2B7FFF; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.2s; }
    a:hover { background: #1B5FB5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">SERVICE RETIRED</div>
    <h1>Certificate verification has been retired.</h1>
    <p>The digital certificate verification service on LogicWhileLiRE has been permanently discontinued. If your printed credential or QR code directed you here, please contact your institution administrator directly.</p>
    <a href="/">← Return to Home</a>
  </div>
</body>
</html>`);
  }

  return res.status(200).json({
    success: true,
    retired: true,
    valid: false,
    message: 'Certificate verification has been retired.',
    home_url: '/',
  });
});


// ─── LEADERBOARD (real-time) ───────────────────────────────────
router.get('/leaderboard/:examCode', async (req: Request, res: Response) => {
  try {
    const { examCode } = req.params;
    const { data: lbData } = await supabase
      .from('leaderboard')
      .select('rank, score, department, candidates(hall_ticket, name)')
      .eq('exam_id', examCode)
      .order('rank', { ascending: true })
      .limit(50);

    if (lbData && lbData.length > 0) {
      const rows = lbData.map((row: Record<string, unknown>) => {
        const candidate = row.candidates as Record<string, string> | null;
        return {
          rank: row.rank as number,
          score: row.score as number,
          department: row.department as string,
          hall_ticket: candidate?.hall_ticket || '',
          name: candidate?.name || '',
        };
      });
      return res.json({ success: true, data: rows });
    }

    // Fallback: compute from legitimate completed attempts using canonical score DESC, time_taken_seconds ASC
    const { data: attempts } = await supabase
      .from('exam_code_attempts')
      .select('hall_ticket_no, student_name, score, max_score, time_taken_seconds, status')
      .eq('exam_code', examCode)
      .in('status', ['completed', 'submitted'])
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .limit(50);

    const rows = (attempts || []).map((a: Record<string, unknown>, i: number) => ({
      rank: i + 1,
      hall_ticket: (a.hall_ticket_no || a.student_name || '') as string,
      name: (a.student_name || a.hall_ticket_no || '') as string,
      score: Number(a.score || 0),
      max_score: Number(a.max_score || 0),
      time_taken_seconds: Number(a.time_taken_seconds || 0),
    }));

    res.json({ success: true, data: rows, leaderboard: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Leaderboard fetch failed' });
  }
});

// ─── EXAM VERIFY (GET) for EnterExamPage ──────────────────────
router.get('/exam-code/:code/verify', (req: Request, res: Response) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.query.hallTicket || req.body?.hallTicket,
  };
  return verifyExamEntry(req, res);
});

// ─── EXAM START (GET questions) ────────────────────────────────
router.get('/exam-code/:code/start', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const hallTicket = String(req.query.hallTicket || 'GUEST').toUpperCase();

    let { data: exam } = await supabase
      .from('exam_codes')
      .select('*')
      .eq('exam_code', code)
      .maybeSingle();

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    }

    // Enforce student targeting (returns 404 so untargeted students cannot tell exam exists)
    const isEligible = await validateStudentEligibility(exam, hallTicket);
    if (!isEligible) {
      return res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    }

    // Enforce student email verification (Item 9)
    const { data: studentRecord } = await supabase
      .from('students')
      .select('id, email, is_verified')
      .or(`hall_ticket.eq.${hallTicket},roll_number.eq.${hallTicket}`)
      .maybeSingle();

    if (studentRecord && studentRecord.is_verified === false) {
      return res.status(403).json({
        success: false,
        error: 'Your email address is not verified. Please verify your email before starting this examination.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Enforce inspector start (Synchronized Launch)
    if (!exam.started_at) {
      const { getExamStartedState } = await import('../services/socketService');
      const startedState = getExamStartedState(code);
      if (!startedState) {
        return res.status(403).json({
          success: false,
          error: 'The inspector has not started this examination yet. Please wait in the waiting lobby.',
          code: 'EXAM_NOT_STARTED_BY_INSPECTOR',
          waiting_list: true,
          exam_name: exam.exam_name || exam.name || code,
          duration_minutes: exam.duration_minutes || 60,
          total_questions: exam.total_questions || 15,
        });
      }
    }

    // Try questions table, then questions_ec table
    let { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_code', code)
      .order('created_at');

    if (!questions || questions.length === 0) {
      const { data: ecQuestions } = await supabase
        .from('questions_ec')
        .select('*')
        .eq('exam_code', code);
      questions = ecQuestions;
    }

    // Default rich questions set with MCQ + Coding Challenge if none found
    if (!questions || questions.length === 0) {
      questions = [
        {
          id: `q-${code}-1`,
          exam_code: code,
          question_text: 'What is the time complexity of searching in a balanced Binary Search Tree with N nodes?',
          options: ['O(N)', 'O(log N)', 'O(N log N)', 'O(1)'],
          correct_answer: 1,
          question_type: 'mcq',
          marks: 2,
          difficulty: 'Easy',
          topic: 'Data Structures',
        },
        {
          id: `q-${code}-2`,
          exam_code: code,
          question_text: 'Which ACID property guarantees that once a transaction has committed, it will remain committed even in the event of a system crash?',
          options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
          correct_answer: 3,
          question_type: 'mcq',
          marks: 2,
          difficulty: 'Medium',
          topic: 'Database Systems',
        },
        {
          id: `q-${code}-3`,
          exam_code: code,
          question_text: 'In TCP/IP networking, what is the purpose of the SYN-ACK packet in the three-way handshake?',
          options: [
            'Acknowledge client SYN and initiate server sequence connection',
            'Terminate an existing TCP connection gracefully',
            'Reset an erroneous packet window size',
            'Route packet through dynamic NAT gateway',
          ],
          correct_answer: 0,
          question_type: 'mcq',
          marks: 2,
          difficulty: 'Medium',
          topic: 'Computer Networks',
        },
        {
          id: `q-${code}-4`,
          exam_code: code,
          question_text: `⚡ CODING CHALLENGE: Two Sum\n\nGiven an integer N, followed by N space-separated integers on the second line, and a target integer T on the third line, determine if any two distinct integers sum up to T.\n\nPrint "True" if such a pair exists, otherwise print "False".`,
          options: [],
          correct_answer: 0,
          question_type: 'code',
          marks: 10,
          difficulty: 'Medium',
          topic: 'Algorithms (Hash Table / Two Pointers)',
          test_cases: [
            { id: 'tc-1', input_text: "5\n2 7 11 15 20\n9", expected_output: "True", marks: 3, is_hidden: false },
            { id: 'tc-2', input_text: "4\n1 2 3 9\n8", expected_output: "False", marks: 3, is_hidden: false },
            { id: 'tc-3', input_text: "6\n-3 4 3 90 2 1\n0", expected_output: "True", marks: 4, is_hidden: true },
          ],
        },
        {
          id: `q-${code}-5`,
          exam_code: code,
          question_text: `⚡ CODING CHALLENGE: Palindrome String\n\nRead a single string from standard input and print "True" if the string is a palindrome (reads the same backwards and forwards, case-sensitive), or "False" otherwise.`,
          options: [],
          correct_answer: 0,
          question_type: 'code',
          marks: 10,
          difficulty: 'Easy',
          topic: 'Algorithms (Strings)',
          test_cases: [
            { id: 'tc-p1', input_text: "racecar", expected_output: "True", marks: 3, is_hidden: false },
            { id: 'tc-p2', input_text: "logicwhilelire", expected_output: "False", marks: 3, is_hidden: false },
            { id: 'tc-p3', input_text: "deified", expected_output: "True", marks: 4, is_hidden: true },
          ],
        },
      ];
    }

    const studentIdentifier = `${hallTicket}_${code}`;
    const shuffledQuestions = deterministicShuffle(questions, studentIdentifier);

    const formattedQuestions = shuffledQuestions.map((q: any) => {
      const studentSeed = `${studentIdentifier}_${q.id}`;
      const rawOpts = q.options && q.options.length > 0
        ? q.options.map((t: string, idx: number) => ({ key: ['A', 'B', 'C', 'D'][idx] || String(idx), text: t }))
        : [
            { key: 'A', text: q.option_a },
            { key: 'B', text: q.option_b },
            { key: 'C', text: q.option_c },
            { key: 'D', text: q.option_d },
          ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);

      const shuffledOpts = deterministicShuffle(rawOpts, studentSeed);

      return {
        id: q.id,
        text: q.question_text || q.question || 'Question',
        question: q.question_text || q.question || 'Question',
        options: shuffledOpts.map((o: any) => o.text),
        type: q.question_type || (q.type ? q.type : 'mcq'),
        marks: q.marks || 1,
        penalty: Number(q.penalty ?? q.negative_marks ?? 0),
        difficulty: q.difficulty || 'Medium',
        topic: q.topic || 'Computer Science',
        section: q.section || 'General',
        test_cases: q.test_cases || [],
      };
    });

    // Record or update attempt in exam_code_attempts
    try {
      await supabase.from('exam_code_attempts').upsert({
        id: `att_${code}_${hallTicket}`,
        exam_code: code,
        hall_ticket: hallTicket,
        hall_ticket_no: hallTicket,
        student_name: hallTicket,
        started_at: new Date().toISOString(),
        start_time: new Date().toISOString(),
        status: 'in_progress',
      }, { onConflict: 'exam_code,hall_ticket' });
    } catch {}

    res.json({
      success: true,
      sessionId: `sess_${code}_${hallTicket}_${Date.now()}`,
      exam,
      questions: formattedQuestions,
      candidateId: hallTicket,
    });
  } catch (err) {
    console.error('[ExamStart]', err);
    res.status(500).json({ success: false, error: 'Failed to start exam' });
  }
});

// ─── SCREEN SHARE THUMBNAIL (POST) ───────────────────────────
router.post('/exam-code/:code/screen-thumbnail', async (req: Request, res: Response) => {
  try {
    const code = (req.params.code || req.body.examCode || '').toUpperCase();
    const candidateId = req.body.candidateId || req.body.hallTicket;
    const thumbnail = req.body.thumbnail || req.body.screen_thumb;
    const timestamp = req.body.timestamp || new Date().toISOString();

    if (!candidateId || !thumbnail) {
      res.status(400).json({ success: false, error: 'candidateId and thumbnail required' });
      return;
    }

    await supabase
      .from('exam_code_attempts')
      .update({
        latest_screen_thumb: String(thumbnail).slice(0, 50000),
        screen_thumb_updated_at: timestamp,
      })
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`);

    res.json({ success: true, timestamp });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save screen thumbnail' });
  }
});

// ─── RESULT (GET) ─────────────────────────────────────────────
router.get('/exam-code/:code/result', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { hallTicket } = req.query;

    const { data: attempt } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .eq('hall_ticket', hallTicket as string)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation record not found for this candidate.',
      });
    }

    // Inspect questions to identify coding vs MCQ questions
    const { data: qList } = await supabase
      .from('questions_ec')
      .select('id, question, marks, topic, option_a, option_b, question_type')
      .eq('exam_code', String(code).toUpperCase());

    const codingQList: Array<{ id: string; title: string; marks: number; submitted: boolean }> = [];
    let mcqMaxMarks = 0;
    const codeAns = attempt.code_answers || {};

    (qList || []).forEach((q: any) => {
      const isCoding = q.question_type === 'code' || (!q.option_a && !q.option_b && (String(q.topic || '').toLowerCase().includes('algorithm') || String(q.topic || '').toLowerCase().includes('code')));
      const qMarks = Number(q.marks || 1);
      if (isCoding) {
        const isSub = Boolean(codeAns[q.id] && String(codeAns[q.id]).trim().length > 0);
        codingQList.push({
          id: q.id,
          title: q.question || 'Coding Problem',
          marks: qMarks,
          submitted: isSub,
        });
      } else {
        mcqMaxMarks += qMarks;
      }
    });

    const hasCoding = codingQList.length > 0;
    const mcqScore = attempt.score || 0;
    const mcqPercentage = mcqMaxMarks > 0 ? Math.round((mcqScore / mcqMaxMarks) * 100) : (attempt.percentage || 0);

    const isTerminated = attempt.status === 'terminated_cheating' || attempt.status === 'terminated' || attempt.status === 'Terminated - violation';

    res.json({
      success: true,
      data: {
        status: attempt.status,
        is_terminated: isTerminated,
        termination_reason: attempt.termination_reason || (isTerminated ? 'Proctoring security violation' : null),
        score: isTerminated ? 0 : (attempt.score || 0),
        totalMarks: attempt.total_marks || attempt.max_score || 100,
        percentage: isTerminated ? 0 : (attempt.percentage || 0),
        correctAnswers: attempt.correct_answers || attempt.correct_count || 0,
        wrongAnswers: attempt.wrong_answers || attempt.wrong_count || 0,
        unanswered: attempt.unanswered || 0,
        timeTaken: attempt.time_taken || attempt.time_taken_seconds || 0,
        qrToken: attempt.qr_token || `token_${code}_${attempt.hall_ticket}`,
        code_answers: codeAns,
        mcq_score: isTerminated ? 0 : mcqScore,
        mcq_max_score: mcqMaxMarks > 0 ? mcqMaxMarks : (attempt.total_marks || attempt.max_score || 100),
        mcq_percentage: isTerminated ? 0 : mcqPercentage,
        coding_questions: codingQList,
        has_coding_questions: hasCoding,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch result' });
  }
});

// ─── ADMIN: CREATE EXAM WIZARD (Unified Metadata + Questions — super_admin only) ──
router.post(
  '/admin/create-exam-wizard',
  adminAuth,
  requireRole('super_admin'),
  auditLog('CREATE_EXAM_WIZARD', 'exam_codes'),
  async (req: Request, res: Response) => {
  try {
    const {
      exam_name,
      code,
      subject = 'General',
      college_id,
      branch,
      passout_year,
      section_id,
      section_ids,
      batch_id,
      assigned_faculty_id,
      assigned_inspector_id,
      duration_minutes = 60,
      total_marks = 100,
      passing_marks = 40,
      start_time,
      end_time,
      instructions = '',
      is_proctored = true,
      is_randomized = false,
      is_leaderboard_public = true,
      max_violations = 5,
      questions = [],
    } = req.body;

    if (!exam_name || !code) {
      return res.status(400).json({ success: false, error: 'exam_name and code are required' });
    }

    const examCodeClean = String(code).trim().toUpperCase();
    const targetedSections = Array.isArray(section_ids) && section_ids.length > 0
      ? section_ids
      : section_id
      ? [String(section_id).trim()]
      : [];

    // 1. Insert/Update exam in exam_codes with targeting
    const passingPct = total_marks > 0
      ? Math.round((Number(passing_marks || 40) / Number(total_marks)) * 100)
      : 40;

    const examRecord: Record<string, any> = {
      exam_code: examCodeClean,
      exam_name: exam_name.trim(),
      subject: subject || null,
      college_id: college_id ? parseInt(String(college_id), 10) : null,
      branch: branch ? String(branch).trim().toUpperCase() : null,
      passout_year: passout_year ? Number(passout_year) : null,
      section_id: section_id ? String(section_id).trim() : (targetedSections[0] || null),
      section_ids: targetedSections,
      batch_id: batch_id ? String(batch_id).trim() : null,
      assigned_faculty_id: assigned_faculty_id || null,
      assigned_inspector_id: assigned_inspector_id || null,
      is_locked: false,
      paper_status: assigned_faculty_id ? 'allocated' : 'active',
      duration_minutes: Number(duration_minutes) || 60,
      total_marks: Number(total_marks) || 100,
      passing_percentage: passingPct,
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + 86400000 * 30).toISOString(),
      proctoring_enabled: Boolean(is_proctored),
      max_violations: Number(max_violations) || 5,
      is_active: true,
      total_questions: questions.length,
    };

    const { data: savedExam, error: examError } = await supabase
      .from('exam_codes')
      .upsert(examRecord, { onConflict: 'exam_code' })
      .select()
      .maybeSingle();

    if (examError) {
      console.warn('[CreateExamWizard] exam_codes upsert warning:', examError.message);
    }

    // 2. Insert questions if provided
    let insertedCount = 0;
    if (questions && questions.length > 0) {
      const qRows = questions.map((q: any, i: number) => ({
        id: `q-${examCodeClean}-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
        exam_code: examCodeClean,
        question: q.question_text || q.question || '',
        question_text: q.question_text || q.question || '',
        option_a: q.option_a || (q.options ? q.options[0] : '') || '',
        option_b: q.option_b || (q.options ? q.options[1] : '') || '',
        option_c: q.option_c || (q.options ? q.options[2] : '') || '',
        option_d: q.option_d || (q.options ? q.options[3] : '') || '',
        options: q.options || [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
        correct_answer: q.correct_answer || 'A',
        marks: Number(q.marks || 1),
        difficulty: q.difficulty || 'Medium',
        topic: q.topic || subject,
        question_type: q.question_type || 'mcq',
        explanation: q.explanation || null,
        test_cases: q.test_cases || [],
        display_order: i + 1,
      }));

      // Delete existing and insert fresh
      try {
        await supabase.from('questions_ec').delete().eq('exam_code', examCodeClean);
        await supabase.from('questions_ec').insert(qRows);
      } catch {}

      try {
        await supabase.from('questions').delete().eq('exam_code', examCodeClean);
        await supabase.from('questions').insert(qRows);
      } catch {}

      insertedCount = qRows.length;
    }

    res.json({
      success: true,
      message: `Exam ${examCodeClean} launched successfully with ${insertedCount} questions!`,
      examCode: examCodeClean,
      examId: savedExam?.id || `ec-${examCodeClean.toLowerCase()}`,
      questionsCount: insertedCount,
    });
  } catch (err) {
    console.error('[CreateExamWizard]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Wizard creation failed' });
  }
});


// ─── INSTRUCTOR PUSH-TO-START ─────────────────────────────────────────────────
// POST /api/v1/exams/:examCode/start
// Protected by adminAuth middleware (JWT verified via ADMIN_JWT_SECRET).
// IDEMPOTENT: a second call for the same exam code returns success with
// already_started=true and the original payload — no re-broadcast, no timer reset.
router.post(
  '/v1/exams/:examCode/start',
  adminAuth,
  requireRole('super_admin', 'inspector'),
  async (req: Request, res: Response) => {
  try {
    const { allow_late_join = false, duration_seconds } = req.body;
    const code = (req.params.examCode as string).toUpperCase();

    // ── Idempotency check (Sprint 2, item 1) ──────────────────────────────
    const { getExamStartedState } = await import('../services/socketService');
    const alreadyState = getExamStartedState(code);
    if (alreadyState) {
      console.log(`[ExamStart] Idempotent call — ${code} already started at ${alreadyState.server_start_time}`);
      return res.json({
        success: true,
        already_started: true,
        message: `Exam ${code} was already started — no re-broadcast`,
        exam_id: alreadyState.exam_id,
        server_start_time: alreadyState.server_start_time,
        duration_seconds: alreadyState.duration_seconds,
        allow_late_join: alreadyState.allow_late_join,
      });
    }

    // ── Look up exam to get duration ──────────────────────────────────────
    const { data: examData } = await supabase
      .from('exam_codes')
      .select('exam_code, duration_minutes, is_active, max_participants, college_id')
      .eq('exam_code', code)
      .maybeSingle();

    if (!examData) {
      return res.status(404).json({ success: false, error: `Exam code ${code} not found` });
    }

    // ── College scope check for inspector / college_admin ──
    if (req.admin?.role === 'inspector' || req.admin?.role === 'college_admin') {
      if (req.admin.college_id && examData.college_id && String(examData.college_id) !== String(req.admin.college_id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only start exams for your own college',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
      }
    }

    const durationSeconds = Number(duration_seconds) > 0
      ? Number(duration_seconds)
      : ((examData.duration_minutes ?? 60) * 60);
    const serverStartTime = Date.now();

    // ── Server-authoritative end_time write (Sprint 2, item 2) ───────────
    const endTimeIso = new Date(serverStartTime + durationSeconds * 1000).toISOString();
    try {
      const { error: updErr } = await supabase
        .from('exam_codes')
        .update({
          is_active: true,
          start_time: new Date(serverStartTime).toISOString(),
          end_time: endTimeIso,
        })
        .eq('exam_code', code);
      if (updErr) {
        console.warn('[ExamStart] DB update notice:', updErr.message);
      }
    } catch (e: any) {
      console.warn('[ExamStart] DB update exception:', e?.message);
    }

    // ── Broadcast EXAM_STARTED ────────────────────────────────────────────
    const { broadcastExamStarted } = await import('../services/socketService');
    const { payload, alreadyStarted } = await broadcastExamStarted({
      examCode: code,
      durationSeconds,
      allowLateJoin: allow_late_join,
      serverStartTime,
    });

    console.log(
      `[ExamStart] ${req.admin?.sub} triggered EXAM_STARTED for ${code}. ` +
      `Duration=${durationSeconds}s, end_time=${endTimeIso}`
    );

    return res.json({
      success: true,
      already_started: alreadyStarted,
      message: alreadyStarted
        ? `Exam ${code} was already started`
        : `EXAM_STARTED broadcast sent to lobby:${code}`,
      exam_id: payload.exam_id,
      server_start_time: payload.server_start_time,
      duration_seconds: payload.duration_seconds,
      allow_late_join: payload.allow_late_join,
    });
  } catch (err) {
    console.error('[ExamStart]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Start failed' });
  } finally {
    // Invalidate lobby cache immediately so next polling reflects fresh status
    const code = ((req.params.examCode as string) || '').toUpperCase();
    lobbyDbCache.delete(code);
  }
});

// POST /api/v1/exams/:examCode/reset-state (super_admin only)
router.post(
  '/v1/exams/:examCode/reset-state',
  adminAuth,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
  try {
    const code = ((req.params.examCode as string) || '').toUpperCase();
    const { resetExamStartedState } = await import('../services/socketService');
    resetExamStartedState(code);
    lobbyDbCache.delete(code);
    return res.json({ success: true, message: `Exam ${code} state reset` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Reset failed' });
  }
});

// ─── INSTRUCTOR LOBBY STATS (High-Speed Memory Cached) ──────────────────────────
// GET /api/v1/exams/:examCode/lobby-stats
// Returns real-time enrolled / connected / pending counts + exam_started_state.
// Uses an in-memory TTL cache (2.5s) for database queries to prevent Supabase connection
// exhaustion when hundreds of concurrent students poll the waiting lobby simultaneously.
interface LobbyDbCacheEntry {
  enrolledCount: number;
  durationSec: number;
  timestamp: number;
}
const lobbyDbCache = new Map<string, LobbyDbCacheEntry>();
const LOBBY_CACHE_TTL_MS = 2500;

router.get('/v1/exams/:examCode/lobby-stats', async (req: Request, res: Response) => {
  try {
    const code = ((req.params.examCode as string) || '').toUpperCase();
    const { getLobbyStats, getExamStartedState } = await import('../services/socketService');
    // Socket stats are 100% in-memory and real-time
    const stats = getLobbyStats(code);

    // Real-time started state from memory (used to auto-unblock students who refreshed)
    const startedState = getExamStartedState(code);

    // Fetch enrolled count and duration from short-lived memory cache to ensure sub-2ms responses
    const now = Date.now();
    let cached = lobbyDbCache.get(code);
    let enrolledCount = stats.enrolled;
    let durationSec = 3600;

    if (cached && now - cached.timestamp < LOBBY_CACHE_TTL_MS) {
      enrolledCount = cached.enrolledCount;
      durationSec = cached.durationSec;
    } else {
      try {
        const [enrolled, examRow] = await Promise.all([
          supabase
            .from('exam_code_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('exam_code', code),
          supabase
            .from('exam_codes')
            .select('duration_minutes')
            .eq('exam_code', code)
            .maybeSingle(),
        ]);

        enrolledCount = (enrolled.data as any)?.count ?? stats.enrolled;
        durationSec = ((examRow.data as any)?.duration_minutes || 60) * 60;

        lobbyDbCache.set(code, {
          enrolledCount,
          durationSec,
          timestamp: now,
        });
      } catch {
        enrolledCount = cached ? cached.enrolledCount : stats.enrolled;
        durationSec = cached ? cached.durationSec : 3600;
      }
    }

    res.json({
      success: true,
      exam_code: code,
      enrolled: enrolledCount,
      connected: stats.connected,
      queue_count: stats.queue_count ?? stats.connected,
      pending: Math.max(0, enrolledCount - stats.connected),
      duration_seconds: durationSec,
      // Exam started state — null if not yet started
      exam_started: startedState
        ? {
            exam_id: startedState.exam_id,
            server_start_time: startedState.server_start_time,
            duration_seconds: startedState.duration_seconds,
            allow_late_join: startedState.allow_late_join,
            elapsed_seconds: Math.floor((Date.now() - startedState.server_start_time) / 1000),
            remaining_seconds: Math.max(
              0,
              startedState.duration_seconds - Math.floor((Date.now() - startedState.server_start_time) / 1000)
            ),
          }
        : null,
    });
  } catch (_err) {
    res.json({
      success: true,
      exam_code: ((req.params.examCode as string) || '').toUpperCase(),
      enrolled: 0,
      connected: 0,
      queue_count: 0,
      pending: 0,
      duration_seconds: 3600,
      exam_started: null,
    });
  }
});


export default router;
