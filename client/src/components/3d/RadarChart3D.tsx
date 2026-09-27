import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface RadarDataPoint {
  label: string
  value: number // 0–1
}

interface RadarChartInnerProps {
  data: RadarDataPoint[]
  color: string
}

function RadarMesh({ data, color }: RadarChartInnerProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const lineRef = useRef<THREE.LineLoop>(null!)
  const n = data.length
  const R = 1.8

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.z = clock.getElapsedTime() * 0.15
    if (lineRef.current) lineRef.current.rotation.z = clock.getElapsedTime() * 0.15
  })

  const fillPositions: number[] = []
  const linePositions: number[] = []

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    const r = data[i].value * R
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    fillPositions.push(0, 0, 0, x, y, 0)
    if (i < n - 1) {
      const angle2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
      const r2 = data[i + 1].value * R
      fillPositions.push(Math.cos(angle2) * r2, Math.sin(angle2) * r2, 0)
    } else {
      const angle2 = 0 * Math.PI * 2 - Math.PI / 2
      const r2 = data[0].value * R
      fillPositions.push(Math.cos(angle2) * r2, Math.sin(angle2) * r2, 0)
    }
    linePositions.push(x, y, 0)
  }
  const a0 = 0 * Math.PI * 2 - Math.PI / 2
  linePositions.push(Math.cos(a0) * data[0].value * R, Math.sin(a0) * data[0].value * R, 0)

  const fillGeo = new THREE.BufferGeometry()
  fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fillPositions, 3))

  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))

  const c = new THREE.Color(color)

  return (
    <>
      <mesh ref={meshRef} geometry={fillGeo}>
        <meshBasicMaterial color={c} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <lineLoop ref={lineRef} geometry={lineGeo}>
        <lineBasicMaterial color={c} linewidth={2} />
      </lineLoop>
    </>
  )
}

// Axis spokes — use primitive to avoid SVG <line> collision
function Axes({ n, color }: { n: number; color: string }) {
  const R = 1.8
  const c = new THREE.Color(color)
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(
          [0, 0, 0, Math.cos(angle) * R, Math.sin(angle) * R, 0], 3
        ))
        const mat = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.3 })
        const lineSeg = new THREE.Line(geo, mat)
        return <primitive key={i} object={lineSeg} />
      })}
    </>
  )
}

interface RadarChart3DProps {
  data?: RadarDataPoint[]
  color?: string
  height?: number
}

const DEFAULT_DATA: RadarDataPoint[] = [
  { label: 'Speed', value: 0.85 },
  { label: 'Accuracy', value: 0.72 },
  { label: 'Logic', value: 0.90 },
  { label: 'DS', value: 0.65 },
  { label: 'Algo', value: 0.78 },
]

export default function RadarChart3D({ data = DEFAULT_DATA, color = '#6C5CE7', height = 280 }: RadarChart3DProps) {
  return (
    <div style={{ width: '100%', height }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.5} />
        <RadarMesh data={data} color={color} />
        <Axes n={data.length} color={color} />
      </Canvas>
    </div>
  )
}
