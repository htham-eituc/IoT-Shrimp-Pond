import { memo } from "react";

const BANK_COLOR = "#2c5149";

export const PondBasin = memo(function PondBasin() {
  return (
    <group>
      <mesh position={[0, -0.58, 0]} receiveShadow>
        <boxGeometry args={[9.45, 0.22, 5.85]} />
        <meshStandardMaterial color="#0b2932" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.44, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.16, 5.18]} />
        <meshStandardMaterial color="#123541" roughness={0.9} />
      </mesh>
      <Bank position={[0, -0.08, -2.78]} size={[10.1, 0.9, 0.55]} accentPosition={[0, 0.49, -0.02]} accentSize={[9.72, 0.055, 0.1]} />
      <Bank position={[0, -0.08, 2.78]} size={[10.1, 0.9, 0.55]} accentPosition={[0, 0.49, 0.02]} accentSize={[9.72, 0.055, 0.1]} />
      <Bank position={[-4.78, -0.08, 0]} size={[0.55, 0.9, 5.1]} accentPosition={[-0.02, 0.49, 0]} accentSize={[0.1, 0.055, 4.72]} />
      <Bank position={[4.78, -0.08, 0]} size={[0.55, 0.9, 5.1]} accentPosition={[0.02, 0.49, 0]} accentSize={[0.1, 0.055, 4.72]} />
      <mesh position={[0, 0.39, -2.43]}>
        <boxGeometry args={[8.82, 0.04, 0.08]} />
        <meshBasicMaterial color="#6aa79d" transparent opacity={0.24} />
      </mesh>
      <mesh position={[0, 0.39, 2.43]}>
        <boxGeometry args={[8.82, 0.04, 0.08]} />
        <meshBasicMaterial color="#6aa79d" transparent opacity={0.18} />
      </mesh>
    </group>
  );
});

function Bank({
  position,
  size,
  accentPosition,
  accentSize,
}: {
  position: [number, number, number];
  size: [number, number, number];
  accentPosition: [number, number, number];
  accentSize: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={BANK_COLOR} roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh position={accentPosition}>
        <boxGeometry args={accentSize} />
        <meshStandardMaterial color="#497467" roughness={0.88} />
      </mesh>
    </group>
  );
}
