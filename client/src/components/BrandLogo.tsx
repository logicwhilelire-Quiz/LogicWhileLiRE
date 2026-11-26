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
      const docTheme = document.documentElement.getAttribute('data-theme');
      setCurrentTheme(docTheme === 'light' ? 'light' : 'dark');
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [themeOverride]);

  const isDark = themeOverride ? themeOverride === 'dark' : currentTheme !== 'light';

  // Dimension scaling
  const dims = {
    xs:   { h: 30,  markW: 30,  fontSize: 14, subSize: 8,   tagSize: 7.5, gap: 9 },
    sm:   { h: 44,  markW: 44,  fontSize: 18, subSize: 9.5, tagSize: 8.5, gap: 11 },
    md:   { h: 58,  markW: 58,  fontSize: 22, subSize: 11,  tagSize: 10,  gap: 14 },
    lg:   { h: 78,  markW: 78,  fontSize: 30, subSize: 13,  tagSize: 12,  gap: 16 },
    xl:   { h: 98,  markW: 98,  fontSize: 38, subSize: 16,  tagSize: 14,  gap: 20 },
    hero: { h: 360, markW: 360, fontSize: 52, subSize: 20,  tagSize: 17,  gap: 24 },
  }[size];

  // LogicWhile LiRE Official Logo Color Palette (Navy #0A1C68 · Orange #FF7A00 · Gold #FFB400)
  const goldGlow    = isDark ? 'rgba(255, 180, 0, 0.55)' : 'rgba(255, 180, 0, 0.35)';
  const navyAccent  = isDark ? '#FFFFFF' : '#0A1C68';
  const orangeColor = '#FF7A00';
  const goldColor   = '#FFB400';

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
              ? 'linear-gradient(135deg, #FFD000 0%, #FFB400 45%, #FF7A00 100%)'
              : 'linear-gradient(135deg, #FFB400 0%, #FF7A00 50%, #0A1C68 100%)',
            boxShadow: isDark
              ? `0 0 18px ${goldGlow}, 0 2px 8px rgba(0,0,0,0.5)`
              : '0 2px 10px rgba(10, 28, 104, 0.18)',
          }}
        >
          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile — LiRE Official Logo"
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
        aria-label="LogicWhile — LiRE Assessment Sub-Branch · Elevating Coding Knowledge"
      >
        <div
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(10, 28, 104, 0.88) 0%, rgba(5, 11, 34, 0.96) 100%)'
              : 'linear-gradient(145deg, #FFFFFF 0%, #FFFBEB 100%)',
            border: isDark ? '1.5px solid rgba(255, 180, 0, 0.55)' : '1.5px solid rgba(10, 28, 104, 0.16)',
            borderRadius: 20,
            padding: 16,
            boxShadow: isDark
              ? '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 32px rgba(255, 180, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
              : '0 12px 36px rgba(10, 28, 104, 0.14)',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Corporate Lineage Pill */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 12,
              background: isDark ? 'rgba(255, 122, 0, 0.18)' : 'rgba(10, 28, 104, 0.08)',
              border: `1px solid ${isDark ? 'rgba(255, 180, 0, 0.5)' : 'rgba(10, 28, 104, 0.22)'}`,
              fontSize: '0.64rem',
              fontWeight: 800,
              color: isDark ? goldColor : '#0A1C68',
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: orangeColor, boxShadow: `0 0 6px ${orangeColor}` }} />
            <span>LOGICWHILE › LiRE DIVISION</span>
          </div>

          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile — LiRE Assessment Division"
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
                padding: '5px 14px',
                borderRadius: 20,
                background: isDark ? 'rgba(255, 180, 0, 0.1)' : 'rgba(10, 28, 104, 0.06)',
                border: isDark ? '1px solid rgba(255, 180, 0, 0.35)' : '1px solid rgba(10, 28, 104, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isDark ? goldColor : '#0A1C68', letterSpacing: '0.04em' }}>
                ELEVATING CODING KNOWLEDGE
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="#FF7A00" aria-hidden="true"><polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" /></svg>
              </span>
              <span style={{ fontSize: '0.68rem', color: isDark ? '#FDBA74' : '#EA580C', fontFamily: 'monospace', fontWeight: 700 }}>
                Li: Live • R: Real • E: Engine
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
      aria-label="LogicWhile — LiRE Assessment Sub-Branch · Elevating Coding Knowledge"
    >
      {/* Official Elevated Emblem Mark Image */}
      <div
        style={{
          position: 'relative',
          borderRadius: Math.max(6, Math.round(dims.h * 0.16)),
          padding: 2,
          background: isDark
            ? 'linear-gradient(135deg, #FFD000 0%, #FFB400 50%, #FF7A00 100%)'
            : 'linear-gradient(135deg, #FFB400 0%, #FF7A00 55%, #0A1C68 100%)',
          boxShadow: isDark
            ? `0 0 16px ${goldGlow}, 0 2px 8px rgba(0,0,0,0.6)`
            : '0 2px 8px rgba(10, 28, 104, 0.16)',
          flexShrink: 0,
        }}
      >
        <img
          src="/brand/logicwhilelire-official.png"
          alt="LogicWhile"
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
        {/* Wordmark: LogicWhile (Single Word Parent Company) + LiRE (Sub-Branch Badge) */}
        <div
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk', system-ui, sans-serif)",
            fontSize: dims.fontSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {/* LogicWhile strictly formatted as one cohesive single word using Logo Orange + Navy/White */}
          <span style={{ fontWeight: 900, letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'baseline' }}>
            <span style={{ color: orangeColor, textShadow: isDark ? '0 0 12px rgba(255, 122, 0, 0.35)' : 'none' }}>
              Logic
            </span>
            <span style={{ color: isDark ? '#FFFFFF' : '#0A1C68', textShadow: isDark ? '0 0 10px rgba(59, 130, 246, 0.35)' : 'none' }}>
              While
            </span>
          </span>

          <span style={{ width: Math.round(dims.fontSize * 0.36) }} />

          {/* Elevated Boxed LiRE Sub-Branch Badge */}
          <span
            title="LiRE — Assessment Sub-Branch of LogicWhile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 7px',
              borderRadius: 6,
              border: `1.8px solid ${goldColor}`,
              background: isDark
                ? 'linear-gradient(135deg, rgba(255, 180, 0, 0.20) 0%, rgba(255, 122, 0, 0.14) 100%)'
                : 'linear-gradient(135deg, rgba(255, 208, 0, 0.22) 0%, rgba(255, 122, 0, 0.12) 100%)',
              boxShadow: isDark ? '0 0 12px rgba(255, 180, 0, 0.32)' : 'none',
              fontSize: Math.round(dims.fontSize * 0.80),
              fontWeight: 900,
              letterSpacing: '0.06em',
              color: navyAccent,
            }}
          >
            <span>Li</span>
            <span style={{ color: orangeColor }}>R</span>
            <span>E</span>
          </span>
        </div>

        {/* Sub-Brand & Tagline: Parent -> Sub-Branch Hierarchy */}
        {effectiveShowTagline && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2, gap: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
                fontSize: size === 'xs' ? 8 : size === 'sm' ? 9.5 : dims.subSize,
                fontWeight: 700,
                color: isDark ? goldColor : '#EA580C',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: size === 'sm' ? 5 : 6,
                  height: size === 'sm' ? 5 : 6,
                  borderRadius: '50%',
                  background: orangeColor,
                  boxShadow: `0 0 8px ${orangeColor}`,
                }}
              />
              <span style={{ color: isDark ? '#FDBA74' : '#EA580C', fontWeight: 800 }}>Li: Live</span>
              <span style={{ color: isDark ? '#64748B' : '#94A3B8' }}>•</span>
              <span style={{ color: isDark ? '#FFD000' : '#0A1C68', fontWeight: 800 }}>R: Real</span>
              <span style={{ color: isDark ? '#64748B' : '#94A3B8' }}>•</span>
              <span style={{ color: isDark ? '#FDBA74' : '#EA580C', fontWeight: 800 }}>E: Engine</span>
            </div>

            <div
              style={{
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui, sans-serif)",
                fontSize: size === 'xs' ? 7.5 : size === 'sm' ? 9 : dims.tagSize,
                fontWeight: 800,
                color: isDark ? '#E2E8F0' : '#0A1C68',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
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
