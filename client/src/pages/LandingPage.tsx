import React, { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlowCard from '../components/3d/GlowCard';
import BrandLogo from '../components/BrandLogo';

// Lazy-load 3D particle field for background
const ParticleField = lazy(() => import('../components/3d/ParticleField'));

export default function LandingPage() {
  const navigate = useNavigate();

  const entries = [
    {
      id: 'candidate-gate',
      title: 'Candidate Gate',
      badge: 'Live Assessment Gate',
      badgeColor: '#38BDF8',
      icon: '🛡️',
      description: 'Direct entry for scheduled candidates. Verify your Hall Ticket and unique Exam Code, complete pre-flight environment clearance, and access your live proctored station.',
      primaryActionText: 'Enter Candidate Gate',
      path: '/gate',
      gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(37, 99, 235, 0.06) 100%)',
      borderColor: 'rgba(56, 189, 248, 0.4)',
      glowColor: 'rgba(56, 189, 248, 0.45)',
      btnGradient: 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
    },
    {
      id: 'student-id',
      title: 'Student ID',
      badge: 'Candidate Portal',
      badgeColor: '#10B981',
      icon: '🎓',
      description: 'Authenticate with your institutional Student ID or Roll Number to access your section-targeted upcoming assessments, live countdowns, and performance reports.',
      primaryActionText: 'Student ID Login',
      path: '/login',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.06) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.4)',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      btnGradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    },
    {
      id: 'admin',
      title: 'Admin',
      badge: 'Staff Command Hub',
      badgeColor: '#A855F7',
      icon: '🏛️',
      description: 'Shared staff login for Super Admins, College Inspectors, and Section Faculty. Automatically routes each user to their role-specific console upon authentication.',
      primaryActionText: 'Staff & Admin Login',
      path: '/admin',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.16) 0%, rgba(124, 58, 237, 0.06) 100%)',
      borderColor: 'rgba(168, 85, 247, 0.4)',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      btnGradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #0A1128 0%, #030712 100%)',
        color: '#F8FAFC',
        overflow: 'hidden',
        padding: '40px 20px',
        boxSizing: 'border-box',
      }}
    >
      {/* 3D Particle Field Background with Fallback */}
      <Suspense fallback={<div className="particle-fallback" />}>
        <ParticleField count={800} />
      </Suspense>

      {/* Subtle Ambient Radial Lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70vw',
          height: '40vh',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Main Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1240,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Header / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            textAlign: 'center',
            marginBottom: 44,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <BrandLogo size="lg" />
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              margin: '0 0 10px 0',
              background: 'linear-gradient(180deg, #FFFFFF 30%, #94A3B8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            Autonomous Assessment Platform
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)',
              color: '#94A3B8',
              maxWidth: 580,
              margin: 0,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            Select your portal to proceed with section-targeted evaluations and real-time synchronization.
          </p>
        </motion.div>

        {/* The Three Large 3D Entry Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 28,
            width: '100%',
            marginBottom: 36,
          }}
        >
          {entries.map((card, idx) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'flex' }}
            >
              <GlowCard
                glowColor={card.glowColor}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: card.gradient,
                  border: `1px solid ${card.borderColor}`,
                  borderRadius: 22,
                  padding: '36px 30px',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
                }}
              >
                {/* Card Top Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 14px',
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: `1px solid ${card.borderColor}`,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: card.badgeColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: card.badgeColor,
                        boxShadow: `0 0 10px ${card.badgeColor}`,
                      }}
                    />
                    {card.badge}
                  </span>

                  <span style={{ fontSize: '2.5rem' }}>{card.icon}</span>
                </div>

                {/* Card Title */}
                <h2
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    margin: '0 0 12px 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {card.title}
                </h2>

                {/* Card Description */}
                <p
                  style={{
                    fontSize: '0.92rem',
                    color: '#94A3B8',
                    lineHeight: 1.6,
                    margin: '0 0 32px 0',
                    flex: 1,
                  }}
                >
                  {card.description}
                </p>

                {/* Primary Action Button */}
                <button
                  id={`home-entry-${card.id}`}
                  onClick={() => navigate(card.path)}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background: card.btnGradient,
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: `0 4px 20px ${card.glowColor}`,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {card.primaryActionText}
                  <span style={{ fontSize: '1.15rem' }}>→</span>
                </button>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        {/* Footer Identity Notice */}
        <div
          style={{
            fontSize: '0.75rem',
            color: '#64748B',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>LogicWhileLiRE Enterprise System</span>
          <span>•</span>
          <span>Role-Based Access Control</span>
          <span>•</span>
          <span>Microsecond Telemetry Sync</span>
        </div>
      </div>
    </div>
  );
}
