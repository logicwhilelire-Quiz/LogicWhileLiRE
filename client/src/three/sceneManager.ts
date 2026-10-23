import * as THREE from 'three'
import { safeDisposeObject3D, safeDisposeRenderer } from './disposal'

export interface SceneManagerOptions {
  container: HTMLElement
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  onUpdate?: (delta: number) => void
}

/**
 * LogicWhileLiRESceneManager / LOGICWHILELIRESceneManager — Controls scene lifecycle, frame loops, and viewport pause
 * Ensures animations stop when tab is backgrounded or canvas is scrolled out of view.
 */
export class LogicWhileLiRESceneManager {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.Camera
  private onUpdate?: (delta: number) => void

  private isRunning = false
  private isTabVisible = true
  private isCanvasVisible = true
  private animFrameId: number | null = null
  private clock = new THREE.Clock()
  private observer: IntersectionObserver | null = null

  constructor(options: SceneManagerOptions) {
    this.container = options.container
    this.renderer = options.renderer
    this.scene = options.scene
    this.camera = options.camera
    this.onUpdate = options.onUpdate

    this.initVisibilityListeners()
  }

  private initVisibilityListeners() {
    if (typeof document !== 'undefined') {
      const handleTab = () => {
        this.isTabVisible = !document.hidden
        this.checkState()
      }
      document.addEventListener('visibilitychange', handleTab)
    }

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          this.isCanvasVisible = entry ? entry.isIntersecting : true
          this.checkState()
        },
        { threshold: 0.05 }
      )
      this.observer.observe(this.container)
    }
  }

  private checkState() {
    const shouldRun = this.isTabVisible && this.isCanvasVisible
    if (shouldRun && !this.isRunning) {
      this.start()
    } else if (!shouldRun && this.isRunning) {
      this.stop()
    }
  }

  public start() {
    if (this.isRunning) return
    this.isRunning = true
    this.clock.start()

    const loop = () => {
      if (!this.isRunning) return
      const delta = this.clock.getDelta()
      if (this.onUpdate) {
        this.onUpdate(delta)
      }
      this.renderer.render(this.scene, this.camera)
      this.animFrameId = requestAnimationFrame(loop)
    }

    this.animFrameId = requestAnimationFrame(loop)
  }

  public stop() {
    this.isRunning = false
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  public resize(width: number, height: number) {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
    this.renderer.setSize(width, height)
  }

  public dispose() {
    this.stop()
    if (this.observer) {
      this.observer.disconnect()
    }
    safeDisposeObject3D(this.scene)
    safeDisposeRenderer(this.renderer)
  }
}

export const LOGICWHILELIRESceneManager = LogicWhileLiRESceneManager

