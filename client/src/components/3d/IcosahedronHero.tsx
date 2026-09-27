import { useRef, useEffect } from 'react';

interface IcosahedronHeroProps {
  className?: string;
  width?: number;
  height?: number;
  showEdges?: boolean;
}

export default function IcosahedronHero({
  className = 'w-full h-full opacity-80',
  width = 600,
  height = 600,
  showEdges = true,
}: IcosahedronHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    const cx = width / 2;
    const cy = height / 2;

    let mouseX = 0, mouseY = 0;

    // 12 vertices of icosahedron
    const PHI = (1 + Math.sqrt(5)) / 2;
    const points: [number, number, number][] = [
      [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
      [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
      [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
    ];

    const vertices = points.map(p => ({
      x: p[0] * 80,
      y: p[1] * 80,
      z: p[2] * 80,
    }));

    // Standard edges for an icosahedron
    const edges: [number, number][] = [
      [0, 1], [0, 5], [0, 7], [0, 10], [0, 11],
      [1, 5], [1, 7], [1, 8], [1, 9],
      [2, 3], [2, 4], [2, 6], [2, 10], [2, 11],
      [3, 4], [3, 6], [3, 8], [3, 9],
      [4, 5], [4, 9], [4, 11],
      [5, 9], [5, 11],
      [6, 7], [6, 8], [6, 10],
      [7, 8], [7, 10],
      [8, 9],
      [10, 11]
    ];

    let rotX = 0, rotY = 0;
    let animId = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX - window.innerWidth / 2;
      mouseY = e.clientY - window.innerHeight / 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      rotY += 0.005 + mouseX * 0.00008;
      rotX += 0.003 + mouseY * 0.00008;

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Project vertices
      const projected = vertices.map(v => {
        let x = v.x * cosY - v.z * sinY;
        let z = v.x * sinY + v.z * cosY;
        let y = v.y * cosX - z * sinX;
        z = v.y * sinX + z * cosX;

        const scale = 300 / (300 + z);
        const px = x * scale + cx;
        const py = y * scale + cy;
        return { px, py, z, scale };
      });

      // Draw wireframe edges
      if (showEdges) {
        ctx.lineWidth = 1.2;
        for (const [a, b] of edges) {
          const pA = projected[a];
          const pB = projected[b];
          const avgZ = (pA.z + pB.z) / 2;
          const alpha = Math.max(0.1, Math.min(0.8, 0.4 - avgZ * 0.002));
          ctx.strokeStyle = `rgba(108, 92, 231, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(pA.px, pA.py);
          ctx.lineTo(pB.px, pB.py);
          ctx.stroke();
        }
      }

      // Draw glowing vertices
      projected.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.px, p.py, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(108, 92, 231, ${0.4 + p.scale * 0.6})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#6C5CE7';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [width, height, showEdges]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: `${width} / ${height}`,
      }}
      aria-label="3D Wireframe Icosahedron Hero"
    />
  );
}
