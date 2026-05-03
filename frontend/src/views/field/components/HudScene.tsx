import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * three.js scene rendered inside the IVAS lens.
 *
 * The wearer stands inside an enclosed room. Hold Left/Right arrows to
 * yaw, hold Up/Down to pitch (clamped to about ±60°). When the camera is
 * returned to its initial orientation the front view matches the original
 * reference exactly: every figure is fixed in world space, the original
 * cluster never changes, and the additional random figures are generated
 * once on first load and live behind the camera.
 *
 * The canvas runs in `frameloop="demand"` mode so the scene is only
 * re-drawn while a key is held; once the camera stops moving no further
 * frames are rendered.
 */
export default function HudScene() {
  const [randomFigures] = useState(generateRandomFigures);

  return (
    <Canvas
      camera={{ position: CAMERA_POSITION, fov: 50, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 2]}
      frameloop="demand"
    >
      <color attach="background" args={['#0b1220']} />
      <CameraRig />
      <Room />
      {[...ORIGINAL_FIGURES, ...randomFigures].map((f, i) => (
        <Figure key={i} {...f} />
      ))}
    </Canvas>
  );
}

// --- camera & input -----------------------------------------------------

const CAMERA_POSITION: [number, number, number] = [0, 1.7, 5];
const INITIAL_YAW = 0;
/** Slight downward tilt to match the original framing (~3.4° below horizon). */
const INITIAL_PITCH = -0.06;
const PITCH_LIMIT = Math.PI / 3;
const ROTATION_SPEED = 1.4; // radians per second

function CameraRig() {
  const { camera, invalidate } = useThree();
  const yawRef = useRef(INITIAL_YAW);
  const pitchRef = useRef(INITIAL_PITCH);
  const keysRef = useRef({ left: false, right: false, up: false, down: false });

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(INITIAL_PITCH, INITIAL_YAW, 0);
    invalidate();
  }, [camera, invalidate]);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const k = keysRef.current;
      let matched = true;
      switch (e.key) {
        case 'ArrowLeft':
          k.left = true;
          break;
        case 'ArrowRight':
          k.right = true;
          break;
        case 'ArrowUp':
          k.up = true;
          break;
        case 'ArrowDown':
          k.down = true;
          break;
        default:
          matched = false;
      }
      if (matched) {
        e.preventDefault();
        invalidate();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.key) {
        case 'ArrowLeft':
          k.left = false;
          break;
        case 'ArrowRight':
          k.right = false;
          break;
        case 'ArrowUp':
          k.up = false;
          break;
        case 'ArrowDown':
          k.down = false;
          break;
      }
    };
    // If the window loses focus while a key is held the keyup never
    // fires; reset all input so the camera doesn't drift forever.
    const handleBlur = () => {
      keysRef.current = { left: false, right: false, up: false, down: false };
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [invalidate]);

  useFrame((_, dt) => {
    const k = keysRef.current;
    let active = false;
    if (k.left) {
      yawRef.current += ROTATION_SPEED * dt;
      active = true;
    }
    if (k.right) {
      yawRef.current -= ROTATION_SPEED * dt;
      active = true;
    }
    if (k.up) {
      const next = Math.min(pitchRef.current + ROTATION_SPEED * dt, PITCH_LIMIT);
      if (next !== pitchRef.current) {
        pitchRef.current = next;
        active = true;
      }
    }
    if (k.down) {
      const next = Math.max(pitchRef.current - ROTATION_SPEED * dt, -PITCH_LIMIT);
      if (next !== pitchRef.current) {
        pitchRef.current = next;
        active = true;
      }
    }
    if (active) {
      camera.rotation.set(pitchRef.current, yawRef.current, 0);
      invalidate();
    }
  });

  return null;
}

// --- room ---------------------------------------------------------------

const ROOM = {
  width: 20,
  depth: 20,
  height: 8,
  /** Floor centre on z; offsets the room so it extends past the camera at z=5. */
  centreZ: 1,
} as const;

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
  const halfH = ROOM.height / 2;
  const halfD = ROOM.depth / 2;
  const cz = ROOM.centreZ;
  const backZ = cz - halfD;
  const frontZ = cz + halfD;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshBasicMaterial color={COLOURS.floor} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshBasicMaterial color={COLOURS.ceiling} />
      </mesh>
      <mesh position={[0, halfH, backZ]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.backWall} />
      </mesh>
      <mesh position={[0, halfH, frontZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.backWall} />
      </mesh>
      <mesh position={[-halfW, halfH, cz]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.sideWall} />
      </mesh>
      <mesh position={[halfW, halfH, cz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, ROOM.height]} />
        <meshBasicMaterial color={COLOURS.sideWall} />
      </mesh>

      {/* original doorway in the back wall, slightly proud to avoid z-fighting */}
      <mesh position={[0, 1.35, backZ + 0.01]}>
        <planeGeometry args={[1.5, 2.7]} />
        <meshBasicMaterial color={COLOURS.door} />
      </mesh>
      <mesh position={[0.55, 1.35, backZ + 0.02]}>
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={COLOURS.doorHandle} />
      </mesh>

      {/* second doorway on the front wall, off-centre right */}
      <mesh position={[3, 1.35, frontZ - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.5, 2.7]} />
        <meshBasicMaterial color={COLOURS.door} />
      </mesh>
      <mesh position={[2.45, 1.35, frontZ - 0.02]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.06, 24]} />
        <meshBasicMaterial color={COLOURS.doorHandle} />
      </mesh>
    </group>
  );
}

// --- figures ------------------------------------------------------------

type Marker = 'hostile' | 'friendly' | 'unknown';

const MARKER_COLOUR: Record<Marker, string> = {
  hostile: COLOURS.hostile,
  friendly: COLOURS.friendly,
  unknown: COLOURS.unknown,
};

function randomMarker(): Marker {
  const r = Math.random();
  if (r < 1 / 3) return 'hostile';
  if (r < 2 / 3) return 'friendly';
  return 'unknown';
}

interface FigureProps {
  position: [number, number, number];
  marker: Marker;
  scale?: number;
}

/**
 * Flat soldier silhouette traced as a single closed shape in the xy plane.
 * Built once at module load and reused across every figure.
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

const SILHOUETTE = buildSilhouette();

/**
 * Each figure is a flat plane oriented once, at construction, to face the
 * camera position. The camera position never moves (only its rotation
 * changes), so this orientation stays valid no matter where the wearer
 * looks. Per-frame billboarding is therefore unnecessary.
 */
function Figure({ position, marker, scale = 1 }: FigureProps) {
  const yRot = useMemo(() => {
    const dx = CAMERA_POSITION[0] - position[0];
    const dz = CAMERA_POSITION[2] - position[2];
    return Math.atan2(dx, dz);
  }, [position]);

  return (
    <group position={position} rotation={[0, yRot, 0]} scale={scale}>
      <mesh>
        <shapeGeometry args={[SILHOUETTE]} />
        <meshBasicMaterial color={COLOURS.silhouette} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.95, 0.005]}>
        <circleGeometry args={[0.13, 24]} />
        <meshBasicMaterial color={MARKER_COLOUR[marker]} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * The reference layout: three hostiles at the rear doorway, one friendly
 * plus three unknowns on the left, one friendly plus one unknown on the
 * right. These positions never change.
 */
const ORIGINAL_FIGURES: readonly FigureProps[] = [
  { position: [-0.7, 0, -8], marker: 'hostile' },
  { position: [0, 0, -8.05], marker: 'hostile' },
  { position: [0.7, 0, -8], marker: 'hostile' },
  { position: [-6, 0, -2.5], marker: 'friendly' },
  { position: [-4.4, 0, -3.2], marker: 'unknown', scale: 0.9 },
  { position: [-3.3, 0, -3.6], marker: 'unknown', scale: 0.9 },
  { position: [-2.2, 0, -4], marker: 'unknown', scale: 0.9 },
  { position: [5, 0, -2.5], marker: 'friendly' },
  { position: [6.3, 0, -3], marker: 'unknown', scale: 0.9 },
];

const RANDOM_COUNT = 6;

/**
 * Random figures placed behind the camera (z > camera z) on first load,
 * so the original front view is preserved exactly. They become visible
 * once the wearer turns around. Generated once and held in component
 * state, so positions, markers and sizes never change for the session.
 */
function generateRandomFigures(): FigureProps[] {
  const out: FigureProps[] = [];
  for (let i = 0; i < RANDOM_COUNT; i++) {
    out.push({
      position: [
        (Math.random() - 0.5) * 16,
        0,
        6 + Math.random() * 4,
      ],
      marker: randomMarker(),
      scale: 0.75 + Math.random() * 0.4,
    });
  }
  return out;
}
