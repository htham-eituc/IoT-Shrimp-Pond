import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type Group } from "three";

export function WaterBoundEquipment({ targetY, reducedMotion, children }: { targetY: number; reducedMotion: boolean; children: ReactNode }) {
  const groupRef = useRef<Group>(null);
  const currentY = useRef(targetY);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => invalidate(), [invalidate, targetY]);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    currentY.current = reducedMotion ? targetY : MathUtils.damp(currentY.current, targetY, 4.2, delta);
    groupRef.current.position.y = currentY.current;
    if (!reducedMotion && Math.abs(currentY.current - targetY) > 0.001) invalidate();
  });

  return <group ref={groupRef} position={[0, targetY, 0]}>{children}</group>;
}
