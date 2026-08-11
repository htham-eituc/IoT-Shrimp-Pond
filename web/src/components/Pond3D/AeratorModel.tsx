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
      <mesh position={[0, -0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.12, 0.65]} />
        <meshStandardMaterial color="#274f61" roughness={0.72} metalness={0.1} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.84, 12]} />
          <meshStandardMaterial color={active ? "#2b7481" : "#314d57"} roughness={0.62} metalness={0.06} />
        </mesh>
      ))}
      <mesh position={[-0.55, 0.22, 0]} rotation={[0, 0, -0.25]} castShadow>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color="#8aa9b0" roughness={0.44} metalness={0.16} />
      </mesh>
      <mesh position={[0.55, 0.22, 0]} rotation={[0, 0, 0.25]} castShadow>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color="#8aa9b0" roughness={0.44} metalness={0.16} />
      </mesh>
      <group ref={wheelRef} position={[0, 0.42, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.43, 0.43, 0.22, 24]} />
          <meshStandardMaterial color={active ? "#2fd5bb" : "#3e6875"} roughness={0.46} metalness={0.14} emissive={active ? "#12584f" : "#000000"} emissiveIntensity={active ? 0.25 : 0} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.47, 0.025, 8, 24]} />
          <meshStandardMaterial color={active ? "#b2fff3" : "#64828a"} roughness={0.35} metalness={0.18} />
        </mesh>
        {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation) => (
          <mesh key={rotation} rotation={[0, 0, rotation]} castShadow>
            <boxGeometry args={[0.9, 0.075, 0.34]} />
            <meshStandardMaterial color={active ? "#9ef7e8" : "#4d7180"} roughness={0.38} metalness={0.12} />
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
      {(quality === "low" ? [-0.28, 0.28] : [-0.48, -0.32, -0.15, 0.05, 0.24, 0.42, 0.56]).map((x, index) => (
        <mesh key={x} position={[x, (index % 4) * 0.075, 0.32 - (index % 3) * 0.28]}>
          <sphereGeometry args={[0.035 + (index % 2) * 0.012, 6, 5]} />
          <meshBasicMaterial color="#c7f8f3" transparent opacity={0.68} />
        </mesh>
      ))}
      {quality !== "low" && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.9, 48]} />
          <meshBasicMaterial color="#bdfef5" transparent opacity={0.16} />
        </mesh>
      )}
    </group>
  );
}
