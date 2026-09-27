import { Canvas } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'

export default function LiquidBlob({ className = 'absolute w-[500px] h-[500px] -z-10 opacity-30', ...props }: { className?: string; [key: string]: any }) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        width: 500,
        height: 500,
        zIndex: 0,
        opacity: 0.35,
        pointerEvents: 'none',
      }}
      {...props}
    >
      <Canvas dpr={[1, 1.5]}>
        <ambientLight intensity={1} />
        <Sphere args={[1, 100, 100]} scale={2.5}>
          <MeshDistortMaterial color="#6C5CE7" distort={0.4} speed={2} roughness={0} />
        </Sphere>
      </Canvas>
    </div>
  )
}
