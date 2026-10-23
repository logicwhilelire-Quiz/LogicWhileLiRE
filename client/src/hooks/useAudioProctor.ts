import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioProctorOptions {
  enabled: boolean;
  thresholdDb?: number; // e.g. -24 dB
  cooldownMs?: number; // min time between violation alerts
  onAudioSpike: (peakDb: number) => void;
}

export function useAudioProctor({
  enabled,
  thresholdDb = -24,
  cooldownMs = 8000,
  onAudioSpike,
}: AudioProctorOptions) {
  const [currentDb, setCurrentDb] = useState(-100);
  const [isListening, setIsListening] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpikeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const stopAudio = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopAudio();
      return;
    }

    let active = true;

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        setIsListening(true);
        setPermissionDenied(false);

        const dataArray = new Uint8Array(analyser.fftSize);

        const checkVolume = () => {
          if (!active || !analyserRef.current) return;

          analyserRef.current.getByteTimeDomainData(dataArray);

          let sumSquare = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquare += normalized * normalized;
          }

          const rms = Math.sqrt(sumSquare / dataArray.length);
          // Convert to decibels (0 to -100 dB)
          const db = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -100;
          setCurrentDb(db);

          const now = Date.now();
          if (db > thresholdDb && now - lastSpikeRef.current > cooldownMs) {
            lastSpikeRef.current = now;
            onAudioSpike(db);
          }

          animFrameRef.current = requestAnimationFrame(checkVolume);
        };

        animFrameRef.current = requestAnimationFrame(checkVolume);
      } catch (err) {
        if (active) {
          console.warn('[AudioProctor] Mic access denied or unavailable:', err);
          setPermissionDenied(true);
          setIsListening(false);
        }
      }
    }

    initAudio();

    return () => {
      active = false;
      stopAudio();
    };
  }, [enabled, thresholdDb, cooldownMs, onAudioSpike, stopAudio]);

  return {
    currentDb,
    isListening,
    permissionDenied,
  };
}
