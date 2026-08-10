import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Pond3DQuality } from "./pondQuality";

export function FeederModel({ active, reducedMotion, quality }: { active: boolean; reducedMotion: boolean; quality: Pond3DQuality }) {
  const feedRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!active || reducedMotion || !feedRef.current) return;
    feedRef.current.rotation.y = clock.elapsedTime * 1.4;
    feedRef.current.position.y = -0.12 - ((clock.elapsedTime * 0.16) % 0.34);
  });
  return (
    <group position={[0, 0.65, -1.1]}>
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.38, 0.22, 0.72, 10]} />
        <meshStandardMaterial color={active ? "#38caa9" : "#4c6970"} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.1, 0.19, 0.2, 10]} />
        <meshStandardMaterial color="#718a8e" />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.62, 8]} />
        <meshStandardMaterial color="#789399" />
      </mesh>
      {active && (
        <group ref={feedRef} position={[0, -0.12, 0]}>
          {Array.from({ length: quality === "low" ? 3 : 6 }, (_, index) => {
            const count = quality === "low" ? 3 : 6;
            const angle = (index / count) * Math.PI * 2;
            return (
              <mesh key={index} position={[Math.cos(angle) * 0.52, -0.12, Math.sin(angle) * 0.52]}>
                <sphereGeometry args={[0.035, 5, 4]} />
                <meshBasicMaterial color="#e7c879" />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}
