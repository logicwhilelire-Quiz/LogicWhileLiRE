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
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>
              <BrandLogo size="sm" variant="standard" showTagline={true} />
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#002147' }}>
              Student Login
            </h1>
            <p style={{ color: '#64748B', fontSize: '0.8rem', margin: '4px 0 0' }}>
              Enter your credentials to access your portal
            </p>
          </div>

          {/* Minimal IARE-styled Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #E2E8F0',
              borderRadius: 12,
              padding: '24px 20px',
              boxShadow: '0 8px 24px rgba(0, 33, 71, 0.08)',
            }}
          >
            {notice && (
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {notice}
              </div>
            )}
            {error && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
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
                    padding: '9px 12px',
                    fontSize: '0.88rem',
                    borderRadius: 6,
                    border: '1.5px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    Password
                  </label>
                  <Link to="/forgot-password" style={{ fontSize: '0.74rem', color: '#B45309', textDecoration: 'none', fontWeight: 700 }}>
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
                      padding: '9px 36px 9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 6,
                      border: '1.5px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
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
                  padding: '10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#002147',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 33, 71, 0.25)',
                  transition: 'opacity 0.15s ease',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Signing in...' : 'Sign In as Student'}
              </button>
            </form>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0', textAlign: 'center', fontSize: '0.82rem', color: '#64748B' }}>
              Don't have an account?{' '}
              <Link to="/register" id="student-login-register-link" style={{ color: '#002147', fontWeight: 800, textDecoration: 'none' }}>
                Register New Student →
              </Link>
            </div>

            <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
              Have an exam code?{' '}
              <Link to="/enter-exam" style={{ color: '#B45309', fontWeight: 700, textDecoration: 'none' }}>
                Enter Exam Directly →
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
            It is developed by <strong style={{ color: '#002147', fontWeight: 700 }}>R. Charan Sai Krishna</strong>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
