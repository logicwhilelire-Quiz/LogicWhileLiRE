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
          background: 'rgba(15, 17, 26, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.1)',
        }}
      >
        <LoadingLogo size="md" message={message} />
      </div>
    </div>
  );
}
