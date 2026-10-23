import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 my-6 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-3xl mb-4 shadow-inner">
        {icon}
      </div>
      <h4 className="text-base font-bold text-white mb-2 tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all transform active:scale-95"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
}
