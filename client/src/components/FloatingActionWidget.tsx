import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FloatingActionWidget — LogicWhile LiRE Persistent Floating Support & Action Widget
 * Stays visible on scroll across the Home page, Live examination pages, and candidate portals.
 * Matches the official logicwhile.com floating action bar:
 *  - Scroll-to-Top (Orange circular button with upward chevron)
 *  - Quick Call (Blue circular button with phone dialer)
 *  - WhatsApp (Green circular button with instant chat)
 *  - LinkedIn (Amber/Blue circular button for institutional network)
 */
export default function FloatingActionWidget() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCallMenu, setShowCallMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show scroll-to-top after scrolling down 120px
      if (window.scrollY > 120) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <aside
      className="floating-action-widget-enclave"
      aria-label="Quick contact and navigation widget"
      style={{
        position: 'fixed',
        right: 22,
        bottom: 24,
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {/* ── Quick Call Popup Dialog ── */}
      <AnimatePresence>
        {showCallMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              pointerEvents: 'auto',
              background: '#002147',
              border: '2px solid #EAA812',
              borderRadius: 14,
              padding: '16px 18px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6), 0 0 20px rgba(234,168,18,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minWidth: 240,
              color: '#FFFFFF',
              marginBottom: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(234,168,18,0.3)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#EAA812', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📞 Call LogicWhile Desk
              </span>
              <button
                type="button"
                onClick={() => setShowCallMenu(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                aria-label="Close call menu"
              >
                ✕
              </button>
            </div>

            <a
              href="tel:+919493734553"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: '#FFFFFF',
                background: 'rgba(2, 132, 199, 0.2)',
                border: '1px solid #38BDF8',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: '0.88rem',
                fontWeight: 700,
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(2, 132, 199, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(2, 132, 199, 0.2)')}
            >
              <span style={{ fontSize: '1.1rem' }}>📱</span>
              <div>
                <div style={{ color: '#38BDF8', fontSize: '0.92rem' }}>+91 9493734553</div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Primary Helpline &amp; WhatsApp</div>
              </div>
            </a>

            <a
              href="tel:+919985630896"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: '#FFFFFF',
                background: 'rgba(234, 168, 18, 0.15)',
                border: '1px solid #EAA812',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: '0.88rem',
                fontWeight: 700,
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234, 168, 18, 0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(234, 168, 18, 0.15)')}
            >
              <span style={{ fontSize: '1.1rem' }}>🏢</span>
              <div>
                <div style={{ color: '#EAA812', fontSize: '0.92rem' }}>+91 9985630896</div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>LogicWhile Corporate Office</div>
              </div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Buttons Stack ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 11,
          pointerEvents: 'auto',
        }}
      >
        {/* 1. Scroll-to-Top Button (Orange) */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              type="button"
              id="widget-scroll-top-btn"
              onClick={scrollToTop}
              initial={{ opacity: 0, scale: 0.6, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 15 }}
              transition={{ duration: 0.22 }}
              whileHover={{ scale: 1.12, y: -2 }}
              whileTap={{ scale: 0.92 }}
              title="Scroll to top"
              aria-label="Scroll back to top"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF8A00 0%, #EAA812 100%)',
                border: '2px solid #FFFFFF',
                color: '#FFFFFF',
                boxShadow: '0 6px 18px rgba(234, 168, 18, 0.5), 0 2px 6px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {/* Upward Chevron SVG */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 2. Direct Call Button (Blue) */}
        <motion.button
          type="button"
          id="widget-call-btn"
          onClick={() => setShowCallMenu(!showCallMenu)}
          whileHover={{ scale: 1.12, y: -2 }}
          whileTap={{ scale: 0.92 }}
          title="Call LogicWhile Helpline"
          aria-label="Call LogicWhile Helpline: +91 9493734553"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            boxShadow: '0 6px 18px rgba(2, 132, 199, 0.45), 0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {/* Phone Handset SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.28-.28.37-.68.25-1.02A11.36 11.36 0 018.57 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.62c0-.55-.45-1-.99-1z" />
          </svg>
        </motion.button>

        {/* 3. WhatsApp Direct Chat Button (Green) */}
        <motion.a
          id="widget-whatsapp-btn"
          href="https://wa.me/919493734553?text=Hello%20LogicWhile%20LiRE%20Support%2C%20I%20have%20an%20inquiry%20regarding%20the%20platform."
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.12, y: -2 }}
          whileTap={{ scale: 0.92 }}
          title="Chat on WhatsApp (+91 9493734553)"
          aria-label="Chat with LogicWhile Support on WhatsApp"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            boxShadow: '0 6px 18px rgba(37, 211, 102, 0.45), 0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {/* WhatsApp SVG Icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.41a8.204 8.204 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.45 0-2.88-.38-4.13-1.12l-.3-.18-3.07.81.82-2.99-.19-.31a8.21 8.21 0 01-1.26-4.45c0-4.54 3.69-8.24 8.24-8.24m4.52 11.63c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.26-1.49-1.4-1.74-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.43 1.03 2.6.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
          </svg>
        </motion.a>

        {/* 4. LinkedIn Official Page (Amber/Blue) */}
        <motion.a
          id="widget-linkedin-btn"
          href="https://www.linkedin.com/company/logicwhile"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.12, y: -2 }}
          whileTap={{ scale: 0.92 }}
          title="LogicWhile Official LinkedIn"
          aria-label="LogicWhile on LinkedIn"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            boxShadow: '0 6px 16px rgba(10, 102, 194, 0.4), 0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {/* LinkedIn SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 1.45-1.45 1.45 1.45 0 0 0-1.45-1.45 1.45 1.45 0 0 0-1.45 1.45c0 .8.65 1.45 1.45 1.45m1.39 9.74v-8.37H5.07v8.37h2.78z" />
          </svg>
        </motion.a>
      </div>
    </aside>
  );
}
