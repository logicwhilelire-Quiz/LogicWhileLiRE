import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { importQuestions } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import AnimatedPage from '../../components/AnimatedPage';

interface RowError {
  row: number;
  errors: string[];
}

export default function ImportQuestionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultExamId = searchParams.get('examId') || '';

  const [examId, setExamId] = useState(defaultExamId);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; errors?: RowError[]; count?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith('.xlsx')) {
      setResult({ success: false, message: 'Only .xlsx files are accepted.' });
      return;
    }
    setFile(f);
    setResult(null);
  }

  async function handleImport() {
    if (!file || !examId.trim()) {
      setResult({ success: false, message: 'Please provide an Exam ID and select a file.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await importQuestions(examId.trim(), file);
      setResult({ success: true, message: res.data.message, count: res.data.inserted_count });
      setFile(null);
    } catch (err: any) {
      const data = err?.response?.data;
      setResult({
        success: false,
        message: data?.error || 'Import failed',
        errors: data?.row_errors,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="admin-layout">
      <aside className="admin-sidebar">
        <div style={{ marginBottom: 24 }}>
          <BrandLogo size="sm" />
        </div>
        <button className="admin-nav-item" onClick={() => navigate('/admin/dashboard')}>📊 Dashboard</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/create-exam')}>➕ Create Exam</button>
        <button className="admin-nav-item active">📥 Import Questions</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/sessions')}>👥 Sessions</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/reports')}>📈 Reports</button>
        <button className="admin-nav-item" onClick={() => navigate('/admin/analytics')}>🔬 Analytics</button>
      </aside>

      <main className="admin-content">
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Import Questions</h1>
        <p className="text-muted text-sm mb-3">Upload an Excel (.xlsx) file to bulk-import MCQ questions.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
          <div>
            <div className="card">
              <div className="form-group">
                <label className="form-label" htmlFor="import-exam-id">Exam ID</label>
                <input
                  id="import-exam-id"
                  className="form-input font-mono"
                  type="text"
                  placeholder="paste-exam-uuid-here"
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                />
              </div>

              {/* Drop zone */}
              <div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <div className="upload-icon">📊</div>
                {file ? (
                  <>
                    <div className="upload-text text-success">✅ {file.name}</div>
                    <div className="upload-hint">{(file.size / 1024).toFixed(1)} KB — click to change</div>
                  </>
                ) : (
                  <>
                    <div className="upload-text">Drop your .xlsx file here</div>
                    <div className="upload-hint">or click to browse — max 5 MB</div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              <button
                id="import-submit-btn"
                className="btn btn-primary btn-full mt-2"
                onClick={handleImport}
                disabled={loading || !file || !examId.trim()}
              >
                {loading ? <><div className="btn-spinner" />Importing...</> : '📥 Import Questions'}
              </button>
            </div>

            {result && (
              <div className={`alert mt-2 ${result.success ? 'alert-success' : 'alert-error'}`}>
                {result.success ? `✅ ${result.message}` : `⚠️ ${result.message}`}
              </div>
            )}

            {result?.errors && result.errors.length > 0 && (
              <div className="card mt-2" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.85rem' }}>
                  Row-by-row Errors ({result.errors.length} rows failed)
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {result.errors.map((e) => (
                    <div key={e.row} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: 2 }}>
                        Row {e.row}
                      </div>
                      {e.errors.map((msg, i) => (
                        <div key={i} className="text-sm text-muted">• {msg}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Template info */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>📋 Supported Formats</h3>
            <p className="text-muted text-sm mb-2"><strong>Option 1 (LogicWhileLiRE 1-Click Format):</strong> 5 columns:</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Column</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Format / Values</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['question_text', 'Question prompt / title text'],
                  ['type', 'mcq or code'],
                  ['options', 'option1 | option2 | option3 | option4 (pipe separated)'],
                  ['correct_index', '0, 1, 2, 3 (or a, b, c, d)'],
                  ['marks', 'Numeric marks (e.g. 1, 2, 5)'],
                ].map(([col, note]) => (
                  <tr key={col}>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <code className="font-mono" style={{ background: 'rgba(43,127,255,0.1)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>
                        {col}
                      </code>
                    </td>
                    <td className="text-muted" style={{ padding: '6px 0 6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-muted text-sm mb-2"><strong>Option 2 (Multi-Column Format):</strong></p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Column</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['question', 'Non-empty text'],
                  ['option_a', 'Option A text'],
                  ['option_b', 'Option B text'],
                  ['option_c', 'Option C text'],
                  ['option_d', 'Option D text'],
                  ['correct_option', 'a, b, c, or d'],
                  ['marks', 'Positive number'],
                  ['topic', 'Optional (default: General)'],
                  ['set', 'Optional: 1, 2 or A, B (auto-distributes if omitted)'],
                ].map(([col, note]) => (
                  <tr key={col}>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <code className="font-mono" style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>
                        {col}
                      </code>
                    </td>
                    <td className="text-muted" style={{ padding: '5px 0 5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="alert alert-warning mt-2" style={{ fontSize: '0.82rem' }}>
              ⚠️ If <em>any</em> row fails validation, the entire file is rejected. Fix all errors and re-upload.
            </div>
          </div>
        </div>
      </main>
    </div>
    </AnimatedPage>
  );
}
