import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text?: string;
  speedMs?: number;
  className?: string;
  cursorColor?: string;
}

export default function TypewriterText({
  text = 'Crack CRT | Master Coding | Get Placed',
  speedMs = 80,
  className = '',
  cursorColor = '#06B6D4',
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    setIsDone(false);

    const timer = setInterval(() => {
      index++;
      if (index <= text.length) {
        setDisplayedText(text.slice(0, index));
      } else {
        setIsDone(true);
        clearInterval(timer);
      }
    }, speedMs);

    return () => clearInterval(timer);
  }, [text, speedMs]);

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span>{displayedText}</span>
      <span
        style={{
          display: 'inline-block',
          width: '2px',
          height: '1.15em',
          backgroundColor: cursorColor,
          marginLeft: '4px',
          animation: 'cursorBlink 0.8s infinite',
        }}
        aria-hidden="true"
      />
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
