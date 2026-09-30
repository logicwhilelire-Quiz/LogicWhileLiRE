import React, { useState, useEffect } from 'react';
import LogicWhileLiRELoader from './LogicWhileLiRELoader';

export interface LoadingLogoProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showStatusMessages?: boolean;
}

const STATUS_MESSAGES = [
  'Powering LogicWhileLiRE assessment engine...',
  'Initializing server-authoritative timer...',
  'Securing autonomous proctoring watchdog...',
  'Synchronizing 3D Technical Sectors...',
  'Logic. While. LiRE...',
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
    <LogicWhileLiRELoader size={size} message={activeMessage} />
  );
}
