import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

export interface Sector3DData {
  id: string;
  num: number;
  code: string;
  title: string;
  short: string;
  tagline: string;
  color: string;
  glow: string;
  badge: string;
  questionCount: number;
  accuracy: string;
  avgTime: string;
  topics: string[];
  skills: string[];
  description: string;
}

export const SECTORS_3D_LIST: Sector3DData[] = [
  {
    id: 'sector-quant',
    num: 1,
    code: 'SEC-01',
    title: 'Quantitative Aptitude & Velocity',
    short: 'Quant Aptitude',
    tagline: 'Numerical Velocity, Speed Maths & Probabilistic Reasoning',
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.45)',
    badge: '📐 Sector 1 · Set A',
    questionCount: 15,
    accuracy: '74.2%',
    avgTime: '55s',
    topics: ['Relative Speed & Distance', 'Time & Work Coefficients', 'Permutations & Probability', 'Mixture & Allegations', 'Profit & Loss Formulas'],
    skills: ['Numerical Velocity', 'Mental Math Optimization', 'Probabilistic Intuition'],
    description: 'Calculated assessment of high-throughput mathematical problem solving, relative speed vectors, and algorithmic efficiency models.',
  },
  {
    id: 'sector-logic',
    num: 2,
    code: 'SEC-02',
    title: 'Logical Reasoning & Deduction',
    short: 'Logical Reasoning',
    tagline: 'Pattern Invariants, Syllogisms & Constraint Networks',
    color: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.45)',
    badge: '🧩 Sector 2 · Set B',
    questionCount: 15,
    accuracy: '78.6%',
    avgTime: '60s',
    topics: ['Categorical Syllogisms', 'Topological Seating Grids', 'Blood Relations Coded Logic', 'Cryptarithmetic Matrices', 'Sequential Patterns'],
    skills: ['Constraint Satisfaction', 'Boolean Deduction', 'Relational Mapping'],
    description: 'Rigorous cognitive deduction, spatial layout matrices, condition verification, and symbolic invariant analysis.',
  },
  {
    id: 'sector-core-cs',
    num: 3,
    code: 'SEC-03',
    title: 'Core Computer Science Systems',
    short: 'Core CS Systems',
    tagline: 'Operating Systems, Concurrency, ACID DBMS & Networking',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.45)',
    badge: '💻 Sector 3 · Set C',
    questionCount: 18,
    accuracy: '69.1%',
    avgTime: '45s',
    topics: ['Virtual Memory Paging', 'Deadlock & Semaphore Invariants', 'Database B+ Trees & BCNF', 'TCP 3-Way Handshake Flow', 'Compiler Lexical ASTs'],
    skills: ['System Concurrency', 'Transaction Serializability', 'Network Protocols'],
    description: 'Foundational systems engineering across hardware-software interfaces, kernel primitives, distributed databases, and protocol state machines.',
  },
  {
    id: 'sector-dsa',
    num: 4,
    code: 'SEC-04',
    title: 'Data Structures & Algorithms',
    short: 'DSA & Algorithms',
    tagline: 'Trees, Graphs, DP Transitions & Big-O Complexity',
    color: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.45)',
    badge: '⚡ Sector 4 · Set D',
    questionCount: 20,
    accuracy: '64.8%',
    avgTime: '75s',
    topics: ['Dijkstra & Graph BFS/DFS', 'Multi-State Dynamic Programming', 'Binary Search on Value Range', 'Segment & Fenwick Trees', 'Monotonic Stacks'],
    skills: ['Optimal Substructure', 'Asymptotic Complexity', 'Graph Invariants'],
    description: 'Deep computational problem solving with live test cases, recursion bounds, optimal caching, and algorithmic proofs.',
  },
  {
    id: 'sector-fullstack',
    num: 5,
    code: 'SEC-05',
    title: 'Full-Stack & Distributed Architecture',
    short: 'Full-Stack & Systems',
    tagline: 'Microservices, Event Loops, Redis Caching & Cloud',
    color: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.45)',
    badge: '🌐 Sector 5 · Set E',
    questionCount: 18,
    accuracy: '71.5%',
    avgTime: '50s',
    topics: ['Libuv Event Loop Check Phase', 'React Fiber Reconciliation', 'Distributed Redis Caching', 'CAP & Eventual Consistency', 'WebSockets Telemetry'],
    skills: ['Event-Driven Architecture', 'High-Concurrency Scaling', 'State Synchronization'],
    description: 'Full-lifecycle modern application engineering, cloud infrastructure scale, async non-blocking runtimes, and real-time socket pipelines.',
  },
];

interface SectorsUniverse3DProps {
  onSelectSector?: (sector: Sector3DData) => void;
  className?: string;
}

export default function SectorsUniverse3D({ onSelectSector, className = '' }: SectorsUniverse3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  const [selectedSector, setSelectedSector] = useState<Sector3DData>(SECTORS_3D_LIST[0]);
  const [hoveredSector, setHoveredSector] = useState<Sector3DData | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Active sector reference for Three.js render loop
  const activeSectorIndexRef = useRef<number>(0);
  activeSectorIndexRef.current = SECTORS_3D_LIST.findIndex((s) => s.id === selectedSector.id);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 550;

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050814, 0.025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 14);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const centerPointLight = new THREE.PointLight(0x38bdf8, 2.5, 30);
    centerPointLight.position.set(0, 0, 0);
    scene.add(centerPointLight);

    // --- LOGICWHILELIRE CENTRAL HOLOGRAPHIC CORE ---
    const coreGroup = new THREE.Group();

    // Central pulsing icosahedron (The LiRE core)
    const coreGeom = new THREE.IcosahedronGeometry(1.2, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffb800,
      emissive: 0xff7a00,
      emissiveIntensity: 0.65,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    coreGroup.add(coreMesh);

    // Inner glowing sphere (Electric Blue Engine)
    const innerCoreGeom = new THREE.SphereGeometry(0.75, 16, 16);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.95,
    });
    const innerCoreMesh = new THREE.Mesh(innerCoreGeom, innerCoreMat);
    coreGroup.add(innerCoreMesh);

    // Golden Circuit Orbital rings around center
    const ringGeom = new THREE.TorusGeometry(2.3, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc200, transparent: true, opacity: 0.75 });
    const ring1 = new THREE.Mesh(ringGeom, ringMat);
    ring1.rotation.x = Math.PI / 2.5;
    coreGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeom, ringMat);
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    scene.add(coreGroup);

    // --- PARTICLE FIELD ---
    const particleCount = 180;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 22;
      particlePositions[i + 1] = (Math.random() - 0.5) * 14;
      particlePositions[i + 2] = (Math.random() - 0.5) * 16;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // --- 5 ORBITING SECTOR CRYSTALS ---
    const sectorNodes: Array<{
      group: THREE.Group;
      mesh: THREE.Mesh;
      wireMesh: THREE.Mesh;
      ringMesh: THREE.Mesh;
      baseAngle: number;
      radius: number;
      data: Sector3DData;
    }> = [];

    const orbitRadius = 5.2;

    SECTORS_3D_LIST.forEach((sector, idx) => {
      const nodeGroup = new THREE.Group();
      const baseAngle = (idx / SECTORS_3D_LIST.length) * (Math.PI * 2);

      let geom: THREE.BufferGeometry;
      switch (idx) {
        case 0: // Quant: Octahedron
          geom = new THREE.OctahedronGeometry(0.85, 0);
          break;
        case 1: // Logic: Icosahedron
          geom = new THREE.IcosahedronGeometry(0.85, 0);
          break;
        case 2: // Core CS: Dodecahedron
          geom = new THREE.DodecahedronGeometry(0.85, 0);
          break;
        case 3: // DSA: TorusKnot
          geom = new THREE.TorusKnotGeometry(0.55, 0.18, 48, 12);
          break;
        case 4: // Full-Stack: Box
        default:
          geom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
          break;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(sector.color),
        roughness: 0.25,
        metalness: 0.35,
        emissive: new THREE.Color(sector.color),
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geom, mat);
      nodeGroup.add(mesh);

      // Wireframe overlay for cyber-holographic look
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const wireMesh = new THREE.Mesh(geom, wireMat);
      nodeGroup.add(wireMesh);

      // Orbital halo ring for each sector node
      const nodeRingGeom = new THREE.RingGeometry(1.2, 1.25, 32);
      const nodeRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sector.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const ringMesh = new THREE.Mesh(nodeRingGeom, nodeRingMat);
      ringMesh.rotation.x = Math.PI / 2;
      nodeGroup.add(ringMesh);

      scene.add(nodeGroup);

      sectorNodes.push({
        group: nodeGroup,
        mesh,
        wireMesh,
        ringMesh,
        baseAngle,
        radius: orbitRadius,
        data: sector,
      });
    });

    // --- RAYCASTER FOR MOUSE CLICK / HOVER ON 3D NODES ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactiveMeshes = sectorNodes.map((n) => n.mesh);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = sectorNodes.find((n) => n.mesh === intersects[0].object);
        if (hit) {
          setHoveredSector(hit.data);
          canvas.style.cursor = 'pointer';
        }
      } else {
        setHoveredSector(null);
        canvas.style.cursor = 'default';
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactiveMeshes = sectorNodes.map((n) => n.mesh);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = sectorNodes.find((n) => n.mesh === intersects[0].object);
        if (hit) {
          setSelectedSector(hit.data);
          if (onSelectSector) onSelectSector(hit.data);
        }
      }
    };

    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('click', onPointerDown);

    // --- ANIMATION LOOP ---
    let reqId = 0;
    let orbitClock = 0;

    const renderLoop = () => {
      reqId = requestAnimationFrame(renderLoop);

      orbitClock += 0.007;

      // Central core pulse & spin
      coreMesh.rotation.x += 0.006;
      coreMesh.rotation.y += 0.009;
      innerCoreMesh.rotation.y -= 0.012;
      ring1.rotation.z += 0.004;
      ring2.rotation.z -= 0.005;

      const scalePulse = 1.0 + Math.sin(orbitClock * 2) * 0.04;
      coreGroup.scale.set(scalePulse, scalePulse, scalePulse);

      // Rotate particles slowly
      particles.rotation.y = orbitClock * 0.05;

      // Position each sector around the orbit
      sectorNodes.forEach((node, i) => {
        const angle = node.baseAngle + orbitClock * 0.4;
        const x = Math.cos(angle) * node.radius;
        const z = Math.sin(angle) * node.radius;
        const y = Math.sin(angle * 2) * 0.7;

        node.group.position.set(x, y, z);
        node.mesh.rotation.x += 0.015;
        node.mesh.rotation.y += 0.02;
        node.wireMesh.rotation.x = node.mesh.rotation.x;
        node.wireMesh.rotation.y = node.mesh.rotation.y;

        const isCurrentSelected = i === activeSectorIndexRef.current;
        const isHovered = hoveredSector?.id === node.data.id;

        const targetScale = isCurrentSelected ? 1.45 : isHovered ? 1.25 : 1.0;
        node.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        // Highlight selected material
        const standardMat = node.mesh.material as THREE.MeshStandardMaterial;
        if (isCurrentSelected || isHovered) {
          standardMat.emissiveIntensity = 0.85;
          node.ringMesh.visible = true;
          node.ringMesh.rotation.z += 0.03;
        } else {
          standardMat.emissiveIntensity = 0.3;
          node.ringMesh.visible = false;
        }
      });

      // Smooth camera subtle float
      camera.position.x = Math.sin(orbitClock * 0.3) * 0.6;
      camera.position.y = 5.2 + Math.cos(orbitClock * 0.25) * 0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    renderLoop();

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      if (!container || !canvas) return;
      width = container.clientWidth || 800;
      height = container.clientHeight || 550;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', onPointerMove);
      canvas.removeEventListener('click', onPointerDown);

      // Disposal
      coreGeom.dispose();
      coreMat.dispose();
      innerCoreGeom.dispose();
      innerCoreMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      particleGeom.dispose();
      particleMat.dispose();

      sectorNodes.forEach((node) => {
        node.mesh.geometry.dispose();
        (node.mesh.material as THREE.Material).dispose();
        node.ringMesh.geometry.dispose();
        (node.ringMesh.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, []);

  const handleLaunchPractice = (sectorId: string) => {
    navigate('/practice', { state: { selectedSectorId: sectorId } });
  };

  const handleEnterExam = () => {
    navigate('/enter-exam');
  };

  return (
    <div
      ref={containerRef}
      className={`sectors-universe-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '680px',
        borderRadius: '24px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 30%, #0d1a38 0%, #050814 70%, #03040a 100%)',
        border: '1px solid rgba(43, 127, 255, 0.25)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header & Telemetry Pill */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 28,
          right: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(255, 194, 0, 0.12)',
              border: '1px solid rgba(255, 194, 0, 0.35)',
              color: '#FFC200',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFC200', boxShadow: '0 0 10px #FFC200' }} />
            Logic Whi1e LiRE · 5-Sector Knowledge Galaxy
          </div>
          <h3
            style={{
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
              fontWeight: 800,
              color: '#F8FAFC',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Elevating Coding Knowledge Across All 5 Sectors
          </h3>
        </div>

        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className="btn btn-ghost btn-sm"
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94A3B8',
              borderRadius: '10px',
              fontSize: '0.78rem',
              padding: '6px 12px',
            }}
          >
            {autoRotate ? '⏸ Pause Orbit' : '▶ Resume Orbit'}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '520px',
          display: 'block',
          outline: 'none',
        }}
      />

      {/* 3D Sector Selector Quick Strip */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 24px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {SECTORS_3D_LIST.map((sector) => {
          const isSelected = selectedSector.id === sector.id;
          return (
            <button
              key={sector.id}
              onClick={() => {
                setSelectedSector(sector);
                if (onSelectSector) onSelectSector(sector);
              }}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, rgba(15,23,42,0.95), ${sector.glow})`
                  : 'rgba(15, 23, 42, 0.7)',
                border: isSelected ? `2px solid ${sector.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '12px 14px',
                color: '#FFFFFF',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'translateY(-4px)' : 'none',
                boxShadow: isSelected ? `0 8px 24px ${sector.glow}` : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: sector.color, letterSpacing: '0.05em' }}>
                  {sector.code}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: `${sector.color}22`,
                    color: sector.color,
                    fontWeight: 700,
                  }}
                >
                  {sector.badge.split('·')[1]?.trim() || 'Set'}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sector.short}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {sector.questionCount} Questions · {sector.accuracy} Bench
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Sector Telemetry Overlay HUD */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedSector.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'relative',
            zIndex: 10,
            background: 'rgba(11, 18, 36, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTop: `2px solid ${selectedSector.color}`,
            padding: '24px 28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            alignItems: 'center',
          }}
        >
          {/* Column 1: Sector Core Identity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: selectedSector.color,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: `${selectedSector.color}20`,
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                {selectedSector.badge}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Authoritative Evaluation Sector</span>
            </div>

            <h4
              style={{
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                fontSize: '1.45rem',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: '0 0 6px',
              }}
            >
              {selectedSector.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94A3B8', lineHeight: 1.5 }}>
              {selectedSector.description}
            </p>
          </div>

          {/* Column 2: Key Subtopic Tags & Metrics */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
              Mastery Syllabus Subtopics
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {selectedSector.topics.map((t, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.76rem',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#E2E8F0',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Micro Metrics Strip */}
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Target Accuracy</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: selectedSector.color }}>
                  {selectedSector.accuracy}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Avg Pace</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                  {selectedSector.avgTime}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Question Pool</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38BDF8' }}>
                  {selectedSector.questionCount} Sets
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => handleLaunchPractice(selectedSector.id)}
              className="btn btn-primary"
              style={{
                background: `linear-gradient(135deg, ${selectedSector.color}, #1B5FB5)`,
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                padding: '12px 20px',
                borderRadius: '10px',
                boxShadow: `0 4px 18px ${selectedSector.glow}`,
                cursor: 'pointer',
              }}
            >
              🚀 Launch Sector {selectedSector.num} Practice Sprint
            </button>

            <button
              onClick={handleEnterExam}
              className="btn btn-ghost"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#E2E8F0',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              🔑 Take Full 5-Sector Assessment
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
