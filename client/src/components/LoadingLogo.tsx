import React, { useState, useEffect } from 'react';
import GrowthranLoader from './GrowthranLoader';

export interface LoadingLogoProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showStatusMessages?: boolean;
}

const STATUS_MESSAGES = [
  'Powering GROWTHRAN assessment engine...',
  'Initializing server-authoritative timer...',
  'Securing autonomous proctoring watchdog...',
  'Preparing questions & telemetry metrics...',
  'Learn. Grow. Run...',
];

export default function LoadingLogo({
  size = 'md',
  message,
  showStatusMessages = true,
}: LoadingLogoProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!showStatusMessages || message) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [showStatusMessages, message]);

  const activeMessage = message || (showStatusMessages ? STATUS_MESSAGES[statusIndex] : undefined);

  return (
    <GrowthranLoader size={size} message={activeMessage} />
  );
}
