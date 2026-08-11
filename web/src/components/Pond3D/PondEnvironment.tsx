import { memo } from "react";

const REED_PATCHES = [
  [-5.9, -3.65, 0.1],
  [-5.55, 3.75, 0.55],
  [5.7, -3.45, -0.25],
  [5.95, 3.45, 0.35],
  [-1.8, -4.05, -0.2],
  [2.4, 4.02, 0.2],
] as const;

const STONES = [
  [-6.1, -1.7, 0.18, 0.11],
  [-5.7, 1.9, 0.1, 0.08],
  [5.95, -0.9, 0.2, 0.1],
  [4.9, 3.9, 0.16, 0.09],
  [-2.7, 3.95, 0.12, 0.07],
] as const;

export const PondEnvironment = memo(function PondEnvironment() {
  return (
    <>
      <color attach="background" args={["#071d27"]} />
      <fog attach="fog" args={["#071d27", 13, 27]} />
      <hemisphereLight args={["#b9fff4", "#1a3326", 1.15]} />
      <directionalLight
        position={[4.6, 8.2, 5.2]}
        intensity={1.85}
        color="#e5fff8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[-5.5, 4.2, -4.4]} intensity={0.42} color="#4fc3dd" />
      <ambientLight intensity={0.35} />
      <mesh position={[0, -0.86, 0]} receiveShadow={false}>
        <boxGeometry args={[15, 0.35, 11]} />
        <meshStandardMaterial color="#102822" roughness={1} />
      </mesh>
      <mesh position={[0, -0.61, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14.5, 10.5, 18, 14]} />
        <meshStandardMaterial color="#183b31" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.585, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.4, 7.1, 64, 1]} />
        <meshBasicMaterial color="#2fbfa0" transparent opacity={0.055} />
      </mesh>
      {REED_PATCHES.map(([x, z, rotate]) => <ReedPatch key={`${x}-${z}`} position={[x, -0.35, z]} rotation={rotate} />)}
      {STONES.map(([x, z, width, height]) => (
        <mesh key={`${x}-${z}`} position={[x, -0.49, z]} scale={[width, height, width * 0.8]} castShadow receiveShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#38534b" roughness={0.94} />
        </mesh>
      ))}
    </>
  );
});

function ReedPatch({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.12, 0, 0.13].map((offset, index) => (
        <mesh key={offset} position={[offset, 0.28 + index * 0.03, 0]} rotation={[0.18 - index * 0.12, 0, offset * 1.8]} castShadow>
          <cylinderGeometry args={[0.018, 0.032, 0.82 + index * 0.12, 5]} />
          <meshStandardMaterial color={index === 1 ? "#4f7b54" : "#6b8f58"} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0.05, 0.75, 0.04]} rotation={[0.45, 0, -0.6]}>
        <coneGeometry args={[0.09, 0.28, 5]} />
        <meshStandardMaterial color="#7fa45f" roughness={1} />
      </mesh>
    </group>
  );
}
