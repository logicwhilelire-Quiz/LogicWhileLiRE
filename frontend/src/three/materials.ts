import * as THREE from 'three'

/**
 * materials.ts — Standardized LogicWhileLiRE Brand 3D Materials & Geometries
 *
 * Adheres strictly to H3:
 * - Brand blues only (#0A3F8F wordmark, #1B5FB5 icon, #2B7FFF aerospace)
 * - Light and dark aware
 * - No aggressive neon/glow
 * - Depth via soft lighting, subtle shadows, gentle parallax
 */

export const BRAND_COLORS = {
  blueDark: '#0A3F8F',
  blueMid: '#1B5FB5',
  blueBright: '#2B7FFF',
  navyBg: '#050814',
  surfaceDark: '#0F172A',
  neutralLight: '#F8FAFC',
} as const

// Shared Geometries (reusable across instances to save memory)
let cachedSphere: THREE.SphereGeometry | null = null
let cachedBox: THREE.BoxGeometry | null = null
let cachedIcosahedron: THREE.IcosahedronGeometry | null = null

export function getSharedSphereGeometry(radius = 1, widthSegments = 24, heightSegments = 24): THREE.SphereGeometry {
  if (!cachedSphere) {
    cachedSphere = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
  }
  return cachedSphere
}

export function getSharedBoxGeometry(width = 1, height = 1, depth = 1): THREE.BoxGeometry {
  if (!cachedBox) {
    cachedBox = new THREE.BoxGeometry(width, height, depth)
  }
  return cachedBox
}

export function getSharedIcosahedronGeometry(radius = 1, detail = 0): THREE.IcosahedronGeometry {
  if (!cachedIcosahedron) {
    cachedIcosahedron = new THREE.IcosahedronGeometry(radius, detail)
  }
  return cachedIcosahedron
}

/**
 * Creates brand-standard standard mesh material
 */
export function createBrandMeshMaterial(options: {
  color?: string | number
  roughness?: number
  metalness?: number
  wireframe?: boolean
} = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? BRAND_COLORS.blueBright),
    roughness: options.roughness ?? 0.35,
    metalness: options.metalness ?? 0.2,
    wireframe: options.wireframe ?? false,
  })
}

/**
 * Creates brand line basic material
 */
export function createBrandLineMaterial(color: string | number = BRAND_COLORS.blueBright, opacity = 0.6): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
  })
}
