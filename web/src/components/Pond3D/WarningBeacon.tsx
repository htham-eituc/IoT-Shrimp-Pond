import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import type { PondStatus } from "../../domain";

export function WarningBeacon({ active, status, reducedMotion }: { active: boolean; status: PondStatus; reducedMotion: boolean }) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const glowRef = useRef<MeshStandardMaterial>(null);
  const color = status === "critical" ? "#ff624b" : "#e8a33d";
  useFrame(({ clock }) => {
    if (!active || reducedMotion) return;
    const pulse = 0.65 + (Math.sin(clock.elapsedTime * 5) + 1) * 0.7;
    if (materialRef.current) materialRef.current.emissiveIntensity = pulse;
    if (glowRef.current) glowRef.current.opacity = 0.12 + (Math.sin(clock.elapsedTime * 5) + 1) * 0.13;
  });
  return (
    <group position={[4.25, 0.15, 2.95]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 1.1, 8]} />
        <meshStandardMaterial color="#7f999b" roughness={0.48} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.08, 12]} />
        <meshStandardMaterial color="#3b5559" roughness={0.56} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.34, 16]} />
        <meshStandardMaterial
          ref={materialRef}
          color={active ? color : "#52666a"}
          emissive={active ? color : "#000000"}
          emissiveIntensity={active ? 0.9 : 0}
          transparent
          opacity={0.9}
        />
      </mesh>
      {active && (
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.46, 16, 10]} />
          <meshBasicMaterial ref={glowRef} color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
