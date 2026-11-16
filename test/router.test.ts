import { describe, expect, it } from "vitest";

describe("CART3R OmniRoute starter", () => {
  it("documents the expected router safety defaults", () => {
    expect(Number(process.env.PROVIDER_SWITCH_AT_PERCENT ?? 80)).toBeLessThanOrEqual(99);
    expect(Number(process.env.PROVIDER_SWITCH_AT_PERCENT ?? 80)).toBeGreaterThan(0);
  });
});