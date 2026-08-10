import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import type { PondStatus } from "../../domain";

export function WarningBeacon({ active, status, reducedMotion }: { active: boolean; status: PondStatus; reducedMotion: boolean }) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const color = status === "critical" ? "#ff624b" : "#e8a33d";
  useFrame(({ clock }) => {
    if (!active || reducedMotion || !materialRef.current) return;
    materialRef.current.emissiveIntensity = 0.65 + (Math.sin(clock.elapsedTime * 5) + 1) * 0.7;
  });
  return (
    <group position={[4.25, 0.15, 2.95]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 1.1, 8]} />
        <meshStandardMaterial color="#6e8587" />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.34, 10]} />
        <meshStandardMaterial
          ref={materialRef}
          color={active ? color : "#52666a"}
          emissive={active ? color : "#000000"}
          emissiveIntensity={active ? 0.9 : 0}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}
