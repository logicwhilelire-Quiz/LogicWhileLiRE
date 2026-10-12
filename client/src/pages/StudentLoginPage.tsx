import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { studentLogin } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';
import { findAdminRosterStudent, type AdminRosterStudent } from '../lib/adminRosterStore';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/student/dashboard';
  const registeredRoll = searchParams.get('registered') || searchParams.get('roll') || '';

  const [form, setForm] = useState({ login: registeredRoll, password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(registeredRoll ? '✓ Account verified! Enter your password to sign in.' : '');

  function loginWithAdminStudent(student: AdminRosterStudent) {
    if (student.is_blocked) {
      setError('Account suspended by administration.');
      return;
    }
    if (student.is_verified === false || student.status === 'pending_clearance') {
      setError('Account pending clearance from administrator.');
      return;
    }

    const studentUser = {
      id: student.id,
      name: student.name,
      first_name: student.first_name || student.name.split(' ')[0],
      last_name: student.last_name || student.name.split(' ')[1] || '',
      email: student.email,
      roll_number: student.hall_ticket || student.roll_number,
      hall_ticket: student.hall_ticket || student.roll_number,
      college_id: student.college_id || 1,
      college_name: student.college_name,
      branch_code: student.branch || student.branch_code || 'CSE',
      section: student.section,
      section_id: student.section_id || `sec-${(student.branch || 'cse').toLowerCase()}-${student.section.toLowerCase()}`,
      year_of_passing: student.passout_year,
      passout_year: student.passout_year,
      batch: student.batch,
    };

    localStorage.setItem('student_token', `token-admin-roster-${student.id}`);
    localStorage.setItem('student_user', JSON.stringify(studentUser));
    navigate(redirectTarget);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const loginQuery = form.login.trim();
    if (!loginQuery) {
      setError('Please enter your hall ticket or email');
      return;
    }
    if (!form.password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    const matchedAdminStudent = findAdminRosterStudent(loginQuery);
    if (matchedAdminStudent) {
      loginWithAdminStudent(matchedAdminStudent);
      setLoading(false);
      return;
    }

    try {
      const res = await studentLogin({
        login: loginQuery,
        password: form.password,
      });
      if (res.data?.token) {
        localStorage.setItem('student_token', res.data.token);
      }
      if (res.data?.student) {
        localStorage.setItem('student_user', JSON.stringify(res.data.student));
      }
      navigate(redirectTarget);
    } catch (err: any) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.message?.includes('Network Error')) {
        setError('Server is warming up or temporarily unreachable. Please retry in a few moments.');
      } else {
        const resp = err?.response?.data;
        setError(resp?.error || 'Invalid hall ticket number or password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 350 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
            </Link>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
              Candidate Assessment Portal
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Sign in with your Hall Ticket number or registered email
            </p>
          </div>

          {/* Cyber-Glass Card */}
          <div
            style={{
              background: 'rgba(14, 22, 44, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 16,
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 35px rgba(59, 130, 246, 0.15)',
            }}
          >
            {notice && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#6EE7B7',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  marginBottom: 16,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span>
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#FCA5A5',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  marginBottom: 16,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Hall Ticket / Email
                </label>
                <input
                  id="student-login-input"
                  type="text"
                  required
                  placeholder="e.g. 22B91A0501"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  autoComplete="username"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    fontSize: '0.9rem',
                    borderRadius: 8,
                    border: '1.5px solid rgba(59, 130, 246, 0.25)',
                    background: 'rgba(9, 14, 31, 0.75)',
                    color: '#F8FAFC',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#38BDF8';
                    e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Password
                  </label>
                  <Link to="/forgot-password" style={{ fontSize: '0.74rem', color: '#FBBF24', textDecoration: 'none', fontWeight: 700 }}>
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="student-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      fontSize: '0.9rem',
                      borderRadius: 8,
                      border: '1.5px solid rgba(59, 130, 246, 0.25)',
                      background: 'rgba(9, 14, 31, 0.75)',
                      color: '#F8FAFC',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#38BDF8';
                      e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.25)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: 4,
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                id="student-login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563EB 0%, #38BDF8 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  letterSpacing: '0.02em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Signing in...' : 'Sign In as Student'}
              </button>
            </form>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '0.82rem', color: '#94A3B8' }}>
              Don't have an account?{' '}
              <Link to="/register" id="student-login-register-link" style={{ color: '#38BDF8', fontWeight: 800, textDecoration: 'none' }}>
                Register New Student →
              </Link>
            </div>

            <div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
              Have an exam code?{' '}
              <Link to="/enter-exam" style={{ color: '#FBBF24', fontWeight: 700, textDecoration: 'none' }}>
                Enter Exam Directly →
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
            LogicWhile LiRE • Created by <strong style={{ color: '#38BDF8', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
