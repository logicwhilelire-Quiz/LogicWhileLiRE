import React from 'react';
import { motion } from 'framer-motion';

interface LogicCoilProps {
  size?: number;
  className?: string;
  variant?: 'mark' | 'loader' | 'divider' | 'inline';
  color?: string;
}

/**
 * LogicCoil — Signature "Logic Coil" Brand Motif
 * Refined continuous looping coil representing algorithmic recursion & precision logic.
 */
export default function LogicCoil({
  size = 36,
  className = '',
  variant = 'mark',
  color = '#bf9f62',
}: LogicCoilProps) {
  if (variant === 'divider') {
    return (
      <div className={`w-full flex items-center justify-center my-12 relative overflow-hidden ${className}`}>
        <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#bf9f62]/40 to-transparent" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="relative px-4 bg-[#190F3B] flex items-center justify-center"
        >
          <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <motion.path
              d="M 24,12 C 16,12 12,18 12,24 C 12,30 18,36 24,36 C 30,36 36,30 36,24 C 36,16 28,14 24,14 C 18,14 16,20 16,24 C 16,28 20,32 24,32 C 28,32 32,28 32,24 C 32,20 28,18 24,18"
              stroke="url(#logicCoilGrad)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 0.8, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <defs>
              <linearGradient id="logicCoilGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#bf9f62" />
                <stop offset="0.5" stopColor="#064484" />
                <stop offset="1" stopColor="#190F3B" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </div>
    );
  }

  if (variant === 'loader') {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className="relative" style={{ width: size, height: size }}>
          {/* Subtle ambient halo */}
          <div
            className="absolute inset-0 rounded-full blur-md opacity-40 animate-pulse"
            style={{ background: 'radial-gradient(circle, #bf9f62 0%, #064484 60%, transparent 100%)' }}
          />
          <motion.svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          >
            <motion.path
              d="M 24,10 C 14,10 10,18 10,24 C 10,32 18,38 24,38 C 32,38 38,32 38,24 C 38,15 28,12 24,12 C 17,12 14,19 14,24 C 14,29 19,34 24,34 C 29,34 34,29 34,24 C 34,18 29,16 24,16"
              stroke="url(#loaderCoilGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0.15, strokeDashoffset: 0 }}
              animate={{ pathLength: [0.2, 0.85, 0.2], strokeDashoffset: [0, -100, -200] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <defs>
              <linearGradient id="loaderCoilGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#bf9f62" />
                <stop offset="0.6" stopColor="#064484" />
                <stop offset="1" stopColor="#190F3B" />
              </linearGradient>
            </defs>
          </motion.svg>
        </div>
      </div>
    );
  }

  // Default 'mark' or 'inline'
  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: 12 }}
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <motion.path
          d="M 24,10 C 14,10 10,18 10,24 C 10,32 18,38 24,38 C 32,38 38,32 38,24 C 38,15 28,12 24,12 C 17,12 14,19 14,24 C 14,29 19,34 24,34 C 29,34 34,29 34,24 C 34,18 29,16 24,16"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0.6 }}
          animate={{ pathLength: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <circle cx="24" cy="24" r="2.5" fill={color} />
      </svg>
    </motion.div>
  );
}
