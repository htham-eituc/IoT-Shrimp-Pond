import { describe, expect, it } from "vitest";
import { resolveAuthenticatedApplicationView } from "./authView";

describe("authenticated application bootstrap view", () => {
  it("shows loading while Firebase Auth and profile authorization initialize", () => {
    expect(resolveAuthenticatedApplicationView("initializing", false)).toBe("loading");
    expect(resolveAuthenticatedApplicationView("initializing", true)).toBe("loading");
  });

  it("shows login only after Firebase reports a signed-out user", () => {
    expect(resolveAuthenticatedApplicationView("unauthenticated", false)).toBe("login");
  });

  it("shows the dashboard only for an authorized ready session", () => {
    expect(resolveAuthenticatedApplicationView("authenticated-profile-ready", true)).toBe("dashboard");
    expect(resolveAuthenticatedApplicationView("authenticated-profile-ready", false)).toBe("login");
  });
});
