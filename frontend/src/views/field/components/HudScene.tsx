import { useLayoutEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * three.js scene rendered inside the IVAS lens.
 *
 * Static framing of a room interior with classified figures:
 *  - hostile (red marker)
 *  - friendly (blue marker)
 *  - unknown (grey marker)
 *
 * Composition mirrors the reference brief: three hostiles by the rear
 * doorway, one friendly plus three unknowns on the left of the room, one
 * friendly plus one unknown on the right.
 */
export default function HudScene() {
  return (
    <Canvas
      camera={{ position: [0, 1.7, 6], fov: 38, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#0b1220']} />
      <CameraTarget target={[0, 1.0, -8]} />
      <Room />
      <Figures />
    </Canvas>
  );
}

function CameraTarget({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(new THREE.Vector3(...target));
  }, [camera, target]);
  return null;
}

const ROOM = {
  width: 20,
  depth: 18,
  height: 8,
  /** centre of the floor (and the room's xz origin) */
  centre: { x: 0, z: 0 },
};

const COLOURS = {
  floor: '#eef0f4',
  backWall: '#dee2e8',
  sideWall: '#cfd4dc',
  ceiling: '#e6e9ee',
  door: '#a8d2ec',
  doorHandle: '#0f172a',
  silhouette: '#0f172a',
  hostile: '#ef4444',
  friendly: '#2563eb',
  unknown: '#94a3b8',
} as const;

function Room() {
  const halfW = ROOM.width / 2;
  const halfD = ROOM.depth / 2;
  const halfH = ROOM.height / 2;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshBasicMaterial color={COLOURS.floor} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshBasicMaterial color={COLOURS.ceiling} />
      </mesh>

      <mesh position={[0, halfH, -halfD]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.backWall} />
      </mesh>

      <mesh position={[-halfW, halfH, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.sideWall} />
      </mesh>

      <mesh position={[halfW, halfH, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.sideWall} />
      </mesh>

      {/* doorway in the back wall, slightly proud to avoid z-fighting */}
      <mesh position={[0, 1.35, -halfD + 0.01]}>
        <planeGeometry args={[1.5, 2.7]} />
        <meshBasicMaterial color={COLOURS.door} />
      </mesh>
      <mesh position={[0.55, 1.35, -halfD + 0.02]}>
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={COLOURS.doorHandle} />
      </mesh>
    </group>
  );
}

type Marker = 'hostile' | 'friendly' | 'unknown';

const MARKER_COLOUR: Record<Marker, string> = {
  hostile: COLOURS.hostile,
  friendly: COLOURS.friendly,
  unknown: COLOURS.unknown,
};

/**
 * Flat soldier silhouette, traced as a single closed shape in the xy plane.
 * Built once and reused across every figure.
 */
function buildSilhouette(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0);
  s.lineTo(0.25, 0.55);
  s.lineTo(0.55, 0.85);
  s.lineTo(0.5, 1.3);
  s.lineTo(0.18, 1.4);
  s.lineTo(0.22, 1.55);
  s.absarc(0, 1.55, 0.22, 0, Math.PI, false);
  s.lineTo(-0.18, 1.4);
  s.lineTo(-0.5, 1.3);
  s.lineTo(-0.55, 0.85);
  s.lineTo(-0.25, 0.55);
  s.lineTo(-0.25, 0);
  return s;
}

interface FigureProps {
  position: [number, number, number];
  marker: Marker;
  scale?: number;
}

function Figure({ position, marker, scale = 1 }: FigureProps) {
  const shape = useMemo(buildSilhouette, []);
  return (
    <group position={position} scale={scale}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={COLOURS.silhouette} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.95, 0.005]}>
        <circleGeometry args={[0.13, 24]} />
        <meshBasicMaterial color={MARKER_COLOUR[marker]} />
      </mesh>
    </group>
  );
}

function Figures() {
  return (
    <group>
      {/* hostiles in/near the doorway */}
      <Figure position={[-0.7, 0, -8]} marker="hostile" />
      <Figure position={[0, 0, -8.05]} marker="hostile" />
      <Figure position={[0.7, 0, -8]} marker="hostile" />

      {/* left flank: friendly leading three unknowns */}
      <Figure position={[-6, 0, -2.5]} marker="friendly" />
      <Figure position={[-4.4, 0, -3.2]} marker="unknown" scale={0.9} />
      <Figure position={[-3.3, 0, -3.6]} marker="unknown" scale={0.9} />
      <Figure position={[-2.2, 0, -4]} marker="unknown" scale={0.9} />

      {/* right flank: friendly with a single unknown */}
      <Figure position={[5, 0, -2.5]} marker="friendly" />
      <Figure position={[6.3, 0, -3]} marker="unknown" scale={0.9} />
    </group>
  );
}
