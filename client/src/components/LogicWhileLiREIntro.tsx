import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function LogicWhileLiREIntro({ onComplete }: { onComplete?: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisible(false);
      if (onComplete) onComplete();
      return;
    }

    try {
      const seen = sessionStorage.getItem('logicwhilelire_intro_seen');
      if (seen) {
        setVisible(false);
        if (onComplete) onComplete();
        return;
      }
      sessionStorage.setItem('logicwhilelire_intro_seen', 'true');
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 1600);

      return () => clearTimeout(timer);
    } catch {
      setVisible(false);
      if (onComplete) onComplete();
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="logicwhilelire-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'radial-gradient(ellipse at 50% 40%, #0c1735 0%, #050814 75%, #020409 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {/* Subtle Ambient Particle Glow */}
          <div
            style={{
              position: 'absolute',
              width: 380,
              height: 380,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 194, 0, 0.18) 0%, rgba(56, 189, 248, 0.12) 50%, transparent 75%)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: 320,
              width: '90%',
            }}
          >
            {/* Animated Master Circuit SVG */}
            <svg
              viewBox="0 0 800 800"
              width="100%"
              height="100%"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 12px 36px rgba(255, 194, 0, 0.4))' }}
            >
              {/* Outer Circuit Frame (Drawing in) */}
              <motion.path
                d="M 52 440 L 52 88 L 748 88 L 748 216 L 712 216"
                stroke="#FFC200"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.65, ease: 'easeInOut' }}
              />

              <motion.circle
                cx="52"
                cy="440"
                r="22"
                fill="#FFC200"
                stroke="#FFFFFF"
                strokeWidth="3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              />

              <motion.path
                d="M 86 122 L 86 360"
                stroke="#FFC200"
                strokeWidth="12"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />

              {/* Right Bulb Node & Rays */}
              <motion.circle
                cx="712"
                cy="216"
                r="24"
                fill="#FFC200"
                stroke="#FFFFFF"
                strokeWidth="3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: 'spring' }}
              />
              <circle cx="712" cy="216" r="13" fill="#FFF9C4" />

              <motion.g
                stroke="#FFD54F"
                strokeWidth="8"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.3 }}
              >
                <line x1="684" y1="202" x2="626" y2="176" />
                <line x1="680" y1="216" x2="618" y2="216" />
                <line x1="684" y1="230" x2="626" y2="256" />
              </motion.g>

              {/* Bottom Circuit Line */}
              <motion.path
                d="M 52 676 L 748 676 L 748 372"
                stroke="#FFC200"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: 0.15, ease: 'easeInOut' }}
              />
              <motion.circle
                cx="748"
                cy="372"
                r="22"
                fill="#FFC200"
                stroke="#FFFFFF"
                strokeWidth="3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.75, type: 'spring' }}
              />

              {/* Wordmark Letters Fade & Scale */}
              <motion.g
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                {/* L */}
                <path d="M 108 126 L 152 126 L 152 232 L 216 232 L 216 274 L 108 274 Z" fill="#FF7A00" />
                {/* 0 (Slashed Zero) */}
                <path
                  fillRule="evenodd"
                  d="M 324 200 C 324 246 304 278 266 278 C 228 278 208 246 208 200 C 208 154 228 122 266 122 C 304 122 324 154 324 200 Z 
                     M 284 200 C 284 168 276 154 266 154 C 256 154 248 168 248 200 C 248 232 256 246 266 246 C 276 246 284 232 284 200 Z"
                  fill="#38BDF8"
                />
                <line x1="222" y1="256" x2="310" y2="144" stroke="#38BDF8" strokeWidth="16" strokeLinecap="round" />
                {/* g */}
                <path
                  d="M 358 158 C 358 138 374 124 402 124 C 428 124 442 138 442 162 L 442 254 C 442 270 432 278 408 278 C 378 278 360 262 360 262 L 372 236 C 372 236 384 248 402 248 C 414 248 418 242 418 234 L 418 226 C 410 236 394 242 380 242 C 358 242 342 224 342 198 C 342 172 358 158 358 158 Z"
                  fill="#FF7A00"
                />
                <ellipse cx="392" cy="184" rx="24" ry="22" fill="#0A1024" />
                <g fill="#FF7A00">
                  <rect x="368" y="168" width="48" height="3.5" rx="1.5" />
                  <rect x="368" y="176" width="48" height="3.5" rx="1.5" />
                  <rect x="368" y="184" width="48" height="3.5" rx="1.5" />
                  <rect x="368" y="192" width="48" height="3.5" rx="1.5" />
                  <rect x="368" y="200" width="48" height="3.5" rx="1.5" />
                </g>
                {/* i */}
                <circle cx="512" cy="132" r="16" fill="#FF7A00" />
                <rect x="496" y="162" width="32" height="112" rx="6" fill="#FF7A00" />
                {/* c */}
                <path
                  d="M 648 166 C 636 142 616 124 582 124 C 542 124 516 156 516 200 C 516 244 544 278 584 278 C 618 278 638 258 648 234 L 614 220 C 608 234 598 246 584 246 C 564 246 550 228 550 200 C 550 172 564 156 582 156 C 598 156 608 166 614 180 Z"
                  fill="#FF7A00"
                />

                {/* Whi1e */}
                <path
                  d="M 108 304 L 140 304 L 164 404 L 190 304 L 218 304 L 244 404 L 268 304 L 300 304 L 262 444 L 228 444 L 204 346 L 180 444 L 146 444 Z"
                  fill="#38BDF8"
                />
                <path
                  d="M 324 290 L 356 290 L 356 350 C 368 336 386 328 404 328 C 428 328 442 342 442 368 L 442 444 L 410 444 L 410 376 C 410 362 404 354 392 354 C 378 354 368 366 368 382 L 368 444 L 336 444 Z"
                  fill="#38BDF8"
                />
                <circle cx="468" cy="316" r="15" fill="#38BDF8" />
                <path
                  d="M 456 348 C 456 348 468 346 476 354 C 482 360 482 370 482 384 L 482 426 C 482 438 490 444 502 444 L 504 444 L 504 446 C 496 448 484 448 472 442 C 458 434 454 420 454 406 L 454 348 Z"
                  fill="#38BDF8"
                />
                {/* 1 in Orange */}
                <path
                  d="M 522 334 L 552 308 L 568 308 L 568 414 L 594 414 L 594 444 L 518 444 L 518 414 L 540 414 L 540 336 L 522 348 Z"
                  fill="#FF7A00"
                />
                <path
                  d="M 648 376 C 648 348 630 328 602 328 C 572 328 552 350 552 386 C 552 422 572 446 604 446 C 624 446 640 436 648 420 L 622 408 C 618 416 612 422 602 422 C 590 422 582 414 580 398 L 648 398 C 648 398 648 388 648 376 Z
                     M 580 376 C 582 360 590 350 602 350 C 614 350 622 360 622 376 Z"
                  fill="#38BDF8"
                />
              </motion.g>

              {/* LiRE Box & Tagline */}
              <motion.g
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, delay: 0.6 }}
              >
                <rect
                  x="136"
                  y="476"
                  width="548"
                  height="144"
                  rx="6"
                  stroke="#FFC200"
                  strokeWidth="14"
                  fill="rgba(56, 189, 248, 0.08)"
                />
                <path d="M 176 502 L 208 502 L 208 558 L 244 558 L 244 584 L 176 584 Z" fill="#38BDF8" />
                <circle cx="288" cy="510" r="12" fill="#38BDF8" />
                <path
                  d="M 276 534 C 278 534 292 532 296 540 C 300 546 300 554 300 566 C 300 576 306 584 316 584 L 298 584 C 286 584 280 574 280 562 L 280 534 Z"
                  fill="#38BDF8"
                />

                <path
                  d="M 346 502 L 406 502 C 426 502 440 514 440 532 C 440 546 430 556 416 560 L 444 584 L 416 584 L 392 562 L 372 562 L 372 584 L 346 584 Z
                     M 372 522 L 400 522 C 410 522 416 526 416 534 C 416 542 410 546 400 546 L 372 546 Z"
                  fill="#FF7A00"
                />
                <g fill="#0A1024">
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

                <path d="M 470 502 L 536 502 L 536 526 L 498 526 L 498 544 L 528 544 L 528 566 L 498 566 L 498 560 L 498 584 L 536 584 L 536 584 L 470 584 Z" fill="#38BDF8" />

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

                <text
                  x="400"
                  y="744"
                  textAnchor="middle"
                  fontFamily="var(--font-display, 'Space Grotesk', sans-serif)"
                  fontSize="38"
                  fontWeight="800"
                  letterSpacing="-0.01em"
                  fill="#F8FAFC"
                >
                  Elevating Coding Knowledge
                </text>
              </motion.g>
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
