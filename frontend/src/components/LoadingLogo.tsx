import React from 'react';
import LogicWhileLiRELoader from './LogicWhileLiRELoader';

export interface LoadingLogoProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showStatusMessages?: boolean;
}

export default function LoadingLogo({
  size = 'md',
  message,
}: LoadingLogoProps) {
  return (
    <LogicWhileLiRELoader size={size} message={message} showProgress={true} />
  );
}
