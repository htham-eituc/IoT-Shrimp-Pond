import { memo } from "react";

const BANK_COLOR = "#2c5149";

export const PondBasin = memo(function PondBasin() {
  return (
    <group>
      <mesh position={[0, -0.56, 0]}>
        <boxGeometry args={[9.3, 0.22, 5.7]} />
        <meshStandardMaterial color="#102f38" roughness={0.92} />
      </mesh>
      <Bank position={[0, -0.08, -2.78]} size={[10.1, 0.9, 0.55]} />
      <Bank position={[0, -0.08, 2.78]} size={[10.1, 0.9, 0.55]} />
      <Bank position={[-4.78, -0.08, 0]} size={[0.55, 0.9, 5.1]} />
      <Bank position={[4.78, -0.08, 0]} size={[0.55, 0.9, 5.1]} />
    </group>
  );
});

function Bank({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={BANK_COLOR} roughness={1} />
    </mesh>
  );
}
