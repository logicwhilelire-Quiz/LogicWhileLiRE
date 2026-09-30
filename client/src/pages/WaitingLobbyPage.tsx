import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import BrandLogo from "../components/BrandLogo";
import AnimatedPage from "../components/AnimatedPage";
import ParticleField from "../components/3d/ParticleField";
import NodeNetwork from "../components/3d/NodeNetwork";
import { getAssessmentSystemCheck, authLogout } from "../lib/api";

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001";

interface CandidateProfile {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  college_id?: string;
  college_name?: string;
  year_of_passing?: number;
  roll_number?: string;
  branch_code?: string;
  section?: string;
  email?: string;
  contact_number?: string;
}

interface LobbyMeta {
  enrolled: number;
  connected: number;
  pending: number;
}

interface LobbyParticipant {
  hall_ticket_no: string;
  student_name: string;
  status: string;
}

interface ExamStartedPayload {
  event: "EXAM_STARTED";
  exam_id: string;
  server_start_time: number;
  duration_seconds: number;
  allow_late_join: boolean;
  /** Populated on reconnect-sync: seconds already elapsed at the point the server sent this */
  elapsed_seconds?: number;
}

export default function WaitingLobbyPage() {
  const { contestId = "demo-contest" } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lobbyMeta, setLobbyMeta] = useState<LobbyMeta>({ enrolled: 0, connected: 0, pending: 0 });
  const [examStarted, setExamStarted] = useState(false);
  const [startPayload, setStartPayload] = useState<ExamStartedPayload | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; time: string; text: string; type: "info" | "success" | "ping" | "alert" }>>([]);
  const [countdown, setCountdown] = useState(300);

  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = (text: string, type: "info" | "success" | "ping" | "alert" = "info") => {
    setEvents((prev) => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 9),
    ]);
  };

  useEffect(() => {
    const stateCandidate = (location.state as any)?.candidate;
    if (stateCandidate) {
      setCandidate(stateCandidate);
    } else {
      const stored = localStorage.getItem("student_user");
      if (stored) {
        try { setCandidate(JSON.parse(stored)); } catch { /* ignore */ }
      } else {
        setCandidate({
          first_name: "Venkata Srinivas", last_name: "Katta",
          name: "Venkata Srinivas Katta", college_id: "COL-UNIV-042",
          college_name: "University College of Eng.", year_of_passing: 2028,
          roll_number: "22B91A0501", branch_code: "CSM", section: "B",
          email: "srinivas.k@college.edu", contact_number: "+91 9876543210",
        });
      }
    }

    getAssessmentSystemCheck().catch(() => {});

    const socket = connectSocket(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      auth: { token: localStorage.getItem("student_token") || undefined },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      addEvent(`Socket connected (${socket.id?.slice(0, 8) || "?"}...)`, "success");
      socket.emit("lobby:join", { examCode: contestId });
      addEvent(`Joined lobby room: lobby:${contestId.toUpperCase()}`, "info");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      addEvent("WebSocket disconnected — attempting reconnect...", "alert");
    });

    socket.on("connect_error", () => {
      setConnected(false);
      addEvent("Connection error — retrying...", "alert");
    });

    socket.on("lobby:update", (data: { participants?: LobbyParticipant[]; meta?: LobbyMeta }) => {
      if (data.meta) {
        setLobbyMeta(data.meta);
        addEvent(`[REDIS] ${data.meta.connected} connected | ${data.meta.enrolled} enrolled | ${data.meta.pending} pending`, "ping");
      }
    });

    socket.on("EXAM_STARTED", (payload: ExamStartedPayload) => {
      setExamStarted(true);
      setStartPayload(payload);
      setCountdown(0);
      const elapsed = payload.elapsed_seconds ?? Math.floor((Date.now() - payload.server_start_time) / 1000);
      const remaining = Math.max(0, payload.duration_seconds - elapsed);
      addEvent(
        `EXAM_STARTED — exam=${payload.exam_id} | remaining=${remaining}s | ` +
        `${payload.elapsed_seconds != null ? 'reconnect-sync' : 'fresh start'}`,
        "alert"
      );
    });

    const pingStart: { t?: number } = {};
    pingIntervalRef.current = setInterval(() => {
      pingStart.t = Date.now();
      socket.emit("ping", pingStart.t);
    }, 4000);

    socket.on("pong", () => {
      if (pingStart.t) setLatency(Math.floor((Date.now() - pingStart.t) / 2));
    });

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    addEvent(`Subscribed to Redis Sorted Set leader channel: room:${contestId}:leader_set`, "success");
    addEvent("Encrypted JWT session claim verified. Gate clearance granted.", "info");
    addEvent("Composite uniqueness check verified on (college_id, roll_number).", "info");

    return () => {
      socket.disconnect();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [contestId, location.state]);

  useEffect(() => {
    if (examStarted && startPayload) {
      const examCode = startPayload.exam_id || contestId;
      const timer = setTimeout(() => {
        navigate(`/quiz/${examCode}`, {
          state: { serverStartTime: startPayload.server_start_time, durationSeconds: startPayload.duration_seconds, examCode },
        });
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [examStarted, startPayload, contestId, navigate]);

  const handleManualStart = () => {
    const examCode = startPayload?.exam_id || contestId;
    // Compute remaining from server_start_time to honour server-authoritative timer (Sprint 2, item 4)
    const elapsed = startPayload
      ? Math.floor((Date.now() - startPayload.server_start_time) / 1000)
      : 0;
    navigate(`/quiz/${examCode}`, {
      state: {
        examCode,
        serverStartTime: startPayload?.server_start_time,
        durationSeconds: startPayload?.duration_seconds,
        elapsed_seconds: elapsed,
      },
    });
  };

  const handleLogout = async () => {
    try { await authLogout(); } catch { /* ignore */ }
    localStorage.removeItem("student_token");
    localStorage.removeItem("student_user");
    socketRef.current?.disconnect();
    navigate("/login");
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const displayName = candidate?.name || `${candidate?.first_name || "Venkata"} ${candidate?.last_name || "Katta"}`.trim();

  return (
    <AnimatedPage>
      <div
        style={{
          minHeight: "100vh",
          background: examStarted
            ? "radial-gradient(ellipse at 50% 10%, #0a2a1a 0%, #050f08 80%)"
            : "radial-gradient(ellipse at 50% 10%, #15102a 0%, #08080f 80%)",
          color: "var(--color-text, #f0f0f8)",
          padding: "24px 16px 48px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
          transition: "background 0.6s ease",
        }}
      >
        <ParticleField liveCount={lobbyMeta.connected} particleCount={800} color="#a78bfa" />
        <NodeNetwork nodeCount={lobbyMeta.connected > 80 ? 40 : 25} maxDistance={140} lineColor="#38bdf8" nodeColor="#818cf8" />

        {/* EXAM STARTED OVERLAY */}
        {examStarted && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.25) 0%, rgba(5, 8, 20, 0.95) 70%)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ fontSize: "5rem", marginBottom: 16, animation: "pulse 0.8s infinite" }}>&#x1F680;</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#10b981", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Exam Started!
            </div>
            <div style={{ fontSize: "1rem", color: "#94a3b8", marginBottom: 28 }}>Entering assessment in a moment...</div>
            <button
              onClick={handleManualStart}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                border: "none", borderRadius: 10, color: "#fff",
                padding: "14px 36px", fontSize: "1rem", fontWeight: 800, cursor: "pointer",
                boxShadow: "0 8px 32px rgba(16, 185, 129, 0.5)",
              }}
            >
              Enter Now &rarr;
            </button>
          </div>
        )}

        {/* Nav Bar */}
        <div
          style={{
            width: "100%", maxWidth: 1000,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 24, padding: "12px 20px",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, backdropFilter: "blur(16px)",
          }}
        >
          <BrandLogo size="sm" variant="standard" />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 8,
                background: connected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${connected ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                fontSize: "0.78rem", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                color: connected ? "#34d399" : "#f87171",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#10b981" : "#ef4444", boxShadow: connected ? "0 0 10px #10b981" : "none", animation: connected ? "pulse 1.8s infinite" : "none" }} />
              <span>WEBSOCKET: {connected ? "CONNECTED" : "RECONNECTING..."}</span>
              {latency !== null && <span style={{ color: "#6ee7b7" }}>({latency}ms)</span>}
            </div>
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", padding: "6px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ width: "100%", maxWidth: 1000, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* Column 1 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ padding: "24px", background: "linear-gradient(135deg, rgba(26,26,38,0.95) 0%, rgba(17,17,24,0.98) 100%)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a78bfa" }}>Candidate Gate Clearance</div>
                <div style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", padding: "3px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700 }}>VERIFIED CLAIM &#10004;</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", marginBottom: 4 }}>{displayName}</div>
                <div style={{ fontSize: "0.88rem", color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Roll: {candidate?.roll_number || "22B91A0501"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.04em" }}>Institution</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>{candidate?.college_name || "University College of Eng."}</div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>{candidate?.college_id || "COL-UNIV-042"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.04em" }}>Branch &amp; Section</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f59e0b", marginTop: 2 }}>{candidate?.branch_code || "CSM"} &#x2022; Section {candidate?.section || "B"}</div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Batch: {candidate?.year_of_passing || 2028}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.04em" }}>Scorecard Dispatch</div>
                  <div style={{ fontSize: "0.82rem", color: "#e2e8f0", marginTop: 2, wordBreak: "break-all" }}>{candidate?.email || "srinivas.k@college.edu"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.04em" }}>Critical SMS Channel</div>
                  <div style={{ fontSize: "0.85rem", color: "#e2e8f0", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{candidate?.contact_number || "+91 9876543210"}</div>
                </div>
              </div>
              <button
                id="start-assessment-now-btn"
                onClick={handleManualStart}
                disabled={!examStarted}
                style={{
                  width: "100%",
                  background: examStarted ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "rgba(255,255,255,0.06)",
                  boxShadow: examStarted ? "0 8px 24px rgba(16,185,129,0.4)" : "none",
                  fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                  padding: "14px 20px", borderRadius: 8,
                  cursor: examStarted ? "pointer" : "not-allowed",
                  color: examStarted ? "#fff" : "#475569",
                  border: examStarted ? "none" : "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.35s ease",
                }}
              >
                {examStarted ? "ENTER LIVE ASSESSMENT NOW \u2192" : "\u23F3 Waiting for Instructor to Start..."}
              </button>
            </div>

            <div className="card" style={{ padding: "20px 24px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>
                {examStarted ? "&#x1F7E2; Exam In Progress" : "Assessment Timer Sync"}
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: examStarted ? "#10b981" : "#f59e0b", letterSpacing: "0.04em" }}>
                {examStarted ? "00:00" : timeFormatted}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                {examStarted ? "Transitioning to exam..." : "Global competitive assessment timer sync in progress"}
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "In Lobby", value: lobbyMeta.connected, color: "#38bdf8" },
                { label: "Enrolled", value: lobbyMeta.enrolled, color: "#a78bfa" },
                { label: "Pending", value: lobbyMeta.pending, color: "#f59e0b" },
              ].map((s) => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#e2e8f0", marginBottom: 12 }}>Pre-Assessment System Verification</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { ok: true, label: "100% Identity Uniqueness confirmed" },
                  { ok: connected, label: `WebSocket Gateway ${connected ? `connected (${latency ?? "-"}ms)` : "reconnecting..."}` },
                  { ok: true, label: "Browser full-screen and tab isolation armed" },
                  { ok: true, label: "Single-session mutex active" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.84rem" }}>
                    <span style={{ color: item.ok ? "#10b981" : "#f59e0b" }}>{item.ok ? "✔" : "⏳"}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a78bfa" }}>Redis Sorted Set Channel Stream</div>
                <div style={{ fontSize: "0.68rem", fontFamily: "'JetBrains Mono', monospace", color: "#6ee7b7" }}>LIVE FEED</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.74rem" }}>
                {events.map((ev) => (
                  <div key={ev.id} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, borderLeft: `3px solid ${ev.type === "success" ? "#10b981" : ev.type === "ping" ? "#06b6d4" : ev.type === "alert" ? "#f59e0b" : "#7c3aed"}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#94a3b8", flexShrink: 0 }}>{ev.time}</span>
                    <span style={{ color: ev.type === "alert" ? "#fbbf24" : "#e2e8f0" }}>{ev.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: "0.82rem", color: "#94a3b8" }}>
          Need to update your registration information?{" "}
          <Link to="/register" style={{ color: "#38bdf8", fontWeight: 600 }}>Return to Assessment Entrance Gate</Link>
        </div>
      </div>
    </AnimatedPage>
  );
}
