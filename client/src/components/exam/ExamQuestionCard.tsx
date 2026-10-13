import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  id: string | number
  text: string
  options?: string[]
  type?: 'mcq' | 'code' | 'aptitude'
  topic?: string
  starter_code?: string
  code?: string
}

interface ExamQuestionCardProps {
  question: Question
  onOptionSelect?: (optionIdx: number) => void
  selectedOption?: number | null
  questionIndex: number
  sector?: { name: string; color: string }
}

function detectLanguage(code: string): string {
  if (/\b(def\s+|elif\b|print\(|len\(|range\(|__init__|import\s+numpy)\b/.test(code)) return 'Python'
  if (/\b(console\.log|const\s+|let\s+|function\s*\(|=>)\b/.test(code)) return 'JavaScript'
  if (/\b(public\s+static|System\.out\.println)\b/.test(code)) return 'Java'
  if (/\b(#include|<iostream>|std::cout)\b/.test(code)) return 'C++'
  if (/\b(SELECT|FROM|WHERE|INSERT|UPDATE)\b/i.test(code)) return 'SQL'
  return 'Python'
}

function looksLikeCode(str: string): boolean {
  if (!str || str.trim().length < 6) return false
  const codePatterns = [
    /\b(def|class|function|var|let|const|import|from|while|for|if|elif|else|return|print)\b/,
    /[a-zA-Z_]\w*\s*=[^=]/,
    /(\[.*\]|\{.*\}|\(.*\))\s*$/,
    /\/\/|#include|#define|#\s*/,
    /\b(int|float|void|public|static|bool|char)\s+/,
    /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i,
    /;\s*$/,
    /^\s{2,}|\t/m,
  ]
  let matches = 0
  for (const p of codePatterns) {
    if (p.test(str)) matches++
  }
  return matches >= 2 || (matches >= 1 && str.includes('\n'))
}

interface ParsedContent {
  promptText: string
  codeSnippet: string | null
  language: string
}

function parseQuestionContent(text: string, starterCode?: string | null): ParsedContent {
  if (starterCode && starterCode.trim()) {
    let cleanPrompt = text.replace(starterCode, '').trim()
    cleanPrompt = cleanPrompt.replace(/```[a-z]*\s*[\s\S]*?```/gi, '').trim()
    return {
      promptText: cleanPrompt || text,
      codeSnippet: starterCode.trim(),
      language: detectLanguage(starterCode),
    }
  }

  // Check markdown code blocks: ```lang ... ```
  const fenceMatch = text.match(/```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)```/)
  if (fenceMatch) {
    const prompt = text.replace(fenceMatch[0], '').trim()
    return {
      promptText: prompt,
      codeSnippet: fenceMatch[2].trim(),
      language: fenceMatch[1] ? fenceMatch[1].toUpperCase() : detectLanguage(fenceMatch[2]),
    }
  }

  // Check double newline split
  const splitDouble = text.split(/\n\s*\n/)
  if (splitDouble.length >= 2) {
    const candidateCode = splitDouble.slice(1).join('\n\n').trim()
    if (looksLikeCode(candidateCode)) {
      return {
        promptText: splitDouble[0].trim(),
        codeSnippet: candidateCode,
        language: detectLanguage(candidateCode),
      }
    }
  }

  // Check single newline split by scanning for the first code statement line
  const lines = text.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const candidateCode = lines.slice(i).join('\n').trim()
    const line = lines[i].trim()
    if (
      /^(def\s+|class\s+|function\s+|let\s+|const\s+|var\s+|import\s+|from\s+|#include|int\s+|void\s+|public\s+|[a-zA-Z_]\w*\s*=[^=]|while\s+|for\s+|if\s+)/.test(line) &&
      looksLikeCode(candidateCode)
    ) {
      return {
        promptText: lines.slice(0, i).join('\n').trim(),
        codeSnippet: candidateCode,
        language: detectLanguage(candidateCode),
      }
    }
  }

  return {
    promptText: text,
    codeSnippet: null,
    language: 'plaintext',
  }
}

function formatCodeLine(line: string) {
  // Check comment
  const commentIdx = line.indexOf('#')
  let codePart = line
  let commentPart = ''
  if (commentIdx !== -1) {
    codePart = line.slice(0, commentIdx)
    commentPart = line.slice(commentIdx)
  }

  // Tokenize codePart into tokens
  const tokenRegex = /(".*?"|'.*?'|\b(?:def|return|while|for|in|if|elif|else|break|continue|import|from|as|class|try|except|finally|with|pass|raise|assert|True|False|None|and|or|not|is)\b|\b(?:print|len|range|search|min|max|sum|int|str|list|dict|append)\b|\b\d+\b|[a-zA-Z_]\w*|[=+\-*/<>!&|^~%]+|[^\s\w])/g

  const tokens: Array<{ text: string; type: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(codePart)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: codePart.slice(lastIndex, match.index), type: 'space' })
    }
    const val = match[0]
    let type = 'ident'
    if (val.startsWith('"') || val.startsWith("'")) {
      type = 'string'
    } else if (
      /^(def|return|while|for|in|if|elif|else|break|continue|import|from|as|class|try|except|finally|with|pass|raise|assert|True|False|None|and|or|not|is)$/.test(val)
    ) {
      type = 'keyword'
    } else if (/^(print|len|range|search|min|max|sum|int|str|list|dict|append)$/.test(val)) {
      type = 'builtin'
    } else if (/^\d+$/.test(val)) {
      type = 'number'
    } else if (/^[=+\-*/<>!&|^~%]+$/.test(val)) {
      type = 'operator'
    }
    tokens.push({ text: val, type })
    lastIndex = tokenRegex.lastIndex
  }
  if (lastIndex < codePart.length) {
    tokens.push({ text: codePart.slice(lastIndex), type: 'space' })
  }

  const getColor = (t: string) => {
    switch (t) {
      case 'keyword':
        return '#C084FC' // bright violet
      case 'builtin':
        return '#38BDF8' // cyan/sky blue
      case 'string':
        return '#4ADE80' // emerald green
      case 'number':
        return '#FBBF24' // warm amber
      case 'operator':
        return '#94A3B8' // slate operator
      default:
        return '#F1F5F9' // light text
    }
  }

  return (
    <>
      {tokens.map((tok, i) => (
        <span
          key={i}
          style={{
            color: getColor(tok.type),
            fontWeight: tok.type === 'keyword' ? 700 : 400,
          }}
        >
          {tok.text}
        </span>
      ))}
      {commentPart && (
        <span style={{ color: '#64748B', fontStyle: 'italic' }}>{commentPart}</span>
      )}
    </>
  )
}

function QuestionCodeSnippet({ code, language }: { code: string; language: string }) {
  const lines = useMemo(() => code.split('\n'), [code])

  return (
    <div
      style={{
        margin: '18px 0 24px 0',
        borderRadius: 12,
        background: 'linear-gradient(180deg, #090D16 0%, #060911 100%)',
        border: '1.5px solid rgba(234, 168, 18, 0.28)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(234, 168, 18, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Code Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mac/IDE dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          </div>
          <span
            style={{
              marginLeft: 8,
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#FBBF24',
              background: 'rgba(234, 168, 18, 0.12)',
              border: '1px solid rgba(234, 168, 18, 0.3)',
              padding: '2px 8px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🐍</span>
            <span>{language}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#94A3B8',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '3px 9px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🔒</span>
            <span>Anti-Tamper Locked</span>
          </span>
        </div>
      </div>

      {/* Code Editor Body */}
      <div
        style={{
          display: 'flex',
          padding: '14px 0',
          fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
          fontSize: '0.92rem',
          lineHeight: 1.65,
          overflowX: 'auto',
        }}
      >
        {/* Line Numbers Gutter */}
        <div
          style={{
            userSelect: 'none',
            padding: '0 14px 0 16px',
            textAlign: 'right',
            color: '#475569',
            borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            flexShrink: 0,
            fontSize: '0.82rem',
            lineHeight: 1.65,
          }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code Content */}
        <pre
          style={{
            margin: 0,
            padding: '0 18px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 1.65,
            color: '#F1F5F9',
            whiteSpace: 'pre',
            tabSize: 4,
            flex: 1,
            overflowX: 'auto',
          }}
        >
          {lines.map((line, idx) => (
            <div key={idx}>{formatCodeLine(line) || ' '}</div>
          ))}
        </pre>
      </div>
    </div>
  )
}

/**
 * ExamQuestionCard — Focused, high-contrast, distraction-free question card for exams.
 * Smooth 2D directional transition with zero Three.js overhead.
 */
export default function ExamQuestionCard({
  question,
  onOptionSelect,
  selectedOption,
  questionIndex,
  sector,
}: ExamQuestionCardProps) {
  const [prev, setPrev] = useState(questionIndex)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  useEffect(() => {
    if (questionIndex !== prev) {
      setDirection(questionIndex > prev ? 'next' : 'prev')
      setPrev(questionIndex)
    }
  }, [questionIndex, prev])

  const parsed = useMemo(() => {
    return parseQuestionContent(question.text || '', question.starter_code || question.code)
  }, [question.text, question.starter_code, question.code])

  const LABELS = ['A', 'B', 'C', 'D']

  const slideVariants = {
    enter: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? 24 : -24,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? -24 : 24,
      opacity: 0,
    }),
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="question-card"
            style={{
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(0, 33, 71, 0.95))',
              border: '1.5px solid rgba(234, 168, 18, 0.35)',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(234, 168, 18, 0.15)',
              position: 'relative',
            }}
          >
            {/* Question meta header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#EAA812',
                  }}
                >
                  Question {questionIndex + 1}
                </span>
                {sector && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      background: `${sector.color}15`,
                      border: `1px solid ${sector.color}40`,
                      color: sector.color,
                      boxShadow: `0 0 10px ${sector.color}20`,
                    }}
                  >
                    <span>🪐</span>
                    <span>{sector.name}</span>
                  </span>
                )}
                {question.type && (
                  <span
                    className={`badge ${
                      question.type === 'code'
                        ? 'badge-warning'
                        : question.type === 'aptitude'
                        ? 'badge-primary'
                        : 'badge-neutral'
                    }`}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {question.type.toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                Single Choice
              </span>
            </div>

            {/* Question text / Prompt */}
            <p
              style={{
                fontSize: '1.12rem',
                fontWeight: 600,
                lineHeight: 1.65,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                marginBottom: parsed.codeSnippet ? 12 : 24,
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                WebkitFontSmoothing: 'antialiased',
                whiteSpace: 'pre-line',
              }}
            >
              {parsed.promptText}
            </p>

            {/* Embedded Code Snippet (if question contains code) */}
            {parsed.codeSnippet && (
              <QuestionCodeSnippet
                code={parsed.codeSnippet}
                language={parsed.language}
              />
            )}

            {/* Options list */}
            {question.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx

                  return (
                    <motion.div
                      key={idx}
                      className="exam-option-card"
                      onClick={() => onOptionSelect?.(idx)}
                      whileHover={{ x: 4, borderColor: 'rgba(234, 168, 18, 0.6)' }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 18px',
                        borderRadius: 12,
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(234, 168, 18, 0.18), rgba(0, 33, 71, 0.6))'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isSelected ? '#EAA812' : 'rgba(255, 255, 255, 0.09)'}`,
                        boxShadow: isSelected ? '0 0 20px rgba(234, 168, 18, 0.25)' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                          background: isSelected
                            ? 'linear-gradient(135deg, #EAA812, #D97706)'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#002147' : '#94A3B8',
                          boxShadow: isSelected ? '0 2px 10px rgba(234, 168, 18, 0.5)' : 'none',
                        }}
                      >
                        {isSelected ? '✓' : LABELS[idx]}
                      </div>

                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#FFFFFF' : '#E2E8F0',
                          lineHeight: 1.5,
                          WebkitFontSmoothing: 'antialiased',
                        }}
                      >
                        {opt}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
