import { PerspectiveCamera, type Camera } from "three";

export const POND_CAMERA_POSITION = [7.9, 6.25, 7.65] as const;
export const POND_CAMERA_TARGET = [0, -0.08, 0] as const;
export const POND_CAMERA_FOV = 39;
export const POND_CAMERA_NEAR = 0.1;
export const POND_CAMERA_FAR = 45;

export function applyPondCamera(camera: Camera): void {
  camera.position.set(...POND_CAMERA_POSITION);
  camera.lookAt(...POND_CAMERA_TARGET);
  camera.updateMatrixWorld();

  if (camera instanceof PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }
}

export function createPondProjectionCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(POND_CAMERA_FOV, aspect, POND_CAMERA_NEAR, POND_CAMERA_FAR);
  applyPondCamera(camera);
  return camera;
}
