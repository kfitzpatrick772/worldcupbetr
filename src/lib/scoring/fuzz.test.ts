import { describe, expect, it } from "vitest";
import { REGRESSION_SEEDS, runFuzz, runFuzzCase } from "./fuzz";

// The randomized property test, run in CI. If the engine and the independent
// oracle ever disagree, this fails and prints the exact reproducing case.
describe("scoring fuzz (engine vs independent oracle)", () => {
  it("agrees across 5000 random scenarios", () => {
    const report = runFuzz(5000, 1);
    if (!report.ok) {
      // surface the precise failing case so it's actionable
      throw new Error(
        `Fuzz found ${report.failed} failing scenario(s). First:\n` +
          JSON.stringify(report.firstFailure, null, 2) +
          `\nfailing seeds: ${report.failingSeeds.join(", ")}`,
      );
    }
    expect(report.ok).toBe(true);
    expect(report.iterations).toBe(5000 + REGRESSION_SEEDS.length);
  });

  it("agrees across a second, disjoint seed range", () => {
    const report = runFuzz(5000, 999_983);
    expect(report.ok, JSON.stringify(report.firstFailure, null, 2)).toBe(true);
  });

  it("re-verifies every regression seed", () => {
    for (const seed of REGRESSION_SEEDS) {
      const fails = runFuzzCase(seed);
      expect(fails, `regression seed ${seed} must stay fixed:\n${fails[0]?.repro}`).toEqual([]);
    }
  });
});
