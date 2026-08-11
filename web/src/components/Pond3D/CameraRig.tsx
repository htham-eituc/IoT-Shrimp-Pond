import { memo, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { applyPondCamera } from "./pondCamera";

export const CameraRig = memo(function CameraRig() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    applyPondCamera(camera);
  }, [camera]);
  return null;
});
