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
  // Proportional sizing matching 222:174 logo aspect ratio (~1.276)
  const dims = {
    sm: { h: 32, w: 41, title: '1.1rem', tag: '0.62rem', gap: 10, radius: 8, badgePad: '2px 7px', badgeFont: '0.66rem' },
    md: { h: 42, w: 54, title: '1.38rem', tag: '0.72rem', gap: 12, radius: 10, badgePad: '3px 9px', badgeFont: '0.76rem' },
    lg: { h: 60, w: 76, title: '1.85rem', tag: '0.84rem', gap: 16, radius: 12, badgePad: '4px 13px', badgeFont: '0.92rem' },
    xl: { h: 84, w: 108, title: '2.4rem', tag: '0.98rem', gap: 20, radius: 16, badgePad: '6px 18px', badgeFont: '1.18rem' },
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
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.45)',
          border: '1.5px solid rgba(245, 158, 11, 0.85)',
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
          gap: 14,
        }}
      >
        <div
          className="brand-logo-badge"
          style={{
            width: dims.w * 1.35,
            height: dims.h * 1.35,
            borderRadius: dims.radius + 4,
            overflow: 'hidden',
            boxShadow: '0 10px 36px rgba(245, 158, 11, 0.5), 0 0 20px rgba(234, 88, 12, 0.3)',
            border: '2px solid rgba(245, 158, 11, 0.9)',
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
            alt="LogicWhile QUIZ Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
          <div
            style={{
              fontSize: dims.title,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span className="brand-logicwhile">LogicWhile</span>
            <span
              className="elevated-quiz-badge"
              style={{
                fontSize: dims.badgeFont,
                padding: dims.badgePad,
              }}
            >
              QUIZ
            </span>
          </div>

          {showTagline && (
            <span
              style={{
                fontSize: dims.tag,
                color: '#f59e0b',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 6,
                opacity: 0.95,
                textShadow: '0 0 12px rgba(245, 158, 11, 0.3)',
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
          boxShadow: '0 4px 18px rgba(245, 158, 11, 0.4)',
          border: '1.5px solid rgba(245, 158, 11, 0.8)',
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
          alt="LogicWhile QUIZ"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 2,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: dims.title,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="brand-logicwhile">LogicWhile</span>
          <span
            className="elevated-quiz-badge"
            style={{
              fontSize: dims.badgeFont,
              padding: dims.badgePad,
            }}
          >
            QUIZ
          </span>
        </div>
        {showTagline && (
          <span
            style={{
              fontSize: dims.tag,
              color: '#f59e0b',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: 3,
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
