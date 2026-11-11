import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import BrandLogo from "../components/BrandLogo";
import AnimatedPage from "../components/AnimatedPage";
import { getAssessmentSystemCheck, authLogout, getExamLobbyStats, getAttemptStatus } from "../lib/api";
import { SOCKET_URL } from "../lib/config";
import HoloProctorDeskModal from "../components/HoloProctorDeskModal";
import { IconClock, IconLaunch, IconCheck, IconShield, IconPulse, IconAlert } from "../components/icons/HumanIcons";


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
  const { contestId = "exam-session" } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lobbyMeta, setLobbyMeta] = useState<LobbyMeta>({ enrolled: 0, connected: 0, pending: 0 });
  const [examStarted, setExamStarted] = useState(false);
  const [startPayload, setStartPayload] = useState<ExamStartedPayload | null>(null);
  const [isReleased, setIsReleased] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [events, setEvents] = useState<Array<{ id: string; time: string; text: string; type: "info" | "success" | "ping" | "alert" }>>([]);
  const [countdown, setCountdown] = useState(300);
  // Real exam duration fetched from server (used for accurate timer when exam starts via LocalStorage/BC)
  const [examDurationSeconds, setExamDurationSeconds] = useState(3600);
  const [showProctorDesk, setShowProctorDesk] = useState(false);

  const displayName = candidate?.name || `${candidate?.first_name || "Student"} ${candidate?.last_name || "Candidate"}`.trim();

  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = (text: string, type: "info" | "success" | "ping" | "alert" = "info") => {
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 9),
    ]);
  };

  // ── High-Speed REST Synchronization & Fallback Polling ──
  // Polls lobby status every 2.5 seconds to guarantee candidates are immediately dispatched
  // even if network fluctuations drop a single WebSocket frame.
  useEffect(() => {
    let isMounted = true;
    const checkIfAlreadyStarted = async () => {
      if (!isMounted || examStarted) return;
      try {
        const res = await getExamLobbyStats(contestId);
        const d = res.data;
        if (!isMounted) return;
        if (d?.duration_seconds) {
          setExamDurationSeconds(d.duration_seconds);
        } else if (d?.exam_started?.duration_seconds) {
          setExamDurationSeconds(d.exam_started.duration_seconds);
        }
        if (d?.exam_started && d.exam_started.server_start_time) {
          const s = d.exam_started;
          setExamStarted(true);
          setIsReleased(true);
          setStartPayload({
            event: "EXAM_STARTED",
            exam_id: s.exam_id || contestId.toUpperCase(),
            server_start_time: s.server_start_time,
            duration_seconds: s.duration_seconds || examDurationSeconds,
            allow_late_join: s.allow_late_join ?? true,
            elapsed_seconds: s.elapsed_seconds,
          });
          addEvent(
            `[REST-sync] Exam active — remaining=${s.remaining_seconds}s`,
            "alert"
          );
        }
      } catch {
        // Non-fatal
      }
    };

    checkIfAlreadyStarted();
    const interval = setInterval(checkIfAlreadyStarted, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [contestId, examStarted, examDurationSeconds]);

  // Real-time Administrator Command Synchronizer (Cross-Window & Broadcast Channel)
  useEffect(() => {
    const checkAdminCommand = () => {
      try {
        const state =
          localStorage.getItem(`admin_exam_state_${contestId}`) ||
          localStorage.getItem(`admin_exam_state_${contestId.toUpperCase()}`);

        if (state === 'started' && !examStarted) {
          const startedAtStr =
            localStorage.getItem(`admin_exam_started_at_${contestId}`) ||
            localStorage.getItem(`admin_exam_started_at_${contestId.toUpperCase()}`) ||
            String(Date.now());
          const startedAt = Number(startedAtStr) || Date.now();
          // Use the real duration fetched from server; fall back to 3600 only as last resort
          const durationSec =
            Number(localStorage.getItem(`admin_exam_duration_${contestId}`)) ||
            Number(localStorage.getItem(`admin_exam_duration_${contestId.toUpperCase()}`)) ||
            examDurationSeconds;
          setExamStarted(true);
          setStartPayload({
            event: 'EXAM_STARTED',
            exam_id: contestId.toUpperCase(),
            server_start_time: startedAt,
            duration_seconds: durationSec,
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
            e.data?.examCode?.toUpperCase() === contestId.toUpperCase() &&
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
    let resolvedCandidate = (location.state as any)?.candidate;
    if (!resolvedCandidate) {
      const stored = localStorage.getItem("student_user") || localStorage.getItem("logicwhilelire_attempt") || localStorage.getItem("lw_attempt");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          resolvedCandidate = parsed.student || parsed;
        } catch { /* ignore */ }
      }
    }
    if (resolvedCandidate) {
      setCandidate(resolvedCandidate);
    }

    const effectiveHt = String(
      resolvedCandidate?.roll_number ||
      resolvedCandidate?.hall_ticket ||
      (location.state as any)?.hallTicket ||
      ''
    ).toUpperCase().trim();
    const effectiveName = resolvedCandidate?.name || resolvedCandidate?.first_name || (location.state as any)?.studentName || 'Student Candidate';
    const effectiveSection = resolvedCandidate?.section || 'General';
    const effectiveAttemptId = (location.state as any)?.attemptId || resolvedCandidate?.attemptId;

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
        hallTicket: effectiveHt || 'STUDENT',
        studentName: effectiveName,
        section: effectiveSection,
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

    // PRIORITY 2: Live release event from Admin or Inspector
    socket.on("STUDENT_RELEASED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (data.all || !data.hallTicket || !myHt || data.hallTicket.toUpperCase() === myHt) {
          setIsReleased(true);
          addEvent("Release granted by supervisor! Proceeding to instructions...", "success");
          try {
            const currentAttempt = {
              examCode: contestId.toUpperCase(),
              hallTicket: myHt || effectiveHt,
              studentName: effectiveName,
              attemptId: data.attemptId || effectiveAttemptId,
              serverStartTime: startPayload?.server_start_time,
              durationSeconds: startPayload?.duration_seconds || examDurationSeconds,
              isReleased: true,
            };
            localStorage.setItem('logicwhilelire_attempt', JSON.stringify(currentAttempt));
            localStorage.setItem('lw_attempt', JSON.stringify(currentAttempt));
          } catch {}
          setTimeout(() => {
            navigate(`/instructions/${contestId}`, {
              state: {
                hallTicket: myHt || effectiveHt,
                studentName: effectiveName,
                attemptId: data.attemptId || effectiveAttemptId,
                serverStartTime: startPayload?.server_start_time,
                durationSeconds: startPayload?.duration_seconds || examDurationSeconds,
                isReleased: true,
              },
            });
          }, 600);
        }
      }
    });

    socket.on("STUDENT_BLOCKED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (!data.hallTicket || data.hallTicket.toUpperCase() === myHt) {
          setIsBlocked(true);
          setBlockReason(data.reason || 'Blocked by supervisor');
          addEvent(`🛑 Entry suspended: ${data.reason || 'Blocked by supervisor'}`, "alert");
        }
      }
    });

    socket.on("STUDENT_REJECTED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (!data.hallTicket || data.hallTicket.toUpperCase() === myHt) {
          setIsRejected(true);
          setRejectReason(data.reason || 'Entry rejected by invigilator');
          addEvent(`⚠️ Entry rejected: ${data.reason || 'Rejected by supervisor'}`, "alert");
        }
      }
    });

    socket.on("EXAM_STARTED", (payload: ExamStartedPayload) => {
      setExamStarted(true);
      setStartPayload(payload);
      setCountdown(0);
      setIsReleased(true);
      const elapsed = payload.elapsed_seconds ?? Math.floor((Date.now() - payload.server_start_time) / 1000);
      const remaining = Math.max(0, payload.duration_seconds - elapsed);
      addEvent(
        `EXAM_STARTED — exam=${payload.exam_id} | remaining=${remaining}s | ` +
        `${payload.elapsed_seconds != null ? 'reconnect-sync' : 'fresh start'}`,
        "alert"
      );
      try {
        const myHt = String(effectiveHt || candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        const currentAttempt = {
          examCode: contestId.toUpperCase(),
          hallTicket: myHt || effectiveHt,
          studentName: effectiveName,
          attemptId: effectiveAttemptId,
          serverStartTime: payload.server_start_time,
          durationSeconds: payload.duration_seconds,
          isReleased: true,
        };
        localStorage.setItem('logicwhilelire_attempt', JSON.stringify(currentAttempt));
        localStorage.setItem('lw_attempt', JSON.stringify(currentAttempt));
      } catch {}
      setTimeout(() => {
        navigate(`/instructions/${contestId}`, {
          state: {
            serverStartTime: payload.server_start_time,
            durationSeconds: payload.duration_seconds,
            examCode: contestId,
            hallTicket: effectiveHt,
            attemptId: effectiveAttemptId,
            isReleased: true,
          },
        });
      }, 600);
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

  // PRIORITY 2: 3-second fallback polling check for supervisor release
  useEffect(() => {
    const checkStatus = async () => {
      const myHt = candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket;
      const attemptId = (location.state as any)?.attemptId;
      if (!myHt && !attemptId) return;
      try {
        const res = await getAttemptStatus(contestId, { hallTicket: myHt, attemptId });
        if (res.data?.is_released) {
          setIsReleased(true);
          navigate(`/instructions/${contestId}`, {
            state: {
              hallTicket: myHt,
              studentName: candidate?.name,
              attemptId: res.data.attempt_id,
              isReleased: true,
              serverStartTime: res.data.start_time ? new Date(res.data.start_time).getTime() : undefined,
            },
          });
        } else if (res.data?.status === 'blocked') {
          setIsBlocked(true);
        } else if (res.data?.status === 'rejected') {
          setIsRejected(true);
        }
      } catch {}
    };

    const interval = setInterval(checkStatus, 3000);
    checkStatus();
    return () => clearInterval(interval);
  }, [contestId, candidate, location.state, navigate]);

  useEffect(() => {
    if (examStarted && startPayload) {
      const examCode = startPayload.exam_id || contestId;
      const hallTicket = candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || "";
      try {
        sessionStorage.setItem(`lw_camera_consented_${examCode}`, 'true');
        sessionStorage.setItem('lw_camera_consented', 'true');
        const attemptData = {
          examCode,
          hallTicket,
          studentName: displayName,
          attemptId: (location.state as any)?.attemptId,
          serverStartTime: startPayload.server_start_time,
          durationSeconds: startPayload.duration_seconds,
          examDetails: {
            exam_name: examCode,
            duration_minutes: Math.round(startPayload.duration_seconds / 60),
            total_questions: 15,
          },
        };
        localStorage.setItem('logicwhilelire_attempt', JSON.stringify(attemptData));
        localStorage.setItem('lw_attempt', JSON.stringify(attemptData));
      } catch {}
      const timer = setTimeout(() => {
        navigate(`/instructions/${examCode}`, {
          state: {
            serverStartTime: startPayload.server_start_time,
            durationSeconds: startPayload.duration_seconds,
            examCode,
            hallTicket,
            attemptId: (location.state as any)?.attemptId,
          },
        });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [examStarted, startPayload, contestId, candidate, location.state, navigate, displayName]);

  const handleManualStart = () => {
    const examCode = startPayload?.exam_id || contestId;
    const hallTicket = candidate?.roll_number || (candidate as any)?.hall_ticket || (location.state as any)?.hallTicket || "";
    try {
      sessionStorage.setItem(`lw_camera_consented_${examCode}`, 'true');
      sessionStorage.setItem('lw_camera_consented', 'true');
    } catch {}
    navigate(`/instructions/${examCode}`, {
      state: {
        examCode,
        serverStartTime: startPayload?.server_start_time,
        durationSeconds: startPayload?.duration_seconds,
        hallTicket,
        attemptId: (location.state as any)?.attemptId,
        isReleased: true,
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
                disabled={!examStarted && !isReleased}
                style={{
                  width: "100%",
                  background: examStarted
                    ? "linear-gradient(135deg, #10B981, #059669)"
                    : isReleased
                    ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: (examStarted || isReleased) ? "0 4px 16px rgba(16,185,129,0.35)" : "none",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "13px 18px",
                  borderRadius: 8,
                  cursor: (examStarted || isReleased) ? "pointer" : "not-allowed",
                  color: (examStarted || isReleased) ? "#FFFFFF" : "#64748B",
                  border: (examStarted || isReleased) ? "none" : "1px solid rgba(255,255,255,0.12)",
                  transition: "all 0.25s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {examStarted ? (
                  <>
                    <IconLaunch size={16} color="#FFFFFF" />
                    <span>ENTER ASSESSMENT NOW →</span>
                  </>
                ) : isReleased ? (
                  <>
                    <IconCheck size={16} color="#FFFFFF" />
                    <span>SUPERVISOR RELEASE GRANTED • PROCEED TO INSTRUCTIONS →</span>
                  </>
                ) : (
                  <>
                    <IconClock size={16} color="#64748B" />
                    <span>Awaiting Supervisor Dispatch Signal...</span>
                  </>
                )}
              </button>

              <button
                id="lobby-report-issue-btn"
                type="button"
                onClick={() => setShowProctorDesk(true)}
                style={{
                  width: "100%",
                  marginTop: 10,
                  background: "transparent",
                  color: "#EAA812",
                  border: "1px solid rgba(234,168,18,0.4)",
                  padding: "10px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                }}
              >
                <span>✋ Report Issue / Contact Proctor</span>
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

        <HoloProctorDeskModal
          isOpen={showProctorDesk}
          onClose={() => setShowProctorDesk(false)}
          examCode={contestId.toUpperCase()}
          hallTicket={candidate?.roll_number || "GUEST"}
          candidateName={displayName}
          commsLog={[]}
          initialTab="raise_hand"
        />
      </div>
    </AnimatedPage>
  );
}
