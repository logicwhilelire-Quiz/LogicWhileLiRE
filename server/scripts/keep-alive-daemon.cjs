/**
 * keep-alive-daemon.cjs
 * LogicWhileLiRE — Continuous Cloud Backend Keep-Alive Daemon
 *
 * Keeps Render free-tier services continuously active by polling /api/health
 * every 5 minutes (300 seconds), preventing the 15-minute idle container sleep.
 *
 * Usage:
 *   node scripts/keep-alive-daemon.cjs
 *   or via PM2: pm2 start scripts/keep-alive-daemon.cjs --name "logicwhile-keepalive"
 */

const https = require('https');

const PING_URL = process.env.PING_URL || 'https://logicwhilelire-api.onrender.com/api/health';
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL_MS = 15 * 1000;    // 15 seconds on failure

console.log('================================================================');
console.log('🚀 LogicWhileLiRE — CLOUD BACKEND KEEP-ALIVE DAEMON');
console.log(`Target: ${PING_URL}`);
console.log(`Interval: Every 5 minutes (${PING_INTERVAL_MS / 1000}s)`);
console.log('================================================================\n');

function pingServer() {
  const start = Date.now();
  const req = https.get(PING_URL, { timeout: 45000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const elapsed = Date.now() - start;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[KeepAlive] ✅ Ping successful (${res.statusCode}) - ${elapsed}ms | ${new Date().toISOString()}`);
        scheduleNext(PING_INTERVAL_MS);
      } else {
        console.warn(`[KeepAlive] ⚠️ Non-200 response (${res.statusCode}) - ${elapsed}ms. Retrying in 15s...`);
        scheduleNext(RETRY_INTERVAL_MS);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[KeepAlive] ❌ Connection error: ${err.message}. Retrying in 15s...`);
    scheduleNext(RETRY_INTERVAL_MS);
  });

  req.on('timeout', () => {
    req.destroy();
    console.warn(`[KeepAlive] ⏳ Request timed out. Retrying in 15s...`);
    scheduleNext(RETRY_INTERVAL_MS);
  });
}

function scheduleNext(delay) {
  setTimeout(pingServer, delay);
}

// Initial ping on boot
pingServer();
