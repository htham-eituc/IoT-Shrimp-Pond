import { useCallback, useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { PondAnchorKey, PondWorldPoint } from "./pondAnchors";
import { createPondProjectionCamera } from "./pondCamera";

type AnchorRefs = Map<PondAnchorKey, HTMLElement>;

export function usePondAnchorProjection(anchors: Partial<Record<PondAnchorKey, PondWorldPoint>>) {
  const layerRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<AnchorRefs>(new Map());

  const registerAnchor = useCallback((key: PondAnchorKey) => (element: HTMLElement | null) => {
    if (element) {
      elementRefs.current.set(key, element);
    } else {
      elementRefs.current.delete(key);
    }
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const figure = layer?.closest<HTMLElement>(".pond-3d");
    const canvasBox = figure?.querySelector<HTMLElement>(".pond-3d__canvas");
    if (!layer || !canvasBox) return undefined;

    let frame = 0;
    const vector = new Vector3();
    const camera = createPondProjectionCamera(1);

    const update = () => {
      const layerRect = layer.getBoundingClientRect();
      const canvasRect = canvasBox.getBoundingClientRect();
      const width = Math.max(canvasRect.width, 1);
      const height = Math.max(canvasRect.height, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      for (const [key, element] of elementRefs.current) {
        const point = anchors[key];
        if (!point) {
          element.hidden = true;
          delete element.dataset.anchorReady;
          continue;
        }

        vector.set(...point).project(camera);
        const left = ((vector.x + 1) / 2) * width + canvasRect.left - layerRect.left;
        const top = ((-vector.y + 1) / 2) * height + canvasRect.top - layerRect.top;
        element.hidden = vector.z < -1 || vector.z > 1;
        element.style.left = `${left.toFixed(2)}px`;
        element.style.top = `${top.toFixed(2)}px`;
        element.dataset.anchorEdge = left < 96 ? "left" : left > width - 96 ? "right" : "center";
        element.dataset.anchorReady = "true";
      }

      frame = window.requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(update);
    observer.observe(layer);
    observer.observe(canvasBox);
    window.addEventListener("resize", update);
    frame = window.requestAnimationFrame(update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.cancelAnimationFrame(frame);
    };
  }, [anchors]);

  return { layerRef, registerAnchor };
}
