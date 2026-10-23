/**
 * LogicWhileLiRE — Web Audio Synthesizer
 * Zero-asset, pure browser-native sound generator for:
 * - Invigilator broadcasts and direct whisper notices
 * - Anti-cheat breach alerts (tab switch, context menu, DevTools)
 * - Time extension celebrations
 * - Submission confirmations
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  /**
   * High-tech two-tone chime for invigilator broadcasts & whisper directives
   */
  public playProctorBroadcastChime() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)       // A5
      osc1.frequency.setValueAtTime(1174.66, now + 0.12) // D6

      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(440, now)
      osc2.frequency.setValueAtTime(587.33, now + 0.12)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.5)
      osc2.stop(now + 0.5)
    } catch {
      /* Audio policy safe fallback */
    }
  }

  /**
   * Authoritative alert pulse for security violations & tab switch detection
   */
  public playSecurityAlertTone() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.linearRampToValueAtTime(220, now + 0.18)
      osc.frequency.linearRampToValueAtTime(320, now + 0.28)
      osc.frequency.linearRampToValueAtTime(180, now + 0.45)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1200, now)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.5)
    } catch {
      /* Non-blocking audio */
    }
  }

  /**
   * Harmonious ascending chord for server-authoritative time extensions
   */
  public playTimeExtensionChime() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      const now = ctx.currentTime

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.08)

        gain.gain.setValueAtTime(0.001, now + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.08 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + idx * 0.08)
        osc.stop(now + idx * 0.08 + 0.4)
      })
    } catch {
      /* Safe fallback */
    }
  }

  /**
   * Celebratory resolution chime on successful exam submission
   */
  public playExamSubmittedFanfare() {
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const chords = [587.33, 739.99, 880, 1174.66] // D major triumph
      const now = ctx.currentTime

      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.06)

        gain.gain.setValueAtTime(0.001, now + idx * 0.06)
        gain.gain.exponentialRampToValueAtTime(0.15, now + idx * 0.06 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.7)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + idx * 0.06)
        osc.stop(now + idx * 0.06 + 0.7)
      })
    } catch {
      /* Safe fallback */
    }
  }
}

export const soundFx = new AudioSynthesizer()
