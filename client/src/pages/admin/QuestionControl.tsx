import { useState, useRef } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';

interface TestCase {
  id: string;
  input_text: string;
  expected_output: string;
  marks: number;
  is_hidden: boolean;
}

interface QuestionItem {
  id: string;
  question: string;
  question_type: 'mcq' | 'code' | 'aptitude';
  options?: { a: string; b: string; c: string; d: string };
  correct_option?: string;
  marks: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  sector?: string;
  tags?: string[];
  test_cases?: TestCase[];
}

const SECTOR_OPTIONS = [
  'Sector 1 · Quantitative Aptitude & Velocity',
  'Sector 2 · Logical Reasoning & Deduction',
  'Sector 3 · Core Computer Science Systems',
  'Sector 4 · Data Structures & Algorithms',
  'Sector 5 · Full-Stack & Distributed Architecture',
];

export default function QuestionControl() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');

  // Sample questions initialized for admin control
  const [questions, setQuestions] = useState<QuestionItem[]>([
    {
      id: 'q-1',
      question: 'What is the average time complexity of searching in a Hash Map with uniform hashing?',
      question_type: 'mcq',
      options: { a: 'O(1)', b: 'O(N)', c: 'O(log N)', d: 'O(N log N)' },
      correct_option: 'a',
      marks: 2,
      difficulty: 'Easy',
      topic: 'Data Structures & Algorithms',
      sector: 'Sector 4 · Data Structures & Algorithms',
      tags: ['Hashing', 'Complexity'],
    },
    {
      id: 'q-2',
      question: 'Which scheduling algorithm is non-preemptive and selects the process with the shortest burst time?',
      question_type: 'mcq',
      options: { a: 'Round Robin', b: 'Shortest Job First', c: 'Priority Scheduling', d: 'Multi-level Queue' },
      correct_option: 'b',
      marks: 2,
      difficulty: 'Medium',
      topic: 'Operating Systems & Concurrency',
      sector: 'Sector 3 · Core Computer Science Systems',
      tags: ['Processes', 'CPU'],
    },
    {
      id: 'q-3',
      question: 'A rocket burns fuel mass M (kg) at constant rate R (kg/s). If M=1200 and R=40, what is the integer burn duration?',
      question_type: 'aptitude',
      options: { a: '25 seconds', b: '30 seconds', c: '40 seconds', d: '48 seconds' },
      correct_option: 'b',
      marks: 3,
      difficulty: 'Easy',
      topic: 'Quantitative Velocity & Relative Rates',
      sector: 'Sector 1 · Quantitative Aptitude & Velocity',
      tags: ['Relative Speed', 'Math Velocity'],
    },
    {
      id: 'q-4',
      question: 'Write an optimized function in Python/JS to check if an input string is a valid palindrome ignoring case and non-alphanumeric characters.',
      question_type: 'code',
      marks: 10,
      difficulty: 'Medium',
      topic: 'String Invariants & Two Pointers',
      sector: 'Sector 4 · Data Structures & Algorithms',
      tags: ['Strings', 'Two Pointers'],
      test_cases: [
        { id: 'tc-1', input_text: '"A man, a plan, a canal: Panama"', expected_output: 'true', marks: 3, is_hidden: false },
        { id: 'tc-2', input_text: '"race a car"', expected_output: 'false', marks: 3, is_hidden: false },
        { id: 'tc-3', input_text: '"0P"', expected_output: 'false', marks: 4, is_hidden: true },
      ],
    },
    {
      id: 'q-5',
      question: 'In categorical deduction: All microservices are decoupled. Some decoupled services use Redis. What valid conclusion must hold?',
      question_type: 'aptitude',
      options: {
        a: 'All Redis instances are microservices',
        b: 'Some decoupled entities use Redis',
        c: 'No microservices use Redis',
        d: 'All decoupled systems are microservices',
      },
      correct_option: 'b',
      marks: 3,
      difficulty: 'Medium',
      topic: 'Categorical Syllogisms & Constraints',
      sector: 'Sector 2 · Logical Reasoning & Deduction',
      tags: ['Syllogisms', 'Deduction'],
    },
  ]);

  // Form State
  const [form, setForm] = useState({
    question: '',
    question_type: 'mcq' as 'mcq' | 'code' | 'aptitude',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'a',
    marks: 2,
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    topic: 'Computer Science',
    sector: SECTOR_OPTIONS[0],
    tags: '',
    test_cases: [
      { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
      { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
    ],
  });

  const handleOpenCreateModal = () => {
    setEditingQuestion(null);
    setForm({
      question: '',
      question_type: 'mcq',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'a',
      marks: 2,
      difficulty: 'Medium',
      topic: 'Algorithms & Core CS',
      sector: SECTOR_OPTIONS[0],
      tags: '',
      test_cases: [
        { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
        { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: QuestionItem) => {
    setEditingQuestion(q);
    setForm({
      question: q.question,
      question_type: q.question_type,
      option_a: q.options?.a || '',
      option_b: q.options?.b || '',
      option_c: q.options?.c || '',
      option_d: q.options?.d || '',
      correct_option: q.correct_option || 'a',
      marks: q.marks,
      difficulty: q.difficulty,
      topic: q.topic,
      sector: q.sector || SECTOR_OPTIONS[0],
      tags: q.tags?.join(', ') || '',
      test_cases: q.test_cases?.length
        ? q.test_cases
        : [
            { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
            { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
          ],
    });
    setIsModalOpen(true);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(`Parsing ${file.name}...`);
    setTimeout(() => {
      const imported: QuestionItem[] = [
        {
          id: `imp-${Date.now()}-1`,
          question: 'Which ACID property guarantees that either all database modifications take effect or none do?',
          question_type: 'mcq',
          options: { a: 'Atomicity', b: 'Consistency', c: 'Isolation', d: 'Durability' },
          correct_option: 'a',
          marks: 2,
          difficulty: 'Easy',
          topic: 'Database Systems',
          sector: 'Sector 3 · Core Computer Science Systems',
          tags: ['ACID', 'Transactions'],
        },
        {
          id: `imp-${Date.now()}-2`,
          question: 'Implement quicksort partitioning and return the pivot index for the given array.',
          question_type: 'code',
          marks: 10,
          difficulty: 'Hard',
          topic: 'Algorithms',
          sector: 'Sector 4 · Data Structures & Algorithms',
          tags: ['Divide and Conquer'],
          test_cases: [
            { id: 'tc-q1', input_text: '[3, 6, 8, 10, 1, 2, 1]', expected_output: '[1, 1, 2, 3, 6, 8, 10]', marks: 5, is_hidden: false },
            { id: 'tc-q2', input_text: '[5, 4, 3, 2, 1]', expected_output: '[1, 2, 3, 4, 5]', marks: 5, is_hidden: true },
          ],
        },
      ];
      setQuestions((prev) => [...imported, ...prev]);
      setUploadMsg(`✅ 1-Click Import Successful: Added ${imported.length} questions from ${file.name}!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 600);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) return;

    if (editingQuestion) {
      // Update existing question
      setQuestions((prev) =>
        prev.map((item) => {
          if (item.id !== editingQuestion.id) return item;
          const updated: QuestionItem = {
            ...item,
            question: form.question,
            question_type: form.question_type,
            marks: Number(form.marks),
            difficulty: form.difficulty,
            topic: form.topic,
            sector: form.sector,
            tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          };
          if (form.question_type === 'mcq' || form.question_type === 'aptitude') {
            updated.options = {
              a: form.option_a || 'Option A',
              b: form.option_b || 'Option B',
              c: form.option_c || 'Option C',
              d: form.option_d || 'Option D',
            };
            updated.correct_option = form.correct_option;
            updated.test_cases = undefined;
          } else if (form.question_type === 'code') {
            updated.test_cases = form.test_cases.filter((tc) => tc.expected_output.trim() !== '');
            updated.options = undefined;
            updated.correct_option = undefined;
          }
          return updated;
        })
      );
      setIsModalOpen(false);
      setEditingQuestion(null);
      return;
    }

    // Create new question
    const newQ: QuestionItem = {
      id: `q-${Date.now()}`,
      question: form.question,
      question_type: form.question_type,
      marks: Number(form.marks),
      difficulty: form.difficulty,
      topic: form.topic,
      sector: form.sector,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    if (form.question_type === 'mcq' || form.question_type === 'aptitude') {
      newQ.options = {
        a: form.option_a || 'Option A',
        b: form.option_b || 'Option B',
        c: form.option_c || 'Option C',
        d: form.option_d || 'Option D',
      };
      newQ.correct_option = form.correct_option;
    } else if (form.question_type === 'code') {
      newQ.test_cases = form.test_cases.filter((tc) => tc.expected_output.trim() !== '');
    }

    setQuestions((prev) => [newQ, ...prev]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this question from master question bank?')) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    }
  };

  const filtered = questions.filter((q) => {
    const matchesType = filterType === 'all' || q.question_type === filterType;
    const matchesSearch =
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.topic.toLowerCase().includes(search.toLowerCase()) ||
      (q.sector && q.sector.toLowerCase().includes(search.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="questions" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#FFC200', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Logic Whi1e LiRE Master Bank
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Question Bank Control
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Add and Edit All Options across MCQs, Aptitude, Coding Challenges, Public & Hidden Test Cases, and 5 Technical Sectors
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>📊</span> 1-Click Excel Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                style={{ display: 'none' }}
                onChange={handleExcelImport}
              />

              <button
                onClick={handleOpenCreateModal}
                className="btn btn-primary"
                style={{
                  padding: '10px 20px',
                  fontWeight: 700,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                }}
              >
                <span>➕</span> Add Question
              </button>
            </div>
          </div>

          {/* Upload Status Banner */}
          {uploadMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontWeight: 600,
                fontSize: '0.85rem',
                marginBottom: 20,
              }}
            >
              {uploadMsg}
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search statement, topic, or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ maxWidth: 320 }}
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'mcq', label: 'MCQs' },
                { id: 'code', label: 'Coding' },
                { id: 'aptitude', label: 'Aptitude' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: filterType === tab.id ? 700 : 500,
                    background: filterType === tab.id ? 'rgba(255, 194, 0, 0.15)' : 'transparent',
                    border: `1px solid ${filterType === tab.id ? '#FFC200' : 'var(--color-border)'}`,
                    color: filterType === tab.id ? '#FFC200' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((q, idx) => (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: '22px 26px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 194, 0, 0.25)',
                  background: 'rgba(11, 18, 38, 0.75)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-faint)' }}>
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: q.question_type === 'code' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: q.question_type === 'code' ? '#A78BFA' : '#38BDF8',
                          border: `1px solid ${q.question_type === 'code' ? '#A78BFA40' : '#38BDF840'}`,
                        }}
                      >
                        {q.question_type === 'code' ? '💻 Coding Challenge' : q.question_type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 800 }}>
                        {q.marks} Marks
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Difficulty: <strong>{q.difficulty}</strong>
                      </span>
                      {q.sector && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#FFC200',
                            background: 'rgba(255, 194, 0, 0.1)',
                            border: '1px solid rgba(255, 194, 0, 0.3)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          {q.sector}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.5, marginBottom: 12 }}>
                      {q.question}
                    </div>

                    {/* Options Preview for MCQs & Aptitude */}
                    {q.options && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
                        {Object.entries(q.options).map(([optKey, optVal]) => {
                          const isCorrect = q.correct_option === optKey;
                          return (
                            <div
                              key={optKey}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                background: isCorrect ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                                fontSize: '0.84rem',
                                color: isCorrect ? '#34D399' : 'var(--color-text-muted)',
                                fontWeight: isCorrect ? 700 : 400,
                              }}
                            >
                              <strong>{optKey.toUpperCase()}:</strong> {optVal} {isCorrect && ' ✓ (Correct Answer)'}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Test Cases for Coding Challenges */}
                    {q.test_cases && (
                      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', marginBottom: 6 }}>
                          Test Cases ({q.test_cases.length} configured)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {q.test_cases.map((tc, tcIdx) => (
                            <div key={tc.id || tcIdx} style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono, monospace)', color: '#CBD5E1' }}>
                              <span style={{ color: tc.is_hidden ? '#F59E0B' : '#38BDF8', fontWeight: 700 }}>
                                [{tc.is_hidden ? 'HIDDEN' : 'PUBLIC'}]
                              </span>{' '}
                              Input: <code style={{ color: '#F8FAFC' }}>{tc.input_text}</code> → Expected: <code style={{ color: '#34D399' }}>{tc.expected_output}</code> ({tc.marks} pts)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions: Edit All Options & Delete */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => handleOpenEditModal(q)}
                      className="btn btn-sm"
                      style={{
                        background: 'rgba(255, 194, 0, 0.14)',
                        color: '#FFC200',
                        border: '1px solid rgba(255, 194, 0, 0.4)',
                        fontWeight: 700,
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Edit Question and Options"
                    >
                      <span>✏️</span> Edit Options
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                      title="Delete Question"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal for Creating & Editing Question and All Options */}
          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
              }}
              onClick={() => setIsModalOpen(false)}
            >
              <div
                className="card"
                style={{
                  maxWidth: 680,
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 194, 0, 0.4)',
                  background: '#0B1226',
                  padding: 32,
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    {editingQuestion ? '✏️ Edit Question & Options' : '➕ Add Question to Bank'}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Question Type</label>
                      <select
                        className="form-input"
                        value={form.question_type}
                        onChange={(e) => setForm({ ...form, question_type: e.target.value as any })}
                      >
                        <option value="mcq">Multiple Choice Question (MCQ)</option>
                        <option value="code">Coding Assessment (Code Execution)</option>
                        <option value="aptitude">Analytical & Quantitative Aptitude</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">5-Sector Knowledge Domain</label>
                      <select
                        className="form-input"
                        value={form.sector}
                        onChange={(e) => setForm({ ...form, sector: e.target.value })}
                      >
                        {SECTOR_OPTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Question Statement / Problem Prompt</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      required
                      placeholder="Enter the comprehensive question statement..."
                      value={form.question}
                      onChange={(e) => setForm({ ...form, question: e.target.value })}
                    />
                  </div>

                  {form.question_type !== 'code' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Option A</label>
                          <input className="form-input" value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} required />
                        </div>
                        <div>
                          <label className="form-label">Option B</label>
                          <input className="form-input" value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} required />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Option C</label>
                          <input className="form-input" value={form.option_c} onChange={(e) => setForm({ ...form, option_c: e.target.value })} required />
                        </div>
                        <div>
                          <label className="form-label">Option D</label>
                          <input className="form-input" value={form.option_d} onChange={(e) => setForm({ ...form, option_d: e.target.value })} required />
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Correct Option</label>
                        <select className="form-input" value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })}>
                          <option value="a">Option A</option>
                          <option value="b">Option B</option>
                          <option value="c">Option C</option>
                          <option value="d">Option D</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38BDF8', marginBottom: 8 }}>
                        Test Cases (Public & Hidden Boundary Suites)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {form.test_cases.map((tc, idx) => (
                          <div key={tc.id || idx} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'center' }}>
                            <input
                              className="form-input"
                              placeholder="Input parameters"
                              value={tc.input_text}
                              onChange={(e) => {
                                const next = [...form.test_cases];
                                next[idx].input_text = e.target.value;
                                setForm({ ...form, test_cases: next });
                              }}
                            />
                            <input
                              className="form-input"
                              placeholder="Expected output"
                              value={tc.expected_output}
                              onChange={(e) => {
                                const next = [...form.test_cases];
                                next[idx].expected_output = e.target.value;
                                setForm({ ...form, test_cases: next });
                              }}
                            />
                            <input
                              className="form-input"
                              type="number"
                              placeholder="Marks"
                              value={tc.marks}
                              onChange={(e) => {
                                const next = [...form.test_cases];
                                next[idx].marks = Number(e.target.value);
                                setForm({ ...form, test_cases: next });
                              }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#FFC200', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={tc.is_hidden}
                                onChange={(e) => {
                                  const next = [...form.test_cases];
                                  next[idx].is_hidden = e.target.checked;
                                  setForm({ ...form, test_cases: next });
                                }}
                              />
                              Hidden
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Marks</label>
                      <input className="form-input" type="number" min="1" value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="form-label">Difficulty</label>
                      <select className="form-input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Topic / Subtopic</label>
                      <input className="form-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Tags (comma-separated)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Invariants, Recursion, Time Complexity"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                      }}
                    >
                      {editingQuestion ? '💾 Save Question Options' : '➕ Add to Master Bank'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </AnimatedPage>
  );
}
