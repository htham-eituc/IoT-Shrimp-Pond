import { useEffect, useState } from "react";

export type Pond3DQuality = "high" | "balanced" | "low";

export interface Pond3DQualitySignals {
  reducedMotion: boolean;
  viewportWidth: number;
  deviceMemoryGb?: number;
}

export function selectPond3DQuality({ reducedMotion, viewportWidth, deviceMemoryGb }: Pond3DQualitySignals): Pond3DQuality {
  if (reducedMotion || viewportWidth < 900 || (deviceMemoryGb !== undefined && deviceMemoryGb <= 4)) return "low";
  if (viewportWidth >= 1536 && (deviceMemoryGb === undefined || deviceMemoryGb >= 8)) return "high";
  return "balanced";
}

export function usePond3DQuality(reducedMotion: boolean): Pond3DQuality {
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth);

  useEffect(() => {
    let animationFrame = 0;
    const updateWidth = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => setViewportWidth(window.innerWidth));
    };
    window.addEventListener("resize", updateWidth, { passive: true });
    return () => {
      window.removeEventListener("resize", updateWidth);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return selectPond3DQuality({
    reducedMotion,
    viewportWidth,
    deviceMemoryGb: readDeviceMemory(),
  });
}

function readViewportWidth(): number {
  return typeof window === "undefined" ? 1366 : window.innerWidth;
}

function readDeviceMemory(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
}
