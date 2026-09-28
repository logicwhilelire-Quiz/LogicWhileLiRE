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
  tags?: string[];
  test_cases?: TestCase[];
}

export default function QuestionControl() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      topic: 'Data Structures',
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
      topic: 'Operating Systems',
      tags: ['Processes', 'CPU'],
    },
    {
      id: 'q-3',
      question: 'Write an optimized function in Python/JS to check if an input string is a valid palindrome ignoring case and alphanumeric characters.',
      question_type: 'code',
      marks: 10,
      difficulty: 'Medium',
      topic: 'Algorithms',
      tags: ['Strings', 'Two Pointers'],
      test_cases: [
        { id: 'tc-1', input_text: '"A man, a plan, a canal: Panama"', expected_output: 'true', marks: 3, is_hidden: false },
        { id: 'tc-2', input_text: '"race a car"', expected_output: 'false', marks: 3, is_hidden: false },
        { id: 'tc-3', input_text: '"0P"', expected_output: 'false', marks: 4, is_hidden: true }, // Admin only hidden test
      ],
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
    tags: '',
    test_cases: [
      { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
      { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
    ],
  });

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(`Parsing ${file.name}...`);
    setTimeout(() => {
      // 1-Click mock ingestion from 5-column format
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
          tags: ['ACID', 'Transactions'],
        },
        {
          id: `imp-${Date.now()}-2`,
          question: 'Implement quicksort partitioning and return the pivot index for the given array.',
          question_type: 'code',
          marks: 10,
          difficulty: 'Hard',
          topic: 'Algorithms',
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

    const newQ: QuestionItem = {
      id: `q-${Date.now()}`,
      question: form.question,
      question_type: form.question_type,
      marks: Number(form.marks),
      difficulty: form.difficulty,
      topic: form.topic,
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
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const filtered = questions.filter((q) => {
    const matchesType = filterType === 'all' || q.question_type === filterType;
    const matchesSearch =
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.topic.toLowerCase().includes(search.toLowerCase());
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
              <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Admin Master Bank
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Question Bank Control
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Manage MCQs, Coding Challenges, Public & Hidden Test Cases, and 1-Click Excel Ingestion
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
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
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
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search questions or topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ maxWidth: 320 }}
            />

            <div style={{ display: 'flex', gap: 6 }}>
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
                    background: filterType === tab.id ? 'rgba(43, 127, 255, 0.15)' : 'transparent',
                    border: `1px solid ${filterType === tab.id ? 'rgba(43, 127, 255, 0.4)' : 'var(--color-border)'}`,
                    color: filterType === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((q, idx) => (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: '20px 24px',
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  background: 'rgba(11, 18, 38, 0.65)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-faint)' }}>
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: q.question_type === 'code' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(43, 127, 255, 0.2)',
                          color: q.question_type === 'code' ? '#A78BFA' : 'var(--color-primary)',
                        }}
                      >
                        {q.question_type === 'code' ? '💻 Coding Challenge' : q.question_type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700 }}>
                        {q.marks} Marks
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Difficulty: {q.difficulty}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                        Topic: {q.topic}
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.5 }}>
                      {q.question}
                    </div>

                    {/* Options Preview for MCQs */}
                    {q.options && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                        {Object.entries(q.options).map(([optKey, optVal]) => {
                          const isCorrect = q.correct_option === optKey;
                          return (
                            <div
                              key={optKey}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
                                fontSize: '0.82rem',
                                color: isCorrect ? '#10B981' : 'var(--color-text-muted)',
                                fontWeight: isCorrect ? 700 : 400,
                              }}
                            >
                              <strong>{optKey.toUpperCase()}:</strong> {optVal} {isCorrect && '✓ (Correct)'}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Test Cases for Coding Challenges */}
                    {q.test_cases && (
                      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Test Cases ({q.test_cases.length} configured)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {q.test_cases.map((tc) => (
                            <div key={tc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>
                                Input: {tc.input_text} → Expected: <span style={{ color: '#10B981' }}>{tc.expected_output}</span>
                              </span>
                              <span>
                                {tc.is_hidden ? (
                                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>🔒 Hidden (Admin Only)</span>
                                ) : (
                                  <span style={{ color: '#60A5FA' }}>👁️ Public</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(q.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#EF4444', flexShrink: 0 }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Modal */}
          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 8, 20, 0.85)',
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
                  maxWidth: 640,
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  borderRadius: 14,
                  border: '1px solid rgba(43, 127, 255, 0.3)',
                  background: '#0B1226',
                  padding: 32,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    ❓ Author Question (Admin Only)
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="form-label">Question Type</label>
                    <select
                      className="form-input"
                      value={form.question_type}
                      onChange={(e) => setForm({ ...form, question_type: e.target.value as any })}
                    >
                      <option value="mcq">Multiple Choice Question (MCQ)</option>
                      <option value="code">Coding Assessment (Sandboxed Runtime)</option>
                      <option value="aptitude">Analytical & Quantitative Aptitude</option>
                    </select>
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                        Test Cases (Public & Hidden)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {form.test_cases.map((tc, idx) => (
                          <div key={tc.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'center' }}>
                            <input
                              className="form-input"
                              placeholder="Input string/args"
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#F59E0B' }}>
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
                      <label className="form-label">Topic</label>
                      <input className="form-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                      Add to Master Bank
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
