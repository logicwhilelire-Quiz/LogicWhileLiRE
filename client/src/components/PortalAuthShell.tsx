import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ui/ThemeToggle';
import { IconUsers, IconAward, IconShield, IconRadio, IconLaunch } from './icons/HumanIcons';

export type PortalKey = 'Student' | 'ExamGate' | 'Faculty' | 'Inspector' | 'Admin';

interface PortalConfig {
  key: PortalKey;
  label: string;
  to: string;
  accent: string;
  glow: string;
  bg: string;
  border: string;
}

const PORTALS: PortalConfig[] = [
  {
    key: 'Student',
    label: 'Student',
    to: '/login',
    accent: '#60A5FA',
    glow: 'rgba(59, 130, 246, 0.32)',
    bg: 'rgba(37, 99, 235, 0.22)',
    border: 'rgba(96, 165, 250, 0.55)',
  },
  {
    key: 'ExamGate',
    label: 'Exam Code',
    to: '/enter-exam',
    accent: '#34D399',
    glow: 'rgba(16, 185, 129, 0.30)',
    bg: 'rgba(16, 185, 129, 0.18)',
    border: 'rgba(52, 211, 153, 0.50)',
  },
  {
    key: 'Faculty',
    label: 'Faculty',
    to: '/faculty/login',
    accent: '#FB923C',
    glow: 'rgba(255, 122, 0, 0.34)',
    bg: 'rgba(255, 122, 0, 0.20)',
    border: 'rgba(255, 122, 0, 0.55)',
  },
  {
    key: 'Inspector',
    label: 'Inspector',
    to: '/inspector',
    accent: '#A78BFA',
    glow: 'rgba(139, 92, 246, 0.32)',
    bg: 'rgba(139, 92, 246, 0.20)',
    border: 'rgba(167, 139, 250, 0.55)',
  },
  {
    key: 'Admin',
    label: 'Admin',
    to: '/admin',
    accent: '#FFD000',
    glow: 'rgba(255, 180, 0, 0.36)',
    bg: 'rgba(255, 180, 0, 0.20)',
    border: 'rgba(255, 180, 0, 0.60)',
  },
];

function PortalIcon({ portal, color }: { portal: PortalKey; color: string }) {
  switch (portal) {
    case 'Student':
      return <IconUsers size={13} color={color} />;
    case 'ExamGate':
      return <IconLaunch size={13} color={color} />;
    case 'Faculty':
      return <IconAward size={13} color={color} />;
    case 'Inspector':
      return <IconRadio size={13} color={color} />;
    case 'Admin':
      return <IconShield size={13} color={color} />;
  }
}

export interface PortalAuthShellProps {
  activePortal: PortalKey;
  badgeText: string;
  title: string;
  subtitle: string;
  capabilities: string[];
  accentColor?: string;
  accentGlow?: string;
  maxWidth?: number;
  children: React.ReactNode;
}

/**
 * Shared LogicWhile › LiRE Sub-Branch Portal Authentication Shell.
 * Unifies all login gateways under the official Logo Color System (Navy #0A1C68 · Orange #FF7A00 · Gold #FFB400)
 * with corporate parent/sub-branch navigation and role capability telemetry.
 */
export default function PortalAuthShell({
  activePortal,
  badgeText,
  title,
  subtitle,
  capabilities,
  accentColor = '#FFB400',
  accentGlow = 'rgba(255, 180, 0, 0.25)',
  maxWidth = 450,
  children,
}: PortalAuthShellProps) {
  const [hoveredTab, setHoveredTab] = useState<PortalKey | null>(null);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at 50% 0%, #0A1C68 0%, #050B22 52%, #030718 100%)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Official Logo Circuit Backdrop */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255, 180, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 180, 0, 0.05) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 760,
            height: 360,
            background: `radial-gradient(ellipse, ${accentGlow} 0%, transparent 70%)`,
            filter: 'blur(35px)',
          }}
        />
      </div>

      {/* Top Corporate Lineage Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid rgba(255, 180, 0, 0.22)',
          background: 'rgba(5, 11, 34, 0.72)',
          backdropFilter: 'blur(12px)',
          padding: '10px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#FFD000',
              fontSize: '0.78rem',
              fontWeight: 800,
              textDecoration: 'none',
              padding: '5px 12px',
              borderRadius: 8,
              background: 'rgba(255, 180, 0, 0.10)',
              border: '1px solid rgba(255, 180, 0, 0.30)',
            }}
          >
            <span>←</span>
            <span>LogicWhile Home</span>
          </Link>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7A00', boxShadow: '0 0 8px #FF7A00' }} />
            <span style={{ color: '#FF7A00' }}>LogicWhile</span>
            <span style={{ color: '#64748B' }}>›</span>
            <span style={{ color: '#CBD5E1' }}>LiRE Sub-Branch Portal</span>
          </div>

          <ThemeToggle />
        </div>
      </div>

      {/* Main Centered Portal Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px 44px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth }}
        >
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10, 28, 104, 0.55)',
                  border: '1.5px solid rgba(255, 180, 0, 0.38)',
                  borderRadius: 16,
                  padding: '10px 20px',
                  boxShadow: '0 8px 26px rgba(0, 0, 0, 0.45), 0 0 22px rgba(255, 180, 0, 0.14)',
                }}
              >
                <BrandLogo size="sm" variant="standard" showTagline={true} themeOverride="dark" />
              </div>
            </Link>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: `${accentColor}1A`,
                  border: `1px solid ${accentColor}55`,
                  borderRadius: 999,
                  padding: '4px 14px',
                  fontSize: '0.71rem',
                  fontWeight: 800,
                  color: accentColor,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                  }}
                />
                {badgeText}
              </div>
            </div>

            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 900,
                margin: '0 0 4px',
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              {title}
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.83rem', margin: 0 }}>{subtitle}</p>
          </div>

          {/* Unified 5-Portal Switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              background: 'rgba(7, 19, 75, 0.72)',
              padding: 4,
              borderRadius: 12,
              border: '1px solid rgba(255, 180, 0, 0.22)',
              marginBottom: 16,
              gap: 3,
              backdropFilter: 'blur(12px)',
            }}
          >
            {PORTALS.map((portal) => {
              const isActive = portal.key === activePortal;
              const isHover = hoveredTab === portal.key;
              return (
                <Link
                  key={portal.key}
                  to={portal.to}
                  onMouseEnter={() => setHoveredTab(portal.key)}
                  onMouseLeave={() => setHoveredTab(null)}
                  style={{
                    textAlign: 'center',
                    padding: '7px 4px',
                    borderRadius: 8,
                    fontSize: '0.71rem',
                    fontWeight: 800,
                    color: isActive || isHover ? portal.accent : '#94A3B8',
                    background: isActive ? portal.bg : isHover ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: `1px solid ${isActive ? portal.border : 'transparent'}`,
                    boxShadow: isActive ? `0 0 12px ${portal.glow}` : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <PortalIcon portal={portal.key} color={isActive || isHover ? portal.accent : '#94A3B8'} />
                  <span>{portal.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Main Glass Portal Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            style={{
              background: 'linear-gradient(155deg, rgba(10, 28, 104, 0.56) 0%, rgba(5, 11, 34, 0.94) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: `1.5px solid ${accentColor}55`,
              borderRadius: 20,
              padding: '26px 26px 24px',
              boxShadow: `0 24px 64px rgba(0, 0, 0, 0.65), 0 0 42px ${accentGlow}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '12%',
                right: '12%',
                height: 2,
                background: `linear-gradient(90deg, transparent, ${accentColor}, #FF7A00, transparent)`,
              }}
            />

            {/* Role Capabilities Pill Strip */}
            {capabilities.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {capabilities.map((cap) => (
                  <span
                    key={cap}
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      color: '#E2E8F0',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 180, 0, 0.22)',
                      borderRadius: 999,
                      padding: '3px 9px',
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}

            {children}
          </motion.div>

          {/* Corporate Hierarchy Footer */}
          <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
            <strong style={{ color: '#FF7A00' }}>Logic</strong>
            <strong style={{ color: '#FFFFFF' }}>While</strong> (Parent Company) &bull;{' '}
            <span style={{ color: '#FFD000', fontWeight: 700 }}>LiRE Assessment Sub-Branch</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
