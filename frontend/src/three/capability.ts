/**
 * capability.ts — Hardware and environment detector for 3D & WebGL
 *
 * Enforces Master Prompt Phase H Rules:
 * - Low-end fallback when hardwareConcurrency <= 4 or deviceMemory <= 4 (or <= 2 strict)
 * - Prefers-reduced-motion fallback
 * - WebGL context availability check
 * - Safe DPR capping between 1.0 and 1.5
 */

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const hw = navigator.hardwareConcurrency || 4
  const mem = (navigator as any).deviceMemory || 4
  return hw <= 2 || mem <= 2
}

/**
 * Returns true if 3D should be disabled and replaced with 2D/SVG/CSS fallback
 */
export function shouldUseFallback(): boolean {
  return !isWebGLAvailable() || isReducedMotion() || isLowEndDevice()
}

/**
 * Enforces DPR cap at 1.5 to protect GPU fillrate across displays
 */
export function getSafeDpr(customDpr?: number): [number, number] {
  return [1, 1.5]
}

export function getSafeDprNumber(windowDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1): number {
  return Math.min(Math.max(windowDpr, 1), 1.5)
}
