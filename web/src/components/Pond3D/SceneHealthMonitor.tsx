import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export function SceneHealthMonitor({ onFailure }: { onFailure(): void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", handleContextLoss);
    return () => canvas.removeEventListener("webglcontextlost", handleContextLoss);
  }, [canvas, onFailure]);
  return null;
}
