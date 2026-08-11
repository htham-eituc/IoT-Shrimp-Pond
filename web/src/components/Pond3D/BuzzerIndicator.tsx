import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

export function BuzzerIndicator({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const ringsRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!active || reducedMotion || !ringsRef.current) return;
    const scale = 0.9 + (Math.sin(clock.elapsedTime * 4.5) + 1) * 0.14;
    ringsRef.current.scale.setScalar(scale);
  });
  return (
    <group position={[3.55, 0.47, 2.92]}>
      <mesh position={[0, -0.22, 0]} castShadow>
        <boxGeometry args={[0.4, 0.08, 0.3]} />
        <meshStandardMaterial color="#3b5559" roughness={0.58} metalness={0.12} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.21, 0.28, 14]} />
        <meshStandardMaterial color={active ? "#e8a33d" : "#51666b"} emissive={active ? "#8c5114" : "#000000"} emissiveIntensity={active ? 0.55 : 0} roughness={0.46} metalness={0.1} />
      </mesh>
      {active && (
        <group ref={ringsRef} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.29, 0.025, 6, 18]} />
            <meshBasicMaterial color="#f3b84f" transparent opacity={0.75} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.43, 0.018, 6, 18]} />
            <meshBasicMaterial color="#f3b84f" transparent opacity={0.42} />
          </mesh>
        </group>
      )}
    </group>
  );
}
