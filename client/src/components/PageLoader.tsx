import LoadingLogo from './LoadingLogo';

export default function PageLoader({ message }: { message?: string }) {
  return (
    <div
      className="page-center"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 25%, #0A1C68 0%, #050B22 65%, #030718 100%)',
        padding: '24px 16px',
      }}
    >
      {/* Logo-Matched Ambient Circuit Glows (Royal Navy, Flame Orange & Circuit Gold) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255, 180, 0, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 180, 0, 0.045) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 35%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 35%, transparent 95%)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '-12%',
          left: '15%',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 180, 0, 0.14) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-10%',
          right: '15%',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 122, 0, 0.14) 0%, transparent 70%)',
          filter: 'blur(45px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="card text-center animate-fade-in"
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '28px 26px 24px',
          maxWidth: 560,
          width: '100%',
          background: 'linear-gradient(155deg, rgba(10, 28, 104, 0.72) 0%, rgba(5, 11, 34, 0.94) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255, 180, 0, 0.42)',
          borderRadius: '24px',
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.75), 0 0 50px rgba(255, 180, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top Luminous Gold Circuit Accent Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '12%',
            right: '12%',
            height: 2,
            background: 'linear-gradient(90deg, transparent, #FFD000, #FF7A00, #FFD000, transparent)',
          }}
        />

        <LoadingLogo size="md" message={message} />

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(255, 180, 0, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: '0.7rem',
            color: '#94A3B8',
          }}
        >
          <span>
            <strong style={{ color: '#FF7A00' }}>Logic</strong>
            <strong style={{ color: '#FFFFFF' }}>While</strong> · Main Enterprise
          </span>
          <span style={{ color: '#FFB400', fontWeight: 700, letterSpacing: '0.04em' }}>
            LiRE Assessment Sub-Branch
          </span>
        </div>
      </div>
    </div>
  );
}
