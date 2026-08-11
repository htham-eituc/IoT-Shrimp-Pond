import type { PondStatus } from "../../domain";

export function PondStatusMarker({ status }: { status: PondStatus }) {
  const color = status === "critical" ? "#f2563b" : status === "warning" ? "#e8a33d" : "#2fbfa0";
  const glowOpacity = status === "normal" ? 0.14 : status === "warning" ? 0.22 : 0.3;
  return (
    <group position={[-4.25, 0.18, 2.92]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.055, 0.84, 7]} />
        <meshStandardMaterial color="#7f999b" roughness={0.48} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.08, 12]} />
        <meshStandardMaterial color="#3b5559" roughness={0.56} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshBasicMaterial color={color} transparent opacity={glowOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}
