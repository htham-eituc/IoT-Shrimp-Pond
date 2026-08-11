import type { MetricTone } from "../../presentation/metrics";

export function SensorProbe({ position, tone }: { position: [number, number, number]; tone: MetricTone }) {
  const color = tone === "critical" ? "#f2563b" : tone === "warning" ? "#e8a33d" : tone === "normal" ? "#2fbfa0" : "#55bddd";
  return (
    <group position={position}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.82, 7]} />
        <meshStandardMaterial color="#9eb9bd" roughness={0.42} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.09, 12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial color="#294b55" roughness={0.52} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.01, 6, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.62} />
      </mesh>
    </group>
  );
}
