import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { LineSegments } from "three";
import type { Pond3DQuality } from "./pondQuality";

export function RainEffect({ active, reducedMotion, quality }: { active: boolean; reducedMotion: boolean; quality: Pond3DQuality }) {
  const rainRef = useRef<LineSegments>(null);
  const count = reducedMotion || quality === "low" ? 10 : quality === "balanced" ? 28 : 42;
  const positions = useMemo(() => createRainPositions(count), [count]);

  useFrame((_, delta) => {
    if (!active || reducedMotion || !rainRef.current) return;
    rainRef.current.position.y -= delta * 3.6;
    if (rainRef.current.position.y < -2.2) rainRef.current.position.y = 2.2;
  });

  if (!active) return null;
  return (
    <lineSegments ref={rainRef} position={[0, 1.4, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#77cbed" transparent opacity={reducedMotion ? 0.48 : 0.76} />
    </lineSegments>
  );
}

function createRainPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 6);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 6;
    const x = Math.sin(index * 12.31) * 4.7;
    const y = ((index * 0.47) % 4.4) - 1;
    const z = Math.cos(index * 7.17) * 2.65;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    positions[offset + 3] = x - 0.08;
    positions[offset + 4] = y - 0.34;
    positions[offset + 5] = z;
  }
  return positions;
}
