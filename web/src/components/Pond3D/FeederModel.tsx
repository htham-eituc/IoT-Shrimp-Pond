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
      <mesh position={[0, 0.88, 0]} castShadow>
        <coneGeometry args={[0.46, 0.22, 16]} />
        <meshStandardMaterial color="#6b8990" roughness={0.56} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.24, 0.72, 16]} />
        <meshStandardMaterial color={active ? "#38caa9" : "#4c6970"} roughness={0.58} metalness={0.08} emissive={active ? "#145c4f" : "#000000"} emissiveIntensity={active ? 0.18 : 0} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.19, 0.2, 14]} />
        <meshStandardMaterial color="#8aa0a3" roughness={0.48} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.62, 8]} />
        <meshStandardMaterial color="#789399" roughness={0.48} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.015, 6, 16]} />
        <meshStandardMaterial color={active ? "#e7c879" : "#586e71"} roughness={0.58} />
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
