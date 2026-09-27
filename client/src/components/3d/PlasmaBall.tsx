import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function PlasmaBallMesh() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const innerRef = useRef<THREE.Mesh>(null!)

  // Lightning arc geometry (tubes)
  const arcs = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const points: THREE.Vector3[] = []
      const steps = 20
      const angleBase = (i / 8) * Math.PI * 2
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const r = 0.55 + Math.sin(t * Math.PI) * 0.9 + (Math.random() - 0.5) * 0.25
        const angle = angleBase + t * (Math.random() * 0.8 + 0.3) * Math.PI
        const elevation = (Math.random() - 0.5) * Math.PI * 0.6
        points.push(new THREE.Vector3(
          r * Math.cos(angle) * Math.cos(elevation),
          r * Math.sin(elevation),
          r * Math.sin(angle) * Math.cos(elevation)
        ))
      }
      const curve = new THREE.CatmullRomCurve3(points)
      const geo = new THREE.TubeGeometry(curve, 20, 0.012, 5, false)
      const colors = ['#6C5CE7', '#8b5cf6', '#06b6d4', '#a78bfa', '#7c3aed', '#06b6d4', '#6C5CE7', '#a78bfa']
      return { geo, color: colors[i] }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.3
      meshRef.current.rotation.x = t * 0.15
    }
    if (innerRef.current) {
      const s = 1 + Math.sin(t * 3) * 0.04
      innerRef.current.scale.setScalar(s)
    }
  })

  return (
    <group>
      {/* Outer glass sphere */}
      <mesh>
        <sphereGeometry args={[1.5, 48, 48]} />
        <meshPhysicalMaterial
          color="#0a0f2e"
          transparent
          opacity={0.25}
          roughness={0}
          metalness={0.1}
          transmission={0.8}
          thickness={0.5}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color="#6C5CE7" emissive="#6C5CE7" emissiveIntensity={3} />
      </mesh>

      {/* Lightning arcs */}
      <group ref={meshRef}>
        {arcs.map(({ geo, color }, i) => (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

interface PlasmaBallProps {
  height?: number
}

export default function PlasmaBall({ height = 320 }: PlasmaBallProps) {
  return (
    <div style={{ width: '100%', height }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={4} color="#6C5CE7" distance={6} />
        <pointLight position={[3, 3, 3]} intensity={0.8} color="#06b6d4" />
        <PlasmaBallMesh />
      </Canvas>
    </div>
  )
}
