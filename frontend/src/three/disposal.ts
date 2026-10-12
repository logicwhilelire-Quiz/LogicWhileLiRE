import * as THREE from 'three'

/**
 * disposal.ts — Clean Three.js Resource Disposal Helper
 *
 * Traverses an Object3D hierarchy and properly disposes:
 * - Geometries
 * - Materials (single or arrays)
 * - Associated textures and maps
 * - Renderers
 */

export function safeDisposeMaterial(mat: any) {
  if (!mat) return

  // Dispose all potential textures attached to material slots
  const textureSlots = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
  ]

  for (const slot of textureSlots) {
    const tex = mat[slot]
    if (tex && typeof tex.dispose === 'function') {
      tex.dispose()
    }
  }

  if (typeof mat.dispose === 'function') {
    mat.dispose()
  }
}

export function safeDisposeObject3D(object: THREE.Object3D | null | undefined) {
  if (!object) return

  object.traverse((child: any) => {
    if (child.geometry && typeof child.geometry.dispose === 'function') {
      child.geometry.dispose()
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m: any) => safeDisposeMaterial(m))
      } else {
        safeDisposeMaterial(child.material)
      }
    }
  })
}

export function safeDisposeRenderer(renderer: THREE.WebGLRenderer | null | undefined) {
  if (!renderer) return
  try {
    renderer.dispose()
    renderer.forceContextLoss()
    const dom = renderer.domElement
    if (dom && dom.parentNode) {
      dom.parentNode.removeChild(dom)
    }
  } catch {
    // Ignore context loss errors during unmount
  }
}
