import { describe, expect, it } from "vitest";
import { mapDataSchema } from "../../src/features/maps/schema";
import {
  layoutFixtureNames,
  loadLayoutFixture,
  loadLayoutTopology,
} from "../helpers/layout/fixtures";
import {
  compareLayoutAdapters,
  evaluateLayout,
  hierarchyAdapter,
} from "../helpers/layout/baseline";

describe("layout fixture suite", () => {
  it.each(layoutFixtureNames)(
    "loads %s as canonical persisted data",
    (name) => {
      const fixture = loadLayoutFixture(name);
      expect(mapDataSchema.parse(fixture)).toEqual(fixture);
    },
  );

  it.each(layoutFixtureNames)(
    "records a deterministic baseline for %s",
    (name) => {
      const topology = loadLayoutTopology(name);
      const baseline = evaluateLayout(topology, hierarchyAdapter());
      expect(baseline.nodeCount).toBe(topology.nodes.length);
      expect(baseline.edgeCount).toBe(topology.edges.length);
      expect(baseline.bounds.width).toBeGreaterThan(0);
      expect(baseline.bounds.height).toBeGreaterThan(0);
      expect(baseline.deterministic).toBe(true);
    },
  );

  it("compares hierarchy and migration adapters on the same topology", () => {
    const topology = loadLayoutTopology("synthetic-diamond");
    const comparison = compareLayoutAdapters(topology, hierarchyAdapter());
    expect(comparison.candidate).toEqual(comparison.existing);
  });

  it("captures Control and Action placement", () => {
    const controls = evaluateLayout(
      loadLayoutTopology("multiple-controls"),
      hierarchyAdapter(),
    );
    const actions = evaluateLayout(
      loadLayoutTopology("multiple-actions"),
      hierarchyAdapter(),
    );
    expect(controls.controls).toMatchObject({ count: 2, placed: 2 });
    expect(actions.actions).toMatchObject({ count: 3, placed: 3 });
  });
});
