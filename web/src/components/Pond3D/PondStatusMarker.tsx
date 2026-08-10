import type { PondStatus } from "../../domain";

export function PondStatusMarker({ status }: { status: PondStatus }) {
  const color = status === "critical" ? "#f2563b" : status === "warning" ? "#e8a33d" : "#2fbfa0";
  return (
    <group position={[-4.25, 0.18, 2.92]}>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.84, 7]} />
        <meshStandardMaterial color="#647c7e" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
      </mesh>
    </group>
  );
}
