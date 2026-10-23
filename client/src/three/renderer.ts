import * as THREE from 'three'
import { getSafeDprNumber } from './capability'

export interface RendererOptions {
  canvas?: HTMLCanvasElement
  alpha?: boolean
  antialias?: boolean
  powerPreference?: 'default' | 'high-performance' | 'low-power'
  preserveDrawingBuffer?: boolean
}

/**
 * createLogicWhileLiRERenderer — Standardized Three.js WebGLRenderer factory
 * Enforces DPR cap at 1.5, ACESFilmicToneMapping, and color space correctness.
 */
export function createLogicWhileLiRERenderer(options: RendererOptions = {}): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    alpha: options.alpha ?? true,
    antialias: options.antialias ?? true,
    powerPreference: options.powerPreference ?? 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  })

  // Enforce Master Prompt Phase H Hard Rule: Cap DPR at 1.5
  renderer.setPixelRatio(getSafeDprNumber())
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace

  return renderer
}

export const createLOGICWHILELIRERenderer = createLogicWhileLiRERenderer

