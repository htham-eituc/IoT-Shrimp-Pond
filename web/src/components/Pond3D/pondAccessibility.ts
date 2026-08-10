import type { PondState } from "../../domain";

export function detectWebGLSupport(documentValue: Pick<Document, "createElement"> | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (!documentValue) return false;
  try {
    const canvas = documentValue.createElement("canvas") as HTMLCanvasElement;
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function createPond3DDescription(
  pond: PondState,
  t: (key: string, options?: Record<string, unknown>) => string,
  percentage: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  const activeDevices = (Object.entries(pond.devices) as Array<[keyof PondState["devices"], boolean]>)
    .filter(([, active]) => active)
    .map(([device]) => t(`${device}.label`, { ns: "devices" }));
  return t("pond3d.description", {
    ns: "dashboard",
    status: t(`status.${pond.status}`, { ns: "common" }),
    waterLevel: percentage(pond.sensors.waterLevel, { maximumFractionDigits: 0 }),
    rain: t(pond.sensors.rain ? "boolean.true" : "boolean.false", { ns: "common" }),
    devices: activeDevices.length > 0 ? activeDevices.join(", ") : t("overview.allInactive", { ns: "dashboard" }),
  });
}
