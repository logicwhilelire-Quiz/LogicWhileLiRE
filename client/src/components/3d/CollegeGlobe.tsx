import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const colleges = [
  { name: 'VRSEC', lat: 16.50, lng: 80.64, color: '#6C5CE7' },
  { name: 'KLU', lat: 16.44, lng: 80.62, color: '#06B6D4' },
  { name: 'RVR&JC', lat: 16.30, lng: 80.44, color: '#10B981' },
  { name: 'GITAM', lat: 17.78, lng: 83.37, color: '#F59E0B' },
  { name: 'Tenali', lat: 16.24, lng: 80.64, color: '#EF4444' }, // Your location
]

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function useLogicWhileLiRELogoTexture() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let active = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/brand/logicwhilelire-logo-dark.svg'
    img.onload = () => {
      if (!active) return
      const canvas = document.createElement('canvas')
      canvas.width = 1360
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.needsUpdate = true
        setTexture(tex)
      }
    }
    img.onerror = () => {
      if (!active) return
      const loader = new THREE.TextureLoader()
      loader.load('/brand/logicwhilelire-logo-dark.svg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (active) setTexture(tex)
      }, undefined, () => {
        loader.load('/logo.png', (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          if (active) setTexture(tex)
        })
      })
    }
    return () => {
      active = false
    }
  }, [])

  return texture
}

function createRoundedRectShape(w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

function GlobeLogoBadge({
  position,
  rotation,
  texture,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  texture: THREE.Texture | null
}) {
  const badgeWidth = 0.52
  const badgeHeight = 0.16
  const badgeRadius = 0.02

  const badgeGeometry = useMemo(() => {
    const shape = createRoundedRectShape(badgeWidth, badgeHeight, badgeRadius)
    return new THREE.ShapeGeometry(shape)
  }, [badgeWidth, badgeHeight, badgeRadius])

  const borderGeometry = useMemo(() => {
    const shape = createRoundedRectShape(badgeWidth, badgeHeight, badgeRadius)
    const points = shape.getPoints(32)
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [badgeWidth, badgeHeight, badgeRadius])

  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* 3D Glassmorphic Badge Plate with Smooth Rounded Corners */}
      <mesh geometry={badgeGeometry} position={[0, 0, -0.005]}>
        <meshStandardMaterial
          color="#081432"
          transparent
          opacity={0.88}
          roughness={0.25}
          metalness={0.8}
          emissive="#0A3F8F"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Smooth Glowing Border Rim */}
      <lineLoop geometry={borderGeometry} position={[0, 0, -0.003]}>
        <lineBasicMaterial color="#3B82F6" transparent opacity={0.85} linewidth={2} />
      </lineLoop>

      {/* Holographic Logo Face */}
      {texture && (
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[0.46, 0.13]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.02}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Subtle Glowing Corner Pips */}
      <mesh position={[-badgeWidth / 2 + 0.03, badgeHeight / 2 - 0.03, 0.008]}>
        <circleGeometry args={[0.008, 12]} />
        <meshBasicMaterial color="#60A5FA" />
      </mesh>
      <mesh position={[badgeWidth / 2 - 0.03, badgeHeight / 2 - 0.03, 0.008]}>
        <circleGeometry args={[0.008, 12]} />
        <meshBasicMaterial color="#60A5FA" />
      </mesh>
      <mesh position={[-badgeWidth / 2 + 0.03, -badgeHeight / 2 + 0.03, 0.008]}>
        <circleGeometry args={[0.008, 12]} />
        <meshBasicMaterial color="#60A5FA" />
      </mesh>
      <mesh position={[badgeWidth / 2 - 0.03, -badgeHeight / 2 + 0.03, 0.008]}>
        <circleGeometry args={[0.008, 12]} />
        <meshBasicMaterial color="#60A5FA" />
      </mesh>
    </group>
  )
}

function Globe() {
  const groupRef = useRef<THREE.Group>(null!)
  const logoTexture = useLogicWhileLiRELogoTexture()

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003
    }
  })

  const markers = useMemo(() => colleges.map(c => {
    // 1.02 radius places points right above sphere surface
    const pos = latLngToVec3(c.lat, c.lng, 1.02)
    return { ...c, pos }
  }), [])

  return (
    // Initial rotation of Math.PI brings India (lng ~80E) to face camera at Z > 0
    <group ref={groupRef} rotation={[0.2, Math.PI, 0]}>
      {/* Base Globe Sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#0d1b3e"
          roughness={0.55}
          metalness={0.35}
          emissive="#081430"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* Subtle atmospheric wireframe latitude & longitude grid */}
      <mesh>
        <sphereGeometry args={[1.005, 24, 24]} />
        <meshBasicMaterial
          color="#2B7FFF"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Inner Glowing Holographic Brand Core */}
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial
          color="#1B5FB5"
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Front LogicWhileLiRE 3D Holographic Emblem */}
      <GlobeLogoBadge
        position={[0, -0.44, 0.93]}
        rotation={[-0.38, 0, 0]}
        texture={logoTexture}
      />

      {/* Back LogicWhileLiRE 3D Holographic Emblem (opposite hemisphere) */}
      <GlobeLogoBadge
        position={[0, -0.44, -0.93]}
        rotation={[-0.38, Math.PI, 0]}
        texture={logoTexture}
      />

      {/* College Pulse Markers */}
      {markers.map((m, i) => (
        <group key={i} position={m.pos}>
          {/* Central emissive college dot */}
          <mesh>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial
              color={m.color}
              emissive={m.color}
              emissiveIntensity={3}
            />
          </mesh>

          {/* Outer glowing halo ring */}
          <mesh>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial
              color={m.color}
              transparent
              opacity={0.35}
              wireframe
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function CollegeGlobe({ className = 'w-[400px] h-[400px]' }: { className?: string; [key: string]: any }) {
  return (
    <div className={className} style={{ width: 400, height: 400, margin: '0 auto', maxWidth: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <pointLight position={[5, 5, 5]} intensity={1.8} />
        <directionalLight position={[-4, 3, 4]} intensity={1.4} color="#60A5FA" />
        <Globe />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}
