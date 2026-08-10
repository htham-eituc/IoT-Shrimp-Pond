import { memo } from "react";

export const PondEnvironment = memo(function PondEnvironment() {
  return (
    <>
      <color attach="background" args={["#08232d"]} />
      <fog attach="fog" args={["#08232d", 14, 25]} />
      <hemisphereLight args={["#9be8ef", "#16311f", 1.3]} />
      <directionalLight position={[5, 8, 4]} intensity={1.35} color="#d9fbf5" />
      <ambientLight intensity={0.45} />
      <mesh position={[0, -0.82, 0]} receiveShadow={false}>
        <boxGeometry args={[15, 0.35, 11]} />
        <meshStandardMaterial color="#142d29" roughness={1} />
      </mesh>
      <mesh position={[0, -0.63, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14.5, 10.5, 1, 1]} />
        <meshStandardMaterial color="#1b3b32" roughness={1} />
      </mesh>
      {[-5.8, 5.8].flatMap((x) => [-3.8, 3.8].map((z) => (
        <group key={`${x}-${z}`} position={[x, -0.2, z]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.7, 6]} />
            <meshStandardMaterial color="#426253" roughness={1} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <sphereGeometry args={[0.16, 6, 5]} />
            <meshStandardMaterial color="#2e6b45" roughness={1} />
          </mesh>
        </group>
      )))}
    </>
  );
});
