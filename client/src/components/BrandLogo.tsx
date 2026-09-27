import { useState } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  inline?: boolean;
  variant?: 'standard' | 'hero' | 'minimal' | 'badge-only';
}

export default function BrandLogo({
  size = 'md',
  showTagline = true,
  inline = false,
  variant = 'standard',
}: BrandLogoProps) {
  const [scriptLoaded, setScriptLoaded] = useState(true);

  // Proportional sizing matching 222:174 logo aspect ratio (~1.276)
  const dims = {
    sm: { h: 32, w: 41, title: '1.05rem', scriptH: 28, tag: '0.62rem', gap: 10, radius: 7 },
    md: { h: 42, w: 54, title: '1.35rem', scriptH: 36, tag: '0.72rem', gap: 12, radius: 10 },
    lg: { h: 60, w: 76, title: '1.85rem', scriptH: 54, tag: '0.84rem', gap: 16, radius: 12 },
    xl: { h: 84, w: 108, title: '2.4rem', scriptH: 74, tag: '0.98rem', gap: 18, radius: 14 },
  }[size];

  if (variant === 'badge-only') {
    return (
      <div
        className="brand-logo-badge"
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: dims.radius,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
          border: '1.5px solid rgba(245, 158, 11, 0.75)',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        <img
          src="/logo.png"
          alt="LogicWhile QUIZ"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
        />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 12,
        }}
      >
        {/* Main Logo Card Badge */}
        <div
          className="brand-logo-badge"
          style={{
            width: dims.w * 1.35,
            height: dims.h * 1.35,
            borderRadius: dims.radius + 3,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.45), 0 0 16px rgba(234, 88, 12, 0.25)',
            border: '2px solid rgba(245, 158, 11, 0.85)',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <img
            src="/logo.png"
            alt="LogicWhile Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Combined Brand Name: LogicWhile + Calligraphic Quiz Script */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15 }}>
          <div
            style={{
              fontSize: dims.title,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'var(--color-text, #ffffff)' }}>LogicWhile</span>
            {scriptLoaded ? (
              <div
                className="elevated-quiz-container"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <img
                  src="/quiz-logo-transparent.png"
                  alt="Quiz"
                  onError={() => setScriptLoaded(false)}
                  style={{
                    height: dims.scriptH,
                    objectFit: 'contain',
                    filter:
                      'drop-shadow(0 0 4px rgba(245, 158, 11, 0.95)) drop-shadow(0 0 14px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 28px rgba(234, 88, 12, 0.5))',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    transition: 'transform 0.25s ease, filter 0.25s ease',
                  }}
                />
              </div>
            ) : (
              <span
                style={{
                  background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #ea580c 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  textShadow: '0 0 20px rgba(245, 158, 11, 0.6)',
                }}
              >
                QUIZ
              </span>
            )}
          </div>

          {showTagline && (
            <span
              style={{
                fontSize: dims.tag,
                color: '#f59e0b',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: 4,
                opacity: 0.95,
              }}
            >
              Elevating Coding Knowledge
            </span>
          )}
        </div>
      </div>
    );
  }

  // Standard horizontal variant
  return (
    <div
      style={{
        display: inline ? 'inline-flex' : 'flex',
        alignItems: 'center',
        gap: dims.gap,
        textDecoration: 'none',
      }}
    >
      <div
        className="brand-logo-badge"
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: dims.radius,
          overflow: 'hidden',
          boxShadow: '0 4px 18px rgba(245, 158, 11, 0.35)',
          border: '1.5px solid rgba(245, 158, 11, 0.75)',
          background: '#ffffff',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
        }}
      >
        <img
          src="/logo.png"
          alt="LogicWhile"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 2,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div
          style={{
            fontSize: dims.title,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: 'var(--color-text, #ffffff)' }}>LogicWhile</span>
          {scriptLoaded ? (
            <div
              className="elevated-quiz-container"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <img
                src="/quiz-logo-transparent.png"
                alt="Quiz"
                onError={() => setScriptLoaded(false)}
                style={{
                  height: dims.scriptH,
                  objectFit: 'contain',
                  filter:
                    'drop-shadow(0 0 4px rgba(245, 158, 11, 0.9)) drop-shadow(0 0 12px rgba(245, 158, 11, 0.75)) drop-shadow(0 0 24px rgba(234, 88, 12, 0.45))',
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  transition: 'transform 0.25s ease, filter 0.25s ease',
                }}
              />
            </div>
          ) : (
            <span
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #ea580c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
                letterSpacing: '0.05em',
                textShadow: '0 0 16px rgba(245, 158, 11, 0.6)',
              }}
            >
              QUIZ
            </span>
          )}
        </div>
        {showTagline && (
          <span
            style={{
              fontSize: dims.tag,
              color: '#f59e0b',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: 2,
              opacity: 0.9,
            }}
          >
            Elevating Coding Knowledge
          </span>
        )}
      </div>
    </div>
  );
}
