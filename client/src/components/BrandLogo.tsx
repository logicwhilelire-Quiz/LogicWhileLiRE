import React, { useEffect, useState } from 'react';

export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  variant?: 'full' | 'notag' | 'mark' | 'monochrome' | 'auto' | 'hero' | 'standard';
  showTagline?: boolean;
  animated?: boolean;
  className?: string;
  themeOverride?: 'light' | 'dark';
}

/**
 * Official LogicWhile LiRE Master Brand Logo Component (Elevated Edition)
 * Crafted with elevated golden circuit glow, holographic bevel, and high-fidelity typography.
 * 
 * Emblem elements:
 *  - Golden Circuit Board Frame with corner nodes and cyber aura
 *  - "Logic" with Vibrant Amber L, Deep Cyan/Blue Slashed 0 (Ø), Amber g, i, c
 *  - "Whi1e" with Deep Blue Wh, i, e and Vibrant Amber '1'
 *  - Boxed "LiRE" with Deep Blue Li, E and Amber R
 *  - Sub-brand: "Li: Live • R: Real • E: Engine"
 *  - Tagline: "Elevating Coding Knowledge"
 */
export default function BrandLogo({
  size = 'md',
  variant = 'auto',
  showTagline = true,
  animated = false,
  className = '',
  themeOverride,
}: BrandLogoProps) {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (themeOverride) return themeOverride;
    if (typeof document !== 'undefined') {
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (docTheme === 'light' || docTheme === 'dark') return docTheme;
      const saved = localStorage.getItem('logicwhilelire_theme') || localStorage.getItem('LOGICWHILELIRE_theme');
      if (saved === 'light' || saved === 'dark') return saved as 'light' | 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (themeOverride) {
      setCurrentTheme(themeOverride);
      return;
    }

    const checkTheme = () => {
      const docTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
      setCurrentTheme(docTheme === 'dark' ? 'dark' : 'light');
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [themeOverride]);

  const isDark = themeOverride ? themeOverride === 'dark' : currentTheme === 'dark';

  // Dimension scaling
  const dims = {
    xs:   { h: 30,  markW: 30,  fontSize: 14, subSize: 8,   tagSize: 7.5, gap: 9 },
    sm:   { h: 44,  markW: 44,  fontSize: 18, subSize: 9.5, tagSize: 8.5, gap: 11 },
    md:   { h: 58,  markW: 58,  fontSize: 22, subSize: 11,  tagSize: 10,  gap: 14 },
    lg:   { h: 78,  markW: 78,  fontSize: 30, subSize: 13,  tagSize: 12,  gap: 16 },
    xl:   { h: 98,  markW: 98,  fontSize: 38, subSize: 16,  tagSize: 14,  gap: 20 },
    hero: { h: 360, markW: 360, fontSize: 52, subSize: 20,  tagSize: 17,  gap: 24 },
  }[size];

  // IARE Institutional Theme palettes
  const goldGlow    = isDark ? 'rgba(234, 168, 18, 0.55)' : 'rgba(234, 168, 18, 0.35)';
  const blueColor   = isDark ? '#FFFFFF' : '#002147';
  const orangeColor = '#EAA812';
  const taglineColor = isDark ? '#F1F5F9' : '#002147';
  const subtextColor = isDark ? '#93C5FD' : '#475569';

  // --- 1. PURE ICON MARK (Exact Emblem Badge) ---
  if (variant === 'mark') {
    return (
      <div
        className={`logicwhilelire-mark-wrapper ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: Math.max(6, Math.round(dims.h * 0.16)),
            padding: 2,
            background: isDark
              ? 'linear-gradient(135deg, rgba(255, 194, 0, 0.6) 0%, rgba(56, 189, 248, 0.4) 50%, rgba(255, 122, 0, 0.5) 100%)'
              : 'linear-gradient(135deg, rgba(234, 179, 8, 0.5) 0%, rgba(0, 18, 122, 0.3) 100%)',
            boxShadow: isDark
              ? `0 0 16px ${goldGlow}, 0 2px 8px rgba(0,0,0,0.5)`
              : '0 2px 10px rgba(0,0,0,0.14)',
          }}
        >
          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile LiRE Official Logo"
            style={{
              height: dims.h,
              width: dims.h,
              objectFit: 'contain',
              borderRadius: Math.max(4, Math.round(dims.h * 0.13)),
              background: '#FFFFFF',
              padding: Math.max(2, Math.round(dims.h * 0.04)),
              display: 'block',
            }}
          />
        </div>
      </div>
    );
  }

  // --- 2. FULL / HERO MASTER LOGO (Elevated Masterpiece) ---
  if (variant === 'full' || variant === 'hero') {
    return (
      <div 
        className={`logicwhilelire-hero-emblem ${className}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
          maxWidth: '100%',
          position: 'relative',
        }}
        aria-label="LogicWhile LiRE — Elevating Coding Knowledge"
      >
        <div
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(13, 22, 48, 0.92) 0%, rgba(7, 12, 28, 0.95) 100%)'
              : 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
            border: isDark ? '1.5px solid rgba(255, 194, 0, 0.5)' : '1px solid rgba(0,0,0,0.12)',
            borderRadius: 20,
            padding: 14,
            boxShadow: isDark
              ? '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 32px rgba(255, 194, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
              : '0 12px 36px rgba(0, 0, 0, 0.14)',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Ambient Corner Accent Bulbs */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(255, 194, 0, 0.15)',
              border: '1px solid rgba(255, 194, 0, 0.4)',
              fontSize: '0.66rem',
              fontWeight: 800,
              color: '#FFC200',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#FFC200', boxShadow: '0 0 6px #FFC200' }} />
            <span>OFFICIAL EMBLEM</span>
          </div>

          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile LiRE — Elevating Coding Knowledge"
            style={{
              maxWidth: size === 'hero' ? 440 : size === 'lg' ? 320 : size === 'xl' ? 380 : 270,
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              background: '#FFFFFF',
              borderRadius: 12,
              padding: 6,
            }}
          />

          {showTagline && (
            <div
              style={{
                marginTop: 10,
                padding: '4px 14px',
                borderRadius: 20,
                background: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(0, 18, 122, 0.06)',
                border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(0, 18, 122, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isDark ? '#38BDF8' : '#00127A', letterSpacing: '0.04em' }}>
                ELEVATING CODING KNOWLEDGE
              </span>
              <span style={{ color: '#FF7A00', fontSize: '0.7rem' }}>✦</span>
              <span style={{ fontSize: '0.7rem', color: isDark ? '#94A3B8' : '#64748B', fontWeight: 700 }}>
                LiRE — Live Rank Engine
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 3. HORIZONTAL / STANDARD ELEVATED LOCKUP (Navbar, Headers, Admin Suite) ---
  const effectiveShowTagline = showTagline && variant !== 'notag';

  return (
    <div
      className={`logicwhilelire-brand-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dims.gap,
        textDecoration: 'none',
        userSelect: 'none',
        position: 'relative',
      }}
      aria-label="LogicWhile LiRE — Elevating Coding Knowledge"
    >
      {/* Official Elevated Emblem Mark Image */}
      <div
        style={{
          position: 'relative',
          borderRadius: Math.max(6, Math.round(dims.h * 0.16)),
          padding: 2,
          background: isDark
            ? 'linear-gradient(135deg, rgba(255, 194, 0, 0.7) 0%, rgba(56, 189, 248, 0.4) 50%, rgba(255, 122, 0, 0.6) 100%)'
            : 'linear-gradient(135deg, rgba(234, 179, 8, 0.4) 0%, rgba(0, 18, 122, 0.25) 100%)',
          boxShadow: isDark
            ? `0 0 16px ${goldGlow}, 0 2px 8px rgba(0,0,0,0.6)`
            : '0 2px 8px rgba(0,0,0,0.12)',
          flexShrink: 0,
        }}
      >
        <img
          src="/brand/logicwhilelire-official.png"
          alt="LogicWhile LiRE"
          style={{
            height: dims.h,
            width: dims.h,
            objectFit: 'contain',
            borderRadius: Math.max(4, Math.round(dims.h * 0.13)),
            background: '#FFFFFF',
            padding: Math.max(2, Math.round(dims.h * 0.04)),
            display: 'block',
          }}
        />
      </div>

      {/* Typography Lockup Column */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.15 }}>
        {/* Wordmark: LogicWhile LiRE */}
        <div
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk', system-ui, sans-serif)",
            fontSize: dims.fontSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'inline-flex',
            alignItems: 'baseline',
            whiteSpace: 'nowrap',
          }}
        >
          {/* LogicWhile Wordmark in rich institutional amber */}
          <span
            style={{
              color: '#EAA812',
              fontWeight: 900,
              textShadow: isDark ? '0 0 14px rgba(234, 168, 18, 0.5)' : 'none',
              letterSpacing: '-0.01em',
            }}
          >
            LogicWhile
          </span>

          <span style={{ width: Math.round(dims.fontSize * 0.35) }} />

          {/* Elevated Boxed LiRE badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: 6,
              border: `1.8px solid ${isDark ? '#EAA812' : '#D97706'}`,
              background: isDark
                ? 'linear-gradient(135deg, rgba(234, 168, 18, 0.22) 0%, rgba(245, 158, 11, 0.12) 100%)'
                : 'rgba(234, 168, 18, 0.15)',
              boxShadow: isDark ? '0 0 12px rgba(234, 168, 18, 0.35)' : 'none',
              fontSize: Math.round(dims.fontSize * 0.88),
              fontWeight: 900,
              letterSpacing: '0.06em',
              color: isDark ? '#FFFFFF' : '#002147',
            }}
          >
            LiRE
          </span>
        </div>

        {/* Sub-Brand & Tagline: Render both highlighted lines matching official brand specification */}
        {effectiveShowTagline && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2, gap: 1 }}>
            {/* Sub-Brand Definition: LiRE — Live Rank Engine */}
            <div
              style={{
                fontFamily: "var(--font-display, 'Space Grotesk', system-ui, sans-serif)",
                fontSize: size === 'xs' ? 8 : size === 'sm' ? 10 : dims.subSize,
                fontWeight: 800,
                color: '#38BDF8',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textShadow: isDark ? '0 0 8px rgba(56, 189, 248, 0.5)' : 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: size === 'sm' ? 5 : 6,
                  height: size === 'sm' ? 5 : 6,
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 8px #10B981',
                }}
              />
              <span style={{ color: '#38BDF8', fontWeight: 800 }}>LiRE — Live Rank Engine</span>
            </div>

            {/* Tagline: Elevating Coding Knowledge */}
            <div
              style={{
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui, sans-serif)",
                fontSize: size === 'xs' ? 7.5 : size === 'sm' ? 9.5 : dims.tagSize,
                fontWeight: 800,
                color: isDark ? '#FFFFFF' : '#002147',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
              }}
            >
              Elevating Coding Knowledge
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
