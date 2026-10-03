/**
 * InstructorConsolePage.tsx
 * Sprint 2: Instructor Live Control & Real-Time Leaderboard
 *
 * Route: /admin/live-console/:examCode
 *
 * Features:
 * - Lobby readiness panel: enrolled / socket-connected / pending
 * - Guarded Push-to-Start button with confirmation dialog
 * - Live LEADERBOARD_SNAPSHOT reactive table (socket-driven)
 * - PRD tie-break formula: Score - (Time Elapsed / Total Duration)
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import AdminSidebar from "../../components/layout/AdminSidebar";
import AnimatedPage from "../../components/AnimatedPage";
import { startExam, getExamLobbyStats } from "../../lib/api";
import { SOCKET_URL } from "../../lib/config";


interface RankEntry {
  rank: number;
  student_id: string;
  student_name: string;
  score: number;
  percentage: number;
  answered: number;
  time_taken_seconds: number;
}

interface LeaderboardSnapshot {
  event: "LEADERBOARD_SNAPSHOT";
  exam_id: string;
  top_ranks: RankEntry[];
  total_active: number;
  timestamp: number;
}

interface LobbyStats {
  enrolled: number;
  connected: number;
  pending: number;
}

export default function InstructorConsolePage() {
  const { examCode = "DEMO123" } = useParams<{ examCode: string }>();
  const navigate = useNavigate();
  const code = examCode.toUpperCase();

  const [connected, setConnected] = useState(false);
  const [lobbyStats, setLobbyStats] = useState<LobbyStats>({ enrolled: 0, connected: 0, pending: 0 });
  const [leaderboard, setLeaderboard] = useState<RankEntry[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; time: string; text: string }>>([]);

  const socketRef = useRef<Socket | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (text: string) => {
    setEvents((prev) => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString(), text },
      ...prev.slice(0, 14),
    ]);
  };

  useEffect(() => {
    // Connect as leaderboard subscriber
    const socket = connectSocket(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      auth: { token: localStorage.getItem("admin_token") || undefined },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      addLog(`Instructor console connected (${socket.id?.slice(0, 8)}...)`);
      // Join both lobby room (to receive lobby:update) and leaderboard room
      socket.emit("lobby:join", { examCode: code });
      socket.emit("leaderboard:join", { examCode: code });
      addLog(`Subscribed to lobby:${code} + leaderboard:${code}`);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      addLog("WebSocket disconnected — reconnecting...");
    });

    socket.on("lobby:update", (data: { meta?: LobbyStats }) => {
      if (data.meta) {
        setLobbyStats(data.meta);
        addLog(`Lobby update: ${data.meta.connected} connected / ${data.meta.enrolled} enrolled`);
      }
    });

    socket.on("LEADERBOARD_SNAPSHOT", (snap: LeaderboardSnapshot) => {
      setLeaderboard(snap.top_ranks || []);
      setTotalActive(snap.total_active);
      setLastSnapshotAt(snap.timestamp);
    });

    // Poll REST lobby-stats every 3s for accuracy
    const fetchStats = async () => {
      try {
        const res = await getExamLobbyStats(code);
        if (res.data) setLobbyStats({ enrolled: res.data.enrolled || 0, connected: res.data.connected || 0, pending: res.data.pending || 0 });
      } catch { /* non-fatal */ }
    };
    fetchStats();
    statsIntervalRef.current = setInterval(fetchStats, 3000);

    return () => {
      socket.disconnect();
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [code]);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await startExam(code, { allow_late_join: false });
      if (res.data?.success) {
        setExamStarted(true);
        setConfirmOpen(false);
        addLog(`EXAM_STARTED broadcast sent! server_start_time=${res.data.server_start_time}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Start failed";
      setStartError(msg);
      addLog(`ERROR: ${msg}`);
    } finally {
      setStarting(false);
    }
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const medal = (rank: number) => ["🥇", "🥈", "🥉"][rank - 1] || `#${rank}`;

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg, #050814)" }}>
        <AdminSidebar activeTab="exams" />

        <main className="admin-content" style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Instructor Live Console
              </div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text)", margin: 0, fontFamily: "var(--font-display)" }}>
                {code} — Synchronous Control
              </h1>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.86rem", margin: "4px 0 0" }}>
                Real-time lobby readiness, push-to-start, and live leaderboard stream
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Socket status */}
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
                  background: connected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  border: `1px solid ${connected ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                  fontSize: "0.78rem", fontWeight: 700,
                  color: connected ? "#34d399" : "#f87171",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#10b981" : "#ef4444", boxShadow: connected ? "0 0 8px #10b981" : "none" }} />
                {connected ? "LIVE" : "OFFLINE"}
              </div>

              <button
                onClick={() => navigate("/admin/exams")}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", padding: "8px 16px", borderRadius: 7, fontSize: "0.82rem", cursor: "pointer" }}
              >
                ← Exam Control
              </button>
            </div>
          </div>

          {/* Lobby Readiness Panel */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24,
              padding: "20px 24px", borderRadius: 14,
              background: "linear-gradient(135deg, rgba(43,127,255,0.07) 0%, rgba(11,18,38,0.9) 100%)",
              border: "1px solid rgba(43,127,255,0.2)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em", marginBottom: 4 }}>Enrolled</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#a78bfa" }}>{lobbyStats.enrolled}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em", marginBottom: 4 }}>Socket Connected</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#10b981" }}>{lobbyStats.connected}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em", marginBottom: 4 }}>Pending Arrival</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f59e0b" }}>{lobbyStats.pending}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em", marginBottom: 4 }}>Submitted</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#38bdf8" }}>{totalActive}</div>
            </div>

            {/* Push to Start */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {examStarted ? (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontWeight: 800, textAlign: "center", fontSize: "0.9rem" }}>
                  &#x1F7E2; EXAM RUNNING
                </div>
              ) : (
                <button
                  id="instructor-start-exam-btn"
                  onClick={() => setConfirmOpen(true)}
                  disabled={starting}
                  style={{
                    padding: "12px 16px", borderRadius: 10, fontWeight: 800, fontSize: "0.9rem",
                    background: "linear-gradient(135deg, #2b7fff 0%, #1a4fcf 100%)",
                    color: "#fff", border: "none", cursor: "pointer",
                    boxShadow: "0 6px 24px rgba(43,127,255,0.4)",
                    letterSpacing: "0.03em",
                    opacity: starting ? 0.6 : 1,
                  }}
                >
                  {starting ? "Starting..." : "&#x1F680; Push to Start"}
                </button>
              )}
              {startError && <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: 6 }}>{startError}</div>}
            </div>
          </div>

          {/* Two-column: Leaderboard + Log */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
            {/* Live Leaderboard Table */}
            <div
              style={{
                borderRadius: 14, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(11,18,38,0.7)",
              }}
            >
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--color-text)", fontSize: "0.95rem" }}>&#x1F3C6; Live Leaderboard</div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2 }}>
                    Tie-break: Score &minus; (TimeElapsed / TotalDuration)
                  </div>
                </div>
                {lastSnapshotAt && (
                  <div style={{ fontSize: "0.7rem", color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>
                    &#x25CF; {new Date(lastSnapshotAt).toLocaleTimeString()}
                  </div>
                )}
              </div>

              {leaderboard.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "#475569", fontSize: "0.88rem" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>&#x23F3;</div>
                  {examStarted ? "Leaderboard updating in real time..." : "Start the exam to see live rankings"}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                        {["Rank", "Candidate", "Score", "%", "Answered", "Time"].map((h) => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => (
                        <tr
                          key={entry.student_id}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            background: entry.rank <= 3 ? "rgba(43,127,255,0.04)" : "transparent",
                            transition: "background 0.2s",
                          }}
                        >
                          <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: "1.05rem" }}>{medal(entry.rank)}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{entry.student_name || entry.student_id}</div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{entry.student_id}</div>
                          </td>
                          <td style={{ padding: "12px 14px", fontWeight: 800, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>{entry.score}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <div
                              style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700,
                                background: entry.percentage >= 80 ? "rgba(16,185,129,0.15)" : entry.percentage >= 60 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                                color: entry.percentage >= 80 ? "#10b981" : entry.percentage >= 60 ? "#f59e0b" : "#ef4444",
                              }}
                            >
                              {entry.percentage}%
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{entry.answered}</td>
                          <td style={{ padding: "12px 14px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem" }}>{fmtTime(entry.time_taken_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(11,18,38,0.7)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontWeight: 800, color: "var(--color-text)", fontSize: "0.92rem" }}>&#x1F4E1; Event Log</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 480 }}>
                {events.length === 0 && (
                  <div style={{ color: "#475569", fontSize: "0.8rem", textAlign: "center", paddingTop: 24 }}>Connecting to socket...</div>
                )}
                {events.map((ev) => (
                  <div key={ev.id} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, borderLeft: "3px solid rgba(43,127,255,0.4)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }}>
                    <span style={{ color: "#475569" }}>{ev.time}</span>
                    <span style={{ color: "#94a3b8", marginLeft: 8 }}>{ev.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirm Start Modal */}
      {confirmOpen && (
        <div
          onClick={() => setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(5,8,20,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: "100%", background: "#0B1226", borderRadius: 14, border: "1px solid rgba(43,127,255,0.35)", padding: 32 }}
          >
            <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>&#x1F680;</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>Confirm Exam Start</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 8px" }}>
              This will broadcast <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4 }}>EXAM_STARTED</code> to all <strong style={{ color: "#fff" }}>{lobbyStats.connected}</strong> connected students in <strong style={{ color: "#a78bfa" }}>{code}</strong>.
            </p>
            <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "0 0 24px" }}>
              &#x26A0; {lobbyStats.pending > 0 ? `${lobbyStats.pending} enrolled students have not yet connected to the lobby.` : "All enrolled students are in the lobby."}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ flex: 1, padding: "11px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}
              >
                Cancel
              </button>
              <button
                id="confirm-start-exam-btn"
                onClick={handleStart}
                disabled={starting}
                style={{ flex: 1, padding: "11px", borderRadius: 8, background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: "0.9rem", boxShadow: "0 6px 20px rgba(16,185,129,0.4)" }}
              >
                {starting ? "Broadcasting..." : "&#x2705; Start Exam Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
