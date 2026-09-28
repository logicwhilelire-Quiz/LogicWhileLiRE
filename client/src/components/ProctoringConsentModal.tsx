import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProctoringConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  examName?: string;
}

export default function ProctoringConsentModal({
  isOpen,
  onConsent,
  examName = 'LogicWhile Assessment',
}: ProctoringConsentModalProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [testingHardware, setTestingHardware] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCameraTest = async () => {
    setTestingHardware(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
      setCameraActive(false);
    } finally {
      setTestingHardware(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCameraTest();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  const handleConfirm = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    onConsent();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-850/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold border border-indigo-500/30">
                🛡️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Proctoring & Camera Consent
                </h3>
                <p className="text-xs text-slate-400">{examName}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              ISO/IEC 27001 Privacy Compliant
            </span>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Privacy Guarantee Box */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-2">
              <div className="flex items-center space-x-2 text-sm font-semibold text-emerald-400">
                <span>🔒</span>
                <h4>Zero Video Cloud Storage Guarantee</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your webcam is processed <strong className="text-white">locally on your machine</strong> in a background Web Worker. 
                Continuous video is <strong className="text-white">never recorded, streamed, or stored</strong> on our servers. 
                Only proctoring event counts and occasional low-resolution audit evidence thumbnails (&lt;20KB) are logged upon violation triggers.
              </p>
            </div>

            {/* Camera Test Preview */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="relative w-36 h-28 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center shrink-0">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-2 text-xs text-slate-500">
                    {testingHardware ? 'Initializing...' : 'Camera Off'}
                  </div>
                )}
                {cameraActive && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/80 text-[10px] text-white font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className={cameraActive ? 'text-emerald-400' : 'text-amber-400'}>
                    {cameraActive ? '✓' : '⚠️'}
                  </span>
                  <span className="font-semibold text-slate-200">
                    {cameraActive ? 'Camera Connected & Verified' : 'Camera permission required'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-normal">
                  Position your face clearly inside the frame. Ensure adequate lighting and avoid multiple persons in view.
                </p>
                {cameraError && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px]">
                    {cameraError}
                  </div>
                )}
              </div>
            </div>

            {/* Monitored Rules Summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center space-x-2 text-slate-300">
                <span className="text-base">🖥️</span>
                <span>Fullscreen enforcement</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center space-x-2 text-slate-300">
                <span className="text-base">📑</span>
                <span>Tab & blur detection</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center space-x-2 text-slate-300">
                <span className="text-base">👤</span>
                <span>Face count verification</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center space-x-2 text-slate-300">
                <span className="text-base">⚙️</span>
                <span>Devtools blocking</span>
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-6 border-t border-slate-800 bg-slate-850/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              By proceeding, you agree to proctoring rules.
            </span>
            <button
              onClick={handleConfirm}
              id="confirm-proctoring-consent-btn"
              className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
            >
              Consent & Enter Exam →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
