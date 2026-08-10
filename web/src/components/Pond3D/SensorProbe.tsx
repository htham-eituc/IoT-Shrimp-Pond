import type { MetricTone } from "../../presentation/metrics";

export function SensorProbe({ position, tone }: { position: [number, number, number]; tone: MetricTone }) {
  const color = tone === "critical" ? "#f2563b" : tone === "warning" ? "#e8a33d" : tone === "normal" ? "#2fbfa0" : "#55bddd";
  return (
    <group position={position}>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.82, 7]} />
        <meshStandardMaterial color="#91aeb2" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial color="#294b55" />
      </mesh>
    </group>
  );
}
