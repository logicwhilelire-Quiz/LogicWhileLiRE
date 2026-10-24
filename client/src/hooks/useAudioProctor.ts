/**
 * useAudioProctor.ts
 * LogicWhile LiRE — Audio proctoring disabled per institutional exam specification.
 * Microphone, sound, and classroom noise detection are completely removed.
 */
interface AudioProctorOptions {
  enabled?: boolean;
  thresholdDb?: number;
  cooldownMs?: number;
  onAudioSpike?: (peakDb: number) => void;
}

export function useAudioProctor(_options?: AudioProctorOptions) {
  return {
    currentDb: -100,
    isListening: false,
    permissionDenied: false,
  };
}

