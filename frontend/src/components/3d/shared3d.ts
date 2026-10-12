import { useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Shared 3D Performance Kit & Guards
 * Enforces Hard Rules:
 * - Cap pixel ratio to max 1.5
 * - Pause render loops when tab is hidden
 * - Respect prefers-reduced-motion
 * - Detect low-end devices for fallback
 * - Clean disposal of Three.js geometries/materials/textures
 */

export function getSafeDpr(): [number, number] {
  return [1, 1.5];
}

export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hw = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 4;
  return hw <= 2 || mem <= 2;
}

/**
 * Hook to pause animations when the user leaves the tab
 */
export function useTabVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return isVisible;
}

/**
 * Recursively disposes all geometries, materials, and textures
 */
export function safeDisposeObject3D(object: THREE.Object3D) {
  if (!object) return;

  object.traverse((child: any) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat: any) => disposeMaterial(mat));
      } else {
        disposeMaterial(child.material);
      }
    }
  });
}

function disposeMaterial(mat: any) {
  if (!mat) return;
  Object.keys(mat).forEach((prop) => {
    const value = (mat as any)[prop];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      // Texture detected
      value.dispose();
    }
  });
  mat.dispose();
}
