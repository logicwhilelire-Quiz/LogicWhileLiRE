import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { enrollParticipant } from '../lib/api';
import BrandLogo from '../components/BrandLogo';
import AnimatedPage from '../components/AnimatedPage';

export default function EnrollPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', hall_ticket: '', mobile: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.hall_ticket.trim() || form.hall_ticket.length < 3) e.hall_ticket = 'Enter a valid hall ticket';
    if (!/^\+?[0-9]{7,15}$/.test(form.mobile)) e.mobile = 'Enter a valid mobile number';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setApiError('');

    try {
      const res = await enrollParticipant(examId!, form);
      navigate(`/enroll/${examId}/verify`, {
        state: {
          participant_id: res.data.participant_id,
          email: form.email,
        },
      });
    } catch (err: any) {
      setApiError(err?.response?.data?.error || 'Enrollment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="page-center">
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>

      <div className="container animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <BrandLogo size="lg" variant="hero" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text)' }}>
            Exam Enrollment
          </h2>
          <p className="text-muted text-sm">Fill in your details to receive your OTP</p>
        </div>

        <div className="card">
          {apiError && (
            <div className="alert alert-error mb-2">
              ⚠️ {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="enroll-name">Full Name</label>
              <input
                id="enroll-name"
                className={`form-input ${errors.name ? 'error' : ''}`}
                type="text"
                placeholder="e.g. John Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="enroll-hall-ticket">Hall Ticket Number</label>
              <input
                id="enroll-hall-ticket"
                className={`form-input font-mono ${errors.hall_ticket ? 'error' : ''}`}
                type="text"
                placeholder="e.g. CS2024001"
                value={form.hall_ticket}
                onChange={(e) => setForm({ ...form, hall_ticket: e.target.value.toUpperCase() })}
                autoCapitalize="characters"
              />
              {errors.hall_ticket && <span className="form-error">{errors.hall_ticket}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="enroll-mobile">Mobile Number</label>
              <input
                id="enroll-mobile"
                className={`form-input ${errors.mobile ? 'error' : ''}`}
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                autoComplete="tel"
              />
              {errors.mobile && <span className="form-error">{errors.mobile}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="enroll-email">Email Address</label>
              <input
                id="enroll-email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                type="email"
                placeholder="e.g. john@college.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
              <span className="text-xs text-muted mt-1">Your OTP will be sent to this address</span>
            </div>

            <button
              id="enroll-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? (
                <><div className="btn-spinner" />Sending OTP...</>
              ) : (
                <>✉️ Send OTP to Email</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-sm mt-2">
          By enrolling, you agree to follow the exam rules and conduct guidelines.
        </p>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5 }}>
          <div>LogicWhileLiRE • Architect &amp; Lead Engineer: <strong style={{ color: '#EAA812' }}>R. Charan Sai Krishna</strong></div>
          <div>Assistance: <a href="mailto:logicwhilelire@gmail.com" style={{ color: '#38BDF8', textDecoration: 'none' }}>logicwhilelire@gmail.com</a> | <a href="tel:+919493734553" style={{ color: '#EAA812', textDecoration: 'none' }}>+91 9493734553</a></div>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
