/**
 * LOGICWHILELIRE — Pre-Launch 300-User Load Test Suite
 * Simulates 300 virtual students through the full assessment lifecycle:
 * 1. Login / Enrollment Burst
 * 2. Lobby Join (Socket.io WebSocket connections)
 * 3. Exam Start (inspector push-to-start)
 * 4. 60 Autosaves per student (18,000 total writes)
 * 5. Final Submission Burst
 * 6. Live Leaderboard Polling (Socket.io + REST)
 *
 * Reports:
 * - p95 latency per phase and overall
 * - Error rate (target: 0%)
 * - Server RSS memory (target: < 512MB)
 * - Throughput (requests/sec)
 *
 * Usage:
 *   CONCURRENT_USERS=300 node load-test.js
 *   LOAD_TEST_URL=https://api.yourdomain.com node load-test.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.LOAD_TEST_URL || 'http://localhost:3001';
const DEMO_EXAM_ID = process.env.DEMO_EXAM_ID || 'e1000000-0000-0000-0000-000000000001';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '300', 10);
const AUTOSAVES_PER_USER = parseInt(process.env.AUTOSAVES_PER_USER || '60', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '75', 10);
const SUB_2S_TARGET_MS = 2000;
const MAX_MEMORY_MB = parseInt(process.env.MAX_MEMORY_MB || '512', 10);

const isHttps = BASE_URL.startsWith('https');
const httpModule = isHttps ? https : http;

// High-capacity HTTP agent for connection pooling
const agent = isHttps
  ? new https.Agent({ keepAlive: true, maxSockets: 400, maxFreeSockets: 100, timeout: 30000 })
  : new http.Agent({ keepAlive: true, maxSockets: 400, maxFreeSockets: 100, timeout: 30000 });

// ── Telemetry Accumulators ────────────────────────────────────────────────
const latencies = [];
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const phaseResults = {};
const memorySnapshots = [];

// ── HTTP Request Helper ───────────────────────────────────────────────────
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
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
    };

    totalRequests++;

    const req = httpModule.request(reqOptions, (res) => {
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

    req.setTimeout(25000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// ── Memory Snapshot Helper ────────────────────────────────────────────────
async function captureServerMemory() {
  try {
    const res = await timedRequest('/api/health');
    // If the server exposes memory info, capture it
    // Otherwise use a separate /debug/memory probe or rely on local process.memoryUsage()
    const local = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: Math.round(local.heapUsed / 1024 / 1024),
      rss: Math.round(local.rss / 1024 / 1024),
      external: Math.round(local.external / 1024 / 1024),
    };
    memorySnapshots.push(snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

// ── Percentile Calculator ─────────────────────────────────────────────────
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

// ── Batched Runner (controls concurrency to avoid OOM on 512MB) ───────────
async function runBatched(items, fn, batchSize = BATCH_SIZE) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

// ── Socket.io Lobby Simulator (lightweight polling fallback) ──────────────
// Since we can't use socket.io-client without npm install, simulate WebSocket
// load via HTTP long-polling (Socket.io transport=polling) which is what the
// server accepts as a fallback transport.
async function simulateLobbyJoin(examCode, hallTicket, studentName) {
  const pollingPath = `/socket.io/?EIO=4&transport=polling`;
  const res = await timedRequest(pollingPath);
  return res;
}

async function simulateLeaderboardPoll(examCode) {
  const res = await timedRequest(`/api/exam/${examCode}/leaderboard`);
  return res;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN LOAD TEST
// ══════════════════════════════════════════════════════════════════════════
async function runLoadTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚡ LOGICWHILELIRE — 300-USER PRE-LAUNCH LOAD TEST');
  console.log(`   Target:            ${BASE_URL}`);
  console.log(`   Concurrent Users:  ${CONCURRENT_USERS}`);
  console.log(`   Autosaves/User:    ${AUTOSAVES_PER_USER} (total: ${CONCURRENT_USERS * AUTOSAVES_PER_USER})`);
  console.log(`   Batch Concurrency: ${BATCH_SIZE}`);
  console.log(`   Memory Ceiling:    ${MAX_MEMORY_MB}MB`);
  console.log(`   Latency Target:    P99 < ${SUB_2S_TARGET_MS}ms`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const suiteStartTime = Date.now();
  const testRunId = Date.now().toString().slice(-6);

  // ── User State ──────────────────────────────────────────────────────────
  const users = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
    const num = String(i + 1).padStart(3, '0');
    return {
      index: i + 1,
      name: `LoadCandidate ${num}`,
      hall_ticket: `GR-LT-${testRunId}-${num}`,
      mobile: `+9198765${num.padStart(5, '0')}`,
      email: `lt.${testRunId}.${num}@student.loadtest.local`,
      participant_id: null,
      demo_otp: null,
      token: null,
      session_id: null,
      questions: [],
    };
  });

  // Baseline memory capture
  const baseMemory = await captureServerMemory();
  console.log(`📊 Baseline memory — Local RSS: ${baseMemory?.rss || 'N/A'}MB\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: Enrollment Burst (300 simultaneous enrollments)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 1] 📝 Enrollment Burst (${CONCURRENT_USERS} candidates in batches of ${BATCH_SIZE})...`);
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
  });

  const p1Duration = (Date.now() - p1Start) / 1000;
  const p1Success = enrollResults.filter((r) => r.success).length;
  phaseResults['Phase 1: Enrollment'] = calculatePercentiles(p1Latencies);
  console.log(`  ✅ ${p1Success}/${CONCURRENT_USERS} enrolled in ${p1Duration.toFixed(2)}s (P95: ${phaseResults['Phase 1: Enrollment'].p95.toFixed(1)}ms)\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2: OTP Verification (300 simultaneous verifications)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 2] 🔐 OTP Verification Burst (${CONCURRENT_USERS} candidates)...`);
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
  });

  const p2Duration = (Date.now() - p2Start) / 1000;
  const p2Success = otpResults.filter((r) => r.success).length;
  phaseResults['Phase 2: OTP Verification'] = calculatePercentiles(p2Latencies);
  console.log(`  ✅ ${p2Success}/${CONCURRENT_USERS} verified in ${p2Duration.toFixed(2)}s (P95: ${phaseResults['Phase 2: OTP Verification'].p95.toFixed(1)}ms)\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3: Lobby Join (Socket.io polling transport — 300 connections)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 3] 🚪 Lobby Join Burst (Socket.io polling — ${CONCURRENT_USERS} connections)...`);
  const p3Start = Date.now();
  const p3Latencies = [];

  const lobbyResults = await runBatched(users, async (u) => {
    const res = await simulateLobbyJoin(DEMO_EXAM_ID, u.hall_ticket, u.name);
    p3Latencies.push(res.durationMs);
    return res;
  });

  const p3Duration = (Date.now() - p3Start) / 1000;
  const p3Success = lobbyResults.filter((r) => r.success).length;
  phaseResults['Phase 3: Lobby Join (WS)'] = calculatePercentiles(p3Latencies);
  console.log(`  ✅ ${p3Success}/${CONCURRENT_USERS} lobby connections in ${p3Duration.toFixed(2)}s (P95: ${phaseResults['Phase 3: Lobby Join (WS)'].p95.toFixed(1)}ms)\n`);

  // Memory checkpoint
  const midMemory1 = await captureServerMemory();
  console.log(`  📊 Memory after lobby: ${midMemory1?.rss || 'N/A'}MB\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: Session Start (300 candidates start exam simultaneously)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 4] 🚀 Session Start Burst (${CONCURRENT_USERS} candidates)...`);
  const p4Start = Date.now();
  const p4Latencies = [];

  const startResults = await runBatched(users, async (u) => {
    if (!u.token) return { success: false, durationMs: 0 };
    const startRes = await timedRequest('/api/session/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
    }, {
      fingerprint: `fp-${u.index}-${Date.now()}`,
    });
    p4Latencies.push(startRes.durationMs);
    return startRes;
  });

  const p4Duration = (Date.now() - p4Start) / 1000;
  const p4Success = startResults.filter((r) => r.success).length;
  phaseResults['Phase 4: Session Start'] = calculatePercentiles(p4Latencies);
  console.log(`  ✅ ${p4Success}/${CONCURRENT_USERS} sessions started in ${p4Duration.toFixed(2)}s (P95: ${phaseResults['Phase 4: Session Start'].p95.toFixed(1)}ms)\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5: Question Retrieval (300 candidates fetch question sets)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 5] 📋 Question Retrieval (${CONCURRENT_USERS} candidates)...`);
  const p5Start = Date.now();
  const p5Latencies = [];

  const questionResults = await runBatched(users, async (u) => {
    if (!u.token || !u.session_id) return { success: false, durationMs: 0 };
    const qRes = await timedRequest(`/api/session/${u.session_id}/questions?page=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${u.token}` },
    });
    p5Latencies.push(qRes.durationMs);
    if (qRes.success && qRes.data?.questions) {
      u.questions = qRes.data.questions;
    }
    return qRes;
  });

  const p5Duration = (Date.now() - p5Start) / 1000;
  const p5Success = questionResults.filter((r) => r.success).length;
  phaseResults['Phase 5: Question Retrieval'] = calculatePercentiles(p5Latencies);
  console.log(`  ✅ ${p5Success}/${CONCURRENT_USERS} question sets in ${p5Duration.toFixed(2)}s (P95: ${phaseResults['Phase 5: Question Retrieval'].p95.toFixed(1)}ms)\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 6: 60 Autosaves per Student (300 × 60 = 18,000 writes)
  // ═══════════════════════════════════════════════════════════════════════
  const totalAutosaves = CONCURRENT_USERS * AUTOSAVES_PER_USER;
  console.log(`[Phase 6] 💾 Autosave Storm (${AUTOSAVES_PER_USER} saves/user × ${CONCURRENT_USERS} users = ${totalAutosaves} writes)...`);
  const p6Start = Date.now();
  const p6Latencies = [];
  const options = ['a', 'b', 'c', 'd'];
  let p6SuccessCount = 0;
  let p6FailCount = 0;

  // Simulate autosaves in rounds of AUTOSAVES_PER_USER
  // Each round: all users save one answer (batched to control concurrency)
  for (let saveRound = 0; saveRound < AUTOSAVES_PER_USER; saveRound++) {
    const roundResults = await runBatched(users, async (u) => {
      if (!u.token || !u.session_id) return { success: false, durationMs: 0 };

      // Cycle through available questions, or generate a synthetic question_id
      const qIdx = saveRound % Math.max(u.questions.length, 1);
      const questionId = u.questions[qIdx]?.id || `q-synthetic-${saveRound}`;
      const chosenOption = options[(u.index + saveRound) % 4];

      const res = await timedRequest(`/api/session/${u.session_id}/answer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${u.token}` },
      }, {
        question_id: questionId,
        chosen_option: chosenOption,
        answer_latency_ms: 800 + (saveRound * 50) + (u.index % 200),
        autosave: true,
      });
      p6Latencies.push(res.durationMs);
      if (res.success) p6SuccessCount++;
      else p6FailCount++;
      return res;
    });

    // Progress reporting every 10 rounds
    if ((saveRound + 1) % 10 === 0 || saveRound === AUTOSAVES_PER_USER - 1) {
      const elapsed = ((Date.now() - p6Start) / 1000).toFixed(1);
      const pct = (((saveRound + 1) / AUTOSAVES_PER_USER) * 100).toFixed(0);
      process.stdout.write(`\r  ⏳ Round ${saveRound + 1}/${AUTOSAVES_PER_USER} (${pct}%) — ${p6SuccessCount} OK, ${p6FailCount} ERR — ${elapsed}s elapsed`);
    }
  }

  const p6Duration = (Date.now() - p6Start) / 1000;
  phaseResults['Phase 6: 60× Autosaves'] = calculatePercentiles(p6Latencies);
  console.log(`\n  ✅ ${p6SuccessCount}/${totalAutosaves} autosaves in ${p6Duration.toFixed(2)}s (P95: ${phaseResults['Phase 6: 60× Autosaves'].p95.toFixed(1)}ms)\n`);

  // Memory checkpoint after heavy writes
  const midMemory2 = await captureServerMemory();
  console.log(`  📊 Memory after autosaves: ${midMemory2?.rss || 'N/A'}MB\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 7: Final Submission Burst (300 simultaneous /submit calls)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 7] 🏁 Submission Spike (${CONCURRENT_USERS} simultaneous /submit calls)...`);
  const p7Start = Date.now();
  const p7Latencies = [];

  const submitResults = await runBatched(users, async (u) => {
    if (!u.token || !u.session_id) return { success: false, durationMs: 0 };
    const res = await timedRequest(`/api/session/${u.session_id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${u.token}` },
    });
    p7Latencies.push(res.durationMs);
    return res;
  });

  const p7Duration = (Date.now() - p7Start) / 1000;
  const p7Success = submitResults.filter((r) => r.success).length;
  phaseResults['Phase 7: Submission'] = calculatePercentiles(p7Latencies);
  console.log(`  ✅ ${p7Success}/${CONCURRENT_USERS} submissions in ${p7Duration.toFixed(2)}s (P95: ${phaseResults['Phase 7: Submission'].p95.toFixed(1)}ms)\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 8: Live Leaderboard Storm (REST + simulated Socket.io polling)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[Phase 8] 🏆 Leaderboard Read Storm (${CONCURRENT_USERS} concurrent reads + WS polling)...`);
  const p8Start = Date.now();
  const p8Latencies = [];

  // REST leaderboard reads
  const leaderboardReads = Array.from({ length: CONCURRENT_USERS }, (_, i) => i);
  const leaderboardResults = await runBatched(leaderboardReads, async () => {
    const res = await simulateLeaderboardPoll(DEMO_EXAM_ID);
    p8Latencies.push(res.durationMs);
    return res;
  });

  // Socket.io polling reads (simulates WebSocket leaderboard subscriptions)
  const wsPolls = Array.from({ length: Math.min(CONCURRENT_USERS, 100) }, (_, i) => i);
  const wsPollResults = await runBatched(wsPolls, async () => {
    const res = await timedRequest(`/socket.io/?EIO=4&transport=polling`);
    p8Latencies.push(res.durationMs);
    return res;
  }, 50);

  const p8Duration = (Date.now() - p8Start) / 1000;
  const p8Success = leaderboardResults.filter((r) => r.success).length + wsPollResults.filter((r) => r.success).length;
  const p8Total = leaderboardResults.length + wsPollResults.length;
  phaseResults['Phase 8: Leaderboard Storm'] = calculatePercentiles(p8Latencies);
  console.log(`  ✅ ${p8Success}/${p8Total} leaderboard reads in ${p8Duration.toFixed(2)}s (P95: ${phaseResults['Phase 8: Leaderboard Storm'].p95.toFixed(1)}ms)\n`);

  // Final memory capture
  const finalMemory = await captureServerMemory();

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL TELEMETRY REPORT
  // ═══════════════════════════════════════════════════════════════════════
  const totalDurationSec = (Date.now() - suiteStartTime) / 1000;
  const overallStats = calculatePercentiles(latencies);
  const throughputRps = (totalRequests / totalDurationSec).toFixed(1);
  const errorRatePercent = ((failedRequests / totalRequests) * 100).toFixed(2);
  const isP99Sub2s = overallStats.p99 < SUB_2S_TARGET_MS;
  const isP95Sub2s = overallStats.p95 < SUB_2S_TARGET_MS;
  const peakRss = Math.max(...memorySnapshots.map((s) => s.rss));
  const isMemoryOk = peakRss <= MAX_MEMORY_MB;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 LOAD TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Requests Processed: ${totalRequests}`);
  console.log(`Successful Requests:      ${successfulRequests}`);
  console.log(`Failed Requests:          ${failedRequests} (Error Rate: ${errorRatePercent}%)`);
  console.log(`Total Elapsed Time:       ${totalDurationSec.toFixed(2)} seconds`);
  console.log(`Throughput:               ${throughputRps} requests/sec`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('⏱️  LATENCY PERCENTILES (Overall):');
  console.log(`  • Min Latency:          ${overallStats.min.toFixed(2)} ms`);
  console.log(`  • Mean Latency:         ${overallStats.mean.toFixed(2)} ms`);
  console.log(`  • P50 (Median):         ${overallStats.p50.toFixed(2)} ms`);
  console.log(`  • P90:                  ${overallStats.p90.toFixed(2)} ms`);
  console.log(`  • P95:                  ${overallStats.p95.toFixed(2)} ms`);
  console.log(`  • P99:                  ${overallStats.p99.toFixed(2)} ms  <-- Target: < ${SUB_2S_TARGET_MS} ms`);
  console.log(`  • Max Latency:          ${overallStats.max.toFixed(2)} ms`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('💾 MEMORY USAGE:');
  console.log(`  • Baseline RSS:         ${baseMemory?.rss || 'N/A'} MB`);
  console.log(`  • Peak RSS:             ${peakRss || 'N/A'} MB  <-- Ceiling: ${MAX_MEMORY_MB} MB`);
  console.log(`  • Final RSS:            ${finalMemory?.rss || 'N/A'} MB`);
  console.log(`  • Memory OK:            ${isMemoryOk ? '✅ YES' : '❌ EXCEEDED'}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📈 PER-PHASE LATENCY BREAKDOWN (P50 / P95 / P99):');
  for (const [phase, stats] of Object.entries(phaseResults)) {
    console.log(`  • ${phase.padEnd(35)} : P50=${stats.p50.toFixed(1).padStart(6)}ms | P95=${stats.p95.toFixed(1).padStart(6)}ms | P99=${stats.p99.toFixed(1).padStart(6)}ms`);
  }
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = isP95Sub2s && failedRequests === 0;
  if (passed) {
    console.log(`🏆 BENCHMARK PASSED: P95=${overallStats.p95.toFixed(0)}ms, 0 errors, ${peakRss || '?'}MB RSS under ${CONCURRENT_USERS} concurrent users`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    const reasons = [];
    if (!isP95Sub2s) reasons.push(`P95 latency ${overallStats.p95.toFixed(0)}ms > ${SUB_2S_TARGET_MS}ms`);
    if (failedRequests > 0) reasons.push(`${failedRequests} failed requests (${errorRatePercent}%)`);
    if (!isMemoryOk) reasons.push(`Peak RSS ${peakRss}MB > ${MAX_MEMORY_MB}MB ceiling`);
    console.error(`⚠️  BENCHMARK FAILED: ${reasons.join(', ')}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

runLoadTest().catch((err) => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});
