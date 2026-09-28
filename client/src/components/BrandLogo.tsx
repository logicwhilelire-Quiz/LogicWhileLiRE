import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'notag' | 'mark' | 'monochrome' | 'auto' | 'hero' | 'standard';
  showTagline?: boolean;
  animated?: boolean;
  className?: string;
  themeOverride?: 'light' | 'dark';
}

export default function BrandLogo({
  size = 'md',
  variant = 'auto',
  showTagline = true,
  animated = false,
  className = '',
  themeOverride,
}: BrandLogoProps) {
  const shouldReduceMotion = useReducedMotion();
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

  // Size specifications
  const dimensions = {
    xs: { h: 26, markW: 32, fontSize: 16, tagSize: 8.5, gap: 6 },
    sm: { h: 36, markW: 45, fontSize: 22, tagSize: 11.5, gap: 8 },
    md: { h: 48, markW: 60, fontSize: 30, tagSize: 15, gap: 12 },
    lg: { h: 64, markW: 80, fontSize: 40, tagSize: 20, gap: 14 },
    xl: { h: 84, markW: 105, fontSize: 52, tagSize: 26, gap: 18 },
  }[size];

  // Palette selection
  const markStroke = isDark ? '#3B82F6' : '#1B5FB5';
  const markFill = isDark ? '#0C1631' : '#FFFFFF';
  const depthStroke = isDark ? '#60A5FA' : '#1B5FB5';
  const arrowColor = isDark ? '#60A5FA' : '#1B5FB5';
  const wordmarkColor = isDark ? '#FFFFFF' : '#0A3F8F';
  const taglineColor = isDark ? '#93C5FD' : '#4A7DBE';

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 200 160"
        height={dimensions.h}
        width={dimensions.markW}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`growran-mark ${className}`}
        aria-label="GROWRAN Logo Mark"
        style={{ flexShrink: 0, display: 'inline-block' }}
      >
        <path d="M20 72 V128 H180 V72" stroke={markStroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 65 C55 60 80 66 96 76 V134 C80 124 55 118 34 123 Z" fill={markFill} stroke={markStroke} strokeWidth="8" strokeLinejoin="round" />
        <path d="M48 76 C65 72 82 76 94 84 V126 C82 118 65 114 48 118 Z" fill="none" stroke={depthStroke} strokeWidth="5" strokeLinejoin="round" opacity="0.9" />
        <path d="M166 65 C145 60 120 66 104 76 V134 C120 124 145 118 166 123 Z" fill={markFill} stroke={markStroke} strokeWidth="8" strokeLinejoin="round" />
        <path d="M152 76 C135 72 118 76 106 84 V126 C118 118 135 114 152 118 Z" fill="none" stroke={depthStroke} strokeWidth="5" strokeLinejoin="round" opacity="0.9" />
        <line x1="100" y1="76" x2="100" y2="134" stroke={markStroke} strokeWidth="7" strokeLinecap="round" />
        <path d="M38 108 L78 74 L106 95 L174 24" stroke={arrowColor} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="182,16 150,22 176,48" fill={arrowColor} stroke={arrowColor} strokeWidth="4" strokeLinejoin="round" />
      </svg>
    );
  }

  const effectiveShowTagline = showTagline && variant !== 'notag';

  return (
    <div
      className={`growran-brand-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dimensions.gap,
        textDecoration: 'none',
        userSelect: 'none',
      }}
      aria-label="GROWRAN — Grow + Run"
    >
      {/* Official Mark */}
      <svg
        viewBox="0 0 200 160"
        height={dimensions.h}
        width={dimensions.markW}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <path d="M20 72 V128 H180 V72" stroke={markStroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 65 C55 60 80 66 96 76 V134 C80 124 55 118 34 123 Z" fill={markFill} stroke={markStroke} strokeWidth="8" strokeLinejoin="round" />
        <path d="M48 76 C65 72 82 76 94 84 V126 C82 118 65 114 48 118 Z" fill="none" stroke={depthStroke} strokeWidth="5" strokeLinejoin="round" opacity="0.9" />
        <path d="M166 65 C145 60 120 66 104 76 V134 C120 124 145 118 166 123 Z" fill={markFill} stroke={markStroke} strokeWidth="8" strokeLinejoin="round" />
        <path d="M152 76 C135 72 118 76 106 84 V126 C118 118 135 114 152 118 Z" fill="none" stroke={depthStroke} strokeWidth="5" strokeLinejoin="round" opacity="0.9" />
        <line x1="100" y1="76" x2="100" y2="134" stroke={markStroke} strokeWidth="7" strokeLinecap="round" />
        <path d="M38 108 L78 74 L106 95 L174 24" stroke={arrowColor} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="182,16 150,22 176,48" fill={arrowColor} stroke={arrowColor} strokeWidth="4" strokeLinejoin="round" />
      </svg>

      {/* Typography Column */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: dimensions.fontSize,
            fontWeight: 800,
            letterSpacing: '0.02em',
            color: wordmarkColor,
            lineHeight: 1.05,
          }}
        >
          GROWRAN
        </span>
        {effectiveShowTagline && (
          <span
            style={{
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: dimensions.tagSize,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: taglineColor,
              marginTop: size === 'xs' ? 1 : 2,
              lineHeight: 1,
            }}
          >
            Grow + Run
          </span>
        )}
      </div>
    </div>
  );
}
