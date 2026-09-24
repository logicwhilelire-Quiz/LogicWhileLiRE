import { motion } from 'framer-motion';

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
    sm: { h: 34, w: 43, title: '1.15rem', tag: '0.62rem', gap: 14, wordmarkGap: 8, radius: 8, badgePad: '2.5px 8px', badgeFont: '0.68rem', badgeTrack: '0.16em' },
    md: { h: 44, w: 56, title: '1.42rem', tag: '0.72rem', gap: 16, wordmarkGap: 10, radius: 10, badgePad: '3.5px 11px', badgeFont: '0.78rem', badgeTrack: '0.18em' },
    lg: { h: 64, w: 82, title: '1.92rem', tag: '0.84rem', gap: 20, wordmarkGap: 12, radius: 14, badgePad: '5px 15px', badgeFont: '0.96rem', badgeTrack: '0.2em' },
    xl: { h: 90, w: 115, title: '2.55rem', tag: '1.02rem', gap: 26, wordmarkGap: 16, radius: 18, badgePad: '7px 20px', badgeFont: '1.24rem', badgeTrack: '0.22em' },
  }[size];

  // Micro entrance motion config for high-end feel
  const entranceAnimation = {
    initial: { opacity: 0, y: -6, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  };

  if (variant === 'badge-only') {
    return (
      <motion.div
        {...entranceAnimation}
        className="brand-logo-badge"
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: dims.radius,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4), 0 0 1px rgba(255, 255, 255, 0.6)',
          border: '1.5px solid rgba(245, 158, 11, 0.85)',
          background: 'linear-gradient(145deg, #ffffff 0%, #fffbeb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        whileHover={{ scale: 1.05, boxShadow: '0 8px 28px rgba(245, 158, 11, 0.6), 0 0 2px rgba(255, 255, 255, 0.8)' }}
        whileTap={{ scale: 0.98 }}
      >
        <img
          src="/logo.png"
          alt="LogicWhile QUIZ"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2.5 }}
        />
      </motion.div>
    );
  }

  if (variant === 'hero') {
    return (
      <motion.div
        {...entranceAnimation}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 16,
        }}
      >
        {/* Emblem Crest */}
        <motion.div
          className="brand-logo-badge"
          style={{
            width: dims.w * 1.32,
            height: dims.h * 1.32,
            borderRadius: dims.radius + 4,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(245, 158, 11, 0.45), 0 0 28px rgba(234, 88, 12, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
            border: '2px solid rgba(245, 158, 11, 0.95)',
            background: 'linear-gradient(145deg, #ffffff 0%, #fffdf5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 5,
            position: 'relative',
          }}
          whileHover={{ scale: 1.04, rotate: 0.5 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          {/* Subtle ambient shimmer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <img
            src="/logo.png"
            alt="LogicWhile QUIZ Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 1 }}
          />
        </motion.div>

        {/* Wordmark Hierarchy */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
          <div
            style={{
              fontSize: dims.title,
              fontWeight: 800,
              letterSpacing: '-0.035em',
              display: 'flex',
              alignItems: 'center',
              gap: dims.wordmarkGap,
            }}
          >
            <span className="brand-logicwhile">LogicWhile</span>
            <span
              className="elevated-quiz-badge"
              style={{
                fontSize: dims.badgeFont,
                padding: dims.badgePad,
                letterSpacing: dims.badgeTrack,
              }}
            >
              QUIZ
            </span>
          </div>

          {showTagline && (
            <span
              className="brand-tagline"
              style={{
                fontSize: dims.tag,
                color: '#f59e0b',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginTop: 7,
                opacity: 0.95,
                textShadow: '0 0 14px rgba(245, 158, 11, 0.35)',
              }}
            >
              Elevating Coding Knowledge
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  // Standard horizontal variant (for headers, navigation bars, cards)
  return (
    <motion.div
      {...entranceAnimation}
      style={{
        display: inline ? 'inline-flex' : 'flex',
        alignItems: 'center',
        gap: dims.gap,
        textDecoration: 'none',
      }}
    >
      {/* Emblem Crest */}
      <motion.div
        className="brand-logo-badge"
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: dims.radius,
          overflow: 'hidden',
          boxShadow: '0 4px 18px rgba(245, 158, 11, 0.38), 0 0 1px rgba(255, 255, 255, 0.7)',
          border: '1.5px solid rgba(245, 158, 11, 0.85)',
          background: 'linear-gradient(145deg, #ffffff 0%, #fffdf5 100%)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
      >
        <img
          src="/logo.png"
          alt="LogicWhile QUIZ"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 2.5,
          }}
        />
      </motion.div>

      {/* Wordmark & Product Name */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: dims.title,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            display: 'flex',
            alignItems: 'center',
            gap: dims.wordmarkGap,
          }}
        >
          <span className="brand-logicwhile">LogicWhile</span>
          <span
            className="elevated-quiz-badge"
            style={{
              fontSize: dims.badgeFont,
              padding: dims.badgePad,
              letterSpacing: dims.badgeTrack,
            }}
          >
            QUIZ
          </span>
        </div>
        {showTagline && (
          <span
            className="brand-tagline"
            style={{
              fontSize: dims.tag,
              color: '#f59e0b',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 3,
              opacity: 0.95,
              textShadow: '0 0 10px rgba(245, 158, 11, 0.25)',
            }}
          >
            Elevating Coding Knowledge
          </span>
        )}
      </div>
    </motion.div>
  );
}
