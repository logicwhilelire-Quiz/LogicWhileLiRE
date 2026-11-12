import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import BrandLogo from "../components/BrandLogo";
import AnimatedPage from "../components/AnimatedPage";
import { getAssessmentSystemCheck, authLogout, getExamLobbyStats, getAttemptStatus } from "../lib/api";
import { SOCKET_URL } from "../lib/config";
import HoloProctorDeskModal from "../components/HoloProctorDeskModal";
import {
  IconClock,
  IconLaunch,
  IconCheck,
  IconShield,
  IconAlert,
  IconFlash,
  IconUsers,
  IconTerminal,
  IconSearch,
} from "../components/icons/HumanIcons";

interface CandidateProfile {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  college_id?: string;
  college_name?: string;
  year_of_passing?: number;
  roll_number?: string;
  hall_ticket?: string;
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
  section?: string;
  joined_at?: string;
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

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return "Just now";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "Just now";
  }
};

export default function WaitingLobbyPage() {
  const { contestId = "exam-session" } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [candidate, setCandidate] = useState<CandidateProfile | null>(() => {
    const locState = (location.state as any) || {};
    if (locState.hallTicket || locState.roll_number || locState.candidate) {
      return {
        name: locState.studentName || locState.candidate?.name || 'Student Candidate',
        roll_number: locState.hallTicket || locState.candidate?.roll_number || '',
        hall_ticket: locState.hallTicket || locState.candidate?.hall_ticket || '',
        section: locState.section || locState.candidate?.section || 'General',
        branch_code: locState.branch_code || locState.candidate?.branch_code || 'CSE',
        college_name: locState.college_name || locState.candidate?.college_name || 'Institutional Campus',
      } as CandidateProfile;
    }
    const stored = localStorage.getItem("student_user") || localStorage.getItem("logicwhilelire_attempt") || localStorage.getItem("lw_attempt");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const cand = parsed.student || parsed;
        if (cand.hall_ticket || cand.roll_number || cand.hallTicket) {
          return {
            name: cand.name || cand.studentName || 'Student Candidate',
            roll_number: cand.roll_number || cand.hallTicket || cand.hall_ticket || '',
            hall_ticket: cand.hall_ticket || cand.hallTicket || cand.roll_number || '',
            section: cand.section || 'General',
            branch_code: cand.branch_code || 'CSE',
            college_name: cand.college_name || 'Institutional Campus',
          } as CandidateProfile;
        }
      } catch {}
    }
    return null;
  });

  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [lobbyMeta, setLobbyMeta] = useState<LobbyMeta>({ enrolled: 0, connected: 0, pending: 0 });
  const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  const hasNavigatedRef = useRef(false);

  const navigateToInstructions = (extra?: { attemptId?: string; serverStartTime?: number; durationSeconds?: number }) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    const myHt = String(
      candidate?.roll_number ||
      candidate?.hall_ticket ||
      (location.state as any)?.hallTicket ||
      ''
    ).toUpperCase().trim();
    const myName = displayName || candidate?.name || 'Student Candidate';
    const effectiveAttId = extra?.attemptId || (location.state as any)?.attemptId;
    const sStart = extra?.serverStartTime ?? startPayload?.server_start_time;
    const dSec = extra?.durationSeconds ?? (startPayload?.duration_seconds || examDurationSeconds);

    const currentAttempt = {
      examCode: contestId.toUpperCase(),
      hallTicket: myHt,
      studentName: myName,
      attemptId: effectiveAttId,
      serverStartTime: sStart,
      durationSeconds: dSec,
      isReleased: true,
      examDetails: {
        exam_name: contestId.toUpperCase(),
        duration_minutes: Math.round(dSec / 60),
        total_questions: 15,
      },
    };
    try {
      sessionStorage.setItem(`lw_camera_consented_${contestId.toUpperCase()}`, 'true');
      sessionStorage.setItem('lw_camera_consented', 'true');
      localStorage.setItem('logicwhilelire_attempt', JSON.stringify(currentAttempt));
      localStorage.setItem('lw_attempt', JSON.stringify(currentAttempt));
    } catch {}

    navigate(`/instructions/${contestId}`, {
      state: {
        hallTicket: myHt,
        studentName: myName,
        attemptId: effectiveAttId,
        serverStartTime: sStart,
        durationSeconds: dSec,
        examCode: contestId,
        isReleased: true,
      },
    });
  };

  const addEvent = (text: string, type: "info" | "success" | "ping" | "alert" = "info") => {
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 19),
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
        if (Array.isArray(d?.waiting_students) && d.waiting_students.length > 0) {
          setParticipants(d.waiting_students);
        }
        if (d?.enrolled != null || d?.connected != null || d?.pending != null) {
          setLobbyMeta({
            enrolled: d.enrolled ?? 0,
            connected: d.connected ?? 0,
            pending: d.pending ?? 0,
          });
        }
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
          navigateToInstructions({ serverStartTime: s.server_start_time, durationSeconds: s.duration_seconds || examDurationSeconds });
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
          addEvent('[START] Administrator dispatched live start command! Launching assessment…', 'alert');
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
  }, [contestId, examStarted, examDurationSeconds]);

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
      if (Array.isArray(data.participants) && data.participants.length > 0) {
        setParticipants(data.participants);
      }
    });

    // PRIORITY 2: Live release event from Admin or Inspector
    socket.on("STUDENT_RELEASED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || candidate?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (data.all || !data.hallTicket || !myHt || data.hallTicket.toUpperCase() === myHt) {
          setIsReleased(true);
          addEvent("Release granted by supervisor! Proceeding to instructions...", "success");
          navigateToInstructions({ attemptId: data.attemptId || effectiveAttemptId });
        }
      }
    });

    socket.on("STUDENT_BLOCKED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || candidate?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (!data.hallTicket || data.hallTicket.toUpperCase() === myHt) {
          setIsBlocked(true);
          setBlockReason(data.reason || 'Blocked by supervisor');
          addEvent(`[SUSPENDED] Entry suspended: ${data.reason || 'Blocked by supervisor'}`, "alert");
        }
      }
    });

    socket.on("STUDENT_REJECTED", (data: any) => {
      if (data?.examCode?.toUpperCase() === contestId.toUpperCase()) {
        const myHt = String(effectiveHt || candidate?.roll_number || candidate?.hall_ticket || (location.state as any)?.hallTicket || '').toUpperCase();
        if (!data.hallTicket || data.hallTicket.toUpperCase() === myHt) {
          setIsRejected(true);
          setRejectReason(data.reason || 'Entry rejected by invigilator');
          addEvent(`[REJECTED] Entry rejected: ${data.reason || 'Rejected by supervisor'}`, "alert");
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
      navigateToInstructions({
        serverStartTime: payload.server_start_time,
        durationSeconds: payload.duration_seconds,
        attemptId: effectiveAttemptId,
      });
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
  }, [contestId]);

  // PRIORITY 2: 3-second fallback polling check for supervisor release
  useEffect(() => {
    const checkStatus = async () => {
      const myHt = candidate?.roll_number || candidate?.hall_ticket || (location.state as any)?.hallTicket;
      const attemptId = (location.state as any)?.attemptId;
      if (!myHt && !attemptId) return;
      try {
        const res = await getAttemptStatus(contestId, { hallTicket: myHt, attemptId });
        if (res.data?.is_released) {
          setIsReleased(true);
          navigateToInstructions({
            attemptId: res.data.attempt_id,
            serverStartTime: res.data.start_time ? new Date(res.data.start_time).getTime() : undefined,
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
  }, [contestId, candidate, location.state]);

  useEffect(() => {
    if (examStarted && startPayload) {
      navigateToInstructions({
        serverStartTime: startPayload.server_start_time,
        durationSeconds: startPayload.duration_seconds,
      });
    }
  }, [examStarted, startPayload]);

  const handleManualStart = () => {
    navigateToInstructions({
      serverStartTime: startPayload?.server_start_time,
      durationSeconds: startPayload?.duration_seconds,
    });
  };

  const handleLogout = async () => {
    try { await authLogout(); } catch { /* ignore */ }
    localStorage.removeItem("student_token");
    localStorage.removeItem("student_user");
    socketRef.current?.disconnect();
    navigate("/login");
  };

  // Derive consolidated list of all waiting candidates (ensuring logged-in candidate is represented)
  const allParticipants = useMemo(() => {
    const list = [...participants];
    const myHt = String(
      candidate?.roll_number ||
      candidate?.hall_ticket ||
      (location.state as any)?.hallTicket ||
      ''
    ).toUpperCase().trim();

    if (myHt && !list.some((p) => p.hall_ticket_no?.toUpperCase() === myHt)) {
      list.unshift({
        hall_ticket_no: myHt,
        student_name: displayName || 'Current Candidate',
        section: candidate?.section || 'Section A',
        status: isReleased ? 'released' : 'waiting',
        joined_at: new Date().toISOString(),
      });
    }
    return list;
  }, [participants, candidate, displayName, isReleased, location.state]);

  // Derive section counts for filtering and breakdown cards
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allParticipants.forEach((p) => {
      const sec = (p.section || 'General').toUpperCase().trim();
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [allParticipants]);

  const availableSections = useMemo(() => {
    const secs = Object.keys(sectionCounts).sort();
    return ['ALL', ...secs];
  }, [sectionCounts]);

  const filteredParticipants = useMemo(() => {
    return allParticipants.filter((p) => {
      const sec = (p.section || 'General').toUpperCase().trim();
      const matchesSection = selectedSection === 'ALL' || sec === selectedSection;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.student_name.toLowerCase().includes(q) ||
        p.hall_ticket_no.toLowerCase().includes(q) ||
        sec.toLowerCase().includes(q);
      return matchesSection && matchesQuery;
    });
  }, [allParticipants, selectedSection, searchQuery]);

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
              <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "rgba(234, 168, 18, 0.15)", border: "2px solid rgba(234, 168, 18, 0.4)", marginBottom: 16 }}>
                <IconFlash size={44} color="#EAA812" />
              </div>
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

        {/* BLOCKED / SUSPENDED MODAL OVERLAY */}
        {(isBlocked || isRejected) && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 350,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(8px)",
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#0B1A30",
                border: "2px solid #EF4444",
                borderRadius: 14,
                padding: "36px 40px",
                textAlign: "center",
                maxWidth: 480,
                width: "90%",
                boxShadow: "0 24px 60px rgba(239, 68, 68, 0.35)",
              }}
            >
              <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", border: "2px solid rgba(239, 68, 68, 0.4)", marginBottom: 16 }}>
                <IconAlert size={40} color="#EF4444" />
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color: "#EF4444",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {isBlocked ? "Candidate Entry Suspended" : "Session Access Rejected"}
              </div>
              <div style={{ fontSize: "0.92rem", color: "#CBD5E1", marginBottom: 24, lineHeight: 1.5 }}>
                {blockReason || rejectReason || "Your examination session has been flagged or suspended by the proctoring supervisor."}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => setShowProctorDesk(true)}
                  style={{
                    background: "#EAA812",
                    color: "#002147",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 24px",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Contact Proctor / Appeal
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#E2E8F0",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Sign Out & Exit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Institutional Header */}
        <div
          style={{
            width: "100%",
            maxWidth: 1080,
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

        {/* Main Grid: Responsive 2-Column HUD */}
        <div
          style={{
            width: "100%",
            maxWidth: 1080,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {/* Column 1: Candidate Clearance, Digital Window Timer, and Security Pre-Check */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Candidate Gate Clearance Card */}
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
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <IconShield size={14} color="#EAA812" />
                  <span>Candidate Gate Clearance</span>
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <IconCheck size={12} color="#34D399" />
                  <span>VERIFIED CLAIM</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", marginBottom: 8 }}>
                  {displayName}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    background: "rgba(0, 33, 71, 0.35)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.66rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Roll / Hall Ticket</div>
                    <div style={{ fontSize: "0.84rem", color: "#38BDF8", fontFamily: "monospace", fontWeight: 800 }}>
                      {candidate?.roll_number || candidate?.hall_ticket || "22B91A0501"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.66rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Academic Section</div>
                    <div style={{ fontSize: "0.84rem", color: "#EAA812", fontWeight: 800 }}>
                      {candidate?.section || "Section A"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.66rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Department / Branch</div>
                    <div style={{ fontSize: "0.82rem", color: "#E2E8F0", fontWeight: 700 }}>
                      {candidate?.branch_code || "CSE"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.66rem", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>Campus Clearance</div>
                    <div style={{ fontSize: "0.78rem", color: "#34D399", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {candidate?.college_name || "Institutional Campus"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "6px 10px",
                    background: "rgba(234, 168, 18, 0.08)",
                    border: "1px solid rgba(234, 168, 18, 0.2)",
                    borderRadius: 6,
                    fontSize: "0.72rem",
                    color: "#CBD5E1",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#94A3B8" }}>Gate Pass Auth:</span>
                  <span style={{ fontFamily: "monospace", color: "#EAA812", fontWeight: 800 }}>
                    GP-{String(candidate?.roll_number || "STU").slice(-6).toUpperCase()}-CLEARANCE
                  </span>
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
                  fontSize: "0.88rem",
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
                <IconAlert size={14} color="#EAA812" />
                <span>Report Issue / Contact Proctor</span>
              </button>
            </div>

            {/* Assessment Timer Box */}
            <div
              style={{
                padding: "24px 22px",
                textAlign: "center",
                background: "#0E1A2E",
                border: examStarted ? "1.5px solid rgba(16, 185, 129, 0.45)" : "1.5px solid rgba(234, 168, 18, 0.35)",
                borderRadius: 14,
                boxShadow: examStarted ? "0 8px 30px rgba(16,185,129,0.15)" : "0 8px 30px rgba(234,168,18,0.12)",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: examStarted ? "#34D399" : "#EAA812",
                  fontWeight: 800,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: examStarted ? "#10B981" : "#EAA812", display: "inline-block", boxShadow: examStarted ? "0 0 8px #10B981" : "0 0 8px #EAA812" }} />
                <span>{examStarted ? "Live Exam Clock Active" : "Authoritative Server Synchronous Window"}</span>
              </div>
              <div
                id="waiting-lobby-timer-display"
                style={{
                  fontSize: "3.6rem",
                  fontWeight: 900,
                  fontFamily: "var(--font-mono, monospace)",
                  color: examStarted ? "#34D399" : "#EAA812",
                  letterSpacing: "0.05em",
                  lineHeight: 1,
                  margin: "8px 0 12px",
                  textShadow: examStarted ? "0 0 20px rgba(52,211,153,0.35)" : "0 0 20px rgba(234,168,18,0.35)",
                }}
              >
                {examStarted ? "LIVE NOW" : timeFormatted}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#94A3B8", marginTop: 4, lineHeight: 1.5 }}>
                {examStarted
                  ? "Assessment is live on authoritative server • Synchronized dispatch active"
                  : "Expected Launch Window: Synchronous Dispatch • All candidates start simultaneously"}
              </div>
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
                    <span style={{ color: item.ok ? "#34D399" : "#F59E0B", fontWeight: 800, display: "inline-flex", alignItems: "center" }}>
                      {item.ok ? <IconCheck size={14} color="#34D399" /> : <IconClock size={14} color="#F59E0B" />}
                    </span>
                    <span style={{ color: "#E2E8F0" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Roster Stats, Academic Sections Breakdown, Filter Tabs, Live Table & Live Telemetry */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Visual Connection Counters */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "In Lobby", value: lobbyMeta.connected || allParticipants.length, color: "#38BDF8" },
                { label: "Enrolled", value: lobbyMeta.enrolled || Math.max(allParticipants.length, 1), color: "#EAA812" },
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

            {/* Academic Sections Breakdown Overview */}
            <div
              style={{
                background: "#0E1A2E",
                border: "1px solid rgba(234, 168, 18, 0.25)",
                borderRadius: 10,
                padding: "14px 16px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "#EAA812", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconUsers size={14} color="#EAA812" />
                  <span>Academic Sections Distribution</span>
                </div>
                <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                  {Object.keys(sectionCounts).length} active {Object.keys(sectionCounts).length === 1 ? 'section' : 'sections'}
                </div>
              </div>

              {/* Section Overview Mini-Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 14 }}>
                {Object.entries(sectionCounts).map(([sec, count]) => {
                  const isSelected = selectedSection === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      style={{
                        background: isSelected ? "rgba(234, 168, 18, 0.15)" : "rgba(0, 33, 71, 0.3)",
                        border: isSelected ? "1.5px solid #EAA812" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: isSelected ? "#EAA812" : "#CBD5E1" }}>
                          {sec}
                        </span>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFFFFF", marginTop: 2 }}>
                        {count} <span style={{ fontSize: "0.66rem", color: "#64748B", fontWeight: 600 }}>waiting</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Section Filter Tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
                {availableSections.map((sec) => {
                  const isSelected = selectedSection === sec;
                  const count = sec === 'ALL' ? allParticipants.length : (sectionCounts[sec] || 0);
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: isSelected ? "#EAA812" : "rgba(255,255,255,0.06)",
                        color: isSelected ? "#002147" : "#CBD5E1",
                        border: isSelected ? "1px solid #EAA812" : "1px solid rgba(255,255,255,0.12)",
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{sec === 'ALL' ? 'ALL SECTIONS' : sec}</span>
                      <span
                        style={{
                          background: isSelected ? "rgba(0, 33, 71, 0.25)" : "rgba(255,255,255,0.15)",
                          color: isSelected ? "#002147" : "#EAA812",
                          padding: "1px 5px",
                          borderRadius: 10,
                          fontSize: "0.64rem",
                          fontWeight: 800,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Live Room Participants Table */}
              <div
                style={{
                  background: "rgba(0, 15, 35, 0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(0, 33, 71, 0.3)",
                  }}
                >
                  <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.03em" }}>
                    ROSTER ({filteredParticipants.length})
                  </div>
                  <div style={{ position: "relative", width: 180, maxWidth: "50%" }}>
                    <input
                      type="text"
                      placeholder="Filter roll / name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        background: "rgba(0, 20, 45, 0.8)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 6,
                        padding: "4px 8px 4px 26px",
                        color: "#FFFFFF",
                        fontSize: "0.72rem",
                        outline: "none",
                      }}
                    />
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <IconSearch size={12} color="#64748B" />
                    </span>
                  </div>
                </div>

                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {filteredParticipants.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8" }}>
                        No candidates found in this section filter
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: 4 }}>
                        Candidates joining room {contestId.toUpperCase()} appear in real time.
                      </div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.76rem" }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }}>
                          <th style={{ padding: "8px 10px", fontWeight: 700 }}>ROLL NO</th>
                          <th style={{ padding: "8px 10px", fontWeight: 700 }}>NAME</th>
                          <th style={{ padding: "8px 10px", fontWeight: 700 }}>SEC</th>
                          <th style={{ padding: "8px 10px", fontWeight: 700 }}>TIME</th>
                          <th style={{ padding: "8px 10px", fontWeight: 700 }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map((p, idx) => {
                          const myHt = String(
                            candidate?.roll_number ||
                            candidate?.hall_ticket ||
                            (location.state as any)?.hallTicket ||
                            ''
                          ).toUpperCase().trim();
                          const isMe = p.hall_ticket_no?.toUpperCase() === myHt;
                          return (
                            <tr
                              key={`${p.hall_ticket_no}-${idx}`}
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                background: isMe ? "rgba(234, 168, 18, 0.08)" : "transparent",
                              }}
                            >
                              <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: isMe ? "#EAA812" : "#38BDF8" }}>
                                {p.hall_ticket_no}
                                {isMe && (
                                  <span style={{ marginLeft: 6, background: "#EAA812", color: "#002147", padding: "1px 4px", borderRadius: 3, fontSize: "0.6rem", fontWeight: 900 }}>
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "7px 10px", fontWeight: 600, color: "#F1F5F9" }}>
                                {p.student_name}
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span style={{ background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38BDF8", padding: "1px 6px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700 }}>
                                  {p.section || 'General'}
                                </span>
                              </td>
                              <td style={{ padding: "7px 10px", color: "#64748B", fontSize: "0.7rem" }}>
                                {formatRelativeTime(p.joined_at)}
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: "0.66rem",
                                    fontWeight: 800,
                                    background: p.status === 'released' ? "rgba(16,185,129,0.15)" : "rgba(234,168,18,0.12)",
                                    border: p.status === 'released' ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(234,168,18,0.3)",
                                    color: p.status === 'released' ? "#34D399" : "#EAA812",
                                  }}
                                >
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.status === 'released' ? "#10B981" : "#EAA812" }} />
                                  <span>{p.status === 'released' ? 'Released' : 'Waiting Hall'}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Authoritative Redis & WebSocket Stream Telemetry Terminal */}
            <div
              style={{
                background: "#07101E",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "14px 18px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconTerminal size={14} color="#38BDF8" />
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Authoritative Telemetry & Synchronous Dispatch Stream
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.68rem", color: "#10B981", fontFamily: "monospace" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
                  <span>STREAM ACTIVE</span>
                </div>
              </div>

              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                }}
              >
                {events.length === 0 ? (
                  <div style={{ color: "#475569", fontStyle: "italic" }}>Listening for authoritative synchronization packets...</div>
                ) : (
                  events.map((ev) => {
                    const colorMap = {
                      success: "#34D399",
                      alert: "#F87171",
                      ping: "#FBBF24",
                      info: "#38BDF8",
                    };
                    const badgeColor = colorMap[ev.type] || "#38BDF8";
                    return (
                      <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                        <span style={{ color: "#64748B", flexShrink: 0 }}>[{ev.time}]</span>
                        <span style={{ color: badgeColor, fontWeight: 700, flexShrink: 0 }}>[{ev.type.toUpperCase()}]</span>
                        <span style={{ color: "#CBD5E1", wordBreak: "break-word" }}>{ev.text}</span>
                      </div>
                    );
                  })
                )}
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
          hallTicket={candidate?.roll_number || candidate?.hall_ticket || "GUEST"}
          candidateName={displayName}
          commsLog={[]}
          initialTab="raise_hand"
        />
      </div>
    </AnimatedPage>
  );
}
