import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../../components/AnimatedPage';
import AdminSidebar from '../../components/layout/AdminSidebar';
import {
  listQuestionBank,
  createQuestionBankItem,
  updateQuestionBankItem,
  deleteQuestionBankItem,
  listColleges,
} from '../../lib/api';

interface TestCase {
  id?: string;
  input_text?: string;
  expected_output?: string;
  input?: string;
  output?: string;
  marks?: number;
  is_hidden?: boolean;
}

interface QuestionItem {
  id: string;
  question: string;
  question_type: 'mcq' | 'coding' | 'code' | 'aptitude' | 'diagram';
  options?: { a: string; b: string; c: string; d: string };
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  correct_answer?: string;
  marks: number;
  penalty?: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  sector?: string;
  section?: string;
  college_id?: number | string | null;
  college_name?: string;
  college_code?: string;
  exam_code?: string;
  diagram_url?: string;
  tags?: string[];
  test_cases?: any;
}

const SECTOR_OPTIONS = [
  'Sector 1 · Quantitative Aptitude & Velocity',
  'Sector 2 · Logical Reasoning & Deduction',
  'Sector 3 · Core Computer Science Systems',
  'Sector 4 · Data Structures & Algorithms',
  'Sector 5 · Full-Stack & Distributed Architecture',
];

const INITIAL_FALLBACK_QUESTIONS: QuestionItem[] = [];

export default function QuestionControl() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter States
  const [filterCollege, setFilterCollege] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Questions and Colleges
  const [questions, setQuestions] = useState<QuestionItem[]>(INITIAL_FALLBACK_QUESTIONS);
  const [colleges, setColleges] = useState<Array<{ id: number; college_name: string; college_code: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [viewingQuestion, setViewingQuestion] = useState<QuestionItem | null>(null);

  // Form State
  const [form, setForm] = useState({
    question: '',
    question_type: 'mcq' as 'mcq' | 'coding' | 'aptitude' | 'diagram',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'a',
    marks: 2,
    penalty: 0,
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    topic: 'Core Computer Science',
    sector: SECTOR_OPTIONS[0],
    diagram_url: '',
    tags: '',
    exam_code: 'CS2026',
    test_cases: [
      { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
      { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
    ],
  });

  // Fetch colleges once
  useEffect(() => {
    listColleges()
      .then((res) => {
        if (res.data?.colleges && Array.isArray(res.data.colleges)) {
          setColleges(res.data.colleges);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch questions based on active filters
  const loadQuestions = () => {
    setLoading(true);
    listQuestionBank({
      college_id: filterCollege !== 'all' ? filterCollege : undefined,
      question_type: filterType !== 'all' ? filterType : undefined,
      difficulty: filterDifficulty !== 'all' ? filterDifficulty : undefined,
      topic: topicFilter !== 'all' ? topicFilter : undefined,
      search: search.trim() ? search.trim() : undefined,
    })
      .then((res) => {
        if (res.data?.questions && Array.isArray(res.data.questions)) {
          setQuestions(res.data.questions);
        } else {
          setQuestions([]);
        }
      })
      .catch(() => {
        setQuestions([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    const hasToken =
      localStorage.getItem('admin_token') ||
      sessionStorage.getItem('admin_token') ||
      localStorage.getItem('faculty_token') ||
      sessionStorage.getItem('faculty_token');
    if (!hasToken) {
      navigate('/admin', { replace: true });
      return;
    }
    loadQuestions();
  }, [filterCollege, filterType, filterDifficulty, topicFilter, search, navigate]);

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
      penalty: 0,
      difficulty: 'Medium',
      topic: 'Algorithms & Core CS',
      sector: SECTOR_OPTIONS[0],
      diagram_url: '',
      tags: '',
      exam_code: 'CS2026',
      test_cases: [
        { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
        { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: QuestionItem) => {
    setEditingQuestion(q);
    const rawType = q.question_type === 'code' ? 'coding' : q.question_type;
    const tcs = Array.isArray(q.test_cases)
      ? q.test_cases.map((t: any, i: number) => ({
          id: t.id || `tc-${i + 1}`,
          input_text: t.input_text || t.input || '',
          expected_output: t.expected_output || t.output || '',
          marks: Number(t.marks || 5),
          is_hidden: Boolean(t.is_hidden),
        }))
      : [
          { id: 'tc-1', input_text: '', expected_output: '', marks: 5, is_hidden: false },
          { id: 'tc-2', input_text: '', expected_output: '', marks: 5, is_hidden: true },
        ];

    setForm({
      question: q.question,
      question_type: (rawType as any) || 'mcq',
      option_a: q.option_a || q.options?.a || '',
      option_b: q.option_b || q.options?.b || '',
      option_c: q.option_c || q.options?.c || '',
      option_d: q.option_d || q.options?.d || '',
      correct_option: (q.correct_option || q.correct_answer || 'a').toLowerCase(),
      marks: Number(q.marks || 2),
      penalty: Number(q.penalty || 0),
      difficulty: q.difficulty || 'Medium',
      topic: q.topic || 'General',
      sector: q.sector || SECTOR_OPTIONS[0],
      diagram_url: q.diagram_url || '',
      tags: q.tags?.filter((t) => !t.startsWith('diagram:')).join(', ') || '',
      exam_code: q.exam_code || 'CS2026',
      test_cases: tcs,
    });
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) return;

    const payload: any = {
      question: form.question,
      question_text: form.question,
      question_type: form.question_type,
      marks: Number(form.marks),
      penalty: Number(form.penalty),
      difficulty: form.difficulty,
      topic: form.topic,
      sector: form.sector,
      exam_code: form.exam_code || 'CS2026',
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    if (form.question_type === 'mcq' || form.question_type === 'aptitude' || form.question_type === 'diagram') {
      payload.option_a = form.option_a;
      payload.option_b = form.option_b;
      payload.option_c = form.option_c;
      payload.option_d = form.option_d;
      payload.options = {
        a: form.option_a,
        b: form.option_b,
        c: form.option_c,
        d: form.option_d,
      };
      payload.correct_option = form.correct_option;
      payload.correct_answer = form.correct_option.toUpperCase();
      if (form.question_type === 'diagram') {
        payload.diagram_url = form.diagram_url;
      }
    } else if (form.question_type === 'coding') {
      payload.test_cases = form.test_cases.filter(
        (tc) => tc.expected_output && tc.expected_output.trim() !== ''
      );
    }

    try {
      if (editingQuestion) {
        await updateQuestionBankItem(editingQuestion.id, payload);
        setActionMsg(`✅ Question updated successfully.`);
      } else {
        await createQuestionBankItem(payload);
        setActionMsg(`✅ Question created and added to master bank.`);
      }
      setIsModalOpen(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch {
      // Local fallback for offline mode
      if (editingQuestion) {
        setQuestions((prev) =>
          prev.map((item) => (item.id === editingQuestion.id ? { ...item, ...payload } : item))
        );
      } else {
        setQuestions((prev) => [{ id: `q-${Date.now()}`, ...payload }, ...prev]);
      }
      setIsModalOpen(false);
      setEditingQuestion(null);
      setActionMsg(`✅ Question saved.`);
    }

    setTimeout(() => setActionMsg(''), 4000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question from the master question bank?')) {
      return;
    }
    try {
      await deleteQuestionBankItem(id);
      setActionMsg('🗑️ Question deleted from database.');
      loadQuestions();
    } catch {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setActionMsg('🗑️ Question removed.');
    }
    setTimeout(() => setActionMsg(''), 4000);
  };

  // Distinct Topics for topic filter dropdown
  const uniqueTopics = Array.from(
    new Set(questions.map((q) => q.topic).filter(Boolean))
  );

  return (
    <AnimatedPage>
      <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg, #050814)' }}>
        <AdminSidebar activeTab="questions" />

        <main className="admin-content" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#FFC200', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                LogicWhileLiRE Assessment Vault
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Master Question Bank
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Full administrative control across MCQs, Coding Challenges, Visual Diagrams, and Quantitative Aptitude.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => navigate('/admin/import')}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontWeight: 700, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>📊</span> Excel Importer &amp; Validator
              </button>

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

          {/* Action Notification Banner */}
          {actionMsg && (
            <div
              className="animate-slide-up"
              style={{
                padding: '12px 18px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontWeight: 600,
                fontSize: '0.88rem',
                marginBottom: 20,
              }}
            >
              {actionMsg}
            </div>
          )}

          {/* Multi-Dimensional Filter Bar (College, Topic, Difficulty, Type, Search) */}
          <div
            className="card"
            style={{
              padding: '18px 22px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 194, 0, 0.2)',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
              {/* College Filter */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  College Scope
                </label>
                <select
                  className="form-input"
                  value={filterCollege}
                  onChange={(e) => setFilterCollege(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                >
                  <option value="all">All Colleges / Global</option>
                  {colleges.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.college_name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Difficulty Filter */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Difficulty Tier
                </label>
                <select
                  className="form-input"
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                >
                  <option value="all">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Topic Filter */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Topic / Subtopic
                </label>
                <select
                  className="form-input"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                >
                  <option value="all">All Topics</option>
                  {uniqueTopics.map((top) => (
                    <option key={top} value={top}>
                      {top}
                    </option>
                  ))}
                </select>
              </div>

              {/* Free-Text Search */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Keyword Search
                </label>
                <input
                  type="text"
                  placeholder="Search question text, tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            {/* Question Type Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1' }}>Question Type:</span>
              {[
                { id: 'all', label: 'All Types' },
                { id: 'mcq', label: '🔘 MCQs' },
                { id: 'coding', label: '💻 Coding Challenges' },
                { id: 'aptitude', label: '📐 Aptitude & Velocity' },
                { id: 'diagram', label: '🖼️ Diagram & Visual' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: filterType === tab.id ? 700 : 500,
                    background: filterType === tab.id ? 'rgba(255, 194, 0, 0.15)' : 'transparent',
                    border: `1px solid ${filterType === tab.id ? '#FFC200' : 'rgba(255, 255, 255, 0.1)'}`,
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
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                <div className="btn-spinner" style={{ margin: '0 auto 12px' }} />
                Loading question bank records...
              </div>
            ) : questions.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 40,
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                  No Questions Found
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '4px 0 16px' }}>
                  No questions match your current combination of College, Type, Topic, and Difficulty filters.
                </p>
                <button
                  onClick={() => {
                    setFilterCollege('all');
                    setFilterType('all');
                    setFilterDifficulty('all');
                    setTopicFilter('all');
                    setSearch('');
                  }}
                  className="btn btn-outline text-xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              questions.map((q, idx) => {
                const rawType = q.question_type === 'code' ? 'coding' : q.question_type;
                return (
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
                        {/* Badges Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-faint)' }}>
                            #{idx + 1}
                          </span>

                          {/* Question Type Badge */}
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background:
                                rawType === 'coding'
                                  ? 'rgba(139, 92, 246, 0.2)'
                                  : rawType === 'diagram'
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : rawType === 'aptitude'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(56, 189, 248, 0.2)',
                              color:
                                rawType === 'coding'
                                  ? '#A78BFA'
                                  : rawType === 'diagram'
                                  ? '#FBBF24'
                                  : rawType === 'aptitude'
                                  ? '#34D399'
                                  : '#38BDF8',
                              border: `1px solid currentColor`,
                            }}
                          >
                            {rawType === 'coding'
                              ? '💻 Coding Challenge'
                              : rawType === 'diagram'
                              ? '🖼️ Diagram Question'
                              : rawType === 'aptitude'
                              ? '📐 Analytical Aptitude'
                              : '🔘 MCQ'}
                          </span>

                          {/* Difficulty Badge */}
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background:
                                q.difficulty === 'Easy'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : q.difficulty === 'Hard'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color:
                                q.difficulty === 'Easy'
                                  ? '#4ADE80'
                                  : q.difficulty === 'Hard'
                                  ? '#F87171'
                                  : '#FBBF24',
                            }}
                          >
                            {q.difficulty}
                          </span>

                          {/* Marks & Penalty */}
                          <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 800 }}>
                            +{q.marks} Marks
                          </span>
                          {q.penalty !== undefined && q.penalty > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 700 }}>
                              -{q.penalty} Penalty
                            </span>
                          )}

                          {/* Topic / College */}
                          <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontWeight: 600 }}>
                            📚 {q.topic}
                          </span>
                          {q.college_name && (
                            <span style={{ fontSize: '0.75rem', color: '#93C5FD', fontWeight: 600 }}>
                              🏛️ {q.college_name}
                            </span>
                          )}
                          {q.exam_code && (
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                              [{q.exam_code}]
                            </span>
                          )}
                        </div>

                        {/* Question Text */}
                        <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 12 }}>
                          {q.question}
                        </div>

                        {/* Diagram Preview Thumbnail if Diagram Type */}
                        {q.diagram_url && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img
                                src={q.diagram_url}
                                alt="Diagram preview"
                                style={{
                                  maxHeight: 120,
                                  maxWidth: 240,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  border: '1px solid rgba(255, 194, 0, 0.3)',
                                }}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <a
                                href={q.diagram_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '0.75rem', color: '#FBBF24', textDecoration: 'underline' }}
                              >
                                Open Full Diagram &rarr;
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Options Grid for MCQ, Diagram, Aptitude */}
                        {rawType !== 'coding' && (q.options || q.option_a) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
                            {[
                              { label: 'A', val: q.option_a || q.options?.a },
                              { label: 'B', val: q.option_b || q.options?.b },
                              { label: 'C', val: q.option_c || q.options?.c },
                              { label: 'D', val: q.option_d || q.options?.d },
                            ].map((opt) => {
                              const isCorrect =
                                (q.correct_option || q.correct_answer || '').toUpperCase() === opt.label;
                              return (
                                <div
                                  key={opt.label}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    fontSize: '0.82rem',
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                                    color: isCorrect ? '#34D399' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <strong>{opt.label}:</strong> {opt.val || '-'}
                                  {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800 }}>✓ KEY</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Test Cases for Coding Challenges */}
                        {rawType === 'coding' && (
                          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', marginBottom: 4 }}>
                              🧪 Test Cases Specification:
                            </div>
                            {Array.isArray(q.test_cases) && q.test_cases.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {q.test_cases.map((tc: any, tcIdx: number) => (
                                  <div key={tcIdx} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#CBD5E1' }}>
                                    <span style={{ color: tc.is_hidden ? '#F59E0B' : '#38BDF8', fontWeight: 700 }}>
                                      [{tc.is_hidden ? 'HIDDEN' : 'PUBLIC'}]
                                    </span>{' '}
                                    Input: <code style={{ color: '#F8FAFC' }}>{tc.input_text || tc.input}</code> &rarr; Expected:{' '}
                                    <code style={{ color: '#34D399' }}>{tc.expected_output || tc.output}</code>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                                {typeof q.test_cases === 'string' ? q.test_cases : 'Standard test suite configured.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CRUD Actions: View, Edit, Delete */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => setViewingQuestion(q)}
                          className="btn btn-sm"
                          style={{
                            background: 'rgba(56, 189, 248, 0.12)',
                            color: '#38BDF8',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            fontWeight: 700,
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="View Full Question Details"
                        >
                          <span>👁️</span> View
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(q)}
                          className="btn btn-sm"
                          style={{
                            background: 'rgba(255, 194, 0, 0.14)',
                            color: '#FFC200',
                            border: '1px solid rgba(255, 194, 0, 0.4)',
                            fontWeight: 700,
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Edit Question and Options"
                        >
                          <span>✏️</span> Edit
                        </button>

                        <button
                          onClick={() => handleDelete(q.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '6px 10px' }}
                          title="Delete Question"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VIEW DETAILS MODAL */}
          {viewingQuestion && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
              }}
              onClick={() => setViewingQuestion(null)}
            >
              <div
                className="card animate-slide-up"
                style={{
                  maxWidth: 640,
                  width: '100%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  borderRadius: 16,
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  background: '#0B1226',
                  padding: 28,
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>👁️</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                      Question Specification Details
                    </h2>
                  </div>
                  <button
                    onClick={() => setViewingQuestion(null)}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.3rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                      Type: {(viewingQuestion.question_type === 'code' ? 'Coding' : viewingQuestion.question_type).toUpperCase()}
                    </span>
                    <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                      Difficulty: {viewingQuestion.difficulty}
                    </span>
                    <span style={{ background: 'rgba(255, 194, 0, 0.15)', color: '#FFC200', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                      Marks: +{viewingQuestion.marks} | Pen: -{viewingQuestion.penalty || 0}
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      Question Prompt:
                    </label>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC', lineHeight: 1.5, marginTop: 4 }}>
                      {viewingQuestion.question}
                    </div>
                  </div>

                  {viewingQuestion.diagram_url && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase' }}>
                        Diagram Asset:
                      </label>
                      <div style={{ marginTop: 6 }}>
                        <img
                          src={viewingQuestion.diagram_url}
                          alt="Diagram"
                          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}
                        />
                      </div>
                    </div>
                  )}

                  {viewingQuestion.options && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                        Options &amp; Answer Key:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {Object.entries(viewingQuestion.options).map(([k, v]) => {
                          const isCorrect = (viewingQuestion.correct_option || viewingQuestion.correct_answer || '').toLowerCase() === k.toLowerCase();
                          return (
                            <div
                              key={k}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                background: isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                border: `1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: isCorrect ? '#4ADE80' : '#CBD5E1',
                                fontSize: '0.85rem',
                              }}
                            >
                              <strong>Option {k.toUpperCase()}:</strong> {v}
                              {isCorrect && ' ✓ (Correct)'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button onClick={() => setViewingQuestion(null)} className="btn btn-secondary text-xs">
                      Close Window
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREATE & EDIT MODAL */}
          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
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
                className="card animate-slide-up"
                style={{
                  maxWidth: 720,
                  width: '100%',
                  maxHeight: '92vh',
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
                    {editingQuestion ? '✏️ Edit Question in Master Bank' : '➕ Add Question to Bank'}
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
                      <label className="form-label">Question Classification</label>
                      <select
                        className="form-input"
                        value={form.question_type}
                        onChange={(e) => setForm({ ...form, question_type: e.target.value as any })}
                      >
                        <option value="mcq">Multiple Choice Question (MCQ)</option>
                        <option value="coding">Coding Challenge (Execution Suite)</option>
                        <option value="aptitude">Analytical &amp; Quantitative Aptitude</option>
                        <option value="diagram">Diagram / Visual Question</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Target Exam Code</label>
                      <input
                        className="form-input font-mono"
                        value={form.exam_code}
                        onChange={(e) => setForm({ ...form, exam_code: e.target.value.toUpperCase() })}
                        placeholder="e.g. CS2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Question Statement / Problem Prompt</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      required
                      placeholder="Enter the full question statement..."
                      value={form.question}
                      onChange={(e) => setForm({ ...form, question: e.target.value })}
                    />
                  </div>

                  {/* Diagram Image URL input if diagram type */}
                  {form.question_type === 'diagram' && (
                    <div>
                      <label className="form-label">Diagram Image URL (HTTP / HTTPS)</label>
                      <input
                        className="form-input font-mono"
                        required
                        placeholder="https://example.com/diagram.png or /images/network.jpg"
                        value={form.diagram_url}
                        onChange={(e) => setForm({ ...form, diagram_url: e.target.value })}
                      />
                      {form.diagram_url && (
                        <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, display: 'inline-block' }}>
                          <img
                            src={form.diagram_url}
                            alt="Preview"
                            style={{ maxHeight: 100, borderRadius: 4 }}
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Options inputs for MCQ, Diagram, Aptitude */}
                  {form.question_type !== 'coding' ? (
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
                        <label className="form-label">Correct Option Key</label>
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
                        Test Cases (Public &amp; Hidden Boundary Suites)
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
                      <label className="form-label">Penalty / Negative</label>
                      <input className="form-input" type="number" step="0.25" min="0" value={form.penalty} onChange={(e) => setForm({ ...form, penalty: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="form-label">Difficulty</label>
                      <select className="form-input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Topic / Subtopic</label>
                      <input className="form-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Tags (comma-separated)</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Invariants, Time Complexity"
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      />
                    </div>
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
                      {editingQuestion ? '💾 Save Question Changes' : '➕ Add to Master Bank'}
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
