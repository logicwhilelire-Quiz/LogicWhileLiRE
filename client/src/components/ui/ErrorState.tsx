import React from 'react';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-center flex flex-col items-center justify-center my-6 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl font-bold mb-3">
        ⚠️
      </div>
      <h4 className="text-sm font-bold text-rose-200 mb-1">{title}</h4>
      <p className="text-xs text-rose-300/80 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors"
        >
          Try Again ↺
        </button>
      )}
    </motion.div>
  );
}
