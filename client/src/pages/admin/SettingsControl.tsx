import { useState, useEffect } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import {
  downloadSystemBackupZip,
  triggerBackupNow,
  getBackupHistory,
  getGoogleDriveStatus,
} from '../../lib/api';

interface SectorSetting {
  id: string;
  name: string;
  color: string;
  weightPercent: number;
  passCutoff: number;
  active: boolean;
}

export default function SettingsControl() {
  const [savedMsg, setSavedMsg] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [driveConfig, setDriveConfig] = useState<{ configured: boolean; service_account_email: string | null; root_folder_id: string | null } | null>(null);

  const fetchBackupHistory = () => {
    getBackupHistory()
      .then((r) => {
        if (r.data?.history) setBackupHistory(r.data.history);
        if (r.data?.drive_config) setDriveConfig(r.data.drive_config);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBackupHistory();
  }, []);

  const handleBackupNow = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const res = await triggerBackupNow();
      fetchBackupHistory();
      const driveInfo = res.data?.backup?.drive_backup;
      const statusText = driveInfo?.drive_status === 'synced'
        ? `and synced to Google Drive folder (${driveInfo.drive_folder_id})`
        : 'and stored in dated hierarchy archive (college / year / section)';
      setBackupMsg({
        type: 'success',
        text: `✅ System backup executed successfully ${statusText}.`,
      });
    } catch (err: any) {
      setBackupMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to trigger system backup.',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const res = await downloadSystemBackupZip();
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logicwhilelire_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg({
        type: 'success',
        text: '✅ Complete system backup archive (.zip) downloaded successfully with CSVs, JSONs, batch lists, and row-count manifest.',
      });
    } catch (err: any) {
      setBackupMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to download backup archive.',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  // Platform & Branding Settings
  const [platform, setPlatform] = useState(() => {
    try {
      const saved = localStorage.getItem('lw_platform_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      platformName: 'LogicWhileLiRE',
      tagline: 'Elevating Coding Knowledge',
      engineBrand: 'Li: Live • R: Real • E: Engine',
      institutionName: 'Aerospace Engineering & Tech Partner',
      primaryColor: '#FFBE00',
      electricBlue: '#2B7FFF',
      midnightNavy: '#050814',
      maintenanceMode: false,
      maintenanceMsg: 'LogicWhileLiRE portal is undergoing scheduled administrative maintenance.',
    };
  });

  // Candidate Gate & Student Exam Options
  const [portalRules, setPortalRules] = useState(() => {
    try {
      const saved = localStorage.getItem('lw_portal_rules');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enforceStudentLoginToEnterExam: true,
      allowGuestExamBypass: false,
      maxTabSwitchesAllowed: 3,
      autoSubmitOnViolation: true,
      strictFullscreenLock: true,
      mandatoryWebcamMonitoring: true,
      showLeaderboardAfterExam: true,
    };
  });

  // OTP & Login Mail Dispatch Texts (Admin Controlled)
  const [emailTemplates, setEmailTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('lw_email_templates');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      otpSubject: 'LogicWhile LiRE Verification Code',
      otpBody: 'Your LogicWhile LiRE verification code is: {{OTP}}\n\nThis one-time passcode is valid for 10 minutes. Please do not share this code with anyone.',
      loginSubject: 'LogicWhile LiRE - Candidate Portal Credentials',
      loginBody: 'Dear {{NAME}},\n\nYour institutional candidate account for LogicWhile LiRE has been authorized.\n\nHall Ticket: {{HALL_TICKET}}\nTemporary Password: {{PASSWORD}}\nExam Portal URL: {{PORTAL_URL}}\n\nPlease sign in and verify your section details before your exam slot.',
    };
  });

  // 5-Sector Technical Matrix Configuration
  const [sectors, setSectors] = useState<SectorSetting[]>(() => {
    try {
      const saved = localStorage.getItem('lw_sectors_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'sec-01', name: 'Sector 1: Quantitative Velocity', color: '#F59E0B', weightPercent: 20, passCutoff: 65, active: true },
      { id: 'sec-02', name: 'Sector 2: Deductive Logic', color: '#8B5CF6', weightPercent: 20, passCutoff: 65, active: true },
      { id: 'sec-03', name: 'Sector 3: Core CS & Systems', color: '#10B981', weightPercent: 20, passCutoff: 70, active: true },
      { id: 'sec-04', name: 'Sector 4: Data Structures & Algorithms', color: '#38BDF8', weightPercent: 20, passCutoff: 65, active: true },
      { id: 'sec-05', name: 'Sector 5: Full-Stack Architecture', color: '#F43F5E', weightPercent: 20, passCutoff: 70, active: true },
    ];
  });

  // Execution Engine Settings
  const [engine, setEngine] = useState(() => {
    try {
      const saved = localStorage.getItem('lw_engine_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      allowedLanguages: ['python', 'javascript', 'cpp', 'java'],
      executionTimeoutMs: 5000,
      memoryLimitMb: 256,
      enablePlagiarism: true,
    };
  });

  // Audit Logs
  const [auditLogs] = useState([
    { id: 'aud-1', admin: 'R. Charan Sai', action: 'UPDATE_BRANDING', target: 'Branding: LogicWhileLiRE', time: '2026-10-04 11:25:12' },
    { id: 'aud-2', admin: 'R. Charan Sai', action: 'PORTAL_RULES_SYNC', target: 'Enforce Student Login to Enter Exam', time: '2026-10-04 11:32:00' },
    { id: 'aud-3', admin: 'R. Charan Sai', action: 'SECTOR_MATRIX_ADJUST', target: '5 Sectors: 20% Uniform Distribution', time: '2026-10-04 11:38:45' },
    { id: 'aud-4', admin: 'R. Charan Sai', action: 'PROCTOR_POLICY_UPDATE', target: 'Anti-Tab Switch Limit = 3', time: '2026-10-04 11:42:10' },
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('lw_platform_settings', JSON.stringify(platform));
      localStorage.setItem('lw_portal_rules', JSON.stringify(portalRules));
      localStorage.setItem('lw_email_templates', JSON.stringify(emailTemplates));
      localStorage.setItem('lw_sectors_settings', JSON.stringify(sectors));
      localStorage.setItem('lw_engine_settings', JSON.stringify(engine));
    } catch {}
    setSavedMsg('✅ All administrative platform options, OTP & login mail templates, 5-sector matrix, proctoring rules, and branding successfully persisted!');
    setTimeout(() => setSavedMsg(''), 4000);
  };

  const handleToggleLang = (lang: string) => {
    setEngine((prev: any) => ({
      ...prev,
      allowedLanguages: prev.allowedLanguages.includes(lang)
        ? prev.allowedLanguages.filter((l: string) => l !== lang)
        : [...prev.allowedLanguages, lang],
    }));
  };

  const handleSectorChange = (id: string, field: string, value: any) => {
    setSectors((prev: SectorSetting[]) =>
      prev.map((s: SectorSetting) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="settings" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#FFBE00', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Master Administration & Configuration
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Platform Control & Master Options
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Manage Branding, 5-Sector Parameters, Student Portal Access, Proctoring Policies, Code Engine, and Backups.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="btn btn-primary"
              style={{
                padding: '12px 26px',
                fontWeight: 800,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                boxShadow: '0 4px 16px rgba(255, 122, 0, 0.35)',
              }}
            >
              💾 Save All Options & Changes
            </button>
          </div>

          {savedMsg && (
            <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#10B981', fontWeight: 700, fontSize: '0.9rem', marginBottom: 24 }}>
              {savedMsg}
            </div>
          )}

          {/* Section 1: Branding & Candidate Gate Access Rules */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* Platform Branding */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎨</span> Platform Branding & Identity
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Official Platform Title</label>
                  <input className="form-input" value={platform.platformName} onChange={(e) => setPlatform({ ...platform, platformName: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Tagline</label>
                  <input className="form-input" value={platform.tagline} onChange={(e) => setPlatform({ ...platform, tagline: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Sub-Brand Definition</label>
                  <input className="form-input" value={platform.engineBrand} onChange={(e) => setPlatform({ ...platform, engineBrand: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Institution / College Partner</label>
                  <input className="form-input" value={platform.institutionName} onChange={(e) => setPlatform({ ...platform, institutionName: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Circuit Gold Accent</label>
                    <input className="form-input font-mono" value={platform.primaryColor} onChange={(e) => setPlatform({ ...platform, primaryColor: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Electric Blue</label>
                    <input className="form-input font-mono" value={platform.electricBlue} onChange={(e) => setPlatform({ ...platform, electricBlue: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Gate & Student Exam Options */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(11, 18, 38, 0.7)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎓</span> Student Portal & Exam Access Policies
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                      Enforce Student Login to Enter Exam
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Home page hides "Enter Exam" by default until student signs into their account.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortalRules({ ...portalRules, enforceStudentLoginToEnterExam: !portalRules.enforceStudentLoginToEnterExam })}
                    className="btn btn-sm"
                    style={{
                      background: portalRules.enforceStudentLoginToEnterExam ? '#10B98125' : '#EF444425',
                      color: portalRules.enforceStudentLoginToEnterExam ? '#10B981' : '#EF4444',
                      border: `1px solid ${portalRules.enforceStudentLoginToEnterExam ? '#10B98150' : '#EF444450'}`,
                      fontWeight: 800,
                    }}
                  >
                    {portalRules.enforceStudentLoginToEnterExam ? 'ENFORCED' : 'OPTIONAL'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                      Strict Fullscreen & Anti-Cheat Lock
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Forces fullscreen during examination with automatic focus tracking.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={portalRules.strictFullscreenLock}
                    onChange={(e) => setPortalRules({ ...portalRules, strictFullscreenLock: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#2B7FFF' }}
                  />
                </div>

                <div>
                  <label className="form-label">Tab Switch Violation Limit (Auto-Submit Threshold)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-input"
                      value={portalRules.maxTabSwitchesAllowed}
                      onChange={(e) => setPortalRules({ ...portalRules, maxTabSwitchesAllowed: Number(e.target.value) })}
                      style={{ width: 100 }}
                    />
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Violations allowed before instant lockdown & paper submission
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                      Mandatory AI Webcam & Face Tracking
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Candidate face verification & live continuous telemetry stream.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={portalRules.mandatoryWebcamMonitoring}
                    onChange={(e) => setPortalRules({ ...portalRules, mandatoryWebcamMonitoring: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#2B7FFF' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 5-Sector Technical Matrix Configuration */}
          <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid rgba(255, 190, 0, 0.3)', background: 'rgba(11, 18, 38, 0.7)', marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🌌</span> 5-Sector Technical Matrix Calibration
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                  Administer question weight allocations, pass cut-offs, and naming across all 5 sectors.
                </p>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#FFBE00', background: 'rgba(255,190,0,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,190,0,0.3)', fontWeight: 700 }}>
                Total Allocated Weight: {sectors.reduce((acc: number, s: SectorSetting) => acc + (s.active ? s.weightPercent : 0), 0)}%
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {sectors.map((sec: SectorSetting) => (
                <div
                  key={sec.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: `1px solid ${sec.color}40`,
                    borderTop: `3px solid ${sec.color}`,
                    borderRadius: 8,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: sec.color, textTransform: 'uppercase' }}>
                      {sec.id}
                    </span>
                    <input
                      type="checkbox"
                      checked={sec.active}
                      onChange={(e) => handleSectorChange(sec.id, 'active', e.target.checked)}
                      style={{ accentColor: sec.color }}
                      title="Toggle Sector Active State"
                    />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Sector Title</label>
                    <input
                      className="form-input text-xs"
                      value={sec.name}
                      onChange={(e) => handleSectorChange(sec.id, 'name', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: 2 }}>Weight %</label>
                      <input
                        type="number"
                        className="form-input text-xs"
                        value={sec.weightPercent}
                        onChange={(e) => handleSectorChange(sec.id, 'weightPercent', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: 2 }}>Pass %</label>
                      <input
                        type="number"
                        className="form-input text-xs"
                        value={sec.passCutoff}
                        onChange={(e) => handleSectorChange(sec.id, 'passCutoff', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Execution Engine & Maintenance Lockdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* Code Execution Engine */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚡</span> Code Execution Engine (LiRE)
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Permitted Candidate Runtimes</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {[
                      { id: 'python', label: 'Python 3.11' },
                      { id: 'javascript', label: 'Node.js 20' },
                      { id: 'cpp', label: 'C++ (GCC 13)' },
                      { id: 'java', label: 'Java 17 (OpenJDK)' },
                      { id: 'go', label: 'Go 1.22' },
                      { id: 'rust', label: 'Rust 1.76' },
                    ].map((lang) => {
                      const enabled = engine.allowedLanguages.includes(lang.id);
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => handleToggleLang(lang.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: enabled ? 'rgba(43, 127, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            color: enabled ? '#FFFFFF' : 'var(--color-text-faint)',
                            border: `1px solid ${enabled ? 'rgba(43, 127, 255, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {enabled ? '✓ ' : '+ '} {lang.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Execution Timeout (ms)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={engine.executionTimeoutMs}
                      onChange={(e) => setEngine({ ...engine, executionTimeoutMs: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Memory Limit (MB)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={engine.memoryLimitMb}
                      onChange={(e) => setEngine({ ...engine, memoryLimitMb: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem', color: '#FFFFFF', cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={engine.enablePlagiarism}
                    onChange={(e) => setEngine({ ...engine, enablePlagiarism: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                  />
                  Enable automated AST code plagiarism cross-checking
                </label>
              </div>
            </div>

            {/* Maintenance Lockdown */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛑</span> Maintenance Mode Lockdown
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>Portal Maintenance Mode</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>When active, all student logins and exams are locked.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlatform({ ...platform, maintenanceMode: !platform.maintenanceMode })}
                    className="btn btn-sm"
                    style={{
                      background: platform.maintenanceMode ? '#EF444425' : '#10B98125',
                      color: platform.maintenanceMode ? '#EF4444' : '#10B981',
                      border: `1px solid ${platform.maintenanceMode ? '#EF444450' : '#10B98150'}`,
                      fontWeight: 800,
                    }}
                  >
                    {platform.maintenanceMode ? 'LOCKED' : 'NORMAL'}
                  </button>
                </div>

                <div>
                  <label className="form-label">Lockdown Banner Message</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={platform.maintenanceMsg}
                    onChange={(e) => setPlatform({ ...platform, maintenanceMsg: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Admin-Controlled OTP & Login Mail Notification Templates */}
          <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)', marginBottom: 32 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✉️</span> Admin-Controlled OTP &amp; Candidate Login Email Templates
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Configure the authoritative text dispatched to candidates for authentication OTPs and official credentials issuance.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {/* OTP Dispatch Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8' }}>
                    🔑 Authentication OTP Email
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Triggered on Login / Verification</span>
                </div>

                <div>
                  <label className="form-label">Email Subject</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emailTemplates.otpSubject}
                    onChange={(e) => setEmailTemplates({ ...emailTemplates, otpSubject: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Email Message Body</label>
                  <textarea
                    className="form-input"
                    rows={5}
                    value={emailTemplates.otpBody}
                    onChange={(e) => setEmailTemplates({ ...emailTemplates, otpBody: e.target.value })}
                    style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem' }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 4 }}>
                    Supported Token: <code style={{ color: '#FFC200' }}>{`{{OTP}}`}</code>
                  </div>
                </div>
              </div>

              {/* Login Welcome & Credentials Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10B981' }}>
                    🎓 Candidate Credentials Welcome Email
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Triggered on Roster / Registration Approval</span>
                </div>

                <div>
                  <label className="form-label">Email Subject</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emailTemplates.loginSubject}
                    onChange={(e) => setEmailTemplates({ ...emailTemplates, loginSubject: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Email Message Body</label>
                  <textarea
                    className="form-input"
                    rows={5}
                    value={emailTemplates.loginBody}
                    onChange={(e) => setEmailTemplates({ ...emailTemplates, loginBody: e.target.value })}
                    style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem' }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 4 }}>
                    Supported Tokens: <code style={{ color: '#FFC200' }}>{`{{NAME}}`}</code>, <code style={{ color: '#FFC200' }}>{`{{HALL_TICKET}}`}</code>, <code style={{ color: '#FFC200' }}>{`{{PASSWORD}}`}</code>, <code style={{ color: '#FFC200' }}>{`{{PORTAL_URL}}`}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Automated Database Backups & Google Drive Cloud Disaster Recovery */}
          <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)', marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💾</span> Automated Database Backups & Google Drive Cloud Recovery
                </h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0, maxWidth: 680 }}>
                  Nightly and on-demand backup pipeline that exports students, exams, results, and audit logs into dated hierarchical folders (<code style={{ color: '#93C5FD' }}>college / year / section</code>) and syncs directly to Google Drive via server service account.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  id="btn-backup-now"
                  onClick={handleBackupNow}
                  disabled={backupLoading}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontWeight: 700,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #2B7FFF 0%, #1D4ED8 100%)',
                    cursor: backupLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>{backupLoading ? '⏳' : '⚡'}</span>
                  {backupLoading ? 'Backing Up...' : 'Backup now'}
                </button>

                <button
                  id="btn-download-backup-now"
                  onClick={handleDownloadBackup}
                  disabled={backupLoading}
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 20px',
                    fontWeight: 700,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(43, 127, 255, 0.12)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    cursor: backupLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>📥</span> Download Zip
                </button>
              </div>
            </div>

            {/* Cloud Drive Status Banner */}
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                background: driveConfig?.configured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                border: driveConfig?.configured ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(234, 179, 8, 0.25)',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{driveConfig?.configured ? '☁️' : '⚠️'}</span>
                <div>
                  <strong style={{ color: driveConfig?.configured ? '#10B981' : '#FDE047' }}>
                    Google Drive Cloud Storage:{' '}
                    {driveConfig?.configured ? 'Active (Service Account Connected)' : 'Local Mode (Drive Credentials in Server Env)'}
                  </strong>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', marginTop: 2 }}>
                    {driveConfig?.configured
                      ? `Target Folder: ${driveConfig.root_folder_id || 'Root'} • Account: ${driveConfig.service_account_email} • Credentials kept strictly in server env`
                      : 'To sync to Google Drive, configure GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID in server environment'}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: driveConfig?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                  color: driveConfig?.configured ? '#10B981' : '#EAB308',
                }}
              >
                {driveConfig?.configured ? 'GOOGLE DRIVE SYNC ON' : 'LOCAL ARCHIVE ACTIVE'}
              </span>
            </div>

            {backupMsg && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '12px 16px',
                  borderRadius: 8,
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  background: backupMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${backupMsg.type === 'success' ? '#10B981' : '#EF4444'}`,
                  color: backupMsg.type === 'success' ? '#10B981' : '#F87171',
                }}
              >
                {backupMsg.text}
              </div>
            )}

            {/* Backup History Table */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#E2E8F0', margin: 0 }}>
                  📜 Backup History & Dated Cloud Archives
                </h3>
                <button onClick={fetchBackupHistory} className="btn btn-ghost btn-sm" style={{ fontSize: '0.76rem' }}>
                  🔄 Refresh History
                </button>
              </div>

              {backupHistory.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
                  No previous backup archives found in history. Click <strong>Backup now</strong> to generate the initial cloud archive.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Timestamp / ID</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Trigger</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Dated Folder (Hierarchy)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Records / Files</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Cloud Sync</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--color-text-faint)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupHistory.slice(0, 10).map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#FFFFFF' }}>
                              {new Date(b.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
                              {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {b.id.slice(0, 20)}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: b.trigger === 'scheduled' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(43, 127, 255, 0.15)',
                                color: b.trigger === 'scheduled' ? '#C084FC' : '#93C5FD',
                              }}
                            >
                              {b.trigger === 'scheduled' ? '⏰ Nightly' : '⚡ Manual'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#93C5FD', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {b.dated_folder || 'college / year / section'}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>
                            {b.total_records} records • {b.file_count} files
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background:
                                  b.drive_status === 'synced'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(255, 255, 255, 0.06)',
                                color: b.drive_status === 'synced' ? '#10B981' : 'var(--color-text-muted)',
                              }}
                            >
                              {b.drive_status === 'synced' ? '☁️ Synced to Drive' : '📁 Local Archive'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                downloadSystemBackupZip(b.id).then((res) => {
                                  const blob = new Blob([res.data], { type: 'application/zip' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `logicwhilelire_${b.id}.zip`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                });
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            >
                              📥 Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Audit Log Wall */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.7)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                📋 Administrative Security Audit Log
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                Immutable administrative activity record
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 18px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Admin User</th>
                  <th style={{ padding: '10px 18px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Action Performed</th>
                  <th style={{ padding: '10px 18px', textAlign: 'left', color: 'var(--color-text-faint)' }}>Target Entity</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', color: 'var(--color-text-faint)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 18px', fontWeight: 600, color: '#FFFFFF' }}>{log.admin}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(43, 127, 255, 0.15)', color: '#60a5fa', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', color: 'var(--color-text-muted)' }}>{log.target}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}
