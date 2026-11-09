/**
 * soundService.ts — LogicWhile LiRE Web Audio Synthesizer
 *
 * Adapted from Swarm Rebuild / Califa Web Audio synthesis:
 * Zero external audio files. 100% synthesized in real time via Web Audio API.
 * Provides tactile clicks, mechanical keyboard thocks, and soft pentatonic chimes.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('logicwhilelire_audio_muted');
      this.isMuted = saved === 'true';
    }
  }

  private initCtx() {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
        this.initialized = true;
      }
    } catch (_) {
      // AudioContext unavailable or blocked by policy
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('logicwhilelire_audio_muted', String(this.isMuted));
    }
    if (!this.isMuted) {
      this.initCtx();
      this.playChime();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Tactile mouse click: short transient click with subtle low-end resonance.
   */
  public playClick(pitchMultiplier: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800 * pitchMultiplier, t);
      osc.frequency.exponentialRampToValueAtTime(140 * pitchMultiplier, t + 0.025);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.025);
    } catch (_) {}
  }

  /**
   * Mechanical key thock: satisfying keystroke feedback.
   */
  public playKeyThock() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 60, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.035);

      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.035);
    } catch (_) {}
  }

  /**
   * Pentatonic glass chime: E major pentatonic note on question answer or sector mastery.
   */
  public playChime(freqIndex: number = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      // E major pentatonic frequencies (E4, F#4, G#4, B4, C#5, E5)
      const scale = [329.63, 369.99, 415.3, 493.88, 554.37, 659.25, 739.99];
      const freq = scale[Math.abs(freqIndex) % scale.length];
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.35);
    } catch (_) {}
  }

  /**
   * Ambient sweep: airy filter swell when entering lobby or changing theme.
   */
  public playSwell() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(587.33, t + 0.4);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    } catch (_) {}
  }
}

export const sound = new SoundService();
