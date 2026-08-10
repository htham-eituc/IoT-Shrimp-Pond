import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPondDatabase, MockPondDataSource, MOCK_NOW_MS } from "../../data";
import { Pond3DVisualization } from "./Pond3DVisualization";
import { detectWebGLSupport } from "./pondAccessibility";
import { createPondSceneModel } from "./pondSceneModel";

afterEach(() => vi.useRealTimers());

describe("3D pond scene projection", () => {
  it("maps Firebase-shaped pond state without mutating it", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    pond.sensors.waterLevel = 92;
    pond.sensors.rain = true;
    pond.devices.aerator = true;
    pond.devices.drainagePump = true;
    const original = structuredClone(pond);

    const model = createPondSceneModel(pond);

    expect(model.waterLevel).toBe(92);
    expect(model.waterSurfaceY).toBeCloseTo(0.2792);
    expect(model.rain).toBe(true);
    expect(model.devices.aerator).toBe(true);
    expect(model.devices.drainagePump).toBe(true);
    expect(model.devices).toEqual(pond.devices);
    expect(model.devices).not.toBe(pond.devices);
    expect(pond).toEqual(original);
  });

  it("clamps only the visual water projection, not the source state", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    pond.sensors.waterLevel = 125;

    const model = createPondSceneModel(pond);

    expect(model.waterLevel).toBe(100);
    expect(model.waterSurfaceY).toBe(0.34);
    expect(pond.sensors.waterLevel).toBe(125);
  });

  it("detects WebGL absence and context errors for fallback selection", () => {
    const unavailable = { createElement: () => ({ getContext: () => null }) } as unknown as Pick<Document, "createElement">;
    const throwing = { createElement: () => ({ getContext: () => { throw new Error("context failure"); } }) } as unknown as Pick<Document, "createElement">;
    const available = { createElement: () => ({ getContext: (name: string) => name === "webgl" ? {} : null }) } as unknown as Pick<Document, "createElement">;

    expect(detectWebGLSupport(undefined)).toBe(false);
    expect(detectWebGLSupport(unavailable)).toBe(false);
    expect(detectWebGLSupport(throwing)).toBe(false);
    expect(detectWebGLSupport(available)).toBe(true);
  });

  it("renders the retained SVG fallback when WebGL is unavailable", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    const markup = renderToStaticMarkup(createElement(Pond3DVisualization, {
      pond,
      probes: [],
      onSelectSensor: () => undefined,
      onSelectDevice: () => undefined,
      onShowAlerts: () => undefined,
    }));

    expect(markup).toContain("pond-3d-fallback");
    expect(markup).toContain("pond-scene__svg");
  });

  it("projects all subscribed mock scenario outcomes without scenario input", async () => {
    vi.useFakeTimers();
    let nowMs = MOCK_NOW_MS;
    const source = new MockPondDataSource(undefined, () => nowMs);
    await source.signIn("farmer@example.com", "placeholder");
    const observed = new Array<{ pond: ReturnType<typeof source.getDatabaseSnapshot>["ponds"][string]; model: ReturnType<typeof createPondSceneModel> }>();
    const unsubscribe = source.subscribePond("pond-001", (pond) => {
      if (pond) observed.push({ pond, model: createPondSceneModel(pond) });
    });

    source.setDemoScenario("pond-001", "normal");
    expect(observed.at(-1)?.model).toMatchObject({ status: "normal", rain: false });
    expect(observed.at(-1)?.model.devices).toMatchObject({ aerator: false, drainagePump: false, dilutionPump: false, buzzer: false, warningBeacon: false });

    source.setDemoScenario("pond-001", "hypoxia");
    nowMs += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(observed.at(-1)?.pond.sensors.do).toBeLessThan(4);
    expect(observed.at(-1)?.model).toMatchObject({ status: "critical" });
    expect(observed.at(-1)?.model.devices).toMatchObject({ aerator: true, feeder: false, buzzer: true, warningBeacon: true });

    source.setDemoScenario("pond-001", "rain_overflow");
    expect(observed.at(-1)?.model.rain).toBe(true);
    expect(observed.at(-1)?.model.waterLevel).toBeGreaterThan(90);
    expect(observed.at(-1)?.model.devices).toMatchObject({ drainagePump: true, aerator: true });

    source.setDemoScenario("pond-001", "heat_salinity");
    expect(observed.at(-1)?.pond.sensors.temperature).toBeGreaterThan(33);
    expect(observed.at(-1)?.pond.sensors.salinity).toBeGreaterThan(30);
    expect(observed.at(-1)?.model.devices).toMatchObject({ dilutionPump: true, feeder: false });

    unsubscribe();
    source.dispose();
  });
});
