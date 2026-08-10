import { memo, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";

export const CameraRig = memo(function CameraRig() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(8.7, 6.6, 8.4);
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
});
