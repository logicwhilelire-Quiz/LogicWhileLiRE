import LoadingLogo from './LoadingLogo';

export default function PageLoader({ message }: { message?: string }) {
  return (
    <div className="page-center">
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
      </div>
      <div
        className="card text-center animate-fade-in"
        style={{
          padding: '40px 48px',
          maxWidth: 420,
          background: 'rgba(11, 18, 32, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(43, 127, 255, 0.25)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(43, 127, 255, 0.12)',
        }}
      >
        <LoadingLogo size="md" message={message} />
      </div>
    </div>
  );
}
