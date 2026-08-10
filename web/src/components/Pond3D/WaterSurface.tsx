import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type Mesh } from "three";

export function WaterSurface({ surfaceY, rain, animate, reducedMotion }: { surfaceY: number; rain: boolean; animate: boolean; reducedMotion: boolean }) {
  const waterRef = useRef<Mesh>(null);
  const volumeRef = useRef<Mesh>(null);
  const currentY = useRef(surfaceY);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => invalidate(), [invalidate, surfaceY]);

  useFrame(({ clock }, delta) => {
    if (!waterRef.current || !volumeRef.current) return;
    currentY.current = reducedMotion ? surfaceY : MathUtils.damp(currentY.current, surfaceY, 4.2, delta);
    const agitation = animate && !reducedMotion ? Math.sin(clock.elapsedTime * 0.75) * 0.012 : 0;
    const waterDepth = Math.max(0.12, currentY.current + 0.53);
    waterRef.current.position.y = currentY.current + agitation;
    volumeRef.current.position.y = -0.5 + waterDepth / 2;
    volumeRef.current.scale.y = waterDepth;
    if (!reducedMotion && Math.abs(currentY.current - surfaceY) > 0.001) invalidate();
  });

  return (
    <group>
      <mesh ref={volumeRef} position={[0, -0.5 + Math.max(0.12, surfaceY + 0.53) / 2, 0]} scale={[1, Math.max(0.12, surfaceY + 0.53), 1]}>
        <boxGeometry args={[8.95, 1, 5.05]} />
        <meshStandardMaterial color={rain ? "#185b74" : "#14506a"} transparent opacity={0.78} roughness={rain ? 0.46 : 0.3} metalness={0.05} />
      </mesh>
      <mesh ref={waterRef} position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.95, 5.05, 1, 1]} />
        <meshStandardMaterial color={rain ? "#55a7bb" : "#3aa4bd"} transparent opacity={rain ? 0.73 : 0.68} roughness={rain ? 0.5 : 0.18} metalness={0.08} />
      </mesh>
    </group>
  );
}
