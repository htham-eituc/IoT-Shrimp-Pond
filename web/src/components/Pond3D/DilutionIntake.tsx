import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

export function DilutionIntake({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const flowRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!active || reducedMotion || !flowRef.current) return;
    flowRef.current.position.x = 0.35 - ((clock.elapsedTime * 0.4) % 0.5);
  });
  return (
    <group position={[4.65, 0.05, -1.35]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.8, 12]} />
        <meshStandardMaterial color={active ? "#42d3ba" : "#42616c"} roughness={0.65} />
      </mesh>
      {active && (
        <group ref={flowRef} position={[0.35, 0, 0]}>
          {[0, 0.2, 0.4].map((offset) => (
            <mesh key={offset} position={[offset, 0, 0]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshBasicMaterial color="#6cebd5" transparent opacity={0.75} />
            </mesh>
          ))}
          <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.13, 0.32, 8]} />
            <meshBasicMaterial color="#6cebd5" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
    </group>
  );
}
