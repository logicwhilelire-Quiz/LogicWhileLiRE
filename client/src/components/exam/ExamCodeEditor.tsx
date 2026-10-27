import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../../lib/config'

const BASE = API_BASE_URL

const LANGUAGES = [
  {
    id: 'python',
    label: 'Python 3',
    ext: '.py',
    comment: '# Write your solution in Python 3\nimport sys\n\ndef solve():\n    lines = sys.stdin.read().splitlines()\n    if not lines: return\n    # Implement logic and print expected output\n    print("True")\n\nif __name__ == "__main__":\n    solve()\n',
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    ext: '.js',
    comment: '// Write your solution in JavaScript (Node.js)\nconst fs = require("fs");\nconst input = fs.readFileSync(0, "utf-8").trim();\n\nconsole.log("True");\n',
  },
  {
    id: 'c++',
    label: 'C++',
    ext: '.cpp',
    comment: '#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string s;\n    if (cin >> s) {\n        cout << "True" << endl;\n    }\n    return 0;\n}\n',
  },
  {
    id: 'java',
    label: 'Java',
    ext: '.java',
    comment: 'import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println("True");\n    }\n}\n',
  },
  {
    id: 'c',
    label: 'C',
    ext: '.c',
    comment: '#include <stdio.h>\n\nint main() {\n    printf("True\\n");\n    return 0;\n}\n',
  },
  {
    id: 'go',
    label: 'Go',
    ext: '.go',
    comment: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("True")\n}\n',
  },
  {
    id: 'rust',
    label: 'Rust',
    ext: '.rs',
    comment: 'fn main() {\n    println!("True");\n}\n',
  },
]

interface TestResult {
  id?: string
  passed: boolean
  input?: string
  expected?: string
  actual?: string
  marks?: number
}

interface RunResult {
  output: string
  stderr?: string
  hasError?: boolean
  verdict?: string
  results?: TestResult[]
  passed?: number
  total?: number
  score?: number
  maxScore?: number
}

interface ExamCodeEditorProps {
  value?: string
  onChange?: (val: string) => void
  language?: string
  readOnly?: boolean
  height?: number
  placeholder?: string
  questionId?: string
  testCases?: Array<{ id: string; input_text: string; is_hidden: boolean; marks?: number }>
  onRunComplete?: (result: RunResult) => void
  showRunButton?: boolean
  onAcceptAnswer?: (code: string) => void
  isAccepted?: boolean
}

/**
 * ExamCodeEditor — High-performance 2D code editor tailored for secure, distraction-free exams.
 * 0% Three.js / WebGL overhead.
 */
export default function ExamCodeEditor({
  value = '',
  onChange,
  language: initialLang = 'python',
  readOnly = false,
  height = 360,
  placeholder,
  questionId,
  testCases = [],
  onRunComplete,
  showRunButton = true,
  onAcceptAnswer,
  isAccepted = false,
}: ExamCodeEditorProps) {
  const [selectedLang, setSelectedLang] = useState(initialLang)
  const [lineCount, setLineCount] = useState(value.split('\n').length || 1)
  const [cursorLine, setCursorLine] = useState(1)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [outputVisible, setOutputVisible] = useState(false)
  const [pasteBlockedNotice, setPasteBlockedNotice] = useState(false)
  const [justAccepted, setJustAccepted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setPasteBlockedNotice(true)
    setTimeout(() => setPasteBlockedNotice(false), 3500)
  }, [])

  const lang = LANGUAGES.find((l) => l.id === selectedLang) || LANGUAGES[0]

  const syncScroll = () => {
    if (textareaRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      onChange?.(val)
      const lines = val.split('\n').length
      setLineCount(lines)
      setCursorLine(val.slice(0, e.target.selectionStart).split('\n').length)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd

      if (e.key === 'Tab') {
        e.preventDefault()
        const indent = '  '
        const newVal = value.slice(0, start) + indent + value.slice(end)
        onChange?.(newVal)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + indent.length
        })
      }

      const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" }
      if (PAIRS[e.key] && start === end) {
        e.preventDefault()
        const newVal = value.slice(0, start) + e.key + PAIRS[e.key] + value.slice(end)
        onChange?.(newVal)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 1
        })
      }
    },
    [value, onChange]
  )

  const switchLanguage = (langId: string) => {
    setSelectedLang(langId)
    const l = LANGUAGES.find((item) => item.id === langId)
    if (l && (!value || value.trim() === '' || value === lang.comment)) {
      onChange?.(l.comment)
      setLineCount(l.comment.split('\n').length)
    }
  }

  const handleRun = useCallback(async () => {
    if (!value.trim() || running) return
    setRunning(true)
    setRunResult(null)
    setOutputVisible(true)

    try {
      const { data } = await axios.post(`${BASE}/api/execute`, {
        language: selectedLang,
        code: value,
        testCases: testCases || [],
        questionId,
      })

      const result: RunResult = {
        output: data.output || data.stdout || '',
        stderr: data.stderr || data.error || '',
        hasError: data.hasError || !!data.stderr,
        verdict: data.verdict || 'Accepted',
        results: data.results || [],
        passed: data.passed,
        total: data.total,
        score: data.score,
        maxScore: data.maxScore,
      }
      setRunResult(result)
      onRunComplete?.(result)
      if (value.trim()) {
        onAcceptAnswer?.(value)
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Execution failed'
      const result: RunResult = { output: '', stderr: msg, hasError: true, verdict: 'Error' }
      setRunResult(result)
      onRunComplete?.(result)
      if (value.trim()) {
        onChange?.(value)
      }
    } finally {
      setRunning(false)
    }
  }, [value, selectedLang, testCases, questionId, running, onRunComplete, onAcceptAnswer, onChange])

  // ─── Language accent colour ─────────────────────────────────────────────────
  const accentColor = useMemo(() => {
    const accents: Record<string, string> = {
      python: '#3B82F6',
      javascript: '#F59E0B',
      'c++': '#8B5CF6',
      java: '#EF4444',
      c: '#06B6D4',
      go: '#10B981',
      rust: '#F97316',
    }
    return accents[selectedLang] || '#2B7FFF'
  }, [selectedLang])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showRunButton) {
        handleRun()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRun, showRunButton])

  const verdictColor = (v?: string) => {
    if (!v || v === 'Accepted') return '#10B981'
    if (v === 'Partial') return '#F59E0B'
    return '#EF4444'
  }

  const lines = Math.max(lineCount, Math.ceil((height - 40) / 21))

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg, 12px)',
        border: `1px solid ${accentColor}40`,
        background: '#080E1C',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 10px 32px rgba(0,0,0,0.6), 0 0 20px ${accentColor}15`,
        height: outputVisible && runResult ? 'auto' : height,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 14px',
          background: `linear-gradient(90deg, ${accentColor}14, rgba(8,14,28,0.95))`,
          borderBottom: `1px solid ${accentColor}28`,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 6px #EF444488' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 6px #F59E0B88' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B98188' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 4, marginLeft: 16 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => switchLanguage(l.id)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: '0.72rem',
                fontWeight: 600,
                border: selectedLang === l.id ? `1px solid ${accentColor}50` : '1px solid transparent',
                background: selectedLang === l.id ? `${accentColor}22` : 'transparent',
                color: selectedLang === l.id ? accentColor : '#4B5563',
                cursor: 'pointer',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            color: 'var(--color-text-faint, #64748B)',
            fontFamily: 'var(--font-mono, monospace)',
            marginLeft: 8,
          }}
        >
          Ln {cursorLine}
        </span>

        {showRunButton && (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-faint, #64748B)', marginLeft: 8 }}>
            Ctrl+↵
          </span>
        )}
      </div>

      {/* Editor Body */}
      <div style={{ display: 'flex', height: height - 40, overflow: 'hidden' }}>
        <div
          ref={lineNumRef}
          style={{
            width: 48,
            flexShrink: 0,
            background: 'rgba(0,0,0,0.3)',
            borderRight: `1px solid ${accentColor}15`,
            overflowY: 'hidden',
            paddingTop: 12,
            userSelect: 'none',
          }}
        >
          {Array.from({ length: lines }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              style={{
                height: 21,
                lineHeight: '21px',
                paddingRight: 12,
                textAlign: 'right',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, monospace)',
                color: n === cursorLine ? accentColor : 'rgba(255,255,255,0.14)',
              }}
            >
              {n}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onClick={() => {
              if (textareaRef.current) {
                setCursorLine(value.slice(0, textareaRef.current.selectionStart).split('\n').length)
              }
            }}
            onKeyUp={() => {
              if (textareaRef.current) {
                setCursorLine(value.slice(0, textareaRef.current.selectionStart).split('\n').length)
              }
            }}
            readOnly={readOnly}
            placeholder={placeholder || lang.comment}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            onPaste={handlePaste}
            onCopy={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onCut={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              width: '100%',
              minHeight: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.88rem',
              lineHeight: '21px',
              color: '#E2E8F0',
              caretColor: accentColor,
              tabSize: 2,
            }}
          />
          {pasteBlockedNotice && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 16,
                background: 'rgba(239, 68, 68, 0.95)',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                pointerEvents: 'none',
              }}
            >
              <span>🛡️</span> Pasting code is blocked by exam strictness rules. Code must be written manually.
            </div>
          )}
        </div>
      </div>

      {/* Run Bar */}
      {showRunButton && (
        <div
          style={{
            borderTop: `1px solid ${accentColor}20`,
            padding: '8px 12px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: `linear-gradient(90deg, ${accentColor}10, rgba(0,0,0,0.3))`,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-success btn-sm"
              onClick={handleRun}
              disabled={running || !value.trim()}
              style={{ minWidth: 110 }}
            >
              {running ? (
                <>
                  <span className="btn-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Running...
                </>
              ) : (
                '▶ Run Code'
              )}
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                if (value.trim()) {
                  onAcceptAnswer?.(value)
                  setJustAccepted(true)
                  setTimeout(() => setJustAccepted(false), 3000)
                }
              }}
              disabled={!value.trim()}
              style={{
                background: isAccepted || justAccepted
                  ? 'rgba(16, 185, 129, 0.22)'
                  : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: '1px solid #10B981',
                color: '#FFFFFF',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 6,
                cursor: value.trim() ? 'pointer' : 'not-allowed',
                opacity: value.trim() ? 1 : 0.6,
                transition: 'all 0.2s ease',
              }}
              title="Accept and securely save this solution as your answer"
            >
              <span>✓</span>
              <span>{isAccepted || justAccepted ? 'Answer Accepted ✓' : 'Accept Solution'}</span>
            </button>
          </div>

          {testCases.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint, #64748B)' }}>
              {testCases.filter((t) => !t.is_hidden).length} public · {testCases.filter((t) => t.is_hidden).length} hidden test cases
            </span>
          )}

          <div style={{ flex: 1 }} />

          {runResult?.verdict && (
            <div
              style={{
                padding: '3px 12px',
                borderRadius: 999,
                background: verdictColor(runResult.verdict) + '18',
                border: `1px solid ${verdictColor(runResult.verdict)}44`,
                color: verdictColor(runResult.verdict),
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {runResult.verdict === 'Accepted' ? '✅' : runResult.verdict === 'Partial' ? '⚡' : '❌'} {runResult.verdict}
            </div>
          )}
        </div>
      )}

      {/* Output Panel */}
      <AnimatePresence>
        {outputVisible && runResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              style={{
                background: '#070C18',
                padding: '12px 16px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-faint, #64748B)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Execution Output
                  </span>
                  {(isAccepted || justAccepted) && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#10B981',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                      }}
                    >
                      ✓ Answer Accepted & Saved
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setOutputVisible(false)
                    setRunResult(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-faint, #64748B)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>

              {runResult.results && runResult.results.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: verdictColor(runResult.verdict) }}>
                      {runResult.passed}/{runResult.total} passed
                    </span>
                    {runResult.maxScore !== undefined && (
                      <span style={{ color: 'var(--color-text-faint, #64748B)', fontSize: '0.75rem' }}>
                        · {runResult.score}/{runResult.maxScore} marks
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {runResult.results.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: r.passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          border: `1px solid ${r.passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: r.input ? 4 : 0 }}>
                          <span style={{ color: r.passed ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                            {r.passed ? '✓' : '✗'} Test {i + 1}
                          </span>
                          {r.marks !== undefined && (
                            <span style={{ color: r.passed ? '#10B981' : 'var(--color-text-faint)', fontSize: '0.72rem' }}>
                              {r.passed ? r.marks : 0}/{r.marks}m
                            </span>
                          )}
                        </div>
                        {r.input && r.input !== '[hidden]' && (
                          <div style={{ color: 'var(--color-text-faint)', fontSize: '0.75rem' }}>
                            In: <code style={{ color: '#93C5FD' }}>{r.input}</code> · Expected:{' '}
                            <code style={{ color: '#86EFAC' }}>{r.expected}</code> · Got:{' '}
                            <code style={{ color: r.passed ? '#86EFAC' : '#FCA5A5' }}>{r.actual}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: runResult.hasError ? '#FCA5A5' : '#86EFAC',
                    lineHeight: 1.6,
                  }}
                >
                  {runResult.stderr || runResult.output || '(no output)'}
                </pre>
              )}

              {/* Accept & Save Answer Action Bar in Output */}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>{isAccepted || justAccepted ? '✅' : '⚡'}</span>
                  <span style={{ color: isAccepted || justAccepted ? '#10B981' : '#94A3B8', fontWeight: 600 }}>
                    {isAccepted || justAccepted
                      ? 'Answer accepted & securely saved into examination attempt'
                      : 'Output generated. Click Accept to submit this solution.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (value.trim()) {
                      onAcceptAnswer?.(value)
                      setJustAccepted(true)
                      setTimeout(() => setJustAccepted(false), 3000)
                    }
                  }}
                  disabled={!value.trim()}
                  style={{
                    background: isAccepted || justAccepted
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    border: '1px solid #10B981',
                    color: '#FFFFFF',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: value.trim() ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: isAccepted ? 'none' : '0 2px 10px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>✓</span>
                  <span>{isAccepted || justAccepted ? 'Solution Accepted ✓' : 'Accept & Save Solution'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
