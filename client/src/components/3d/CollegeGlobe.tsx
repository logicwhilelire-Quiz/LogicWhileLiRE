import { useRef, useMemo } from 'react'
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

function Globe() {
  const groupRef = useRef<THREE.Group>(null!)
  
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
          color="#162044"
          roughness={0.6}
          metalness={0.3}
          emissive="#0a122c"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Subtle atmospheric wireframe latitude & longitude grid */}
      <mesh>
        <sphereGeometry args={[1.005, 24, 24]} />
        <meshBasicMaterial
          color="#6C5CE7"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>

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
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-4, 3, 4]} intensity={1.2} color="#a29bfe" />
        <Globe />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}
