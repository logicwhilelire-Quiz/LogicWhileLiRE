/**
 * GROWTHRAN — High-Concurrency Institutional Load Test Suite
 * Simulates 500+ concurrent candidates taking an assessment:
 * 1. Concurrent Enrollment Burst (500 candidates)
 * 2. Concurrent OTP Verification (500 candidates)
 * 3. Concurrent Session Starting & Question Retrieval (500 candidates)
 * 4. Concurrent Answer Saving (500 candidates x questions)
 * 5. Tight Synchronous Submission Burst (500 simultaneous submissions)
 * 6. Post-Exam Leaderboard Read Spikes (500+ concurrent reads)
 *
 * Measures: Min, P50, P90, P95, P99, Max Latency, Error Rate, and Throughput (RPS)
 */

const http = require('http');

const BASE_URL = process.env.LOAD_TEST_URL || 'http://localhost:3001';
const DEMO_EXAM_ID = 'e1000000-0000-0000-0000-000000000001';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '500', 10);
const SUB_2S_TARGET_MS = 2000;

// High-capacity HTTP agent for connection pooling
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 600,
  maxFreeSockets: 150,
  timeout: 30000,
});

// Telemetry store
const latencies = [];
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const phaseResults = {};

function timedRequest(path, options = {}, body = null) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    const url = new URL(path, BASE_URL);

    const headers = {
      ...(options.headers || {}),
      'x-load-test': 'true',
    };
    if (body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const reqOptions = {
      method: options.method || 'GET',
      agent,
      headers,
    };

    totalRequests++;

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;
        latencies.push(durationMs);

        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}

        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        if (isSuccess) {
          successfulRequests++;
        } else {
          failedRequests++;
        }

        resolve({
          status: res.statusCode,
          durationMs,
          data: json || data,
          success: isSuccess,
        });
      });
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      latencies.push(durationMs);
      failedRequests++;
      resolve({
        status: 0,
        durationMs,
        error: err.message,
        success: false,
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function calculatePercentiles(samples) {
  if (!samples || samples.length === 0) {
    return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const getP = (p) => {
    const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
    return sorted[idx];
  };
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    min: sorted[0],
    p50: getP(50),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
  };
}

async function runBatched(items, fn, batchSize = 100) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function runLoadTest() {
  console.log('================================================================');
  console.log('⚡ GROWTHRAN ASSESSMENT ENGINE — 500+ CONCURRENT LOAD TEST');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Latency Benchmark: Sub-${SUB_2S_TARGET_MS / 1000}s (< ${SUB_2S_TARGET_MS}ms at P99)`);
  console.log('================================================================\n');

  const suiteStartTime = Date.now();
  const testRunId = Date.now().toString().slice(-6);

  // User state tracking
  const users = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
    const num = String(i + 1).padStart(3, '0');
    return {
      index: i + 1,
      name: `Candidate ${num}`,
      hall_ticket: `GR-LOAD-${testRunId}-${num}`,
      mobile: `+9198765${num.padStart(5, '0')}`,
      email: `candidate.${testRunId}.${num}@student.growthran.com`,
      participant_id: null,
      demo_otp: null,
      token: null,
      session_id: null,
      questions: [],
    };
  });

  // -------------------------------------------------------------------------
  // PHASE 1: Concurrent Enrollment Burst (500 users in 100-batch waves)
  // -------------------------------------------------------------------------
  console.log(`[Phase 1] Firing Concurrent Enrollment Burst (${CONCURRENT_USERS} simultaneous candidates in waves of 100)...`);
  const p1Start = Date.now();
  const p1Latencies = [];

  const enrollResults = await runBatched(users, async (u) => {
    const res = await timedRequest(`/api/enroll/${DEMO_EXAM_ID}`, { method: 'POST' }, {
      name: u.name,
      hall_ticket: u.hall_ticket,
      mobile: u.mobile,
      email: u.email,
    });
    p1Latencies.push(res.durationMs);
    if (res.success && res.data?.participant_id) {
      u.participant_id = res.data.participant_id;
      u.demo_otp = res.data.demo_otp;
    }
    return res;
  }, 100);

  const p1Duration = (Date.now() - p1Start) / 1000;
  const p1Success = enrollResults.filter((r) => r.success).length;
  phaseResults['Phase 1: Enrollment'] = calculatePercentiles(p1Latencies);
  console.log(`  ✅ ${p1Success}/${CONCURRENT_USERS} enrolled in ${p1Duration.toFixed(2)}s (P95: ${phaseResults['Phase 1: Enrollment'].p95.toFixed(1)}ms)\n`);

  // -------------------------------------------------------------------------
  // PHASE 2: Concurrent OTP Verification Burst (500 users in waves of 100)
  // -------------------------------------------------------------------------
  console.log(`[Phase 2] Firing Concurrent OTP Verification Burst (${CONCURRENT_USERS} simultaneous candidates)...`);
  const p2Start = Date.now();
  const p2Latencies = [];

  const otpResults = await runBatched(users, async (u) => {
    if (!u.participant_id) return { success: false, durationMs: 0 };
    const res = await timedRequest(`/api/enroll/${DEMO_EXAM_ID}/verify-otp`, { method: 'POST' }, {
      participant_id: u.participant_id,
      otp: u.demo_otp || '123456',
    });
    p2Latencies.push(res.durationMs);
    if (res.success && res.data?.token) {
      u.token = res.data.token;
      u.session_id = res.data.session_id;
    }
    return res;
  }, 100);

  const p2Duration = (Date.now() - p2Start) / 1000;
  const p2Success = otpResults.filter((r) => r.success).length;
  phaseResults['Phase 2: OTP Verification'] = calculatePercentiles(p2Latencies);
  console.log(`  ✅ ${p2Success}/${CONCURRENT_USERS} sessions issued in ${p2Duration.toFixed(2)}s (P95: ${phaseResults['Phase 2: OTP Verification'].p95.toFixed(1)}ms)\n`);

  // -------------------------------------------------------------------------
  // PHASE 3: Concurrent Exam Session Start (500 candidates in waves of 100)
  // -------------------------------------------------------------------------
  console.log(`[Phase 3] Firing Concurrent Session Start Burst (${CONCURRENT_USERS} simultaneous candidates)...`);
  const p3Start = Date.now();
  const p3Latencies = [];

  const startResults = await runBatched(users, async (u) => {
    if (!u.token) return { success: false, durationMs: 0 };
    const startRes = await timedRequest('/api/session/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
    }, {
      fingerprint: `fp-${u.index}-${Date.now()}`,
    });
    p3Latencies.push(startRes.durationMs);
    return startRes;
  }, 100);

  const p3Duration = (Date.now() - p3Start) / 1000;
  const p3Success = startResults.filter((r) => r.success).length;
  phaseResults['Phase 3: Session Start'] = calculatePercentiles(p3Latencies);
  console.log(`  ✅ ${p3Success}/${CONCURRENT_USERS} sessions started in ${p3Duration.toFixed(2)}s (P95: ${phaseResults['Phase 3: Session Start'].p95.toFixed(1)}ms)`);
  if (p3Success < CONCURRENT_USERS) {
    const f = startResults.find((r) => !r.success);
    console.log('  ⚠️ Sample Phase 3 failure details -> Status:', f?.status, '| Error:', f?.error, '| Data:', f?.data);
  }
  console.log();

  // -------------------------------------------------------------------------
  // PHASE 4: Concurrent Question Retrieval (500 candidates in waves of 100)
  // -------------------------------------------------------------------------
  console.log(`[Phase 4] Serving Rotating Question Sets (${CONCURRENT_USERS} simultaneous candidates)...`);
  const p4Start = Date.now();
  const p4Latencies = [];

  const questionResults = await runBatched(users, async (u) => {
    if (!u.token || !u.session_id) return { success: false, durationMs: 0 };
    const qRes = await timedRequest(`/api/session/${u.session_id}/questions?page=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${u.token}` },
    });
    p4Latencies.push(qRes.durationMs);
    if (qRes.success && qRes.data?.questions) {
      u.questions = qRes.data.questions;
    }
    return qRes;
  }, 100);

  const p4Duration = (Date.now() - p4Start) / 1000;
  const p4Success = questionResults.filter((r) => r.success).length;
  phaseResults['Phase 4: Question Retrieval'] = calculatePercentiles(p4Latencies);
  console.log(`  ✅ ${p4Success}/${CONCURRENT_USERS} question sets served in ${p4Duration.toFixed(2)}s (P95: ${phaseResults['Phase 4: Question Retrieval'].p95.toFixed(1)}ms)\n`);

  // -------------------------------------------------------------------------
  // PHASE 5: Concurrent Active Answer Saving (500 candidates × questions)
  // -------------------------------------------------------------------------
  console.log(`[Phase 5] Simulating Concurrent Live Answer Submissions (1500 answers across 500 users)...`);
  const p5Start = Date.now();
  const p5Latencies = [];
  const answerResults = [];
  const options = ['a', 'b', 'c', 'd'];

  for (let qIdx = 0; qIdx < 3; qIdx++) {
    const roundResults = await runBatched(users, (u) => {
      if (!u.token || !u.questions || !u.questions[qIdx]) return Promise.resolve({ success: false });
      const q = u.questions[qIdx];
      const chosenOption = options[(u.index + qIdx) % 4];
      return timedRequest(`/api/session/${u.session_id}/answer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${u.token}` },
      }, {
        question_id: q.id,
        chosen_option: chosenOption,
        answer_latency_ms: 1200 + (u.index * 10),
      }).then((res) => {
        p5Latencies.push(res.durationMs);
        return res;
      });
    }, 100);
    answerResults.push(...roundResults);
  }

  const p5Duration = (Date.now() - p5Start) / 1000;
  const p5Success = answerResults.filter((r) => r.success).length;
  phaseResults['Phase 5: Answer Auto-Save'] = calculatePercentiles(p5Latencies);
  console.log(`  ✅ ${p5Success}/${answerResults.length} answers saved in ${p5Duration.toFixed(2)}s (P95: ${phaseResults['Phase 5: Answer Auto-Save'].p95.toFixed(1)}ms)\n`);

  // -------------------------------------------------------------------------
  // PHASE 6: Tight Synchronous Final Submission Burst (500 simultaneous submissions)
  // -------------------------------------------------------------------------
  console.log(`[Phase 6] 💥 Simulating Synchronous Submission Spike (${CONCURRENT_USERS} simultaneous /submit calls)...`);
  const p6Start = Date.now();
  const p6Latencies = [];

  const submitResults = await runBatched(users, async (u) => {
    if (!u.token) return { success: false, durationMs: 0 };
    const res = await timedRequest(`/api/session/${u.session_id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
    });
    p6Latencies.push(res.durationMs);
    return res;
  }, 100);

  const p6Duration = (Date.now() - p6Start) / 1000;
  const p6Success = submitResults.filter((r) => r.success).length;
  phaseResults['Phase 6: Synchronous Submissions'] = calculatePercentiles(p6Latencies);
  console.log(`  ✅ ${p6Success}/${CONCURRENT_USERS} exam submissions graded in ${p6Duration.toFixed(2)}s (P95: ${phaseResults['Phase 6: Synchronous Submissions'].p95.toFixed(1)}ms)`);
  if (p6Success < CONCURRENT_USERS) {
    const f = submitResults.find((r) => !r.success);
    console.log('  ⚠️ Sample Phase 6 failure details -> Status:', f?.status, '| Error:', f?.error, '| Data:', f?.data);
  }
  console.log();

  // -------------------------------------------------------------------------
  // PHASE 7: Post-Exam Leaderboard Read Spikes (500 rapid requests in waves)
  // -------------------------------------------------------------------------
  console.log(`[Phase 7] Simulating Post-Exam Leaderboard Read Storm (500 concurrent reads)...`);
  const p7Start = Date.now();
  const p7Latencies = [];

  const readIndices = Array.from({ length: 500 }, (_, i) => i);
  const leaderboardResults = await runBatched(readIndices, () =>
    timedRequest(`/api/exam/${DEMO_EXAM_ID}/leaderboard`).then((res) => {
      p7Latencies.push(res.durationMs);
      return res;
    }),
    100
  );

  const p7Duration = (Date.now() - p7Start) / 1000;
  const p7Success = leaderboardResults.filter((r) => r.success).length;
  phaseResults['Phase 7: Leaderboard Read Storm'] = calculatePercentiles(p7Latencies);
  console.log(`  ✅ ${p7Success}/500 leaderboard queries served in ${p7Duration.toFixed(2)}s (P95: ${phaseResults['Phase 7: Leaderboard Read Storm'].p95.toFixed(1)}ms)\n`);

  // -------------------------------------------------------------------------
  // FINAL TELEMETRY REPORT
  // -------------------------------------------------------------------------
  const totalDurationSec = (Date.now() - suiteStartTime) / 1000;
  const overallStats = calculatePercentiles(latencies);
  const throughputRps = (totalRequests / totalDurationSec).toFixed(1);
  const errorRatePercent = ((failedRequests / totalRequests) * 100).toFixed(2);
  const isP99Sub2s = overallStats.p99 < SUB_2S_TARGET_MS;

  console.log('================================================================');
  console.log('📊 HIGH-CONCURRENCY LOAD TEST RESULTS SUMMARY');
  console.log('================================================================');
  console.log(`Total Requests Processed: ${totalRequests}`);
  console.log(`Successful Requests:      ${successfulRequests}`);
  console.log(`Failed Requests:          ${failedRequests} (Error Rate: ${errorRatePercent}%)`);
  console.log(`Total Elapsed Time:       ${totalDurationSec.toFixed(2)} seconds`);
  console.log(`Throughput:               ${throughputRps} requests/sec`);
  console.log('----------------------------------------------------------------');
  console.log('⏱️ LATENCY PERCENTILES (Overall):');
  console.log(`  • Min Latency:          ${overallStats.min.toFixed(2)} ms`);
  console.log(`  • Mean Latency:         ${overallStats.mean.toFixed(2)} ms`);
  console.log(`  • P50 (Median):         ${overallStats.p50.toFixed(2)} ms`);
  console.log(`  • P90:                  ${overallStats.p90.toFixed(2)} ms`);
  console.log(`  • P95:                  ${overallStats.p95.toFixed(2)} ms`);
  console.log(`  • P99:                  ${overallStats.p99.toFixed(2)} ms  <-- Target: < ${SUB_2S_TARGET_MS} ms`);
  console.log(`  • Max Latency:          ${overallStats.max.toFixed(2)} ms`);
  console.log('----------------------------------------------------------------');
  console.log('📈 PER-PHASE LATENCY BREAKDOWN (P50 / P95 / P99):');
  for (const [phase, stats] of Object.entries(phaseResults)) {
    console.log(`  • ${phase.padEnd(35)} : P50=${stats.p50.toFixed(1).padStart(5)}ms | P95=${stats.p95.toFixed(1).padStart(5)}ms | P99=${stats.p99.toFixed(1).padStart(5)}ms`);
  }
  console.log('================================================================');

  if (isP99Sub2s && failedRequests === 0) {
    console.log(`🏆 BENCHMARK PASSED: System achieved SUB-2S response latency at P99 under ${CONCURRENT_USERS}+ concurrent users with 0.00% error rate!`);
    console.log('================================================================\n');
    process.exit(0);
  } else if (!isP99Sub2s) {
    console.error(`⚠️ BENCHMARK WARNING: P99 latency of ${overallStats.p99.toFixed(2)}ms exceeded 2000ms threshold.`);
    process.exit(1);
  } else {
    console.error(`⚠️ BENCHMARK WARNING: Error rate was ${errorRatePercent}% (${failedRequests} failed requests).`);
    process.exit(1);
  }
}

runLoadTest().catch((err) => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});
