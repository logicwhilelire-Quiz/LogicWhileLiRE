/**
 * InstructorConsolePage.tsx — LogicWhileLiRE Master Inspector Command Dashboard
 *
 * Requirements:
 * - Inspector lands directly on the live dashboard for their college.
 * - Elements: Exam selector, section filter, waiting queue (students who entered and waiting),
 *   Start Exam button (server-authoritative clock), live leaderboard, and live monitor.
 * - Students enter with exam code, wait in lobby, and exam begins for all at once when inspector starts.
 * - Live updates with Socket.io (queue count, joined/submitted counts, live ranks, batched <= 1/sec).
 * - Distraction-free, zero 3D / WebGL overhead.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io as connectSocket, Socket } from "socket.io-client";
import axios from "axios";
import AdminSidebar from "../../components/layout/AdminSidebar";
import AnimatedPage from "../../components/AnimatedPage";
import { startExam, getExamLobbyStats } from "../../lib/api";
import { SOCKET_URL, API_BASE_URL } from "../../lib/config";

const BASE = API_BASE_URL;

interface CollegeInfo {
  id: string | number;
  college_name: string;
  college_code: string;
}

interface ExamOption {
  id: string;
  title?: string;
  exam_code?: string;
  duration_minutes?: number;
  is_active?: boolean;
}

interface WaitingStudent {
  hall_ticket_no: string;
  student_name: string;
  section?: string;
  joined_at?: string;
  status?: string;
}

interface RankEntry {
  rank: number;
  student_id: string;
  student_name: string;
  score: number;
  percentage: number;
  answered: number;
  time_taken_seconds: number;
}

interface TelemetryUpdate {
  event: string;
  exam_code: string;
  queue_count: number;
  joined_count: number;
  submitted_count: number;
  total_enrolled: number;
  live_ranks: RankEntry[];
  waiting_students: WaitingStudent[];
  timestamp: number;
}

export default function InstructorConsolePage() {
  const { examCode: routeExamCode } = useParams<{ examCode?: string }>();
  const navigate = useNavigate();

  // College & Exam selection state
  const [college, setCollege] = useState<CollegeInfo | null>(null);
  const [examList, setExamList] = useState<ExamOption[]>([]);
  const [selectedExamCode, setSelectedExamCode] = useState<string>(routeExamCode || "DEMO123");
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("ALL");

  // Real-time telemetry state
  const [connected, setConnected] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [joinedCount, setJoinedCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [waitingStudents, setWaitingStudents] = useState<WaitingStudent[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"queue" | "leaderboard" | "monitor">("leaderboard");

  // Exam execution & Clock state
  const [examStarted, setExamStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serverRemainingSeconds, setServerRemainingSeconds] = useState<number | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; time: string; text: string }>>([]);

  const socketRef = useRef<Socket | null>(null);
  const adminToken = localStorage.getItem("admin_token") || "";

  const addLog = (text: string) => {
    setEvents((prev) => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString(), text },
      ...prev.slice(0, 19),
    ]);
  };

  // 1. Fetch Inspector College & Exams
  useEffect(() => {
    async function loadInspectorData() {
      try {
        const res = await axios.get(`${BASE}/api/admin/inspector/dashboard-data`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.data?.success) {
          setCollege(res.data.college);

          const exams: ExamOption[] = [];
          if (Array.isArray(res.data.exam_codes) && res.data.exam_codes.length > 0) {
            for (const ec of res.data.exam_codes) {
              exams.push({
                id: ec.id,
                exam_code: ec.exam_code,
                title: ec.exam_name || ec.subject || ec.exam_code,
                duration_minutes: ec.duration_minutes || 60,
                is_active: ec.is_active,
              });
            }
          }
          if (Array.isArray(res.data.exams) && res.data.exams.length > 0) {
            for (const ex of res.data.exams) {
              if (!exams.some((e) => e.exam_code === (ex.exam_code || ex.title))) {
                exams.push({
                  id: ex.id,
                  exam_code: ex.exam_code || `EX-${ex.id.slice(0, 6).toUpperCase()}`,
                  title: ex.title,
                  duration_minutes: ex.duration_minutes || 60,
                  is_active: ex.is_active,
                });
              }
            }
          }

          if (exams.length > 0) {
            setExamList(exams);
            if (!routeExamCode) {
              setSelectedExamCode(exams[0].exam_code || "DEMO123");
            }
          }

          const secs: string[] = [];
          if (Array.isArray(res.data.sections)) {
            for (const s of res.data.sections) {
              if (s.section_name && !secs.includes(s.section_name)) {
                secs.push(s.section_name);
              }
            }
          }
          if (secs.length === 0) secs.push("Section A", "Section B", "Section C");
          setSectionsList(secs);
        }
      } catch (err: any) {
        console.warn("[InspectorConsole] Dashboard data fallback:", err?.message);
        setCollege({
          id: 1,
          college_name: "Velagapudi Ramakrishna Siddhartha Engineering College (VRSEC)",
          college_code: "VRSEC",
        });
        setSectionsList(["Section A", "Section B", "Section C"]);
      }
    }
    loadInspectorData();
  }, [adminToken, routeExamCode]);

  // 2. Connect to Socket.io and join rooms for selected exam
  const currentCode = selectedExamCode.toUpperCase();

  useEffect(() => {
    if (!currentCode) return;

    const socket = connectSocket(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      auth: { token: adminToken || undefined },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      addLog(`Inspector connected (${socket.id?.slice(0, 8)}...)`);
      // Join lobby, monitor, and leaderboard rooms
      socket.emit("lobby:join", { examCode: currentCode });
      socket.emit("monitor:join", { examCode: currentCode });
      socket.emit("leaderboard:join", { examCode: currentCode });
      addLog(`Subscribed to rooms for ${currentCode}`);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      addLog("WebSocket disconnected — reconnecting...");
    });

    // Unified throttled telemetry (emitted <= 1 time per second per room)
    socket.on("telemetry:update", (data: TelemetryUpdate) => {
      if (data.exam_code === currentCode) {
        setQueueCount(data.queue_count);
        setJoinedCount(data.joined_count);
        setSubmittedCount(data.submitted_count);
        setTotalEnrolled(data.total_enrolled);
        setWaitingStudents(data.waiting_students || []);
        setLeaderboard(data.live_ranks || []);
      }
    });

    // Fallback lobby update
    socket.on("lobby:update", (data: any) => {
      if (data.meta) {
        setJoinedCount(data.meta.connected || 0);
        setTotalEnrolled(data.meta.enrolled || 0);
        if (data.meta.queue_count !== undefined) setQueueCount(data.meta.queue_count);
        if (data.meta.submitted_count !== undefined) setSubmittedCount(data.meta.submitted_count);
      }
      if (Array.isArray(data.participants)) {
        setWaitingStudents(data.participants);
      }
    });

    // Fallback leaderboard snapshot
    socket.on("LEADERBOARD_SNAPSHOT", (data: any) => {
      if (Array.isArray(data.top_ranks)) {
        setLeaderboard(data.top_ranks);
      }
    });

    // Timer tick for clock synchronization
    socket.on("timer:tick", (tick: { remaining_seconds: number; status: string }) => {
      setServerRemainingSeconds(tick.remaining_seconds);
      if (tick.status === "in_progress") setExamStarted(true);
    });

    // Exam started broadcast confirmation
    socket.on("EXAM_STARTED", (data: any) => {
      setExamStarted(true);
      addLog(`🚀 EXAM_STARTED broadcast confirmed for ${currentCode}!`);
    });

    // Initial check from REST stats
    getExamLobbyStats(currentCode)
      .then((res) => {
        if (res.data) {
          setJoinedCount(res.data.connected || 0);
          setTotalEnrolled(res.data.enrolled || 0);
          if (res.data.exam_started) setExamStarted(true);
        }
      })
      .catch(() => {});

    return () => {
      socket.disconnect();
    };
  }, [currentCode, adminToken]);

  const [stopping, setStopping] = useState(false);

  // Handle Inspector Push to Start
  const handleStartExam = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await startExam(currentCode, { allow_late_join: false });
      if (res.data?.success) {
        setExamStarted(true);
        setConfirmOpen(false);
        setActiveTab("leaderboard");
        addLog(`🚀 EXAM_STARTED triggered by Inspector for ${currentCode}!`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Exam start failed";
      setStartError(msg);
      addLog(`❌ START ERROR: ${msg}`);
    } finally {
      setStarting(false);
    }
  };

  // Handle Inspector Push to Stop
  const handleStopExam = async () => {
    if (!window.confirm(`Are you sure you want to stop the exam for ${currentCode}? This will end all active candidate sessions.`)) {
      return;
    }
    setStopping(true);
    try {
      await axios.post(`${BASE}/api/admin/exams/${currentCode}/end`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setExamStarted(false);
      addLog(`🛑 EXAM STOPPED by Inspector for ${currentCode}.`);
    } catch (err: any) {
      addLog(`❌ STOP ERROR: ${err?.message}`);
    } finally {
      setStopping(false);
    }
  };

  // Section Filtering
  const filteredQueue = useMemo(() => {
    if (selectedSection === "ALL") return waitingStudents;
    return waitingStudents.filter(
      (s) => (s.section || "").toLowerCase() === selectedSection.toLowerCase()
    );
  }, [waitingStudents, selectedSection]);

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const medal = (rank: number) => ["🥇", "🥈", "🥉"][rank - 1] || `#${rank}`;

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: "flex", minHeight: "100vh", background: "#050814", color: "#F8FAFC" }}>
        <AdminSidebar activeTab="exams" />

        <main className="admin-content" style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
          {/* ── College Header Banner ── */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: 14,
              marginBottom: 24,
              background: "linear-gradient(135deg, rgba(43,127,255,0.12) 0%, rgba(15,23,42,0.95) 100%)",
              border: "1px solid rgba(43,127,255,0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    background: "rgba(43,127,255,0.2)",
                    color: "#60A5FA",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Principal Inspector Command
                </span>
                <span style={{ color: "#64748B", fontSize: "0.8rem" }}>•</span>
                <span style={{ color: "#94A3B8", fontSize: "0.82rem", fontWeight: 600 }}>
                  {college?.college_code || "CAMPUS"}
                </span>
              </div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                {college?.college_name || "Institutional Assessment Command Center"}
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: connected ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                  border: `1px solid ${connected ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: connected ? "#34D399" : "#F87171",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: connected ? "#10B981" : "#EF4444",
                    boxShadow: connected ? "0 0 10px #10B981" : "none",
                  }}
                />
                {connected ? "SOCKET LIVE" : "DISCONNECTED"}
              </div>

              {(() => {
                let userRole = 'inspector';
                try {
                  userRole = JSON.parse(localStorage.getItem('admin_user') || '{}')?.role || 'inspector';
                } catch {}
                const isSuper = userRole === 'super_admin' || userRole === 'admin';
                return isSuper ? (
                  <button
                    onClick={() => navigate('/admin/dashboard')}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#94A3B8',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Admin Hub →
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/leaderboard-ec/${selectedExamCode}`)}
                    style={{
                      background: 'rgba(56,189,248,0.15)',
                      border: '1px solid rgba(56,189,248,0.3)',
                      color: '#38BDF8',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🏆 Live Leaderboard →
                  </button>
                );
              })()}
            </div>
          </div>

          {/* ── Control Bar: Exam Selector + Section Filter + Push-to-Start ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
              padding: "18px 20px",
              background: "rgba(15,23,42,0.8)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            {/* Exam Selector */}
            <div>
              <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#94A3B8", marginBottom: 6, textTransform: "uppercase" }}>
                Active Examination
              </label>
              <select
                id="inspector-exam-selector"
                value={selectedExamCode}
                onChange={(e) => {
                  setSelectedExamCode(e.target.value);
                  setExamStarted(false);
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "#0B1226",
                  border: "1px solid rgba(43,127,255,0.3)",
                  color: "#FFFFFF",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {examList.length > 0 ? (
                  examList.map((ex) => (
                    <option key={ex.exam_code} value={ex.exam_code}>
                      {ex.exam_code} — {ex.title || "Exam"} ({ex.duration_minutes || 60}m)
                    </option>
                  ))
                ) : (
                  <option value={selectedExamCode}>{selectedExamCode} (Active Exam)</option>
                )}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#94A3B8", marginBottom: 6, textTransform: "uppercase" }}>
                Filter by Section
              </label>
              <select
                id="inspector-section-filter"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "#0B1226",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#FFFFFF",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="ALL">All Sections (Entire Cohort)</option>
                {sectionsList.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Server Authoritative Clock State */}
            <div>
              <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#94A3B8", marginBottom: 6, textTransform: "uppercase" }}>
                Server Authoritative Clock
              </label>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: examStarted ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                  border: `1px solid ${examStarted ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}`,
                  color: examStarted ? "#34D399" : "#F59E0B",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{examStarted ? "● CLOCK RUNNING" : "⏸ WAITING TO START"}</span>
                {serverRemainingSeconds != null && (
                  <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {fmtTime(serverRemainingSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Authoritative Push-to-Start Button */}
            <div>
              <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#94A3B8", marginBottom: 6, textTransform: "uppercase" }}>
                Exam Trigger
              </label>
              {examStarted ? (
                <div style={{ display: "flex", gap: 8, width: "100%" }}>
                  <div
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 8,
                      background: "rgba(16,185,129,0.2)",
                      border: "1px solid rgba(16,185,129,0.4)",
                      color: "#10B981",
                      fontWeight: 800,
                      textAlign: "center",
                      fontSize: "0.85rem",
                    }}
                  >
                    ✓ Live Active
                  </div>
                  <button
                    id="inspector-stop-exam-btn"
                    onClick={handleStopExam}
                    disabled={stopping}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#EF4444",
                      fontWeight: 800,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    {stopping ? "Ending..." : "🛑 Stop"}
                  </button>
                </div>
              ) : (
                <button
                  id="inspector-start-exam-btn"
                  onClick={() => setConfirmOpen(true)}
                  disabled={starting}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {starting ? "Starting..." : "🚀 Start Exam"}
                </button>
              )}
            </div>
          </div>

          {startError && (
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#F87171", marginBottom: 20, fontSize: "0.85rem" }}>
              ⚠️ {startError}
            </div>
          )}

          {/* ── Real-Time Metrics Strip (Throttled <= 1 update/sec) ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748B", fontWeight: 700, marginBottom: 4 }}>
                Waiting Queue
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>
                {queueCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: 2 }}>In lobby awaiting start</div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748B", fontWeight: 700, marginBottom: 4 }}>
                Connected Students
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>
                {joinedCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: 2 }}>Active socket connections</div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748B", fontWeight: 700, marginBottom: 4 }}>
                Submissions
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#38BDF8" }}>
                {submittedCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: 2 }}>Completed assessments</div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#64748B", fontWeight: 700, marginBottom: 4 }}>
                Total Enrolled
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#A78BFA" }}>
                {totalEnrolled}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginTop: 2 }}>Roster approved candidates</div>
            </div>
          </div>

          {/* ── Tabbed View: Waiting Queue / Live Leaderboard / Live Monitor ── */}
          <div style={{ marginBottom: 18, display: "flex", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab("queue")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: activeTab === "queue" ? "rgba(43,127,255,0.2)" : "transparent",
                color: activeTab === "queue" ? "#60A5FA" : "#94A3B8",
                border: `1px solid ${activeTab === "queue" ? "rgba(43,127,255,0.4)" : "transparent"}`,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              ⏳ Waiting Queue ({filteredQueue.length})
            </button>

            <button
              onClick={() => setActiveTab("leaderboard")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: activeTab === "leaderboard" ? "rgba(43,127,255,0.2)" : "transparent",
                color: activeTab === "leaderboard" ? "#60A5FA" : "#94A3B8",
                border: `1px solid ${activeTab === "leaderboard" ? "rgba(43,127,255,0.4)" : "transparent"}`,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              🏆 Live Leaderboard ({leaderboard.length})
            </button>

            <button
              onClick={() => setActiveTab("monitor")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: activeTab === "monitor" ? "rgba(43,127,255,0.2)" : "transparent",
                color: activeTab === "monitor" ? "#60A5FA" : "#94A3B8",
                border: `1px solid ${activeTab === "monitor" ? "rgba(43,127,255,0.4)" : "transparent"}`,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              📡 Live Monitor
            </button>
          </div>

          {/* ── Content View ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
            {/* Left Column: Active Tab */}
            <div>
              {activeTab === "queue" && (
                <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                      Students in Lobby Waiting Queue
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                      Section filter: <strong style={{ color: "#60A5FA" }}>{selectedSection}</strong>
                    </div>
                  </div>

                  {filteredQueue.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748B" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>⏳</div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#E2E8F0" }}>No students in waiting queue</div>
                      <div style={{ fontSize: "0.82rem", marginTop: 4 }}>
                        Students who enter exam code <code style={{ color: "#60A5FA" }}>{currentCode}</code> will appear here in real time.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.02)", color: "#64748B", textTransform: "uppercase", fontSize: "0.72rem" }}>
                            <th style={{ padding: "10px 16px", textAlign: "left" }}>Candidate</th>
                            <th style={{ padding: "10px 16px", textAlign: "left" }}>Roll Number</th>
                            <th style={{ padding: "10px 16px", textAlign: "left" }}>Section</th>
                            <th style={{ padding: "10px 16px", textAlign: "left" }}>Joined Time</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredQueue.map((s, idx) => (
                            <tr key={`${s.hall_ticket_no}-${idx}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "12px 16px", fontWeight: 700, color: "#E2E8F0" }}>
                                {s.student_name || "Student"}
                              </td>
                              <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#60A5FA" }}>
                                {s.hall_ticket_no}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4, fontSize: "0.78rem" }}>
                                  {s.section || "General"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#94A3B8", fontSize: "0.78rem" }}>
                                {s.joined_at ? new Date(s.joined_at).toLocaleTimeString() : "Just now"}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <span style={{ color: "#10B981", fontWeight: 700, fontSize: "0.78rem" }}>
                                  ● Ready
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "leaderboard" && (
                <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Live Assessment Leaderboard</div>
                      <div style={{ fontSize: "0.74rem", color: "#64748B", marginTop: 2 }}>
                        Tie-break formula: Score − (TimeElapsed / TotalDuration)
                      </div>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#10B981", fontWeight: 700 }}>
                      ● BATCHED STREAM (1/sec)
                    </span>
                  </div>

                  {leaderboard.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748B" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>🏆</div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#E2E8F0" }}>No completed scores yet</div>
                      <div style={{ fontSize: "0.82rem", marginTop: 4 }}>
                        Ranks will stream live as students answer and submit.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.02)", color: "#64748B", textTransform: "uppercase", fontSize: "0.72rem" }}>
                            <th style={{ padding: "10px 14px", textAlign: "left" }}>Rank</th>
                            <th style={{ padding: "10px 14px", textAlign: "left" }}>Candidate</th>
                            <th style={{ padding: "10px 14px", textAlign: "left" }}>Score</th>
                            <th style={{ padding: "10px 14px", textAlign: "left" }}>Percentage</th>
                            <th style={{ padding: "10px 14px", textAlign: "left" }}>Answered</th>
                            <th style={{ padding: "10px 14px", textAlign: "right" }}>Time Taken</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((entry) => (
                            <tr key={entry.student_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: "1rem" }}>
                                {medal(entry.rank)}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: 700, color: "#FFFFFF" }}>{entry.student_name}</div>
                                <div style={{ fontSize: "0.72rem", color: "#64748B", fontFamily: "monospace" }}>{entry.student_id}</div>
                              </td>
                              <td style={{ padding: "12px 14px", fontWeight: 800, color: "#60A5FA" }}>
                                {entry.score}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    background: entry.percentage >= 70 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                                    color: entry.percentage >= 70 ? "#10B981" : "#F59E0B",
                                  }}
                                >
                                  {entry.percentage}%
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#94A3B8" }}>{entry.answered}</td>
                              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#64748B" }}>
                                {fmtTime(entry.time_taken_seconds)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "monitor" && (
                <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 14 }}>
                    Live Proctoring & Candidate Oversight
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                    {filteredQueue.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#0B1226",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10,
                          padding: "14px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#FFFFFF" }}>{s.student_name}</span>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace", marginBottom: 6 }}>
                          {s.hall_ticket_no} • {s.section || "General"}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#94A3B8", marginBottom: 10 }}>
                          Status: <strong style={{ color: examStarted ? "#38BDF8" : "#F59E0B" }}>{examStarted ? "Exam In Progress" : "In Lobby Waiting"}</strong>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => addLog(`Whisper notice dispatched to ${s.hall_ticket_no}`)}
                            style={{ flex: 1, padding: "5px", fontSize: "0.72rem", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#CBD5E1", cursor: "pointer" }}
                          >
                            Notice
                          </button>
                          <button
                            onClick={() => addLog(`+5 min extension granted to ${s.hall_ticket_no}`)}
                            style={{ flex: 1, padding: "5px", fontSize: "0.72rem", borderRadius: 6, background: "rgba(43,127,255,0.15)", border: "1px solid rgba(43,127,255,0.3)", color: "#60A5FA", cursor: "pointer" }}
                          >
                            +5 Min
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Event Stream */}
            <div style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 800, fontSize: "0.9rem" }}>
                📡 Live Inspector Event Stream
              </div>
              <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 520 }}>
                {events.length === 0 && (
                  <div style={{ color: "#64748B", fontSize: "0.8rem", textAlign: "center", padding: "20px 0" }}>
                    Connecting to telemetry stream...
                  </div>
                )}
                {events.map((ev) => (
                  <div key={ev.id} style={{ padding: "8px 10px", background: "#0B1226", borderRadius: 6, borderLeft: "3px solid #3B82F6", fontSize: "0.74rem" }}>
                    <div style={{ color: "#64748B", fontSize: "0.68rem" }}>{ev.time}</div>
                    <div style={{ color: "#E2E8F0", marginTop: 2 }}>{ev.text}</div>
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
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: "100%", background: "#0F172A", borderRadius: 14, border: "1px solid rgba(43,127,255,0.35)", padding: 28 }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>🚀</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: "0 0 10px" }}>
              Start Assessment for All Candidates?
            </h2>
            <p style={{ color: "#94A3B8", fontSize: "0.88rem", lineHeight: 1.5, margin: "0 0 16px" }}>
              This will simultaneously broadcast <code style={{ color: "#60A5FA" }}>EXAM_STARTED</code> to all{" "}
              <strong style={{ color: "#FFFFFF" }}>{joinedCount}</strong> connected candidates in{" "}
              <strong style={{ color: "#A78BFA" }}>{currentCode}</strong> and activate the server-authoritative timer.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                id="confirm-start-exam-btn"
                onClick={handleStartExam}
                disabled={starting}
                style={{ flex: 1, padding: "10px", borderRadius: 8, background: "linear-gradient(135deg, #10B981, #059669)", border: "none", color: "#FFFFFF", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.4)" }}
              >
                {starting ? "Dispatched..." : "✓ Confirm Start"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
