import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'

const FACES = ['{ }', '</>', '01', '&&', '=>', '[]']
const COLORS = ['#6C5CE7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function RotatingCube() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    groupRef.current.rotation.x = t * 0.4
    groupRef.current.rotation.y = t * 0.6
    groupRef.current.rotation.z = t * 0.2
  })

  const facePositions: [number, number, number][] = [
    [0, 0, 1.01],   // front
    [0, 0, -1.01],  // back
    [0, 1.01, 0],   // top
    [0, -1.01, 0],  // bottom
    [1.01, 0, 0],   // right
    [-1.01, 0, 0],  // left
  ]
  const faceRotations: [number, number, number][] = [
    [0, 0, 0],
    [0, Math.PI, 0],
    [-Math.PI / 2, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, Math.PI / 2, 0],
    [0, -Math.PI / 2, 0],
  ]

  return (
    <group ref={groupRef}>
      <RoundedBox args={[2, 2, 2]} radius={0.15} smoothness={4}>
        <meshStandardMaterial color="#0d1326" metalness={0.8} roughness={0.2} wireframe={false} />
      </RoundedBox>
      {FACES.map((face, i) => (
        <group key={i} position={facePositions[i]} rotation={faceRotations[i]}>
          <Text
            fontSize={0.45}
            color={COLORS[i]}
            font={undefined}
            anchorX="center"
            anchorY="middle"
          >
            {face}
          </Text>
        </group>
      ))}
    </group>
  )
}

interface CodeCubeProps {
  height?: number
}

export default function CodeCube({ height = 280 }: CodeCubeProps) {
  return (
    <div style={{ width: '100%', height }}>
      <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#6C5CE7" />
        <pointLight position={[-5, -5, 5]} intensity={0.8} color="#06b6d4" />
        <RotatingCube />
      </Canvas>
    </div>
  )
}
