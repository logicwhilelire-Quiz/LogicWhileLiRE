import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateAndPreviewQuestions, confirmImportQuestions, listExams } from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';

interface PreviewItem {
  row_number: number;
  valid: boolean;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
  penalty: number;
  section: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  errors?: string[];
}

export default function ImportQuestionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultExamId = searchParams.get('examId') || searchParams.get('code') || '';

  const [examCode, setExamCode] = useState(defaultExamId);
  const [availableExams, setAvailableExams] = useState<Array<{ id: string; exam_code?: string; title?: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<{
    total_rows: number;
    valid_count: number;
    invalid_count: number;
    preview: PreviewItem[];
    errors: string[];
    can_import: boolean;
  } | null>(null);

  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listExams(1, 50)
      .then((res) => {
        if (res.data?.exams) {
          setAvailableExams(res.data.exams);
          if (!defaultExamId && res.data.exams.length > 0) {
            setExamCode(res.data.exams[0].exam_code || res.data.exams[0].id);
          }
        }
      })
      .catch(() => {});
  }, [defaultExamId]);

  function handleFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.csv')) {
      setGeneralError('Only Excel (.xlsx) or CSV (.csv) files are supported.');
      return;
    }
    setFile(f);
    setPreviewData(null);
    setImportSuccess(null);
    setGeneralError(null);
  }

  function handleDownloadTemplate() {
    const csvContent =
      'Question,Option A,Option B,Option C,Option D,Correct Answer,Marks,Penalty,Section,Topic,Difficulty\n' +
      '"What is the time complexity of searching in a balanced Binary Search Tree?","O(1)","O(log n)","O(n)","O(n log n)","B",1,0.25,"Computer Science","Data Structures","Easy"\n' +
      '"Which CPU scheduling algorithm gives minimum average waiting time?","FCFS","Round Robin","SJF","Priority Scheduling","C",1,0.25,"Computer Science","Operating Systems","Medium"\n' +
      '"What is the output of 3 + 2 + \\"7\\" in JavaScript?","57","12","NaN","Error","A",1,0,"Web Development","JavaScript","Easy"\n' +
      '"In relational databases, which normal form eliminates transitive dependency?","1NF","2NF","3NF","BCNF","C",2,0.5,"Databases","Normalization","Hard"\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'LogicWhileLiRE_Questions_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleValidate() {
    if (!file) {
      setGeneralError('Please select or drop an Excel (.xlsx) file first.');
      return;
    }
    setValidating(true);
    setGeneralError(null);
    setImportSuccess(null);

    try {
      const res = await validateAndPreviewQuestions(file);
      if (res.data?.success) {
        setPreviewData(res.data);
      } else {
        setGeneralError(res.data?.error || 'Validation failed. Please check your Excel structure.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to parse Excel file.';
      setGeneralError(msg);
    } finally {
      setValidating(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewData || !previewData.preview || previewData.preview.length === 0) {
      setGeneralError('No validated questions available for import.');
      return;
    }
    const targetCode = examCode.trim() || 'DEFAULT';
    const validQuestions = previewData.preview.filter((q) => q.valid);

    if (validQuestions.length === 0) {
      setGeneralError('Cannot import: 0 valid questions found in preview. Please fix row errors.');
      return;
    }

    setImporting(true);
    setGeneralError(null);

    try {
      const res = await confirmImportQuestions({
        examCode: targetCode,
        examId: targetCode,
        questions: validQuestions,
      });

      if (res.data?.success) {
        setImportSuccess(`Successfully imported ${validQuestions.length} questions into exam "${targetCode}"!`);
        setFile(null);
        setPreviewData(null);
      } else {
        setGeneralError(res.data?.error || 'Failed to commit questions to database.');
      }
    } catch (err: any) {
      setGeneralError(err?.response?.data?.error || err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg, #090d16)' }}>
        <AdminSidebar activeTab="questions" />

        <main className="admin-content" style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: '1.4rem' }}>📥</span>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                  Faculty Question Uploader
                </h1>
              </div>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                Upload question papers using the 5-column Excel format with instant validation and preview.
              </p>
            </div>

            <button
              onClick={() => navigate('/admin/questions')}
              className="btn btn-outline text-xs"
              style={{ padding: '8px 16px' }}
            >
              &larr; Back to Question Bank
            </button>
          </div>

          {/* Feedback Alerts */}
          {importSuccess && (
            <div className="alert alert-success mb-3 animate-slide-up" role="alert" style={{ fontSize: '0.92rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🎉</span>
              <div>
                <strong>Import Complete!</strong> {importSuccess}
                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => navigate('/admin/questions')}
                    className="btn btn-primary text-xs"
                    style={{ padding: '4px 12px' }}
                  >
                    View in Question Bank &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {generalError && (
            <div className="alert alert-error mb-3 animate-slide-up" role="alert" style={{ fontSize: '0.92rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>{generalError}</div>
            </div>
          )}

          {/* Upload Configuration & Dropzone Card */}
          <div className="card mb-4" style={{ padding: '24px 28px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Target Exam Selection */}
              <div>
                <label className="form-label" htmlFor="import-exam-selector" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  Target Exam Code / Subject
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="import-exam-selector"
                    className="form-input font-mono"
                    type="text"
                    placeholder="e.g. GR-VRSEC-001 or DEMO123"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                    style={{ flex: 1 }}
                  />
                  {availableExams.length > 0 && (
                    <select
                      className="form-input"
                      style={{ maxWidth: 160 }}
                      onChange={(e) => setExamCode(e.target.value)}
                      value={examCode}
                    >
                      <option value="">Choose Exam...</option>
                      {availableExams.map((ex) => (
                        <option key={ex.id} value={ex.exam_code || ex.id}>
                          {ex.exam_code || ex.title || ex.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="text-muted text-xs" style={{ display: 'block', marginTop: 4 }}>
                  Questions will be bound to this exam code for student assessment delivery.
                </span>
              </div>

              {/* Supported Columns Summary */}
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: 8, padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>
                  📋 5-Column Excel Standard
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  Col 1: <strong>Question</strong> &bull; Col 2: <strong>Option A</strong> &bull; Col 3: <strong>Option B</strong> &bull; Col 4: <strong>Option C</strong> &bull; Col 5: <strong>Option D</strong>
                  <br />
                  Optional extensions: <em>Correct Answer (A-D), Marks, Penalty / Negative Marking, Section, Topic, Difficulty</em>
                </div>
              </div>
            </div>

            {/* Dropzone */}
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
              style={{
                border: '2px dashed rgba(59, 130, 246, 0.4)',
                borderRadius: 12,
                padding: '36px 20px',
                textAlign: 'center',
                background: dragging ? 'rgba(59, 130, 246, 0.1)' : 'rgba(15, 23, 42, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📊</div>
              {file ? (
                <>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
                    ✅ {file.name}
                  </div>
                  <div className="text-muted text-xs">
                    {(file.size / 1024).toFixed(1)} KB &bull; Click or drop another file to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                    Drop your question paper Excel file here
                  </div>
                  <div className="text-muted text-xs">
                    Supports .xlsx and .csv files &bull; Max 5 MB &bull; Click to browse
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                id="btn-download-template"
                onClick={handleDownloadTemplate}
                className="btn btn-outline text-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                📥 Download 5-Column Template (.csv)
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {file && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewData(null); }}
                    className="btn btn-outline text-xs"
                  >
                    Clear File
                  </button>
                )}

              <button
                type="button"
                id="btn-validate-preview"
                onClick={handleValidate}
                disabled={validating || !file}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {validating ? (
                  <>
                    <div className="btn-spinner" />
                    Validating Rows...
                  </>
                ) : (
                  <>
                    🔍 Validate &amp; Preview Questions
                  </>
                )}
              </button>
              </div>
            </div>
          </div>

          {/* Validation & Preview Section */}
          {previewData && (
            <section className="animate-slide-up" style={{ marginBottom: 40 }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ padding: '16px 20px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="text-muted text-xs font-bold uppercase">Total Parsed Rows</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
                    {previewData.total_rows}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <div style={{ color: '#86efac', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Valid Questions</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4ade80', marginTop: 4 }}>
                    {previewData.valid_count}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px', background: previewData.invalid_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(30, 41, 59, 0.5)', border: previewData.invalid_count > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ color: previewData.invalid_count > 0 ? '#fca5a5' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Errors / Needs Attention
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: previewData.invalid_count > 0 ? '#ef4444' : '#94a3b8', marginTop: 4 }}>
                    {previewData.invalid_count}
                  </div>
                </div>
              </div>

              {/* Confirm Import Banner */}
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 12,
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                    Ready to commit question paper to "{examCode.trim() || 'DEFAULT'}"?
                  </div>
                  <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                    {previewData.valid_count} verified question{previewData.valid_count !== 1 ? 's' : ''} will be imported with automated shuffling and negative marking.
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-confirm-import"
                  onClick={handleConfirmImport}
                  disabled={importing || previewData.valid_count === 0}
                  className="btn btn-primary"
                  style={{ padding: '12px 28px', fontWeight: 800, fontSize: '0.92rem', boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)' }}
                >
                  {importing ? (
                    <>
                      <div className="btn-spinner" />
                      Importing to Database...
                    </>
                  ) : (
                    <>
                      ✅ Confirm &amp; Import ({previewData.valid_count} Questions) &rarr;
                    </>
                  )}
                </button>
              </div>

              {/* Error messages if any */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div className="card mb-4" style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.88rem', marginBottom: 8 }}>
                    ⚠️ {previewData.errors.length} Row Validation Warning{previewData.errors.length !== 1 ? 's' : ''}:
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {previewData.errors.map((err, i) => (
                      <div key={i} className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                        &bull; {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                    Parsed Question Preview ({previewData.preview.length} rows)
                  </h3>
                  <span className="text-muted text-xs">
                    Shuffled per candidate during exam session
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 60, color: '#94a3b8' }}>#</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 260, color: '#94a3b8' }}>Question Text</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 280, color: '#94a3b8' }}>Options (A, B, C, D)</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, color: '#94a3b8' }}>Correct</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 110, color: '#94a3b8' }}>Scoring</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', width: 120, color: '#94a3b8' }}>Section / Topic</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, color: '#94a3b8' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((q, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                          }}
                        >
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                            {q.row_number}
                          </td>

                          <td style={{ padding: '12px 14px', color: '#f8fafc', fontWeight: 600 }}>
                            <div>{q.question}</div>
                            {q.errors && q.errors.length > 0 && (
                              <div style={{ marginTop: 4, color: '#f87171', fontSize: '0.75rem' }}>
                                ⚠️ {q.errors.join('; ')}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.76rem' }}>
                              <div style={{ background: q.correct_answer === 'A' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: 4, border: q.correct_answer === 'A' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent' }}>
                                <strong>A:</strong> {q.option_a || '-'}
                              </div>
                              <div style={{ background: q.correct_answer === 'B' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: 4, border: q.correct_answer === 'B' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent' }}>
                                <strong>B:</strong> {q.option_b || '-'}
                              </div>
                              <div style={{ background: q.correct_answer === 'C' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: 4, border: q.correct_answer === 'C' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent' }}>
                                <strong>C:</strong> {q.option_c || '-'}
                              </div>
                              <div style={{ background: q.correct_answer === 'D' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)', padding: '3px 8px', borderRadius: 4, border: q.correct_answer === 'D' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent' }}>
                                <strong>D:</strong> {q.option_d || '-'}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                background: 'rgba(34, 197, 94, 0.2)',
                                color: '#4ade80',
                                border: '1px solid rgba(34, 197, 94, 0.4)',
                              }}
                            >
                              {q.correct_answer}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>+{q.marks} m</div>
                            {q.penalty > 0 ? (
                              <div style={{ fontSize: '0.72rem', color: '#f87171' }}>-{q.penalty} pen</div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>no neg</div>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#cbd5e1' }}>{q.section || 'General'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{q.topic || 'General'} &bull; {q.difficulty}</div>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {q.valid ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: 10 }}>
                                ✅ OK
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 10 }}>
                                ❌ Error
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
