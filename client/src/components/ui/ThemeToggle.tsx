import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('logicwhilelire_theme') || localStorage.getItem('LOGICWHILELIRE_theme') || localStorage.getItem('lw_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('logicwhilelire_theme', nextTheme);
    localStorage.setItem('LOGICWHILELIRE_theme', nextTheme);
    localStorage.removeItem('lw_theme');
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle theme"
      className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
        theme === 'dark'
          ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700'
          : 'bg-white border-slate-200 text-indigo-600 shadow-sm hover:bg-slate-50'
      } ${className}`}
    >
      <span className="text-base select-none">
        {theme === 'dark' ? '🌙' : '☀️'}
      </span>
    </motion.button>
  );
}
