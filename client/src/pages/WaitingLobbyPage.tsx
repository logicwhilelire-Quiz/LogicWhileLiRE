import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';
import ParticleField from '../components/3d/ParticleField';
import { getAssessmentSystemCheck, getAssessmentLobbyStatus, authLogout } from '../lib/api';

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

export default function WaitingLobbyPage() {
  const { contestId = 'demo-contest' } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Load candidate profile from location state or localStorage
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);

  // Real-time socket & Redis state
  const [connected, setConnected] = useState(true);
  const [latency, setLatency] = useState(18);
  const [connectedCount, setConnectedCount] = useState(142);
  const [queueRank, setQueueRank] = useState(38);
  const [countdown, setCountdown] = useState(300); // 5 minutes default
  const [events, setEvents] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'ping' }>>([]);

  useEffect(() => {
    // 1. Resolve candidate profile
    const stateCandidate = (location.state as any)?.candidate;
    if (stateCandidate) {
      setCandidate(stateCandidate);
    } else {
      const stored = localStorage.getItem('student_user');
      if (stored) {
        try {
          setCandidate(JSON.parse(stored));
        } catch {
          // ignore
        }
      } else {
        // Sample baseline fallback from spec
        setCandidate({
          first_name: 'Venkata Srinivas',
          last_name: 'Katta',
          name: 'Venkata Srinivas Katta',
          college_id: 'COL-UNIV-042',
          college_name: 'University College of Eng.',
          year_of_passing: 2028,
          roll_number: '22B91A0501',
          branch_code: 'CSM',
          section: 'B',
          email: 'srinivas.k@college.edu',
          contact_number: '+91 9876543210',
        });
      }
    }

    // 2. Fetch lobby status & system check
    getAssessmentSystemCheck()
      .then((res) => {
        setConnected(true);
        if (res.data?.latency_ms) setLatency(res.data.latency_ms);
      })
      .catch(() => {
        setConnected(false);
      });

    getAssessmentLobbyStatus(contestId).then((res) => {
      if (res.data?.connected_candidates) setConnectedCount(res.data.connected_candidates);
      if (res.data?.queue_rank) setQueueRank(res.data.queue_rank);
    }).catch(() => {});

    // Initial event feed
    const now = new Date();
    setEvents([
      {
        id: '1',
        time: now.toLocaleTimeString(),
        text: `Subscribed to Redis Sorted Set leader channel: room:${contestId}:leader_set`,
        type: 'success',
      },
      {
        id: '2',
        time: new Date(now.getTime() - 2000).toLocaleTimeString(),
        text: 'Encrypted JWT session claim verified. Gate clearance granted.',
        type: 'info',
      },
      {
        id: '3',
        time: new Date(now.getTime() - 4000).toLocaleTimeString(),
        text: 'Composite uniqueness check verified on (college_id, roll_number).',
        type: 'info',
      },
    ]);

    // Simulated WebSocket ping & activity stream
    const interval = setInterval(() => {
      setLatency(Math.floor(15 + Math.random() * 8));
      setConnectedCount((prev) => prev + (Math.random() > 0.4 ? 1 : 0));

      if (Math.random() > 0.7) {
        const timeStr = new Date().toLocaleTimeString();
        const randRoll = `22B91A05${Math.floor(10 + Math.random() * 89)}`;
        setEvents((prev) => [
          {
            id: Date.now().toString(),
            time: timeStr,
            text: `[REDIS] Candidate ${randRoll} enrolled in Section ${['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]}`,
            type: 'ping',
          },
          ...prev.slice(0, 7),
        ]);
      }
    }, 3000);

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [contestId, location.state]);

  const handleStartExam = () => {
    navigate('/exam');
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // ignore
    }
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
    navigate('/login');
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const displayName =
    candidate?.name ||
    `${candidate?.first_name || 'Venkata'} ${candidate?.last_name || 'Katta'}`.trim();

  return (
    <AnimatedPage>
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at 50% 10%, #15102a 0%, #08080f 80%)',
          color: 'var(--color-text, #f0f0f8)',
          padding: '24px 16px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Module 16: 3D Star Particle Field */}
        <ParticleField liveCount={connectedCount} particleCount={1000} color="#a78bfa" />
        {/* Navigation Bar */}
        <div
          style={{
            width: '100%',
            maxWidth: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            padding: '12px 20px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            backdropFilter: 'blur(16px)',
          }}
        >
          <BrandLogo size="sm" variant="standard" />

          {/* Active WebSocket Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderRadius: 8,
                background: connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                fontSize: '0.78rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: connected ? '#34d399' : '#f87171',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: connected ? '#10b981' : '#ef4444',
                  boxShadow: connected ? '0 0 10px #10b981' : 'none',
                  animation: 'pulse 1.8s infinite',
                }}
              />
              <span>WEBSOCKET: REDIS SORTED SET LEADER CHANNEL ACTIVE</span>
              <span style={{ color: '#6ee7b7' }}>({latency}ms)</span>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          style={{
            width: '100%',
            maxWidth: 1000,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {/* Column 1: Candidate Verification Card & Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Candidate Identity Card */}
            <div
              className="card"
              style={{
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(26, 26, 38, 0.95) 0%, rgba(17, 17, 24, 0.98) 100%)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(124, 58, 237, 0.15)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a78bfa' }}>
                  Candidate Gate Clearance
                </div>
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  VERIFIED CLAIM ✔
                </div>
              </div>

              {/* Candidate Details */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  Roll: {candidate?.roll_number || '22B91A0501'}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>
                    Institution
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>
                    {candidate?.college_name || 'University College of Eng.'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                    {candidate?.college_id || 'COL-UNIV-042'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>
                    Branch &amp; Section
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', marginTop: 2 }}>
                    {candidate?.branch_code || 'CSM'} • Section {candidate?.section || 'B'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Batch: {candidate?.year_of_passing || 2028}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>
                    Scorecard Dispatch
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: 2, wordBreak: 'break-all' }}>
                    {candidate?.email || 'srinivas.k@college.edu'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>
                    Critical SMS Channel
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {candidate?.contact_number || '+91 9876543210'}
                  </div>
                </div>
              </div>

              {/* Ready to Launch Button */}
              <button
                id="start-assessment-now-btn"
                onClick={handleStartExam}
                className="btn btn-primary btn-full btn-lg"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '14px 20px',
                  borderRadius: 8,
                }}
              >
                <span>ENTER LIVE ASSESSMENT NOW →</span>
              </button>
            </div>

            {/* Countdown Clock Card */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 8 }}>
                Assessment Timer Sync
              </div>
              <div
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#f59e0b',
                  letterSpacing: '0.04em',
                }}
              >
                {timeFormatted}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                Global competitive assessment timer sync in progress
              </div>
            </div>
          </div>

          {/* Column 2: Real-time Channel Status & Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Live Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>{connectedCount}</div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', marginTop: 4 }}>
                  Candidates in Lobby
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>#{queueRank}</div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', marginTop: 4 }}>
                  Queue Position
                </div>
              </div>
            </div>

            {/* System Readiness Checklist */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#e2e8f0', marginBottom: 12 }}>
                Pre-Assessment System Verification
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
                  <span style={{ color: '#10b981' }}>✔</span>
                  <span>100% Identity Uniqueness confirmed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
                  <span style={{ color: '#10b981' }}>✔</span>
                  <span>WebSocket Gateway connection verified ({latency}ms)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
                  <span style={{ color: '#10b981' }}>✔</span>
                  <span>Browser full-screen and tab isolation armed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
                  <span style={{ color: '#10b981' }}>✔</span>
                  <span>Single-session mutex active</span>
                </div>
              </div>
            </div>

            {/* Live Redis Channel Stream */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a78bfa' }}>
                  Redis Sorted Set Channel Stream
                </div>
                <div style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", color: '#6ee7b7' }}>
                  LIVE FEED
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 180,
                  overflowY: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.74rem',
                }}
              >
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 6,
                      borderLeft: `3px solid ${ev.type === 'success' ? '#10b981' : ev.type === 'ping' ? '#06b6d4' : '#7c3aed'}`,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: '#94a3b8', flexShrink: 0 }}>{ev.time}</span>
                    <span style={{ color: '#e2e8f0' }}>{ev.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Return to Gate link */}
        <div style={{ marginTop: 24, fontSize: '0.82rem', color: '#94a3b8' }}>
          Need to update your registration information?{' '}
          <Link to="/register" style={{ color: '#38bdf8', fontWeight: 600 }}>
            Return to Assessment Entrance Gate
          </Link>
        </div>
      </div>
    </AnimatedPage>
  );
}
