/**
 * InspectorRadarMatrix3D.tsx — 3D Holographic Inspector Orbital Matrix
 * An interactive 3D WebGL sphere visualizing all active candidates in real time.
 * Provides inspector with panoramic visibility, risk-level laser highlights, and raycaster inspection.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { type StudentTile } from './LiveGridWall';

interface InspectorRadarMatrix3DProps {
  students: StudentTile[];
  onSelectStudent?: (s: StudentTile) => void;
  selectedId?: string | null;
  height?: number;
}

export default function InspectorRadarMatrix3D({
  students = [],
  onSelectStudent,
  selectedId,
  height = 420,
}: InspectorRadarMatrix3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandidate, setHoveredCandidate] = useState<StudentTile | null>(null);
  const [radarRotating, setRadarRotating] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 30, 95);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f2fe, 2, 200);
    pointLight.position.set(0, 20, 50);
    scene.add(pointLight);

    // Central Holographic Inspector Core
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Inner wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(22, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x1e3a8a,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const innerSphere = new THREE.Mesh(sphereGeo, sphereMat);
    coreGroup.add(innerSphere);

    // Equatorial and Polar Orbital Rings
    const ringGeo1 = new THREE.RingGeometry(27.8, 28.2, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const eqRing = new THREE.Mesh(ringGeo1, ringMat1);
    eqRing.rotation.x = Math.PI / 2;
    coreGroup.add(eqRing);

    const ringGeo2 = new THREE.RingGeometry(34.8, 35.2, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const polarRing = new THREE.Mesh(ringGeo2, ringMat2);
    polarRing.rotation.y = Math.PI / 3;
    coreGroup.add(polarRing);

    // Radar Scanning Fan
    const radarFanGeo = new THREE.CircleGeometry(36, 32, 0, Math.PI / 3);
    const radarFanMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const radarFan = new THREE.Mesh(radarFanGeo, radarFanMat);
    radarFan.rotation.x = Math.PI / 2;
    scene.add(radarFan);

    // Candidate Nodes Group
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    const nodeMeshes: Array<{ mesh: THREE.Mesh; student: StudentTile }> = [];

    // Distribute candidate nodes across spherical shell using Fibonacci sphere distribution
    const count = Math.max(students.length, 1);
    const radius = 32;

    students.forEach((student, i) => {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      const isCheating = student.status === 'cheating';
      const isIdle = student.status === 'idle';
      const isDone = student.status === 'offline';
      const isSelected = student.id === selectedId;

      const nodeColor = isCheating
        ? 0xef4444
        : isIdle
        ? 0xf59e0b
        : isDone
        ? 0x94a3b8
        : 0x10b981;

      const geo = isCheating
        ? new THREE.OctahedronGeometry(isSelected ? 2.4 : 1.8)
        : new THREE.SphereGeometry(isSelected ? 2.0 : 1.4, 12, 12);

      const mat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: isSelected ? 1.0 : isCheating ? 0.8 : 0.4,
        roughness: 0.3,
        metalness: 0.7,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = { student };
      nodesGroup.add(mesh);
      nodeMeshes.push({ mesh, student });

      // If cheating, add subtle pulse ring
      if (isCheating) {
        const alertRingGeo = new THREE.RingGeometry(2.4, 2.7, 16);
        const alertRingMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        });
        const alertRing = new THREE.Mesh(alertRingGeo, alertRingMat);
        alertRing.lookAt(camera.position);
        mesh.add(alertRing);
      }
    });

    // Raycaster for hover and selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));

      if (intersects.length > 0) {
        const target = intersects[0].object.userData.student as StudentTile;
        setHoveredCandidate(target);
        container.style.cursor = 'pointer';
      } else {
        setHoveredCandidate(null);
        container.style.cursor = 'default';
      }
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));
      if (intersects.length > 0) {
        const target = intersects[0].object.userData.student as StudentTile;
        onSelectStudent?.(target);
      }
    };

    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('click', onClick);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation frame loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (radarRotating) {
        coreGroup.rotation.y += delta * 0.25;
        coreGroup.rotation.x += delta * 0.1;
        nodesGroup.rotation.y += delta * 0.18;
        radarFan.rotation.z += delta * 0.9;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('click', onClick);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [students, selectedId, radarRotating, height, onSelectStudent]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, rgba(15,23,42,0.85) 0%, rgba(3,7,18,0.98) 100%)', border: '1px solid rgba(43,127,255,0.3)', boxShadow: '0 12px 36px rgba(0,0,0,0.5)' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height }} />

      {/* Top Overlay HUD */}
      <div style={{ position: 'absolute', top: 12, left: 16, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f2fe', boxShadow: '0 0 10px #00f2fe', animation: 'blink 1.5s infinite' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd' }}>
          3D Orbital Candidate Radar ({students.length} Nodes)
        </span>
      </div>

      {/* Controls Overlay */}
      <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setRadarRotating((r) => !r)}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
            background: radarRotating ? 'rgba(0,242,254,0.15)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${radarRotating ? 'rgba(0,242,254,0.4)' : 'rgba(255,255,255,0.2)'}`,
            color: radarRotating ? '#38bdf8' : '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          {radarRotating ? '⏸️ Freeze Sphere' : '▶️ Spin Matrix'}
        </button>
      </div>

      {/* Interactive Hover HUD Card */}
      {hoveredCandidate && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(43,127,255,0.5)',
            borderRadius: 10,
            padding: '10px 16px',
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ fontSize: '1.4rem' }}>
            {hoveredCandidate.status === 'cheating' ? '🚨' : hoveredCandidate.status === 'idle' ? '🟡' : hoveredCandidate.status === 'offline' ? '🏁' : '🟢'}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
              {hoveredCandidate.hallTicket || hoveredCandidate.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Score: <strong style={{ color: '#38bdf8' }}>{hoveredCandidate.score !== undefined ? `${hoveredCandidate.score}%` : 'In Progress'}</strong> • Flags: <strong style={{ color: (hoveredCandidate.flagCount || 0) > 0 ? '#ef4444' : '#10b981' }}>{hoveredCandidate.flagCount || 0}</strong> • Status: <strong>{hoveredCandidate.status.toUpperCase()}</strong>
            </div>
          </div>
          <div style={{ marginLeft: 6, fontSize: '0.68rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Click to Inspect →
          </div>
        </div>
      )}

      {/* Legend Footer */}
      <div style={{ position: 'absolute', bottom: 12, right: 16, display: 'flex', gap: 12, fontSize: '0.68rem', color: '#94a3b8', pointerEvents: 'none', background: 'rgba(3,7,18,0.7)', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Active
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> Idle
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> Flagged
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} /> Submitted
        </span>
      </div>
    </div>
  );
}
