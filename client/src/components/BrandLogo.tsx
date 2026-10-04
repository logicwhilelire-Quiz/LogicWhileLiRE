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
 * Official Logic Whi1e LiRE Master Brand Logo Component
 * Uses the exact official emblem image uploaded by the user with pixel-perfect fidelity.
 * 
 * Emblem elements:
 *  - Golden Circuit Board Frame with corner turns, nodes, and right-hand bulb with 3 rays
 *  - "Logic" with Orange L, Deep Blue Slashed 0 (Ø), Orange scanline g, i, and ray-receiving c
 *  - "Whi1e" with Deep Blue W, h, i, e and Vibrant Orange '1'
 *  - Boxed "LiRE" with Deep Blue L, i, E and Orange Scanline R
 *  - Legend: "Li: Live • R: Real • E: Engine"
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
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

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
    xs:   { h: 28,  markW: 28,  fontSize: 14, subSize: 8,   tagSize: 7.5, gap: 8 },
    sm:   { h: 42,  markW: 42,  fontSize: 18, subSize: 9.5, tagSize: 8.5, gap: 10 },
    md:   { h: 56,  markW: 56,  fontSize: 22, subSize: 11,  tagSize: 10,  gap: 14 },
    lg:   { h: 76,  markW: 76,  fontSize: 30, subSize: 13,  tagSize: 12,  gap: 16 },
    xl:   { h: 96,  markW: 96,  fontSize: 38, subSize: 16,  tagSize: 14,  gap: 20 },
    hero: { h: 360, markW: 360, fontSize: 52, subSize: 20,  tagSize: 17,  gap: 24 },
  }[size];

  // Theme palettes
  const goldGlow    = isDark ? 'rgba(255, 190, 0, 0.45)' : 'rgba(234, 179, 8, 0.25)';
  const blueColor   = isDark ? '#38BDF8' : '#00127A';
  const orangeColor = '#FF7A00';
  const taglineColor = isDark ? '#E2E8F0' : '#0A1C68';
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
        }}
      >
        <img
          src="/brand/logicwhilelire-official.png"
          alt="Logic Whi1e LiRE Emblem"
          style={{
            height: dims.h,
            width: dims.h,
            objectFit: 'contain',
            borderRadius: Math.max(4, Math.round(dims.h * 0.12)),
            background: '#FFFFFF',
            padding: Math.max(2, Math.round(dims.h * 0.04)),
            boxShadow: isDark
              ? `0 0 12px ${goldGlow}, 0 0 1px 1px rgba(255,190,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.12)',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // --- 2. FULL / HERO MASTER LOGO (The Exact Square Emblem from User Image) ---
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
        }}
        aria-label="Logic Whi1e LiRE — Elevating Coding Knowledge"
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            padding: 12,
            boxShadow: isDark
              ? '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 190, 0, 0.35), 0 0 1px 1px rgba(255, 190, 0, 0.5)'
              : '0 10px 30px rgba(0, 0, 0, 0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/brand/logicwhilelire-official.png"
            alt="Logic Whi1e LiRE — Elevating Coding Knowledge"
            style={{
              maxWidth: size === 'hero' ? 440 : size === 'lg' ? 320 : size === 'xl' ? 380 : 260,
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      </div>
    );
  }

  // --- 3. HORIZONTAL / STANDARD LOCKUP (Navbar, Headers, Compact Footers) ---
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
      }}
      aria-label="Logic Whi1e LiRE — Elevating Coding Knowledge"
    >
      {/* Official Emblem Mark Image */}
      <img
        src="/brand/logicwhilelire-official.png"
        alt="Logic Whi1e LiRE"
        style={{
          height: dims.h,
          width: dims.h,
          objectFit: 'contain',
          borderRadius: Math.max(4, Math.round(dims.h * 0.12)),
          background: '#FFFFFF',
          padding: Math.max(2, Math.round(dims.h * 0.05)),
          boxShadow: isDark
            ? `0 0 12px ${goldGlow}, 0 0 1px 1px rgba(255,190,0,0.4)`
            : '0 2px 8px rgba(0,0,0,0.12)',
          flexShrink: 0,
          display: 'block',
        }}
      />

      {/* Typography Lockup Column */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.15 }}>
        {/* Wordmark: Logic Whi1e LiRE */}
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
          {/* Logic */}
          <span style={{ color: orangeColor }}>L</span>
          <span style={{ color: blueColor, fontWeight: 900 }}>o</span>
          <span style={{ color: orangeColor }}>g</span>
          <span style={{ color: orangeColor }}>i</span>
          <span style={{ color: orangeColor }}>c</span>

          <span style={{ width: Math.round(dims.fontSize * 0.28) }} />

          {/* Whi1e */}
          <span style={{ color: blueColor }}>Wh</span>
          <span style={{ color: blueColor }}>i</span>
          <span style={{ color: orangeColor, fontWeight: 900 }}>1</span>
          <span style={{ color: blueColor }}>e</span>

          <span style={{ width: Math.round(dims.fontSize * 0.32) }} />

          {/* Boxed LiRE badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 6px',
              borderRadius: 4,
              border: `1.5px solid ${isDark ? '#FFBE00' : '#EAB308'}`,
              background: isDark ? 'rgba(255, 190, 0, 0.12)' : 'rgba(234, 179, 8, 0.12)',
              fontSize: Math.round(dims.fontSize * 0.88),
              fontWeight: 900,
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ color: blueColor }}>Li</span>
            <span style={{ color: orangeColor }}>R</span>
            <span style={{ color: blueColor }}>E</span>
          </span>
        </div>

        {/* Sub-Brand Definition: Li: Live • R: Real • E: Engine */}
        <div
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: dims.subSize,
            fontWeight: 700,
            color: subtextColor,
            letterSpacing: '0.05em',
            marginTop: 2,
            whiteSpace: 'nowrap',
          }}
        >
          Li: Live • R: Real • E: Engine
        </div>

        {/* Tagline: Elevating Coding Knowledge */}
        {effectiveShowTagline && (
          <div
            style={{
              fontFamily: "var(--font-display, system-ui, sans-serif)",
              fontSize: dims.tagSize,
              fontWeight: 700,
              color: taglineColor,
              letterSpacing: '0.01em',
              marginTop: 1,
              whiteSpace: 'nowrap',
            }}
          >
            Elevating Coding Knowledge
          </div>
        )}
      </div>
    </div>
  );
}
