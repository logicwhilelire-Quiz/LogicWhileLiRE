import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sound } from '../../lib/soundService';
import { IconEye, IconBuilding, IconFlash, IconShield, IconCheck } from '../icons/HumanIcons';

export type ThemeMode = 'dark' | 'swarm' | 'emerald' | 'light';

interface ThemeOption {
  id: ThemeMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
}

const THEMES: ThemeOption[] = [
  { id: 'dark', label: 'LogicWhile Midnight', icon: <IconEye size={15} color="#0284c7" />, color: '#0284c7', desc: 'Executive Slate & Sapphire' },
  { id: 'swarm', label: 'LogicWhile Enterprise', icon: <IconBuilding size={15} color="#2563EB" />, color: '#2563EB', desc: 'Institutional High-Contrast' },
  { id: 'emerald', label: 'Academic Ivory', icon: <IconFlash size={15} color="#0D9488" />, color: '#0D9488', desc: 'Daylight Proctored Testing' },
  { id: 'light', label: 'LogicWhile Royal', icon: <IconShield size={15} color="#EAA812" />, color: '#EAA812', desc: 'Navy & Official Gold Theme' },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('logicwhilelire_theme') ||
      localStorage.getItem('LOGICWHILELIRE_theme') ||
      'dark') as ThemeMode;

    const validTheme = THEMES.some((t) => t.id === saved) ? saved : 'dark';
    setTheme(validTheme);
    document.documentElement.setAttribute('data-theme', validTheme);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', onDocClick);
    }
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const selectTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('logicwhilelire_theme', nextTheme);
    localStorage.setItem('LOGICWHILELIRE_theme', nextTheme);
    sound.playClick(1.2);
    sound.playSwell();
    setMenuOpen(false);
  };

  const currentOption = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.04 }}
        onClick={() => {
          setMenuOpen(!menuOpen);
          sound.playClick();
        }}
        title={`Current Theme: ${currentOption.label}. Click to customize.`}
        aria-label="Customize platform theme"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-800 shadow-sm hover:bg-slate-50'
            : 'bg-slate-900/80 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800/90'
        } ${className}`}
        style={{
          boxShadow: `0 0 12px ${currentOption.color}25`,
        }}
      >
        <span className="text-sm select-none inline-flex items-center">{currentOption.icon}</span>
        <span className="hidden sm:inline-block font-mono tracking-tight" style={{ color: currentOption.color }}>
          {currentOption.label.split(' ')[0]}
        </span>
        <span className="text-[10px] opacity-60">▾</span>
      </motion.button>

      {/* Popover Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 9999,
              minWidth: 200,
              background: 'rgba(11, 16, 29, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              padding: '6px',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#64748B',
                padding: '6px 10px 4px',
              }}
            >
              Select Interface Theme
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {THEMES.map((opt) => {
                const isSelected = opt.id === theme;
                return (
                  <button
                    key={opt.id}
                    onClick={() => selectTheme(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#94A3B8',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#FFFFFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#94A3B8';
                      }
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isSelected ? opt.color : '#E2E8F0',
                        }}
                      >
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>{opt.desc}</div>
                    </div>
                    {isSelected && (
                      <IconCheck size={14} color={opt.color} strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
