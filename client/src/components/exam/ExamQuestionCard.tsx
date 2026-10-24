import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  id: string | number
  text: string
  options?: string[]
  type?: 'mcq' | 'code' | 'aptitude'
  topic?: string
  section?: string
  marks?: number
  penalty?: number
  difficulty?: string
  starter_code?: string
  code?: string
}

interface ExamQuestionCardProps {
  question: Question
  onOptionSelect?: (optionIdx: number) => void
  onClearSelection?: () => void
  selectedOption?: number | null
  questionIndex: number
  sector?: { name: string; color: string }
  fontSizeScale?: 'normal' | 'large' | 'xl'
}

// ─── Language Detection ───────────────────────────────────────────────────────

function detectLanguage(code: string): string {
  if (/\b(def\s+|elif\b|print\(|len\(|range\(|__init__|import\s+numpy)\b/.test(code)) return 'Python'
  if (/\b(console\.log|const\s+|let\s+|function\s*\(|=>)\b/.test(code)) return 'JavaScript'
  if (/\b(public\s+static|System\.out\.println)\b/.test(code)) return 'Java'
  if (/\b(#include|<iostream>|std::cout)\b/.test(code)) return 'C++'
  if (/\b(fmt\.Println|package\s+main|func\s+main)\b/.test(code)) return 'Go'
  if (/\b(fn\s+main|println!|let\s+mut)\b/.test(code)) return 'Rust'
  if (/\b(SELECT|FROM|WHERE|INSERT|UPDATE)\b/i.test(code)) return 'SQL'
  if (/\b(#include\s*<stdio\.h>|printf\s*\()\b/.test(code)) return 'C'
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

  const fenceMatch = text.match(/```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)```/)
  if (fenceMatch) {
    const prompt = text.replace(fenceMatch[0], '').trim()
    return {
      promptText: prompt,
      codeSnippet: fenceMatch[2].trim(),
      language: fenceMatch[1] ? fenceMatch[1].toUpperCase() : detectLanguage(fenceMatch[2]),
    }
  }

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

// ─── Language Icon & Accent Map ───────────────────────────────────────────────

const LANG_ICON: Record<string, string> = {
  Python: '🐍',
  JavaScript: '🟨',
  Java: '☕',
  'C++': '⚙️',
  C: '🔵',
  Go: '🔷',
  Rust: '🦀',
  SQL: '🗄️',
}

const LANG_ACCENT: Record<string, string> = {
  Python: '#3B82F6',
  JavaScript: '#F59E0B',
  Java: '#EF4444',
  'C++': '#8B5CF6',
  C: '#06B6D4',
  Go: '#10B981',
  Rust: '#F97316',
  SQL: '#EC4899',
}

// ─── Multi-Language Syntax Tokenizer ─────────────────────────────────────────

interface Token { text: string; type: TokenType }
type TokenType =
  | 'keyword' | 'keyword2' | 'builtin' | 'string' | 'number' | 'operator'
  | 'comment' | 'function' | 'type' | 'constant' | 'variable' | 'punctuation' | 'space'

const PYTHON_KW = new Set(['def','return','while','for','in','if','elif','else','break','continue','import','from','as','class','try','except','finally','with','pass','raise','assert','lambda','yield','global','nonlocal','del','is','not','and','or','True','False','None'])
const PYTHON_BI = new Set(['print','len','range','min','max','sum','int','str','list','dict','append','input','open','zip','enumerate','map','filter','sorted','reversed','set','tuple','type','isinstance','hasattr','getattr','setattr','abs','round','float','bool','bytes','format'])
const JS_KW = new Set(['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','class','extends','import','export','from','default','new','this','super','typeof','instanceof','void','delete','in','of','try','catch','finally','throw','async','await','yield','true','false','null','undefined'])
const JS_BI = new Set(['console','Math','Array','Object','String','Number','JSON','Promise','Error','Date','Map','Set','fetch','setTimeout','clearTimeout','setInterval','require','module','process','window','document','parseInt','parseFloat','isNaN','isFinite'])
const JAVA_KW = new Set(['public','private','protected','static','final','void','class','interface','extends','implements','import','package','new','return','if','else','for','while','do','switch','case','break','continue','try','catch','finally','throw','throws','abstract','native','synchronized','enum','true','false','null','this','super','instanceof'])
const JAVA_TY = new Set(['int','long','double','float','char','boolean','byte','short','String','Integer','Long','Double','Float','Boolean','Object','System','Scanner','ArrayList','HashMap','List','Map','Set'])
const CPP_KW = new Set(['int','long','double','float','char','bool','void','unsigned','signed','short','const','static','auto','register','extern','inline','virtual','explicit','friend','class','struct','union','enum','namespace','template','typename','public','private','protected','return','if','else','for','while','do','switch','case','break','continue','try','catch','throw','new','delete','this','nullptr','true','false','using','typedef','sizeof'])
const CPP_BI = new Set(['cout','cin','endl','cerr','string','vector','map','set','pair','stack','queue','printf','scanf','malloc','free','memcpy','strlen','strcmp'])
const GO_KW = new Set(['package','import','func','var','const','type','struct','interface','map','chan','go','defer','select','return','if','else','for','range','switch','case','break','continue','goto','fallthrough','make','new','nil','true','false'])
const GO_BI = new Set(['fmt','Println','Printf','Fprintf','Sprintf','len','cap','append','copy','close','delete','panic','recover','print','println'])
const RUST_KW = new Set(['fn','let','mut','const','static','struct','enum','impl','trait','use','mod','pub','return','if','else','match','for','while','loop','break','continue','in','where','type','unsafe','async','await','move','ref','self','Self','super','crate','true','false'])
const RUST_BI = new Set(['println','print','eprintln','vec','Some','None','Ok','Err','String','Vec','HashMap','i32','i64','u32','u64','f32','f64','bool','char','str','usize','isize'])
const SQL_KW = new Set(['SELECT','FROM','WHERE','INSERT','UPDATE','DELETE','CREATE','DROP','ALTER','TABLE','INDEX','VIEW','DATABASE','JOIN','INNER','LEFT','RIGHT','OUTER','ON','AS','AND','OR','NOT','IN','IS','NULL','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','DISTINCT','ALL','UNION','INTERSECT','EXCEPT','INTO','VALUES','SET','PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE','DEFAULT','CONSTRAINT'])

function tokenize(lang: string, line: string): Token[] {
  const tokens: Token[] = []
  let codePart = line
  let commentPart = ''

  if (lang === 'Python' || lang === 'Go' || lang === 'Rust') {
    const ci = line.indexOf('#')
    if (ci !== -1) { codePart = line.slice(0, ci); commentPart = line.slice(ci) }
  } else if (lang === 'JavaScript' || lang === 'Java' || lang === 'C++' || lang === 'C') {
    const ci = line.indexOf('//')
    if (ci !== -1) { codePart = line.slice(0, ci); commentPart = line.slice(ci) }
  } else if (lang === 'SQL') {
    const ci = line.indexOf('--')
    if (ci !== -1) { codePart = line.slice(0, ci); commentPart = line.slice(ci) }
  }

  const regex = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|0x[0-9a-fA-F]+|\b\d+(?:\.\d+)?\b|[a-zA-Z_]\w*|[=><!\&|+\-*\/%^~]+|[{}()\[\],;.:?]|\s+)/g

  let m: RegExpExecArray | null
  while ((m = regex.exec(codePart)) !== null) {
    const val = m[0]
    let type: TokenType = 'space'

    if (/^\s+$/.test(val)) {
      type = 'space'
    } else if (/^["'`]/.test(val) || val.startsWith('"""') || val.startsWith("'''")) {
      type = 'string'
    } else if (/^(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)$/.test(val)) {
      type = 'number'
    } else if (/^[=><!\&|+\-*\/%^~]+$/.test(val)) {
      type = 'operator'
    } else if (/^[{}()\[\],;.:?]$/.test(val)) {
      type = 'punctuation'
    } else if (/^[a-zA-Z_]\w*$/.test(val)) {
      if (lang === 'Python') {
        if (PYTHON_KW.has(val)) type = 'keyword'
        else if (PYTHON_BI.has(val)) type = 'builtin'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else if (lang === 'JavaScript') {
        if (JS_KW.has(val)) type = 'keyword'
        else if (JS_BI.has(val)) type = 'builtin'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else if (lang === 'Java') {
        if (JAVA_KW.has(val)) type = 'keyword'
        else if (JAVA_TY.has(val)) type = 'type'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else if (lang === 'C++' || lang === 'C') {
        if (CPP_KW.has(val)) type = 'keyword'
        else if (CPP_BI.has(val)) type = 'builtin'
        else if (/^[A-Z_][A-Z0-9_]+$/.test(val)) type = 'constant'
        else type = 'variable'
      } else if (lang === 'Go') {
        if (GO_KW.has(val)) type = 'keyword'
        else if (GO_BI.has(val)) type = 'builtin'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else if (lang === 'Rust') {
        if (RUST_KW.has(val)) type = 'keyword'
        else if (RUST_BI.has(val)) type = 'builtin'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else if (lang === 'SQL') {
        if (SQL_KW.has(val.toUpperCase())) type = 'keyword'
        else if (/^[A-Z]/.test(val)) type = 'type'
        else type = 'variable'
      } else {
        type = 'variable'
      }
    }
    tokens.push({ text: val, type })
  }

  if (commentPart) tokens.push({ text: commentPart, type: 'comment' })
  return tokens
}

// ─── Vibrant Token Colors ─────────────────────────────────────────────────────

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword:     '#C084FC', // vivid violet
  keyword2:    '#F472B6', // hot pink
  builtin:     '#38BDF8', // electric cyan
  string:      '#4ADE80', // neon green
  number:      '#FB923C', // vivid orange
  operator:    '#F1FA8C', // bright yellow
  comment:     '#64748B', // muted slate
  function:    '#60A5FA', // bright blue
  type:        '#34D399', // emerald
  constant:    '#FDE68A', // amber
  variable:    '#E2E8F0', // near-white
  punctuation: '#94A3B8', // cool grey
  space:       'transparent',
}

function renderTokens(tokens: Token[]) {
  return tokens.map((tok, i) => {
    if (tok.type === 'space') return <span key={i}>{tok.text}</span>
    return (
      <span
        key={i}
        style={{
          color: TOKEN_COLORS[tok.type],
          fontWeight: tok.type === 'keyword' || tok.type === 'keyword2' ? 700 : 400,
          fontStyle: tok.type === 'comment' ? 'italic' : 'normal',
          textShadow:
            tok.type !== 'comment' && tok.type !== 'punctuation'
              ? `0 0 10px ${TOKEN_COLORS[tok.type]}50`
              : 'none',
        }}
      >
        {tok.text}
      </span>
    )
  })
}

// ─── QuestionCodeSnippet Component ───────────────────────────────────────────

function QuestionCodeSnippet({ code, language }: { code: string; language: string }) {
  const lines = useMemo(() => code.split('\n'), [code])
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const accentColor = LANG_ACCENT[language] || '#EAA812'
  const langIcon = LANG_ICON[language] || '📄'

  const LEGEND = [
    { label: 'Keyword', color: TOKEN_COLORS.keyword },
    { label: 'Built-in', color: TOKEN_COLORS.builtin },
    { label: 'String', color: TOKEN_COLORS.string },
    { label: 'Number', color: TOKEN_COLORS.number },
    { label: 'Operator', color: TOKEN_COLORS.operator },
    { label: 'Type', color: TOKEN_COLORS.type },
    { label: 'Comment', color: TOKEN_COLORS.comment },
  ]

  return (
    <div
      style={{
        margin: '18px 0 24px 0',
        borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(6,9,18,0.95) 0%, rgba(8,13,24,0.97) 100%)',
        border: `1.5px solid ${accentColor}45`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 24px ${accentColor}18`,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: `linear-gradient(90deg, ${accentColor}18, transparent)`,
          borderBottom: `1px solid ${accentColor}30`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#EF4444', display: 'inline-block', boxShadow: '0 0 6px #EF444488' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', boxShadow: '0 0 6px #F59E0B88' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 6px #10B98188' }} />
          </div>
          <span
            style={{
              marginLeft: 6,
              fontSize: '0.73rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: accentColor,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}40`,
              padding: '2px 10px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: `0 0 10px ${accentColor}25`,
            }}
          >
            <span>{langIcon}</span>
            <span>{language}</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'monospace' }}>
            {lines.length} lines
          </span>
        </div>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#64748B',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 9px',
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

      {/* Code Body */}
      <div
        style={{
          display: 'flex',
          padding: '12px 0',
          fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '0.91rem',
          lineHeight: 1.72,
          maxHeight: 320,
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      >
        {/* Line Numbers */}
        <div
          style={{
            userSelect: 'none',
            padding: '0 12px 0 16px',
            textAlign: 'right',
            borderRight: `1px solid ${accentColor}15`,
            flexShrink: 0,
            fontSize: '0.79rem',
            lineHeight: 1.72,
            minWidth: 42,
          }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              style={{
                color: hoveredLine === i ? accentColor : '#374151',
                transition: 'color 0.15s',
                fontWeight: hoveredLine === i ? 700 : 400,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Lines */}
        <pre
          style={{
            margin: 0,
            padding: '0 20px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 1.72,
            color: '#E2E8F0',
            whiteSpace: 'pre',
            tabSize: 4,
            flex: 1,
            overflowX: 'auto',
          }}
        >
          {lines.map((line, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredLine(idx)}
              onMouseLeave={() => setHoveredLine(null)}
              style={{
                background: hoveredLine === idx ? `${accentColor}12` : 'transparent',
                borderLeft: hoveredLine === idx ? `2px solid ${accentColor}90` : '2px solid transparent',
                paddingLeft: 6,
                marginLeft: -6,
                transition: 'background 0.15s, border-color 0.15s',
                borderRadius: '0 4px 4px 0',
              }}
            >
              {line.trim() === '' ? <span>&nbsp;</span> : renderTokens(tokenize(language, line))}
            </div>
          ))}
        </pre>
      </div>

      {/* Color Legend Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '7px 16px',
          background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          flexWrap: 'wrap',
        }}
      >
        {LEGEND.map(({ label, color }) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 5px ${color}80`,
              }}
            />
            <span style={{ fontSize: '0.62rem', color: '#475569', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Option accent colors (A=violet, B=cyan, C=green, D=orange) ───────────────

const OPTION_ACCENT = ['#C084FC', '#38BDF8', '#4ADE80', '#FB923C']

// ─── Main ExamQuestionCard ────────────────────────────────────────────────────

/**
 * ExamQuestionCard — Multi-language syntax-highlighted, colour-coded question card.
 * Full token colouring: keywords, builtins, strings, numbers, operators, types, comments.
 */
export default function ExamQuestionCard({
  question,
  onOptionSelect,
  onClearSelection,
  selectedOption,
  questionIndex,
  sector,
  fontSizeScale = 'normal',
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
    enter: (dir: 'next' | 'prev') => ({ x: dir === 'next' ? 28 : -28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir: 'next' | 'prev') => ({ x: dir === 'next' ? -28 : 28, opacity: 0 }),
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%' }}
        >
          <div
            className="question-card"
            style={{
              background: 'linear-gradient(145deg, rgba(11,18,34,0.98), rgba(0,28,62,0.97))',
              border: '1.5px solid rgba(234,168,18,0.35)',
              borderRadius: 18,
              padding: '24px 28px 28px',
              boxShadow: '0 15px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(234,168,18,0.12)',
              position: 'relative',
              width: '100%',
              boxSizing: 'border-box',
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
                flexWrap: 'wrap',
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
                    textShadow: '0 0 14px #EAA81255',
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
                      background: `${sector.color}15`,
                      border: `1px solid ${sector.color}40`,
                      color: sector.color,
                      boxShadow: `0 0 12px ${sector.color}22`,
                    }}
                  >
                    <span>🪐</span>
                    <span>{sector.name}</span>
                  </span>
                )}

                {question.section && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 11px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: 'rgba(56, 189, 248, 0.16)',
                      border: '1px solid rgba(56, 189, 248, 0.45)',
                      color: '#38BDF8',
                      boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    <span>📑</span>
                    <span>{question.section}</span>
                  </span>
                )}

                {question.type && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      background:
                        question.type === 'code'
                          ? 'rgba(251,146,60,0.15)'
                          : question.type === 'aptitude'
                          ? 'rgba(96,165,250,0.15)'
                          : 'rgba(148,163,184,0.12)',
                      border:
                        question.type === 'code'
                          ? '1px solid rgba(251,146,60,0.45)'
                          : question.type === 'aptitude'
                          ? '1px solid rgba(96,165,250,0.45)'
                          : '1px solid rgba(148,163,184,0.25)',
                      color:
                        question.type === 'code'
                          ? '#FB923C'
                          : question.type === 'aptitude'
                          ? '#60A5FA'
                          : '#94A3B8',
                    }}
                  >
                    <span>
                      {question.type === 'code' ? '💻' : question.type === 'aptitude' ? '🧠' : '📝'}
                    </span>
                    <span>{question.type.toUpperCase()}</span>
                  </span>
                )}

                {question.marks !== undefined && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(74, 222, 128, 0.14)',
                      border: '1px solid rgba(74, 222, 128, 0.4)',
                      color: '#4ADE80',
                    }}
                  >
                    +{question.marks} {question.marks === 1 ? 'Mark' : 'Marks'}
                  </span>
                )}

                {question.penalty !== undefined && question.penalty > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#F87171',
                    }}
                  >
                    -{question.penalty} Neg
                  </span>
                )}

                {question.difficulty && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background:
                        question.difficulty.toLowerCase() === 'easy'
                          ? 'rgba(52, 211, 153, 0.14)'
                          : question.difficulty.toLowerCase() === 'hard'
                          ? 'rgba(239, 68, 68, 0.14)'
                          : 'rgba(245, 158, 11, 0.14)',
                      border:
                        question.difficulty.toLowerCase() === 'easy'
                          ? '1px solid rgba(52, 211, 153, 0.35)'
                          : question.difficulty.toLowerCase() === 'hard'
                          ? '1px solid rgba(239, 68, 68, 0.35)'
                          : '1px solid rgba(245, 158, 11, 0.35)',
                      color:
                        question.difficulty.toLowerCase() === 'easy'
                          ? '#34D399'
                          : question.difficulty.toLowerCase() === 'hard'
                          ? '#F87171'
                          : '#F59E0B',
                    }}
                  >
                    {question.difficulty.toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedOption !== null && selectedOption !== undefined && onClearSelection && (
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearSelection()
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#F87171',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>✕</span>
                    <span>Clear Selection</span>
                  </motion.button>
                )}
                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  Single Choice
                </span>
              </div>
            </div>

            {/* Question text / Prompt */}
            <p
              style={{
                fontSize:
                  fontSizeScale === 'xl' ? '1.32rem' : fontSizeScale === 'large' ? '1.22rem' : '1.13rem',
                fontWeight: 600,
                lineHeight: 1.68,
                color: '#F1F5F9',
                letterSpacing: '-0.01em',
                marginBottom: parsed.codeSnippet ? 12 : 24,
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                WebkitFontSmoothing: 'antialiased',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {parsed.promptText}
            </p>

            {/* Embedded Code Snippet */}
            {parsed.codeSnippet && (
              <QuestionCodeSnippet code={parsed.codeSnippet} language={parsed.language} />
            )}

            {/* Options */}
            {question.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx
                  const accent = OPTION_ACCENT[idx % OPTION_ACCENT.length]

                  return (
                    <motion.div
                      key={idx}
                      className={`exam-option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isSelected && onClearSelection) {
                          onClearSelection()
                        } else {
                          onOptionSelect?.(idx)
                        }
                      }}
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 18px',
                        borderRadius: 12,
                        background: isSelected
                          ? `linear-gradient(135deg, ${accent}24, rgba(0, 28, 62, 0.75))`
                          : 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isSelected ? accent : 'rgba(255, 255, 255, 0.1)'}`,
                        boxShadow: isSelected ? `0 0 24px ${accent}35, inset 0 0 12px ${accent}15` : 'none',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Label bubble with Shortcut Hint */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          flexShrink: 0,
                          background: isSelected
                            ? `linear-gradient(135deg, ${accent}, ${accent}dd)`
                            : `${accent}18`,
                          color: isSelected ? '#0B1220' : accent,
                          border: `1.5px solid ${isSelected ? 'transparent' : `${accent}35`}`,
                          boxShadow: isSelected ? `0 2px 14px ${accent}60` : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        title={`Select Option ${LABELS[idx]} (or press key '${idx + 1}' / '${LABELS[idx]}')`}
                      >
                        <span style={{ fontSize: isSelected ? '1rem' : '0.88rem', lineHeight: 1 }}>
                          {isSelected ? '✓' : LABELS[idx]}
                        </span>
                        <span style={{ fontSize: '0.55rem', opacity: isSelected ? 0.8 : 0.6, fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                          [{idx + 1}]
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize:
                            fontSizeScale === 'xl'
                              ? '1.18rem'
                              : fontSizeScale === 'large'
                              ? '1.08rem'
                              : '1rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#FFFFFF' : '#CBD5E1',
                          lineHeight: 1.6,
                          WebkitFontSmoothing: 'antialiased',
                          flex: 1,
                          minWidth: 0,
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          userSelect: 'none',
                          transition: 'color 0.2s ease',
                        }}
                      >
                        {opt}
                      </span>

                      {isSelected && (
                        <div
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: `${accent}25`,
                            border: `1px solid ${accent}50`,
                            color: accent,
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          Selected
                        </div>
                      )}
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
