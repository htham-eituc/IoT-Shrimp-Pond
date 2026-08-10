import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { KeyedRecord, PondAlert, PondSensors } from "../domain";
import { createMockPondDatabase, MockPondDataSource, type DemoScenario } from "../data";
import { HISTORY_METRICS } from "../history/telemetryHistory";
import i18n, { setLocale } from "../i18n";
import {
  createMetricViewModels,
  createPrimaryMetricViewModels,
  getPrimaryMetricKeyForSensor,
  isConductivitySalinityMetric,
} from "../presentation/metrics";
import { ConductivitySalinityCard } from "./ConductivitySalinityCard";
import { TEST_FARMER_ACCESS } from "../test/fixtures";

afterEach(async () => setLocale("vi", null));

describe("combined conductivity and salinity presentation", () => {
  it.each([
    ["vi", "Độ dẫn điện / Độ mặn", "Độ mặn", "Độ dẫn điện (EC)", "20,1", "18,4"],
    ["en", "Conductivity / Salinity", "Salinity", "Electrical conductivity (EC)", "20.1", "18.4"],
  ] as const)("renders both protocol values with accessible labels in %s", async (locale, title, salinityLabel, ecLabel, salinityValue, ecValue) => {
    await setLocale(locale, null);
    const sensors = createSensors({ ec: 18.4, salinity: 20.1 });
    const composite = createComposite(sensors);
    const markup = renderToStaticMarkup(<ConductivitySalinityCard metric={composite} />);

    expect(markup).toContain(title);
    expect(markup).toContain(salinityLabel);
    expect(markup).toContain(ecLabel);
    expect(markup).toContain(salinityValue);
    expect(markup).toContain("ppt");
    expect(markup).toContain(ecValue);
    expect(markup).toContain("<dl");
    expect(markup).toContain("<dt");
    expect(markup).toContain("<dd");
  });

  it("updates each projected value independently without mutating PondSensors", async () => {
    await setLocale("en", null);
    const initial = createSensors({ ec: 18.4, salinity: 20.1 });
    const original = structuredClone(initial);
    const ecChanged = { ...initial, ec: 19.6 };
    const salinityChanged = { ...initial, salinity: 22.3 };

    const first = createComposite(initial);
    const second = createComposite(ecChanged);
    const third = createComposite(salinityChanged);

    expect(second.conductivity.value).not.toBe(first.conductivity.value);
    expect(second.salinity.value).toBe(first.salinity.value);
    expect(third.salinity.value).not.toBe(first.salinity.value);
    expect(third.conductivity.value).toBe(first.conductivity.value);
    expect(initial).toEqual(original);
    expect(initial).toHaveProperty("ec", 18.4);
    expect(initial).toHaveProperty("salinity", 20.1);
  });

  it("uses the more severe applicable source status and reduces the primary matrix by one card", async () => {
    await setLocale("en", null);
    const sensors = createSensors({ ec: 18.4, salinity: 20.1 });
    const alert: KeyedRecord<PondAlert> = {
      id: "ec-alert",
      value: {
        type: "heat_salinity",
        severity: "critical",
        status: "active",
        message: "Conductivity requires attention",
        measurements: { ec: sensors.ec },
        createdAtMs: 1,
        resolvedAtMs: null,
      },
    };
    const metrics = createMetrics(sensors, [alert]);
    const primary = createPrimaryMetricViewModels(metrics, i18n.t);
    const composite = primary.find(isConductivitySalinityMetric);

    expect(metrics).toHaveLength(7);
    expect(primary).toHaveLength(6);
    expect(composite?.tone).toBe("critical");
    expect(primary.some((metric) => metric.key === "ec" || metric.key === "salinity")).toBe(false);
  });

  it("maps EC and salinity focus to the same primary card while history keeps separate series", () => {
    expect(getPrimaryMetricKeyForSensor("ec")).toBe("conductivitySalinity");
    expect(getPrimaryMetricKeyForSensor("salinity")).toBe("conductivitySalinity");
    expect(getPrimaryMetricKeyForSensor("do")).toBe("do");
    expect(HISTORY_METRICS.filter((metric) => metric.key === "ec" || metric.key === "salinity").map((metric) => metric.key))
      .toEqual(["ec", "salinity"]);
  });

  it.each([
    ["normal", "normal"],
    ["hypoxia", "normal"],
    ["rain_overflow", "normal"],
    ["heat_salinity", "warning"],
  ] as const)("projects the %s scenario into the composite card without scenario-specific card logic", async (scenario, expectedTone) => {
    await setLocale("en", null);
    const source = new MockPondDataSource(TEST_FARMER_ACCESS);
    let sensors: PondSensors | null = null;
    let alerts: Array<KeyedRecord<PondAlert>> = [];
    const unsubscribePond = source.subscribePond("pond-001", (pond) => {
      sensors = pond?.sensors ?? null;
    });
    const unsubscribeAlerts = source.subscribeAlerts("pond-001", (nextAlerts) => {
      alerts = nextAlerts;
    });

    source.setDemoScenario("pond-001", scenario as DemoScenario);
    expect(sensors).not.toBeNull();
    const composite = createPrimaryMetricViewModels(createMetrics(sensors!, alerts), i18n.t).find(isConductivitySalinityMetric);

    expect(composite).toBeDefined();
    expect(composite?.tone).toBe(expectedTone);
    expect(composite?.conductivity.value).not.toBe("");
    expect(composite?.salinity.value).not.toBe("");
    if (scenario === "heat_salinity") {
      expect(sensors!.salinity).toBeGreaterThan(30);
      expect(alerts.some((alert) => alert.value.type === "heat_salinity" && alert.value.status === "active")).toBe(true);
    }

    unsubscribePond();
    unsubscribeAlerts();
    source.dispose();
  });
});

function createComposite(sensors: PondSensors) {
  const composite = createPrimaryMetricViewModels(createMetrics(sensors), i18n.t).find(isConductivitySalinityMetric);
  if (!composite) throw new Error("Expected conductivity/salinity metric");
  return composite;
}

function createMetrics(sensors: PondSensors, alerts: Array<KeyedRecord<PondAlert>> = []) {
  const settings = createMockPondDatabase().settings["pond-001"];
  return createMetricViewModels(sensors, settings, alerts, [], i18n.t, i18n.resolvedLanguage ?? i18n.language);
}

function createSensors(changes: Partial<PondSensors>): PondSensors {
  return {
    ...createMockPondDatabase().ponds["pond-001"].sensors,
    ...changes,
  };
}
