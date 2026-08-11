import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPondDatabase, MockPondDataSource, MOCK_NOW_MS } from "../../data";
import { Pond3DVisualization } from "./Pond3DVisualization";
import { detectWebGLSupport } from "./pondAccessibility";
import { createPondSceneModel } from "./pondSceneModel";
import { createPondAnchorWorldPoints, projectPondAnchor, type PondAnchorKey } from "./pondAnchors";
import { TEST_FARMER_ACCESS } from "../../test/fixtures";

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

  it("creates world anchors for all interactive 3D sensors and device targets", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    pond.sensors.waterLevel = 74;
    const model = createPondSceneModel(pond);
    const anchors = createPondAnchorWorldPoints(model);
    const requiredAnchors: PondAnchorKey[] = [
      "do",
      "ph",
      "temperature",
      "waterLevel",
      "aerator",
      "drainagePump",
      "dilutionPump",
      "feeder",
      "warningBeacon",
    ];

    for (const key of requiredAnchors) {
      expect(anchors[key].every(Number.isFinite)).toBe(true);
    }
    expect(anchors.do[1]).toBeCloseTo(model.waterSurfaceY + 0.85);
    expect(anchors.ph[1]).toBeCloseTo(model.waterSurfaceY + 0.85);
    expect(anchors.temperature[1]).toBeCloseTo(model.waterSurfaceY + 0.85);
    expect(anchors.waterLevel[1]).toBeCloseTo(model.waterSurfaceY + 0.05);
  });

  it("projects anchors from shared camera settings for different viewport shapes", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    const anchors = createPondAnchorWorldPoints(createPondSceneModel(pond));
    const wide = projectPondAnchor(anchors.feeder, { width: 960, height: 540 });
    const square = projectPondAnchor(anchors.feeder, { width: 540, height: 540 });

    expect(wide.visible).toBe(true);
    expect(square.visible).toBe(true);
    expect(wide.left).not.toBeCloseTo(square.left);
    expect(wide.top).toBeGreaterThanOrEqual(0);
    expect(wide.top).toBeLessThanOrEqual(540);
  });

  it("keeps every interactive anchor inside common desktop and tablet projections", () => {
    const pond = createMockPondDatabase().ponds["pond-001"];
    pond.sensors.waterLevel = 88;
    const anchors = createPondAnchorWorldPoints(createPondSceneModel(pond));
    const viewports = [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 540 },
    ];

    for (const viewport of viewports) {
      for (const [key, point] of Object.entries(anchors)) {
        const projection = projectPondAnchor(point, viewport);

        expect(`${key} ${viewport.width}x${viewport.height}`).toBeTruthy();
        expect(projection.visible).toBe(true);
        expect(projection.left).toBeGreaterThanOrEqual(0);
        expect(projection.left).toBeLessThanOrEqual(viewport.width);
        expect(projection.top).toBeGreaterThanOrEqual(0);
        expect(projection.top).toBeLessThanOrEqual(viewport.height);
      }
    }
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
    const source = new MockPondDataSource(TEST_FARMER_ACCESS, undefined, () => nowMs);
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
