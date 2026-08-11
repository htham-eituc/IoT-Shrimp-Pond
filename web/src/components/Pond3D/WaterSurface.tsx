import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type Group, type Mesh } from "three";
import type { Pond3DQuality } from "./pondQuality";

export function WaterSurface({
  surfaceY,
  rain,
  animate,
  reducedMotion,
  quality,
}: {
  surfaceY: number;
  rain: boolean;
  animate: boolean;
  reducedMotion: boolean;
  quality: Pond3DQuality;
}) {
  const waterRef = useRef<Mesh>(null);
  const volumeRef = useRef<Mesh>(null);
  const shimmerRef = useRef<Group>(null);
  const rippleRef = useRef<Group>(null);
  const currentY = useRef(surfaceY);
  const invalidate = useThree((state) => state.invalidate);
  const showDetails = quality !== "low";

  useEffect(() => invalidate(), [invalidate, surfaceY]);

  useFrame(({ clock }, delta) => {
    if (!waterRef.current || !volumeRef.current) return;
    currentY.current = reducedMotion ? surfaceY : MathUtils.damp(currentY.current, surfaceY, 4.2, delta);
    const agitation = animate && !reducedMotion ? Math.sin(clock.elapsedTime * 0.75) * 0.012 : 0;
    const waterDepth = Math.max(0.12, currentY.current + 0.53);
    waterRef.current.position.y = currentY.current + agitation;
    volumeRef.current.position.y = -0.5 + waterDepth / 2;
    volumeRef.current.scale.y = waterDepth;
    if (!reducedMotion && Math.abs(currentY.current - surfaceY) > 0.001) invalidate();
    if (!reducedMotion && shimmerRef.current) {
      shimmerRef.current.position.x = Math.sin(clock.elapsedTime * 0.45) * 0.08;
      shimmerRef.current.position.z = Math.cos(clock.elapsedTime * 0.32) * 0.06;
    }
    if (!reducedMotion && rippleRef.current) {
      const pulse = 1 + (Math.sin(clock.elapsedTime * (rain ? 2.4 : 1.4)) + 1) * (animate ? 0.018 : 0.008);
      rippleRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group>
      <mesh ref={volumeRef} position={[0, -0.5 + Math.max(0.12, surfaceY + 0.53) / 2, 0]} scale={[1, Math.max(0.12, surfaceY + 0.53), 1]}>
        <boxGeometry args={[8.95, 1, 5.05]} />
        <meshPhysicalMaterial color={rain ? "#176982" : "#135773"} transparent opacity={0.74} roughness={rain ? 0.42 : 0.24} metalness={0.03} transmission={0.12} thickness={0.45} />
      </mesh>
      <mesh ref={waterRef} position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.95, 5.05, showDetails ? 18 : 4, showDetails ? 10 : 3]} />
        <meshPhysicalMaterial color={rain ? "#58b7c8" : "#3fb6c8"} transparent opacity={rain ? 0.78 : 0.7} roughness={rain ? 0.38 : 0.14} metalness={0.04} clearcoat={0.45} clearcoatRoughness={rain ? 0.34 : 0.18} />
      </mesh>
      {showDetails && (
        <group ref={shimmerRef} position={[0, surfaceY + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[-1.4, 0.55, 0]}>
            <planeGeometry args={[2.4, 0.045]} />
            <meshBasicMaterial color="#b6fff3" transparent opacity={rain ? 0.11 : 0.18} />
          </mesh>
          <mesh position={[1.25, -0.82, 0]} rotation={[0, 0, -0.1]}>
            <planeGeometry args={[2.9, 0.04]} />
            <meshBasicMaterial color="#87e8ff" transparent opacity={rain ? 0.1 : 0.16} />
          </mesh>
          <mesh position={[0.3, 0.08, 0]} rotation={[0, 0, 0.08]}>
            <planeGeometry args={[4.8, 0.025]} />
            <meshBasicMaterial color="#e8fffb" transparent opacity={0.08} />
          </mesh>
        </group>
      )}
      <group ref={rippleRef} position={[0, surfaceY + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {(rain ? [0.7, 1.45, 2.15] : animate ? [0.95, 1.9] : [1.55]).map((radius, index) => (
          <mesh key={radius} position={[index * 0.75 - 0.7, index % 2 === 0 ? 0.46 : -0.52, 0]}>
            <ringGeometry args={[radius, radius + 0.012, 48]} />
            <meshBasicMaterial color={rain ? "#b3eaff" : "#b8fff2"} transparent opacity={rain ? 0.11 : 0.09} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
