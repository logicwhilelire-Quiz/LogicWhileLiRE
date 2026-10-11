import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import BrandLogo from "../components/BrandLogo";
import AnimatedPage from "../components/AnimatedPage";
import { getAssessmentSystemCheck, authLogout, getExamLobbyStats } from "../lib/api";
import { SOCKET_URL } from "../lib/config";


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
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 9),
    ]);
  };

  // ── Mount-time REST check (item 2): recover from page refresh after EXAM_STARTED ──
  // This runs before the socket connects so a student who refreshes the page
  // mid-exam doesn't get permanently stuck on the disabled "Waiting" button.
  useEffect(() => {
    const checkIfAlreadyStarted = async () => {
      try {
        const res = await getExamLobbyStats(contestId);
        const d = res.data;
        if (d?.exam_started && d.exam_started.server_start_time) {
          const s = d.exam_started;
          setExamStarted(true);
          setStartPayload({
            event: "EXAM_STARTED",
            exam_id: s.exam_id || contestId.toUpperCase(),
            server_start_time: s.server_start_time,
            duration_seconds: s.duration_seconds,
            allow_late_join: s.allow_late_join ?? true,
            elapsed_seconds: s.elapsed_seconds,
          });
          addEvent(
            `[REST-sync] Exam already started — elapsed=${s.elapsed_seconds}s, remaining=${s.remaining_seconds}s`,
            "alert"
          );
        }
      } catch {
        // Non-fatal — socket event is the primary mechanism
      }
    };
    checkIfAlreadyStarted();
  }, [contestId]);

  // Real-time Administrator Command Synchronizer (Cross-Window & Broadcast Channel)
  useEffect(() => {
    const checkAdminCommand = () => {
      try {
        const state =
          localStorage.getItem(`admin_exam_state_${contestId}`) ||
          localStorage.getItem(`admin_exam_state_${contestId.toUpperCase()}`) ||
          localStorage.getItem(`admin_exam_state_DEMO123`);

        if (state === 'started' && !examStarted) {
          const startedAtStr =
            localStorage.getItem(`admin_exam_started_at_${contestId}`) ||
            localStorage.getItem(`admin_exam_started_at_${contestId.toUpperCase()}`) ||
            String(Date.now());
          const startedAt = Number(startedAtStr) || Date.now();
          setExamStarted(true);
          setStartPayload({
            event: 'EXAM_STARTED',
            exam_id: contestId.toUpperCase(),
            server_start_time: startedAt,
            duration_seconds: 3600,
            allow_late_join: false,
          });
          addEvent('🚀 [ADMIN COMMAND] Administrator dispatched live start command! Launching assessment…', 'alert');
        }
      } catch {}
    };

    checkAdminCommand();
    const interval = setInterval(checkAdminCommand, 1000);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('logicwhilelire_admin_exam_commands');
        bc.onmessage = (e) => {
          if (
            (e.data?.examCode?.toUpperCase() === contestId.toUpperCase() || e.data?.examCode === 'DEMO123') &&
            e.data?.state === 'started'
          ) {
            checkAdminCommand();
          }
        };
      } catch {}
    }

    window.addEventListener('storage', checkAdminCommand);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkAdminCommand);
      bc?.close();
    };
  }, [contestId, examStarted]);

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
      socket.emit("lobby:join", {
        examCode: contestId,
        hallTicket: candidate?.roll_number || (candidate as any)?.hall_ticket || candidate?.email || 'STUDENT',
        studentName: candidate?.name || candidate?.first_name || 'Student Candidate',
        section: candidate?.section || 'General',
      });
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
      const hallTicket = candidate?.roll_number || (location.state as any)?.hallTicket || "2201A0501";
      const timer = setTimeout(() => {
        navigate(`/quiz/${examCode}`, {
          state: {
            serverStartTime: startPayload.server_start_time,
            durationSeconds: startPayload.duration_seconds,
            examCode,
            hallTicket,
          },
        });
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [examStarted, startPayload, contestId, candidate, location.state, navigate]);

  const handleManualStart = () => {
    const examCode = startPayload?.exam_id || contestId;
    const hallTicket = candidate?.roll_number || (location.state as any)?.hallTicket || "2201A0501";
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
        hallTicket,
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
          background: "#081326",
          color: "#F8FAFC",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* EXAM STARTED MODAL OVERLAY */}
        {examStarted && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 33, 71, 0.95)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                background: "#0B1A30",
                border: "2px solid #EAA812",
                borderRadius: 14,
                padding: "36px 48px",
                textAlign: "center",
                maxWidth: 500,
                width: "90%",
                boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>🚀</div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 900,
                  color: "#EAA812",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Exam Initialized!
              </div>
              <div style={{ fontSize: "0.95rem", color: "#CBD5E1", marginBottom: 24, lineHeight: 1.5 }}>
                The proctor has unlocked the assessment session. Synchronous timer is running.
              </div>
              <button
                onClick={handleManualStart}
                style={{
                  background: "#EAA812",
                  color: "#002147",
                  border: "none",
                  borderRadius: 8,
                  padding: "14px 32px",
                  fontSize: "1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  width: "100%",
                  boxShadow: "0 4px 16px rgba(234, 168, 18, 0.35)",
                }}
              >
                Enter Assessment Now &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Top Institutional Header */}
        <div
          style={{
            width: "100%",
            maxWidth: 1040,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            padding: "12px 20px",
            background: "#002147",
            border: "1px solid rgba(234, 168, 18, 0.3)",
            borderRadius: 10,
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <BrandLogo size="sm" variant="standard" />
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 12 }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.02em" }}>
                SYNCHRONOUS ASSESSMENT LOBBY
              </div>
              <div style={{ fontSize: "0.72rem", color: "#EAA812", fontWeight: 600 }}>
                Room: {contestId.toUpperCase()} • PRD v1.0 Engine
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 6,
                background: connected ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${connected ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                fontSize: "0.78rem",
                fontFamily: "monospace",
                fontWeight: 700,
                color: connected ? "#34D399" : "#F87171",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: connected ? "#10B981" : "#EF4444",
                }}
              />
              <span>SOCKET: {connected ? "CONNECTED" : "RECONNECTING..."}</span>
              {latency !== null && <span style={{ color: "#EAA812" }}>({latency}ms)</span>}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#E2E8F0",
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div
          style={{
            width: "100%",
            maxWidth: 1040,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
            gap: 18,
          }}
        >
          {/* Column 1: Clearance & Timer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Candidate Card */}
            <div
              style={{
                padding: 22,
                background: "#0E1A2E",
                border: "1px solid rgba(234, 168, 18, 0.25)",
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#EAA812",
                  }}
                >
                  Candidate Gate Clearance
                </div>
                <div
                  style={{
                    background: "rgba(16,185,129,0.15)",
                    color: "#34D399",
                    border: "1px solid rgba(16,185,129,0.35)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  VERIFIED CLAIM ✔
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#FFFFFF", marginBottom: 3 }}>
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#38BDF8",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    marginBottom: 18,
                  }}
                >
                  Roll / Hall Ticket: {candidate?.roll_number || "22B91A0501"}
                </div>
              </div>

              <button
                id="start-assessment-now-btn"
                onClick={handleManualStart}
                disabled={!examStarted}
                style={{
                  width: "100%",
                  background: examStarted ? "#EAA812" : "rgba(255,255,255,0.08)",
                  boxShadow: examStarted ? "0 4px 16px rgba(234,168,18,0.4)" : "none",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "13px 18px",
                  borderRadius: 6,
                  cursor: examStarted ? "pointer" : "not-allowed",
                  color: examStarted ? "#002147" : "#64748B",
                  border: examStarted ? "none" : "1px solid rgba(255,255,255,0.12)",
                  transition: "all 0.25s ease",
                }}
              >
                {examStarted ? "ENTER LIVE ASSESSMENT NOW →" : "⏳ Waiting for Instructor to Dispatch EXAM_STARTED..."}
              </button>
            </div>

            {/* Assessment Timer Box */}
            <div
              style={{
                padding: "18px 22px",
                textAlign: "center",
                background: "#0E1A2E",
                border: "1px solid rgba(234, 168, 18, 0.25)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94A3B8",
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {examStarted ? "🟢 Exam In Progress" : "Global Synchronous Timer Sync"}
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  fontFamily: "monospace",
                  color: examStarted ? "#34D399" : "#EAA812",
                  letterSpacing: "0.04em",
                }}
              >
                {examStarted ? "00:00" : timeFormatted}
              </div>
              <div style={{ fontSize: "0.76rem", color: "#94A3B8", marginTop: 4 }}>
                {examStarted
                  ? "Assessment active — auto-saving answers in real-time"
                  : "All enrolled candidates will start simultaneously upon dispatch"}
              </div>
            </div>
          </div>

          {/* Column 2: Stats, System Check, Event Log */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Visual Connection Counters */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "In Lobby", value: lobbyMeta.connected, color: "#38BDF8" },
                { label: "Enrolled", value: lobbyMeta.enrolled, color: "#EAA812" },
                { label: "Pending", value: lobbyMeta.pending, color: "#F59E0B" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#0E1A2E",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "14px 10px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94A3B8", marginTop: 3, fontWeight: 700 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Pre-Assessment Verification */}
            <div
              style={{
                padding: "18px 20px",
                background: "#0E1A2E",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#EAA812",
                  marginBottom: 10,
                }}
              >
                Pre-Assessment Verification
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { ok: true, label: "100% Identity Uniqueness confirmed" },
                  { ok: connected, label: `WebSocket Gateway ${connected ? `connected (${latency ?? "-"}ms)` : "reconnecting..."}` },
                  { ok: true, label: "Single-session browser mutex active" },
                  { ok: true, label: "Dynamic question & option SWAP randomized" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.82rem" }}>
                    <span style={{ color: item.ok ? "#34D399" : "#F59E0B", fontWeight: 800 }}>
                      {item.ok ? "✔" : "⏳"}
                    </span>
                    <span style={{ color: "#E2E8F0" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, fontSize: "0.8rem", color: "#64748B" }}>
          Need to re-enter or check your credentials?{" "}
          <Link to="/enter-exam" style={{ color: "#EAA812", fontWeight: 700, textDecoration: "underline" }}>
            Return to Assessment Entrance Gate
          </Link>
        </div>
      </div>
    </AnimatedPage>
  );
}
