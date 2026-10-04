import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LogicWhileLiRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showProgress?: boolean;
}

const TELEMETRY_PHASES = [
  'Booting LogicWhile Live Real Engine (LiRE)...',
  'Synchronizing 5 Technical Sectors (Quant, Logic, Core CS, DSA, Cloud)...',
  'Arming Server-Authoritative Microsecond Clock...',
  'Securing Autonomous On-Device AI Watchdog...',
  'Elevating Coding Knowledge · Ready',
];

export function LogicWhileLiRELoader(props: LogicWhileLiRELoaderProps) {
  return <LogicWhileLiRELoaderDefault {...props} />;
}

export default function LogicWhileLiRELoaderDefault({
  size = 'md',
  message,
  showProgress = true,
}: LogicWhileLiRELoaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(12);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % TELEMETRY_PHASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    if (!showProgress) return;
    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 98) return 98;
        const jump = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + jump, 98);
      });
    }, 280);
    return () => clearInterval(timer);
  }, [showProgress]);

  const dims = {
    sm: { w: 140, h: 140, font: '0.8rem', progressW: 160 },
    md: { w: 220, h: 220, font: '0.92rem', progressW: 240 },
    lg: { w: 300, h: 300, font: '1.05rem', progressW: 320 },
  }[size];

  const currentStatusText = message || TELEMETRY_PHASES[phaseIndex];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '12px' : '28px',
        gap: size === 'sm' ? 12 : 20,
        userSelect: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      {/* ── ANIMATED CIRCUIT BOARD LOGO ── */}
      <div style={{ position: 'relative', width: dims.w, height: dims.h }}>
        {/* Pulsing ambient aura behind loader */}
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 194, 0, 0.22) 0%, rgba(56, 189, 248, 0.14) 45%, transparent 75%)',
            filter: 'blur(16px)',
            pointerEvents: 'none',
          }}
        />

        <svg
          viewBox="0 0 800 800"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: 'block',
            filter: 'drop-shadow(0 8px 24px rgba(255, 194, 0, 0.3))',
          }}
        >
          <defs>
            <linearGradient id="loadGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE066" />
              <stop offset="50%" stopColor="#FFC200" />
              <stop offset="100%" stopColor="#FFA000" />
            </linearGradient>

            <linearGradient id="loadBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="loadOrangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFA040" />
              <stop offset="100%" stopColor="#FF6B00" />
            </linearGradient>
          </defs>

          {/* 1. Circuit Board Frame with Running Laser Pulse */}
          <path
            d="M 52 440 L 52 88 L 748 88 L 748 216 L 712 216"
            stroke="url(#loadGoldGrad)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
          />
          {!shouldReduceMotion && (
            <motion.path
              d="M 52 440 L 52 88 L 748 88 L 748 216 L 712 216"
              stroke="#FFF9C4"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="120 400"
              animate={{ strokeDashoffset: [0, -1200] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Left Circle Node */}
          <motion.circle
            cx="52"
            cy="440"
            r="22"
            fill="#FFC200"
            stroke="#FFFFFF"
            strokeWidth="3"
            animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />

          {/* Inner Parallel Track */}
          <path d="M 86 122 L 86 360" stroke="url(#loadGoldGrad)" strokeWidth="12" strokeLinecap="round" opacity="0.6" />

          {/* Right Circuit Bulb Node & Beaming Light Rays */}
          <motion.circle
            cx="712"
            cy="216"
            r="24"
            fill="#FFC200"
            stroke="#FFFFFF"
            strokeWidth="3"
            animate={shouldReduceMotion ? {} : { fill: ['#FFC200', '#FFF59D', '#FFC200'] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <circle cx="712" cy="216" r="13" fill="#FFF9C4" />

          {/* 3 Radiating Light Rays into letter 'c' */}
          <motion.g
            stroke="#FFD54F"
            strokeWidth="9"
            strokeLinecap="round"
            animate={shouldReduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          >
            <line x1="684" y1="202" x2="626" y2="176" />
            <line x1="680" y1="216" x2="618" y2="216" />
            <line x1="684" y1="230" x2="626" y2="256" />
          </motion.g>

          {/* Bottom Circuit Line with Reverse Current */}
          <path
            d="M 52 676 L 748 676 L 748 372"
            stroke="url(#loadGoldGrad)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
          />
          {!shouldReduceMotion && (
            <motion.path
              d="M 52 676 L 748 676 L 748 372"
              stroke="#FFF9C4"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="140 460"
              animate={{ strokeDashoffset: [-1200, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <circle cx="748" cy="372" r="22" fill="#FFC200" stroke="#FFFFFF" strokeWidth="3" />

          {/* ── ROW 1: 'Logic' ── */}
          {/* 'L' */}
          <path d="M 108 126 L 152 126 L 152 232 L 216 232 L 216 274 L 108 274 Z" fill="url(#loadOrangeGrad)" />

          {/* '0' (Slashed Zero - Binary Logic Pulse) */}
          <motion.g
            animate={shouldReduceMotion ? {} : { scale: [1, 1.04, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '266px 200px' }}
          >
            <path
              fillRule="evenodd"
              d="M 324 200 C 324 246 304 278 266 278 C 228 278 208 246 208 200 C 208 154 228 122 266 122 C 304 122 324 154 324 200 Z 
                 M 284 200 C 284 168 276 154 266 154 C 256 154 248 168 248 200 C 248 232 256 246 266 246 C 276 246 284 232 284 200 Z"
              fill="url(#loadBlueGrad)"
            />
            <line x1="222" y1="256" x2="310" y2="144" stroke="url(#loadBlueGrad)" strokeWidth="16" strokeLinecap="round" />
          </motion.g>

          {/* 'g' (with scanlines) */}
          <g>
            <path
              d="M 358 158 C 358 138 374 124 402 124 C 428 124 442 138 442 162 L 442 254 C 442 270 432 278 408 278 C 378 278 360 262 360 262 L 372 236 C 372 236 384 248 402 248 C 414 248 418 242 418 234 L 418 226 C 410 236 394 242 380 242 C 358 242 342 224 342 198 C 342 172 358 158 358 158 Z"
              fill="url(#loadOrangeGrad)"
            />
            <ellipse cx="392" cy="184" rx="24" ry="22" fill="#0A1024" />
            <g fill="url(#loadOrangeGrad)">
              <rect x="368" y="168" width="48" height="3.5" rx="1.5" />
              <rect x="368" y="176" width="48" height="3.5" rx="1.5" />
              <rect x="368" y="184" width="48" height="3.5" rx="1.5" />
              <rect x="368" y="192" width="48" height="3.5" rx="1.5" />
              <rect x="368" y="200" width="48" height="3.5" rx="1.5" />
            </g>
          </g>

          {/* 'i' */}
          <g fill="url(#loadOrangeGrad)">
            <circle cx="512" cy="132" r="16" />
            <rect x="496" y="162" width="32" height="112" rx="6" />
          </g>

          {/* 'c' */}
          <path
            d="M 648 166 C 636 142 616 124 582 124 C 542 124 516 156 516 200 C 516 244 544 278 584 278 C 618 278 638 258 648 234 L 614 220 C 608 234 598 246 584 246 C 564 246 550 228 550 200 C 550 172 564 156 582 156 C 598 156 608 166 614 180 Z"
            fill="url(#loadOrangeGrad)"
          />

          {/* ── ROW 2: 'Whi1e' ── */}
          <path
            d="M 108 304 L 140 304 L 164 404 L 190 304 L 218 304 L 244 404 L 268 304 L 300 304 L 262 444 L 228 444 L 204 346 L 180 444 L 146 444 Z"
            fill="url(#loadBlueGrad)"
          />
          <path
            d="M 324 290 L 356 290 L 356 350 C 368 336 386 328 404 328 C 428 328 442 342 442 368 L 442 444 L 410 444 L 410 376 C 410 362 404 354 392 354 C 378 354 368 366 368 382 L 368 444 L 336 444 Z"
            fill="url(#loadBlueGrad)"
          />
          <g fill="url(#loadBlueGrad)">
            <circle cx="468" cy="316" r="15" />
            <path d="M 456 348 C 456 348 468 346 476 354 C 482 360 482 370 482 384 L 482 426 C 482 438 490 444 502 444 L 504 444 L 504 446 C 496 448 484 448 472 442 C 458 434 454 420 454 406 L 454 348 Z" />
          </g>

          {/* '1' (Orange Binary 1 with pulse) */}
          <motion.path
            d="M 522 334 L 552 308 L 568 308 L 568 414 L 594 414 L 594 444 L 518 444 L 518 414 L 540 414 L 540 336 L 522 348 Z"
            fill="url(#loadOrangeGrad)"
            animate={shouldReduceMotion ? {} : { scale: [1, 1.05, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            style={{ transformOrigin: '556px 376px' }}
          />

          <path
            d="M 648 376 C 648 348 630 328 602 328 C 572 328 552 350 552 386 C 552 422 572 446 604 446 C 624 446 640 436 648 420 L 622 408 C 618 416 612 422 602 422 C 590 422 582 414 580 398 L 648 398 C 648 398 648 388 648 376 Z
               M 580 376 C 582 360 590 350 602 350 C 614 350 622 360 622 376 Z"
            fill="url(#loadBlueGrad)"
          />

          {/* ── ROW 3: BOXED 'LiRE' ── */}
          <motion.rect
            x="136"
            y="476"
            width="548"
            height="144"
            rx="6"
            stroke="url(#loadGoldGrad)"
            strokeWidth="14"
            fill="rgba(56, 189, 248, 0.08)"
            animate={shouldReduceMotion ? {} : { strokeOpacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />

          <path d="M 176 502 L 208 502 L 208 558 L 244 558 L 244 584 L 176 584 Z" fill="url(#loadBlueGrad)" />
          <g fill="url(#loadBlueGrad)">
            <circle cx="288" cy="510" r="12" />
            <path d="M 276 534 C 278 534 292 532 296 540 C 300 546 300 554 300 566 C 300 576 306 584 316 584 L 298 584 C 286 584 280 574 280 562 L 280 534 Z" />
          </g>

          {/* R with Holographic Scanlines */}
          <g>
            <path
              d="M 346 502 L 406 502 C 426 502 440 514 440 532 C 440 546 430 556 416 560 L 444 584 L 416 584 L 392 562 L 372 562 L 372 584 L 346 584 Z
                 M 372 522 L 400 522 C 410 522 416 526 416 534 C 416 542 410 546 400 546 L 372 546 Z"
              fill="url(#loadOrangeGrad)"
            />
            <g fill="#080E1E">
              <rect x="342" y="508" width="104" height="3" />
              <rect x="342" y="516" width="104" height="3" />
              <rect x="342" y="524" width="104" height="3" />
              <rect x="342" y="532" width="104" height="3" />
              <rect x="342" y="540" width="104" height="3" />
              <rect x="342" y="548" width="104" height="3" />
              <rect x="342" y="556" width="104" height="3" />
              <rect x="342" y="564" width="104" height="3" />
              <rect x="342" y="572" width="104" height="3" />
            </g>
          </g>

          <path d="M 470 502 L 536 502 L 536 526 L 498 526 L 498 544 L 528 544 L 528 566 L 498 566 L 498 560 L 498 584 L 536 584 L 536 584 L 470 584 Z" fill="url(#loadBlueGrad)" />

          {/* Subtitle inside LiRE box */}
          <text
            x="410"
            y="608"
            textAnchor="middle"
            fontFamily="var(--font-mono, monospace, sans-serif)"
            fontSize="17"
            fontWeight="700"
            letterSpacing="0.12em"
            fill="#93C5FD"
          >
            Li: Live  •  R: Real  •  E: Engine
          </text>

          {/* ROW 4: Elevating Coding Knowledge */}
          <text
            x="400"
            y="744"
            textAnchor="middle"
            fontFamily="var(--font-display, 'Space Grotesk', sans-serif)"
            fontSize="38"
            fontWeight="800"
            letterSpacing="-0.01em"
            fill="#E2E8F0"
          >
            Elevating Coding Knowledge
          </text>
        </svg>
      </div>

      {/* ── HIGH-TECH CYBER PROGRESS BAR ── */}
      {showProgress && (
        <div style={{ width: dims.progressW, maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: "var(--font-mono, monospace)", letterSpacing: '0.05em' }}>
              CALIBRATING SYSTEM
            </span>
            <span style={{ fontSize: '0.76rem', color: '#FFC200', fontWeight: 800, fontFamily: "var(--font-mono, monospace)" }}>
              {progressPercent}%
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 6,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              border: '1px solid rgba(255, 194, 0, 0.2)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #FFC200 0%, #FF7A00 50%, #38BDF8 100%)',
                boxShadow: '0 0 10px rgba(255, 194, 0, 0.6)',
                borderRadius: 999,
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* ── DYNAMIC TELEMETRY STATUS MESSAGE ── */}
      <div style={{ textAlign: 'center', minHeight: 28, maxWidth: 380 }}>
        <motion.span
          key={currentStatusText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'inline-block',
            fontFamily: "var(--font-mono, monospace, sans-serif)",
            fontSize: dims.font,
            fontWeight: 600,
            color: 'var(--color-primary-light, #BAE6FD)',
            letterSpacing: '0.04em',
            textShadow: '0 0 12px rgba(56, 189, 248, 0.3)',
          }}
        >
          {currentStatusText}
        </motion.span>
      </div>
    </div>
  );
}
