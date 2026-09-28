import { useState } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

export default function SettingsControl() {
  const [savedMsg, setSavedMsg] = useState('');

  // Platform & Branding Settings
  const [platform, setPlatform] = useState({
    platformName: 'GROWTHRAN',
    tagline: 'Learn. Grow. Run.',
    institutionName: 'Aerospace Engineering & Tech Partner',
    primaryColor: '#2B7FFF',
    midnightNavy: '#050814',
    maintenanceMode: false,
    maintenanceMsg: 'GROWTHRAN portal is undergoing scheduled administrative maintenance.',
  });

  // Execution Engine Settings
  const [engine, setEngine] = useState({
    allowedLanguages: ['python', 'javascript', 'cpp', 'java'],
    executionTimeoutMs: 5000,
    memoryLimitMb: 256,
    enablePlagiarism: true,
  });

  // Certificate Controls
  const [cert, setCert] = useState({
    templateName: 'aerospace_standard',
    criteriaPassPct: 40,
    revokeToken: '',
  });

  // Audit Logs
  const [auditLogs] = useState([
    { id: 'aud-1', admin: 'R. Charan Sai', action: 'LAUNCH_EXAM', target: 'exams (e200...02)', time: '2026-09-28 20:30:12' },
    { id: 'aud-2', admin: 'R. Charan Sai', action: 'UPLOAD_QUESTION_BANK', target: 'questions (5-col format)', time: '2026-09-28 20:35:45' },
    { id: 'aud-3', admin: 'R. Charan Sai', action: 'BLOCK_STUDENT', target: 'students (2201A0588)', time: '2026-09-28 20:44:10' },
    { id: 'aud-4', admin: 'R. Charan Sai', action: 'OVERRIDE_SCORE', target: 'results (2201A0502)', time: '2026-09-28 20:50:02' },
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('✅ Administrative settings successfully persisted to master configuration.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleToggleLang = (lang: string) => {
    setEngine((prev) => ({
      ...prev,
      allowedLanguages: prev.allowedLanguages.includes(lang)
        ? prev.allowedLanguages.filter((l) => l !== lang)
        : [...prev.allowedLanguages, lang],
    }));
  };

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="settings" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Platform Control
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Platform & Engine Settings
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Branding Customization, Code Execution Engine Constraints, Maintenance Locks, and Audit Logs
              </p>
            </div>

            <button
              onClick={handleSave}
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontWeight: 700, borderRadius: 8 }}
            >
              💾 Save All Settings
            </button>
          </div>

          {savedMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', fontWeight: 600, fontSize: '0.85rem', marginBottom: 20 }}>
              {savedMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* 1. Branding & Identity */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.65)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0' }}>
                🎨 Platform Branding
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Brand Name</label>
                  <input className="form-input" value={platform.platformName} onChange={(e) => setPlatform({ ...platform, platformName: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Tagline</label>
                  <input className="form-input" value={platform.tagline} onChange={(e) => setPlatform({ ...platform, tagline: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Institution / College Name</label>
                  <input className="form-input" value={platform.institutionName} onChange={(e) => setPlatform({ ...platform, institutionName: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Primary Color</label>
                    <input className="form-input font-mono" value={platform.primaryColor} onChange={(e) => setPlatform({ ...platform, primaryColor: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Midnight Surface</label>
                    <input className="form-input font-mono" value={platform.midnightNavy} onChange={(e) => setPlatform({ ...platform, midnightNavy: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Maintenance Mode Control */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.65)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0' }}>
                🛑 Maintenance Lockdown
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem' }}>Portal Maintenance Mode</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>When active, all student log-ins and exams are locked.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlatform({ ...platform, maintenanceMode: !platform.maintenanceMode })}
                    className="btn btn-sm"
                    style={{
                      background: platform.maintenanceMode ? '#EF444420' : '#10B98120',
                      color: platform.maintenanceMode ? '#EF4444' : '#10B981',
                      border: `1px solid ${platform.maintenanceMode ? '#EF444440' : '#10B98140'}`,
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* 3. Execution Engine Control */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.65)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0' }}>
                ⚡ Code Execution Engine
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Allowed Runtimes (Candidates cannot select outside this)</label>
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

            {/* 4. Certificate Control */}
            <div className="card" style={{ padding: '24px 28px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.65)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px 0' }}>
                📜 Certificate Master Control
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Certificate Criteria (Pass Score %)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={cert.criteriaPassPct}
                    onChange={(e) => setCert({ ...cert, criteriaPassPct: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)', marginTop: 4 }}>
                    Candidates must achieve ≥ this percentage to unlock verification QR.
                  </div>
                </div>

                <div>
                  <label className="form-label">Revoke Certificate by QR Token</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input font-mono"
                      placeholder="e.g. GR-CERT-9B31E7C4..."
                      value={cert.revokeToken}
                      onChange={(e) => setCert({ ...cert, revokeToken: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (cert.revokeToken) {
                          alert(`Certificate with token ${cert.revokeToken} has been revoked.`);
                          setCert({ ...cert, revokeToken: '' });
                        }
                      }}
                      className="btn"
                      style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', fontWeight: 700 }}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Audit Log Wall */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)', background: 'rgba(11, 18, 38, 0.65)' }}>
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
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(43, 127, 255, 0.15)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
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
