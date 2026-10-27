import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { validateAndPreviewQuestions, confirmImportQuestions, listExams } from '../../lib/api';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';

interface PreviewItem {
  row_number: number;
  valid: boolean;
  type?: 'MCQ' | 'Coding' | 'Aptitude' | 'Diagram';
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
  diagram_url?: string;
  test_cases?: string;
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
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [skippedRows, setSkippedRows] = useState<Array<{ row_number: number; question: string; errors?: string[] }>>([]);

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
    const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const facultyToken = localStorage.getItem('faculty_token') || sessionStorage.getItem('faculty_token');

    if (!adminToken && !facultyToken) {
      navigate('/admin');
      return;
    }

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
  }, [defaultExamId, navigate]);

  function handleFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.csv')) {
      setGeneralError('Only Excel (.xlsx) or CSV (.csv) files are supported.');
      return;
    }
    setFile(f);
    setPreviewData(null);
    setImportSuccess(null);
    setSkippedRows([]);
    setGeneralError(null);
  }

  async function handleDownloadXlsxTemplate() {
    try {
      const res = await fetch('/api/admin/questions/sample-template');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'LogicWhileLiRE_Questions_Template.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}

    try {
      const templateData = [
        {
          Question: 'Which of the following is an essential precondition for Binary Search to work correctly?',
          'Option A': 'The array elements must be unique',
          'Option B': 'The array must be sorted in ascending or descending order',
          'Option C': 'The array size must be a power of 2',
          'Option D': 'The array must contain only positive integers',
          'Correct Answer': 'B',
          Marks: 1,
          Penalty: 0,
          Section: 'Searching Algorithms',
          Topic: 'Linear Search & Binary Search',
          Difficulty: 'Easy',
        },
        {
          Question: 'What is the worst-case time complexity of Linear Search on an array of size n?',
          'Option A': 'O(1)',
          'Option B': 'O(log n)',
          'Option C': 'O(n)',
          'Option D': 'O(n^2)',
          'Correct Answer': 'C',
          Marks: 1,
          Penalty: 0,
          Section: 'Searching Algorithms',
          Topic: 'Linear Search & Binary Search',
          Difficulty: 'Easy',
        },
        {
          Question: 'What is the output of the following Python code?\n\narr = [1, 3, 5, 7, 9]\nlow, high = 0, len(arr) - 1\ntarget = 7\nwhile low <= high:\n    mid = (low + high) // 2\n    if arr[mid] == target:\n        print(mid)\n        break\n    elif arr[mid] < target:\n        low = mid + 1\n    else:\n        high = mid - 1',
          'Option A': '2',
          'Option B': '3',
          'Option C': '4',
          'Option D': '-1',
          'Correct Answer': 'B',
          Marks: 1,
          Penalty: 0,
          Section: 'Searching Algorithms',
          Topic: 'Linear Search & Binary Search',
          Difficulty: 'Medium',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'LogicWhileLiRE_Questions_Template.xlsx');
    } catch (err: any) {
      setGeneralError('Failed to generate template: ' + (err.message || 'Unknown error'));
    }
  }

  function handleDownloadCsvTemplate() {
    const csvContent =
      'Type,Question,Option A,Option B,Option C,Option D,Correct Answer,Marks,Penalty,Section,Topic,Difficulty\n' +
      '"MCQ","Which of the following is an essential precondition for Binary Search to work correctly?","The array elements must be unique","The array must be sorted in ascending or descending order","The array size must be a power of 2","The array must contain only positive integers","B",1,0,"Searching Algorithms","Linear Search & Binary Search","Easy"\n' +
      '"Coding","What is the output of the following Python code?\n\narr = [1, 3, 5, 7, 9]\nlow, high = 0, len(arr) - 1\ntarget = 7\nwhile low <= high:\n    mid = (low + high) // 2\n    if arr[mid] == target:\n        print(mid)\n        break\n    elif arr[mid] < target:\n        low = mid + 1\n    else:\n        high = mid - 1","2","3","4","-1","B",1,0,"Searching Algorithms","Linear Search & Binary Search","Medium"\n';

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
    setSkippedRows([]);

    // 1. Try server-side validation first
    try {
      const res = await validateAndPreviewQuestions(file);
      if (res.data?.success && res.data?.preview?.length > 0) {
        setPreviewData(res.data);
        setValidating(false);
        return;
      }
    } catch (err: any) {
      console.warn('Server validation deferred, utilizing resilient client-side XLSX parser...', err);
    }

    // 2. Client-side XLSX Parser
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const preview: PreviewItem[] = [];
      const globalErrors: string[] = [];

      rawRows.forEach((row, idx) => {
        const rowNumber = idx + 2;
        const getField = (...keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(
              (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
            );
            if (foundKey && String(row[foundKey]).trim()) {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        const question = getField('Question', 'Question Text', 'QuestionText', 'QText');
        const optA = getField('Option A', 'OptionA', 'Option_A', 'A');
        const optB = getField('Option B', 'OptionB', 'Option_B', 'B');
        const optC = getField('Option C', 'OptionC', 'Option_C', 'C');
        const optD = getField('Option D', 'OptionD', 'Option_D', 'D');
        const correctRaw = getField('Correct Answer', 'CorrectAnswer', 'Correct Option', 'Correct', 'Answer');
        const marksRaw = getField('Marks', 'Mark', 'Points');
        const penaltyRaw = getField('Penalty', 'Negative', 'Negative Marks', 'Penalty Marks');
        const section = getField('Section', 'Category', 'Domain') || 'Searching Algorithms';
        const topic = getField('Topic', 'Subtopic') || 'Linear Search & Binary Search';
        const difficultyRaw = getField('Difficulty', 'Level') || 'Medium';

        const rowErrors: string[] = [];
        if (!question) rowErrors.push('Missing question text.');
        if (!optA) rowErrors.push('Missing Option A.');
        if (!optB) rowErrors.push('Missing Option B.');

        let correct = (correctRaw || 'A').toUpperCase();
        if (correct.startsWith('OPTION')) correct = correct.replace('OPTION', '').trim();
        if (!['A', 'B', 'C', 'D'].includes(correct)) {
          if (correct === optA.toUpperCase()) correct = 'A';
          else if (correct === optB.toUpperCase()) correct = 'B';
          else if (correct === optC.toUpperCase()) correct = 'C';
          else if (correct === optD.toUpperCase()) correct = 'D';
          else correct = 'A';
        }

        const marks = Number(marksRaw) > 0 ? Number(marksRaw) : 1;
        const penalty = Number(penaltyRaw) >= 0 ? Number(penaltyRaw) : 0;
        let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
        if (difficultyRaw.toLowerCase().includes('easy')) difficulty = 'Easy';
        else if (difficultyRaw.toLowerCase().includes('hard')) difficulty = 'Hard';

        const isCodingSnippet =
          question.includes('\n') &&
          (/\b(def|while|for|if|elif|else|print|arr|len|mid|return)\b/.test(question));

        const item: PreviewItem = {
          row_number: rowNumber,
          valid: rowErrors.length === 0,
          type: isCodingSnippet ? 'Coding' : 'MCQ',
          question,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          correct_answer: correct,
          marks,
          penalty,
          section,
          topic,
          difficulty,
          errors: rowErrors,
        };
        preview.push(item);
      });

      const validCount = preview.filter((p) => p.valid).length;
      const invalidCount = preview.length - validCount;

      setPreviewData({
        total_rows: preview.length,
        valid_count: validCount,
        invalid_count: invalidCount,
        preview,
        errors: globalErrors,
        can_import: validCount > 0,
      });
    } catch (parseErr: any) {
      setGeneralError('Failed to parse Excel file: ' + (parseErr.message || 'Unknown error'));
    } finally {
      setValidating(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewData || !previewData.preview || previewData.preview.length === 0) {
      setGeneralError('No validated questions available for import.');
      return;
    }
    const targetCode = examCode.trim().toUpperCase();
    if (!targetCode) {
      setGeneralError('Please enter an Exam Code before importing questions.');
      return;
    }
    const validQuestions = previewData.preview.filter((q) => q.valid);

    if (validQuestions.length === 0) {
      setGeneralError('Cannot import: 0 valid questions found in preview. Please fix row errors.');
      return;
    }

    setImporting(true);
    setGeneralError(null);

    // Commit strictly to the central database under authoritative Admin Control
    try {
      await confirmImportQuestions({
        examCode: targetCode,
        examId: targetCode,
        questions: validQuestions,
      });
      setImportSuccess(`Successfully imported ${validQuestions.length} questions into exam "${targetCode}"! Questions are committed to the central database under Admin Control.`);
      setFile(null);
      setPreviewData(null);
    } catch (err: any) {
      console.error('Backend import commit failed:', err);
      setGeneralError(err.response?.data?.message || err.message || 'Failed to commit questions to the database. Ensure server is reachable.');
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
                    placeholder="e.g. GR-UNIV-001 or CS2026-A"
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="btn-download-xlsx-template"
                  onClick={handleDownloadXlsxTemplate}
                  className="btn btn-secondary text-xs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  📥 Download 2-Sheet Excel Template (.xlsx)
                </button>
                <button
                  type="button"
                  id="btn-download-csv-template"
                  onClick={handleDownloadCsvTemplate}
                  className="btn btn-outline text-xs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  📄 Legacy CSV (.csv)
                </button>
              </div>

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

          {/* Skipped Rows Report (if import skipped invalid rows) */}
          {skippedRows.length > 0 && (
            <div className="card mb-4 animate-slide-up" style={{ padding: '18px 22px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 800, fontSize: '0.96rem', marginBottom: 6 }}>
                <span>⚠️</span>
                <span>{skippedRows.length} Invalid Question{skippedRows.length > 1 ? 's' : ''} Skipped During Import:</span>
              </div>
              <p className="text-muted text-xs" style={{ margin: '0 0 10px 0' }}>
                Only verified valid questions were committed to the assessment vault. Please correct the rows below in your Excel sheet and re-upload:
              </p>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {skippedRows.map((sr, idx) => (
                  <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fca5a5' }}>
                      Row {sr.row_number}: {sr.question || 'Untitled Question'}
                    </div>
                    {sr.errors && sr.errors.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {sr.errors.map((e, eIdx) => (
                          <span key={eIdx} style={{ color: '#fee2e2', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                            &bull; {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    Ready to commit verified questions to "{examCode.trim() || 'DEFAULT'}"?
                  </div>
                  <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                    {previewData.valid_count} verified question{previewData.valid_count !== 1 ? 's' : ''} will be imported into the active exam.
                    {previewData.invalid_count > 0 && (
                      <span style={{ color: '#fca5a5', marginLeft: 4 }}>
                        ({previewData.invalid_count} invalid row{previewData.invalid_count > 1 ? 's' : ''} will be skipped and reported)
                      </span>
                    )}
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
                      ✅ Confirm &amp; Import ({previewData.valid_count} Valid Questions) &rarr;
                    </>
                  )}
                </button>
              </div>

              {/* Preview Filter Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`btn text-xs ${filterTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 14px', borderRadius: 20 }}
                >
                  All Rows ({previewData.total_rows})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  className={`btn text-xs ${filterTab === 'valid' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 14px', borderRadius: 20 }}
                >
                  ✅ Valid Only ({previewData.valid_count})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('invalid')}
                  className={`btn text-xs ${filterTab === 'invalid' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 14px', borderRadius: 20 }}
                >
                  ❌ Errors Only ({previewData.invalid_count})
                </button>
              </div>

              {/* Preview Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                    Parsed Question Preview
                  </h3>
                  <span className="text-muted text-xs">
                    Green = Valid &amp; Ready &bull; Red = Validation Errors
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, color: '#94a3b8' }}>Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, color: '#94a3b8' }}>Type</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 260, color: '#94a3b8' }}>Question Text</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: 280, color: '#94a3b8' }}>Options / Specifications</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, color: '#94a3b8' }}>Correct</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 100, color: '#94a3b8' }}>Scoring</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', width: 120, color: '#94a3b8' }}>Section / Topic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview
                        .filter((q) => {
                          if (filterTab === 'valid') return q.valid;
                          if (filterTab === 'invalid') return !q.valid;
                          return true;
                        })
                        .map((q, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              background: q.valid ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.08)',
                              borderLeft: q.valid ? '4px solid #22c55e' : '4px solid #ef4444',
                            }}
                          >
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#64748b' }}>
                                #{q.row_number}
                              </div>
                              {q.valid ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4ade80', background: 'rgba(34, 197, 94, 0.2)', padding: '2px 8px', borderRadius: 8, display: 'inline-block', marginTop: 4, border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                                  VALID
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 8px', borderRadius: 8, display: 'inline-block', marginTop: 4, border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                                  INVALID
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background:
                                    q.type === 'Coding'
                                      ? 'rgba(147, 51, 234, 0.2)'
                                      : q.type === 'Diagram'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : q.type === 'Aptitude'
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : 'rgba(59, 130, 246, 0.2)',
                                  color:
                                    q.type === 'Coding'
                                      ? '#c084fc'
                                      : q.type === 'Diagram'
                                      ? '#fbbf24'
                                      : q.type === 'Aptitude'
                                      ? '#34d399'
                                      : '#60a5fa',
                                  border: '1px solid currentColor',
                                }}
                              >
                                {q.type || 'MCQ'}
                              </span>
                            </td>

                            <td style={{ padding: '12px 14px', color: '#f8fafc', fontWeight: 600 }}>
                              <div>{q.question}</div>
                              {q.errors && q.errors.length > 0 && (
                                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                                  <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.74rem', marginBottom: 2 }}>
                                    ⚠️ VALIDATION ERROR{q.errors.length > 1 ? 'S' : ''}:
                                  </div>
                                  {q.errors.map((err, eIdx) => (
                                    <div key={eIdx} style={{ color: '#fee2e2', fontSize: '0.73rem', fontFamily: 'monospace' }}>
                                      &bull; {err}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '12px 14px' }}>
                              {q.type === 'Coding' ? (
                                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c084fc', marginBottom: 2 }}>
                                    🧪 Test Cases Specification:
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontFamily: 'monospace', maxHeight: 60, overflowY: 'auto' }}>
                                    {q.test_cases || '(No test cases provided)'}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {q.diagram_url && (
                                    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#fbbf24' }}>
                                      <span>🖼️</span>
                                      <a href={q.diagram_url} target="_blank" rel="noreferrer" style={{ color: '#fbbf24', textDecoration: 'underline' }}>
                                        View Diagram Image
                                      </a>
                                    </div>
                                  )}
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
                                </>
                              )}
                            </td>

                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 8,
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  color: '#4ade80',
                                  border: '1px solid rgba(34, 197, 94, 0.4)',
                                  maxWidth: 120,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {q.correct_answer || '-'}
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
