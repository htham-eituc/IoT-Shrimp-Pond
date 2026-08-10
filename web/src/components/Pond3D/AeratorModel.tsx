import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Pond3DQuality } from "./pondQuality";

export function AeratorModel({ position, active, reducedMotion, quality }: { position: [number, number, number]; active: boolean; reducedMotion: boolean; quality: Pond3DQuality }) {
  const wheelRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!active || reducedMotion || !wheelRef.current) return;
    wheelRef.current.rotation.z -= delta * 3.2;
  });

  return (
    <group position={position}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[1.45, 0.12, 0.65]} />
        <meshStandardMaterial color="#315366" roughness={0.8} />
      </mesh>
      <mesh position={[-0.55, 0.22, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color="#75919b" />
      </mesh>
      <mesh position={[0.55, 0.22, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color="#75919b" />
      </mesh>
      <group ref={wheelRef} position={[0, 0.42, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.43, 0.43, 0.22, 16]} />
          <meshStandardMaterial color={active ? "#2fd5bb" : "#3e6875"} roughness={0.58} />
        </mesh>
        {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation) => (
          <mesh key={rotation} rotation={[0, 0, rotation]}>
            <boxGeometry args={[0.9, 0.075, 0.34]} />
            <meshStandardMaterial color={active ? "#8be7da" : "#4d7180"} />
          </mesh>
        ))}
      </group>
      {active && <BubbleField reducedMotion={reducedMotion} quality={quality} />}
    </group>
  );
}

function BubbleField({ reducedMotion, quality }: { reducedMotion: boolean; quality: Pond3DQuality }) {
  const bubblesRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !bubblesRef.current) return;
    bubblesRef.current.position.y = (clock.elapsedTime * 0.16) % 0.32;
  });
  return (
    <group ref={bubblesRef} position={[0, -0.08, 0]}>
      {(quality === "low" ? [-0.28, 0.28] : [-0.4, -0.18, 0.05, 0.28, 0.45]).map((x, index) => (
        <mesh key={x} position={[x, (index % 3) * 0.08, 0.25 - (index % 2) * 0.5]}>
          <sphereGeometry args={[0.035 + (index % 2) * 0.012, 6, 5]} />
          <meshBasicMaterial color="#c7f8f3" transparent opacity={0.68} />
        </mesh>
      ))}
    </group>
  );
}
