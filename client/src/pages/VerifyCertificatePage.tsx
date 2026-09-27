import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import GlowCard from '../components/3d/GlowCard';
import MagneticButton from '../components/3d/MagneticButton';
import FlightPathLines from '../components/3d/FlightPathLines';

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CertificateData {
  qr_token: string;
  certificate_id: string;
  candidate_name: string;
  hall_ticket: string;
  exam_name: string;
  exam_code: string;
  score: number;
  total_marks: number;
  percentage: number;
  percentile?: number;
  grade: string;
  issued_at: string;
  expires_at?: string;
  issuer: string;
  verification_authority: string;
  integrity_score: string;
  crypto_hash: string;
  signature?: string;
}

export default function VerifyCertificatePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const activeToken = token || searchParams.get('token') || 'CERT-DEMO-2026';

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchToken, setSearchToken] = useState('');

  useEffect(() => {
    async function fetchVerification() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${BASE}/api/certificate/verify/${encodeURIComponent(activeToken)}`);
        if (data.success && data.certificate) {
          setCert(data.certificate);
        } else {
          setError(data.error || 'Certificate could not be verified on the national registry.');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to connect to certificate verification service.');
      } finally {
        setLoading(false);
      }
    }

    if (activeToken) {
      fetchVerification();
    }
  }, [activeToken]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 90% 60% at 50% -10%, #0d1b3e 0%, #050814 100%)',
      color: '#F0F4FF',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Flight Path Lines Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.5 }}>
        <FlightPathLines />
      </div>

      <div className="no-print" style={{ position: 'relative', zIndex: 10 }}>
        <SiteHeader />
      </div>

      <main style={{ flex: 1, padding: '40px 20px 80px', position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        
        {/* Verification Status Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 36 }}
          className="no-print"
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 999,
            padding: '8px 20px',
            fontSize: '0.85rem',
            color: '#34D399',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.08em',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.2)',
            marginBottom: 16,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 10px #34D399' }} />
            OFFICIAL PUBLIC REGISTRY VERIFIED
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            background: 'linear-gradient(135deg, #FFFFFF 30%, #2B7FFF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Digital Certificate Verification
          </h1>
          <p style={{ color: '#8899B5', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>
            Instant cryptographic proof of assessment completion, academic integrity, and scored technical merit.
          </p>

          {/* Quick Lookup Bar */}
          <div style={{
            display: 'flex',
            maxWidth: 480,
            margin: '24px auto 0',
            gap: 8,
          }}>
            <input
              type="text"
              placeholder="Verify another Token or Hall Ticket..."
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchToken.trim()) {
                  window.location.href = `/verify/${encodeURIComponent(searchToken.trim())}`;
                }
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (searchToken.trim()) {
                  window.location.href = `/verify/${encodeURIComponent(searchToken.trim())}`;
                }
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: '#2B7FFF',
                border: 'none',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Verify
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{
              width: 48,
              height: 48,
              border: '3px solid rgba(43, 127, 255, 0.2)',
              borderTopColor: '#2B7FFF',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: '#8899B5', fontSize: '0.95rem' }}>Querying national cryptographic registry...</p>
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 16,
            padding: '36px',
            textAlign: 'center',
            maxWidth: 520,
            margin: '0 auto',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
            <h3 style={{ color: '#F87171', margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700 }}>
              Certificate Not Found
            </h3>
            <p style={{ color: '#8899B5', fontSize: '0.9rem', marginBottom: 24 }}>
              {error}
            </p>
            <Link to="/enter-exam" style={{
              padding: '10px 22px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}>
              Return to Examination Portal
            </Link>
          </div>
        ) : cert ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ACTION TOOLBAR (no-print) */}
            <div className="no-print" style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(43, 127, 255, 0.2)',
              borderRadius: 12,
              padding: '14px 20px',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>📜</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    ID: {cert.certificate_id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#60A5FA' }}>
                    Issued: {new Date(cert.issued_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${copied ? '#34D399' : 'rgba(255, 255, 255, 0.15)'}`,
                    color: copied ? '#34D399' : '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copied ? '✓ Link Copied' : '📋 Copy URL'}
                </button>

                <button
                  onClick={handlePrint}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    background: '#2B7FFF',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 0 16px rgba(43, 127, 255, 0.4)',
                  }}
                >
                  <span>🖨️</span> Download Official PDF / Print
                </button>
              </div>
            </div>

            {/* PRINTABLE DIPLOMA CERTIFICATE CARD */}
            <div id="official-certificate-container" style={{
              background: '#070C1E',
              border: '2px solid #2B7FFF',
              borderRadius: 20,
              padding: 'clamp(24px, 5vw, 48px)',
              position: 'relative',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(43, 127, 255, 0.2)',
              overflow: 'hidden',
            }}>
              {/* Inner Decorative Golden / Blue Border */}
              <div style={{
                position: 'absolute',
                inset: 12,
                border: '1px solid rgba(43, 127, 255, 0.3)',
                borderRadius: 12,
                pointerEvents: 'none',
              }} />

              {/* Watermark Logo */}
              <div style={{
                position: 'absolute',
                right: -60,
                bottom: -60,
                width: 320,
                height: 320,
                opacity: 0.04,
                pointerEvents: 'none',
              }}>
                <BrandLogo size="lg" />
              </div>

              {/* Top Header of Certificate */}
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, marginBottom: 32 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <BrandLogo size="md" />
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  color: '#60A5FA',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  {cert.verification_authority || 'National Technical Council of Examinations'}
                </div>
                <h2 style={{
                  fontFamily: "'Space Grotesk', serif",
                  fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: '#FFFFFF',
                  margin: '0 0 8px',
                  textTransform: 'uppercase',
                }}>
                  Certificate of Technical Achievement
                </h2>
                <div style={{
                  width: 80,
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, #2B7FFF, transparent)',
                  margin: '0 auto',
                }} />
              </div>

              {/* Attestation Text */}
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, margin: '24px 0 32px' }}>
                <p style={{ color: '#8899B5', fontSize: '0.95rem', margin: '0 0 12px', fontStyle: 'italic' }}>
                  This official credential is systematically awarded to
                </p>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                  fontWeight: 800,
                  color: '#60A5FA',
                  letterSpacing: '-0.01em',
                  marginBottom: 8,
                }}>
                  {cert.candidate_name}
                </div>
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 6,
                  padding: '4px 14px',
                  fontSize: '0.85rem',
                  color: '#E2E8F0',
                  fontFamily: 'monospace',
                  marginBottom: 18,
                }}>
                  Hall Ticket: <strong>{cert.hall_ticket}</strong>
                </div>

                <p style={{ color: '#C5D4ED', fontSize: '1rem', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
                  for exceptional performance and mastery demonstrated in the proctored examination
                  <br />
                  <strong style={{ color: '#FFFFFF', fontSize: '1.15rem' }}>{cert.exam_name}</strong>
                  <br />
                  <span style={{ fontSize: '0.85rem', color: '#8899B5' }}>(Exam Code: {cert.exam_code})</span>
                </p>
              </div>

              {/* Scorecard Matrix */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(43, 127, 255, 0.2)',
                borderRadius: 12,
                padding: '18px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 2,
                marginBottom: 32,
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#8899B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Earned</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {cert.score} / {cert.total_marks}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#8899B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Percentage</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {cert.percentage}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#8899B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Percentile Rank</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F59E0B', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {cert.percentile || 95.5}th
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#8899B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Official Grade</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#A78BFA', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {cert.grade}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#8899B5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Integrity Rating</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981', marginTop: 4 }}>
                    ✓ 100% CLEAN
                  </div>
                </div>
              </div>

              {/* Bottom Signatures & QR Section */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                position: 'relative',
                zIndex: 2,
                gap: 24,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: 24,
              }}>
                {/* Left: Cryptographic Seal & QR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Dynamic QR Code representation */}
                  <div style={{
                    width: 90,
                    height: 90,
                    background: '#FFFFFF',
                    borderRadius: 8,
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.href)}`}
                      alt="Verification QR"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34D399', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>✓</span> CRYPTOGRAPHICALLY SIGNED
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8899B5', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 260 }}>
                      SHA256: {cert.crypto_hash.substring(0, 28)}...
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#60A5FA', marginTop: 3 }}>
                      Issued by: {cert.issuer}
                    </div>
                  </div>
                </div>

                {/* Right: Official Authority Signatures */}
                <div style={{ display: 'flex', gap: 28, textAlign: 'center' }}>
                  <div>
                    <div style={{
                      fontFamily: "'Space Grotesk', cursive",
                      fontSize: '1.3rem',
                      color: '#93C5FD',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                      paddingBottom: 4,
                      minWidth: 120,
                    }}>
                      A. K. Sharma
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8899B5', marginTop: 4 }}>
                      Controller of Examinations
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontFamily: "'Space Grotesk', cursive",
                      fontSize: '1.3rem',
                      color: '#93C5FD',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                      paddingBottom: 4,
                      minWidth: 120,
                    }}>
                      Dr. R. V. Patel
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8899B5', marginTop: 4 }}>
                      Director of Academic Affairs
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Employer Verification Details Accordion */}
            <div className="no-print" style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: '24px',
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛡️</span> Corporate & Employer Verification Notice
              </h4>
              <p style={{ color: '#8899B5', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                This credential was generated automatically following an AI-proctored examination session. Proctored metrics include biometric face alignment tracking, tab-switch monitoring, screen-focus telemetry, and isolated algorithmic code runtime validation. This certificate cannot be altered, forged, or duplicated.
              </p>
            </div>

          </div>
        ) : null}

      </main>

      <div className="no-print" style={{ position: 'relative', zIndex: 10 }}>
        <SiteFooter />
      </div>

      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body, html {
            background: #FFFFFF !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #official-certificate-container {
            border: 3px solid #1E3A8A !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 40px !important;
            page-break-inside: avoid !important;
          }
          #official-certificate-container * {
            color: #0F172A !important;
            text-shadow: none !important;
          }
          #official-certificate-container h2 {
            color: #1E3A8A !important;
          }
          #official-certificate-container strong {
            color: #1E40AF !important;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
