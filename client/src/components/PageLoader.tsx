import LoadingLogo from './LoadingLogo';

export default function PageLoader({ message }: { message?: string }) {
  return (
    <div className="page-center" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>
      <div
        className="card text-center animate-fade-in"
        style={{
          padding: '36px 40px',
          maxWidth: 440,
          width: '92%',
          background: 'rgba(8, 14, 30, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 194, 0, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.75), 0 0 45px rgba(255, 194, 0, 0.15)',
        }}
      >
        <LoadingLogo size="md" message={message} />
      </div>
    </div>
  );
}
