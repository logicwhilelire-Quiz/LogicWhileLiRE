import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
}: ExamCodeEditorProps) {
  const [selectedLang, setSelectedLang] = useState(initialLang)
  const [lineCount, setLineCount] = useState(value.split('\n').length || 1)
  const [cursorLine, setCursorLine] = useState(1)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [outputVisible, setOutputVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)

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
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Execution failed'
      const result: RunResult = { output: '', stderr: msg, hasError: true, verdict: 'Error' }
      setRunResult(result)
      onRunComplete?.(result)
    } finally {
      setRunning(false)
    }
  }, [value, selectedLang, testCases, questionId, running, onRunComplete])

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
        border: '1px solid rgba(43, 127, 255, 0.25)',
        background: '#0B1220',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        height: outputVisible && runResult ? 'auto' : height,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 14px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
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
                border: selectedLang === l.id ? '1px solid rgba(43, 127, 255, 0.5)' : '1px solid transparent',
                background: selectedLang === l.id ? 'rgba(43, 127, 255, 0.2)' : 'transparent',
                color: selectedLang === l.id ? '#60A5FA' : 'var(--color-text-faint, #64748B)',
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
            borderRight: '1px solid rgba(255,255,255,0.06)',
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
                color: n === cursorLine ? '#60A5FA' : 'rgba(255,255,255,0.18)',
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
              caretColor: '#2B7FFF',
              tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Run Bar */}
      {showRunButton && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 12px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
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
                maxHeight: 240,
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
