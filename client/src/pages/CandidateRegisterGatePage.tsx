import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { API_BASE_URL } from '../lib/config';

interface DynamicCollege {
  id: string;
  name: string;
  code?: string;
}

interface DynamicBranch {
  id: number | string;
  code: string;
  label: string;
  college_id?: string;
  year_of_passing?: number;
}

interface DynamicSection {
  id: number | string;
  cohort_id?: number | string;
  name: string;
}

export const INSTITUTIONAL_BRANCH_LIST: Array<{ id: string; code: string; label: string }> = [
  { id: 'cse', code: 'CSE', label: 'Computer Science & Engineering (CSE)' },
  { id: 'csm', code: 'CSM', label: 'CSE — Artificial Intelligence & Machine Learning (CSM / AIML)' },
  { id: 'csd', code: 'CSD', label: 'CSE — Data Science & Analytics (CSD / DS)' },
  { id: 'csbs', code: 'CSBS', label: 'Computer Science & Business Systems (CSBS)' },
  { id: 'it', code: 'IT', label: 'Information Technology (IT)' },
  { id: 'aids', code: 'AIDS', label: 'Artificial Intelligence & Data Science (AI & DS)' },
  { id: 'ece', code: 'ECE', label: 'Electronics & Communication Engineering (ECE)' },
  { id: 'eee', code: 'EEE', label: 'Electrical & Electronics Engineering (EEE)' },
  { id: 'mech', code: 'MECH', label: 'Mechanical Engineering (MECH)' },
  { id: 'civil', code: 'CIVIL', label: 'Civil Engineering (CIVIL)' },
  { id: 'csit', code: 'CSIT', label: 'Computer Science & Information Technology (CSIT)' },
  { id: 'mca', code: 'MCA', label: 'Master of Computer Applications (MCA)' },
  { id: 'mba', code: 'MBA', label: 'Master of Business Administration (MBA)' },
  { id: 'other', code: 'OTHER', label: 'Other Engineering Specialization' },
];

export default function CandidateRegisterGatePage() {
  const navigate = useNavigate();

  const [colleges, setColleges] = useState<DynamicCollege[]>([]);
  const [allBranches, setAllBranches] = useState<DynamicBranch[]>([]);
  const [allBatches, setAllBatches] = useState<number[]>([]);
  const [allSections, setAllSections] = useState<DynamicSection[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    college_id: '',
    college_name: '',
    year_of_passing: 2026,
    roll_number: '',
    branch_code: 'CSE',
    section: 'A',
    email: '',
    contact_number: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [wsStatus, setWsStatus] = useState<'READY' | 'CHECKING'>('READY');
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredRoll, setRegisteredRoll] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');

  useEffect(() => {
    // 1. Fetch live admin-controlled metadata
    async function fetchMetadata() {
      setLoadingMetadata(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/assessment/metadata`);
        if (res.data?.success) {
          const fetchedColleges: DynamicCollege[] = res.data.colleges || res.data.all_colleges || [];
          const fetchedBranches: DynamicBranch[] = res.data.branches || [];
          const fetchedBatches: number[] = res.data.batches || [];
          const fetchedSections: DynamicSection[] = res.data.sections || [];

          setColleges(fetchedColleges);
          setAllBranches(fetchedBranches);
          setAllBatches(fetchedBatches);
          setAllSections(fetchedSections);

          if (fetchedColleges.length > 0) {
            const firstCol = fetchedColleges[0];
            const matchingBranches = fetchedBranches.filter(
              (b) => !b.college_id || String(b.college_id) === String(firstCol.id)
            );
            const firstBranch = matchingBranches[0]?.code || 'CSE';
            const firstBatch = fetchedBatches[0] || 2026;
            const firstSection = fetchedSections[0]?.name || 'A';

            setForm((prev) => ({
              ...prev,
              college_id: String(firstCol.id),
              college_name: firstCol.name,
              branch_code: prev.branch_code || firstBranch,
              year_of_passing: prev.year_of_passing || firstBatch,
              section: prev.section || firstSection,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      } finally {
        setLoadingMetadata(false);
      }
    }

    fetchMetadata();

    // 2. System check ping
    axios
      .get(`${API_BASE_URL}/api/v1/assessment/system-check`)
      .then((res) => {
        if (res.data?.websocket === 'ready') setWsStatus('READY');
      })
      .catch(() => setWsStatus('READY'));
  }, []);

  // Filtered branches for currently selected college merged with all standard institutional engineering branches
  const availableBranches = (() => {
    const list: DynamicBranch[] = [];
    const seen = new Set<string>();

    // 1. Any college-specific cohorts from database
    for (const b of allBranches) {
      if (b.college_id && String(b.college_id) === String(form.college_id)) {
        const codeUpper = (b.code || '').toUpperCase();
        if (codeUpper && !seen.has(codeUpper)) {
          seen.add(codeUpper);
          list.push(b);
        }
      }
    }

    // 2. Any general cohorts from database
    for (const b of allBranches) {
      if (!b.college_id) {
        const codeUpper = (b.code || '').toUpperCase();
        if (codeUpper && !seen.has(codeUpper)) {
          seen.add(codeUpper);
          list.push(b);
        }
      }
    }

    // 3. Full institutional branch catalog
    for (const b of INSTITUTIONAL_BRANCH_LIST) {
      if (!seen.has(b.code)) {
        seen.add(b.code);
        list.push(b);
      }
    }

    return list;
  })();

  // Capitalize first letter helper
  const capitalizeFirst = (val: string) => {
    if (!val) return '';
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^A-Za-z\s]/g, '');
    setForm((prev) => ({ ...prev, first_name: capitalizeFirst(clean) }));
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^A-Za-z\s]/g, '');
    setForm((prev) => ({ ...prev, last_name: capitalizeFirst(clean) }));
  };

  const handleRollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    setForm((prev) => ({ ...prev, roll_number: clean }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((prev) => ({ ...prev, contact_number: raw }));
  };

  const handleCollegeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const found = colleges.find((c) => String(c.id) === selectedId);
    const matchingBranches = allBranches.filter(
      (b) => !b.college_id || String(b.college_id) === String(selectedId)
    );
    setForm((prev) => ({
      ...prev,
      college_id: selectedId,
      college_name: found ? found.name : selectedId,
      branch_code: matchingBranches[0]?.code || prev.branch_code,
    }));
  };

  // Password validation checks
  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
    match: form.password.length > 0 && form.password === form.confirm_password,
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!form.first_name || form.first_name.length < 2) {
      errs.first_name = 'First name must be at least 2 alphabetic characters.';
    }
    if (!form.last_name || form.last_name.length < 1) {
      errs.last_name = 'Last name is required.';
    }
    if (!form.college_id) {
      errs.college_id = 'Please select your affiliated college.';
    }
    if (!form.roll_number || form.roll_number.length < 3) {
      errs.roll_number = 'Roll / Hall ticket number is required (alphanumeric).';
    }
    if (!form.branch_code) {
      errs.branch_code = 'Please select your branch code.';
    }
    if (!form.section) {
      errs.section = 'Please select your assigned section.';
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Valid institutional or official email address is required.';
    }
    if (!form.contact_number || form.contact_number.length !== 10) {
      errs.contact_number = 'Valid 10-digit mobile contact number is required.';
    }
    if (!passwordChecks.length || !passwordChecks.uppercase || !passwordChecks.number || !passwordChecks.special) {
      errs.password = 'Password must meet all complexity requirements.';
    }
    if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        college_id: form.college_id,
        college_name: form.college_name,
        year_of_passing: Number(form.year_of_passing),
        roll_number: form.roll_number.toUpperCase().trim(),
        branch_code: form.branch_code.toUpperCase().trim(),
        section: form.section.trim(),
        email: form.email.toLowerCase().trim(),
        contact_number: form.contact_number.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        timestamp: new Date().toISOString(),
      };

      const res = await axios.post(`${API_BASE_URL}/api/v1/assessment/register-candidate`, payload);

      if (res.data?.success) {
        if (res.data.requires_otp) {
          setOtpStep(true);
          const emailTarget = (res.data.email || form.email).toLowerCase().trim();
          const rollTarget = (res.data.roll_number || form.roll_number).toUpperCase().trim();
          setRegisteredEmail(emailTarget);
          setRegisteredRoll(rollTarget);
          if (res.data.demo_otp) {
            setDevOtp(res.data.demo_otp);
            setOtpCode(res.data.demo_otp);
          }
          return;
        }

        if (res.data.token) {
          localStorage.setItem('student_token', res.data.token);
        }
        if (res.data.candidate) {
          localStorage.setItem('student_user', JSON.stringify(res.data.candidate));
        }

        const targetUrl = res.data.redirect_url || '/contest/demo-contest/waiting-lobby';
        navigate(targetUrl, {
          state: {
            candidate: res.data.candidate,
            hallTicket: form.roll_number.toUpperCase().trim(),
          },
        });
      } else {
        let msg = res.data?.error || 'Registration failed. Please try again.';
        if (res.data?.details && Array.isArray(res.data.details) && res.data.details.length > 0) {
          msg = `${msg}: ` + res.data.details.map((d: any) => d.message || `${d.field}: ${d.message}`).join(', ');
        }
        setServerError(msg);
      }
    } catch (err: any) {
      let msg = err.response?.data?.error || err.response?.data?.message || 'Server error occurred during candidate registration.';
      if (err.response?.data?.details && Array.isArray(err.response.data.details) && err.response.data.details.length > 0) {
        const detailStr = err.response.data.details.map((d: any) => d.message || `${d.field}: ${d.message}`).join(', ');
        msg = `${msg}: ${detailStr}`;
      }
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.trim();
    if (!code || code.length !== 6) {
      setServerError('Please enter the complete 6-digit verification code.');
      return;
    }
    setVerifyingOtp(true);
    setServerError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/verify-registration-otp`, {
        email: registeredEmail,
        otp: code,
      });
      if (res.data?.success) {
        setOtpSuccessMsg('Account verified successfully! Redirecting to student login...');
        setTimeout(() => {
          navigate(`/login?registered=${encodeURIComponent(registeredRoll)}`);
        }, 1200);
      } else {
        setServerError(res.data?.error || 'Verification failed. Please check the code and try again.');
      }
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Verification failed. Invalid or expired OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        color: '#0F172A',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SiteHeader />

      {/* Main Registration Container */}
      <main style={{ maxWidth: 940, margin: '0 auto', padding: '36px 20px 60px', width: '100%', flex: 1 }}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 12,
            border: '2px solid #002147',
            boxShadow: '0 8px 30px rgba(0, 33, 71, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              background: '#002147',
              color: '#FFFFFF',
              padding: '28px 32px',
              borderBottom: '3px solid #EAA812',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <BrandLogo size="sm" variant="standard" showTagline={false} />
                  <span
                    style={{
                      background: '#EAA812',
                      color: '#002147',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4,
                      letterSpacing: '0.04em',
                    }}
                  >
                    AUTHORIZED GATE
                  </span>
                </div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                  Candidate Registration &amp; Demographic Verification
                </h1>
                <p style={{ color: '#CBD5E1', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Synchronous Institutional Assessment Platform • Administrator Controlled Gate
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: wsStatus === 'READY' ? '#10B981' : '#F59E0B',
                    boxShadow: wsStatus === 'READY' ? '0 0 8px #10B981' : 'none',
                  }}
                />
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>SYSTEM: {wsStatus}</span>
              </div>
            </div>
          </div>

          {/* Form Body or Closed State */}
          {loadingMetadata ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div className="btn-spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
              <p style={{ color: '#64748B', fontSize: '0.9rem', margin: 0 }}>
                Loading institutional colleges, branches, and academic schedules…
              </p>
            </div>
          ) : colleges.length === 0 ? (
            <div style={{ padding: '64px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: '3.2rem', marginBottom: 16 }}>🏛️</div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#002147', margin: '0 0 8px' }}>
                Registration Currently Closed
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.92rem', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Candidate registration is managed exclusively by institutional administrators. No colleges or campuses have open registration at this moment. If you already have credentials, please sign in below.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <Link
                  to="/login"
                  style={{
                    background: '#002147',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    padding: '12px 28px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: '0.92rem',
                  }}
                >
                  Candidate Sign In &rarr;
                </Link>
                <Link
                  to="/admin/login"
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    color: '#002147',
                    fontWeight: 700,
                    padding: '12px 24px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: '0.92rem',
                  }}
                >
                  Admin Console &rarr;
                </Link>
              </div>
            </div>
          ) : otpStep ? (
            <div style={{ padding: '40px 32px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📬</div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#002147', margin: '0 0 8px' }}>
                Verify Your Registration OTP
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 20px' }}>
                A 6-digit one-time password has been dispatched to{' '}
                <strong style={{ color: '#002147' }}>{registeredEmail}</strong>.
                Enter the code below to verify your account and continue.
              </p>

              {devOtp && (
                <div
                  onClick={() => setOtpCode(devOtp)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    color: '#92400E',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    marginBottom: 20,
                    cursor: 'pointer',
                  }}
                  title="Click to auto-fill"
                >
                  <span>⚡ Demo / Dev OTP:</span>
                  <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{devOtp}</span>
                  <span style={{ fontSize: '0.72rem', textDecoration: 'underline' }}>(Click to fill)</span>
                </div>
              )}

              {otpSuccessMsg && (
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1.5px solid #10B981',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: '#065F46',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 20,
                  }}
                >
                  ✓ {otpSuccessMsg}
                </div>
              )}

              {serverError && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1.5px solid #F87171',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: '#991B1B',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: 20,
                  }}
                >
                  ⚠️ {serverError}
                </div>
              )}

              <form onSubmit={handleVerifyOtp}>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="gate-otp-input"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      maxWidth: 240,
                      padding: '12px',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      letterSpacing: '0.3em',
                      fontFamily: 'monospace',
                      borderRadius: 8,
                      border: '2px solid #002147',
                      color: '#002147',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    id="gate-otp-submit-btn"
                    type="submit"
                    disabled={verifyingOtp || otpCode.length !== 6}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#002147',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      cursor: verifyingOtp || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                      opacity: verifyingOtp || otpCode.length !== 6 ? 0.6 : 1,
                      boxShadow: '0 4px 14px rgba(0, 33, 71, 0.25)',
                    }}
                  >
                    {verifyingOtp ? 'Verifying OTP…' : 'Verify & Activate Account →'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setServerError('');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: '8px',
                      textDecoration: 'underline',
                    }}
                  >
                    ← Back to edit registration details
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: '36px 40px' }}>
              {serverError && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1.5px solid #F87171',
                    borderRadius: 8,
                    padding: '14px 18px',
                    color: '#991B1B',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: 24,
                  }}
                >
                  ⚠️ {serverError}
                </div>
              )}

              {/* Section 1: Demographic Identification */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#002147', marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                  1. Candidate Identification
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      FIRST NAME <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="gate-first-name"
                      type="text"
                      required
                      value={form.first_name}
                      onChange={handleFirstNameChange}
                      placeholder="e.g. Venkata"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: errors.first_name ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        fontSize: '0.92rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errors.first_name && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.first_name}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      LAST NAME <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="gate-last-name"
                      type="text"
                      required
                      value={form.last_name}
                      onChange={handleLastNameChange}
                      placeholder="e.g. Srinivas"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: errors.last_name ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        fontSize: '0.92rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errors.last_name && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.last_name}</span>}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    ROLL NUMBER / HALL TICKET NO <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    id="gate-roll-number"
                    type="text"
                    required
                    value={form.roll_number}
                    onChange={handleRollChange}
                    placeholder="e.g. 22B91A0501"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: errors.roll_number ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                      fontSize: '0.95rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.roll_number && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.roll_number}</span>}
                </div>
              </div>

              {/* Section 2: Institutional Hierarchy & Affiliation */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#002147', marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                  2. Institutional Placement &amp; Academic Hierarchy
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* College Select */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      COLLEGE / CAMPUS AFFILIATION <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <select
                      id="gate-college"
                      value={form.college_id}
                      onChange={handleCollegeChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: '0.92rem',
                        boxSizing: 'border-box',
                      }}
                    >
                      {colleges.map((col) => (
                        <option key={col.id} value={String(col.id)}>
                          {col.name} {col.code ? `(${col.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch, Batch, Section Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        BRANCH / COHORT <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <select
                        id="gate-branch"
                        value={form.branch_code}
                        onChange={(e) => setForm((prev) => ({ ...prev, branch_code: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: errors.branch_code ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                          fontSize: '0.92rem',
                          boxSizing: 'border-box',
                        }}
                      >
                        {availableBranches.length > 0 ? (
                          availableBranches.map((br) => (
                            <option key={br.id || br.code} value={br.code}>
                              {br.label || br.code}
                            </option>
                          ))
                        ) : (
                          <option value="CSE">Computer Science & Engineering (CSE)</option>
                        )}
                      </select>
                      {errors.branch_code && (
                        <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.branch_code}</span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        YEAR OF PASSING (BATCH) <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <select
                        id="gate-batch"
                        value={form.year_of_passing}
                        onChange={(e) => setForm((prev) => ({ ...prev, year_of_passing: Number(e.target.value) }))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          fontSize: '0.92rem',
                          boxSizing: 'border-box',
                        }}
                      >
                        {allBatches.length > 0 ? (
                          allBatches.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))
                        ) : (
                          [2026, 2027, 2028, 2029, 2030].map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        ACADEMIC SECTION <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <select
                        id="gate-section"
                        value={form.section}
                        onChange={(e) => setForm((prev) => ({ ...prev, section: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          fontSize: '0.92rem',
                          boxSizing: 'border-box',
                        }}
                      >
                        {allSections.length > 0 ? (
                          allSections.map((sec) => (
                            <option key={sec.id || sec.name} value={sec.name}>
                              Section {sec.name}
                            </option>
                          ))
                        ) : (
                          ['A', 'B', 'C', 'D', 'E'].map((s) => (
                            <option key={s} value={s}>
                              Section {s}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Security Credentials */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#002147', marginBottom: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                  3. Contact Information &amp; Login Security
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      EMAIL ADDRESS <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="gate-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="srinivas.k@college.edu"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: errors.email ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        fontSize: '0.92rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errors.email && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.email}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      MOBILE NUMBER (10 DIGITS) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="gate-contact"
                      type="tel"
                      required
                      value={form.contact_number}
                      onChange={handleContactChange}
                      placeholder="9876543210"
                      maxLength={10}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: errors.contact_number ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        fontSize: '0.92rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errors.contact_number && <span style={{ color: '#EF4444', fontSize: '0.74rem' }}>{errors.contact_number}</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      PASSWORD <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="gate-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Min 8 chars, 1 uppercase, 1 num, 1 sym"
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 14px',
                          borderRadius: 6,
                          border: errors.password ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                          fontSize: '0.92rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#64748B',
                        }}
                      >
                        {showPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      CONFIRM PASSWORD <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="gate-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={form.confirm_password}
                        onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                        placeholder="Re-enter exact password"
                        style={{
                          width: '100%',
                          padding: '10px 42px 10px 14px',
                          borderRadius: 6,
                          border: errors.confirm_password ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                          fontSize: '0.92rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#64748B',
                        }}
                      >
                        {showConfirmPassword ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Quality Indicator */}
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: passwordChecks.length ? '#166534' : '#94A3B8' }}>
                      {passwordChecks.length ? '✔' : '○'} ≥8 Chars
                    </span>
                    <span style={{ color: passwordChecks.uppercase ? '#166534' : '#94A3B8' }}>
                      {passwordChecks.uppercase ? '✔' : '○'} 1 Uppercase
                    </span>
                    <span style={{ color: passwordChecks.number ? '#166534' : '#94A3B8' }}>
                      {passwordChecks.number ? '✔' : '○'} 1 Number
                    </span>
                    <span style={{ color: passwordChecks.special ? '#166534' : '#94A3B8' }}>
                      {passwordChecks.special ? '✔' : '○'} 1 Special
                    </span>
                  </div>

                  <div>
                    {form.confirm_password ? (
                      passwordChecks.match ? (
                        <span style={{ color: '#166534', fontWeight: 800 }}>✔ PASSWORDS MATCH</span>
                      ) : (
                        <span style={{ color: '#EF4444', fontWeight: 800 }}>✖ MISMATCH</span>
                      )
                    ) : (
                      <span style={{ color: '#94A3B8' }}>Match Pending</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #F1F5F9', paddingTop: 20 }}>
                <Link
                  to="/login"
                  style={{
                    color: '#002147',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  &larr; Already Registered? Sign In
                </Link>

                <button
                  id="gate-submit-btn"
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#002147',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    padding: '13px 32px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 33, 71, 0.25)',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Registering Candidate…' : 'Submit Registration & Enter Lobby →'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
