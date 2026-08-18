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
import {
  BRANCH_MERGE_RAIL_GAP,
  CARD_COLLISION_CLEARANCE,
  CONTROL_BEARING_INTERVAL,
  DIRECT_CAUSAL_EDGE_GAP,
} from "../../src/features/layout/geometry/spacing";
import { CHAIN_NODE_HEIGHT } from "../../src/features/layout/dimensions";

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

  it("applies rank-interval invariants to representative fixtures", () => {
    const simple = evaluateLayout(
      loadLayoutTopology("simple-chain"),
      hierarchyAdapter(),
    );
    const branch = evaluateLayout(
      loadLayoutTopology("one-to-three-branch"),
      hierarchyAdapter(),
    );
    const merge = evaluateLayout(
      loadLayoutTopology("three-to-one-convergence"),
      hierarchyAdapter(),
    );
    const controls = evaluateLayout(
      loadLayoutTopology("multiple-controls"),
      hierarchyAdapter(),
    );

    expect(simple.bounds.height).toBe(
      3 * CHAIN_NODE_HEIGHT + 2 * DIRECT_CAUSAL_EDGE_GAP,
    );
    expect(branch.bounds.height).toBe(
      2 * CHAIN_NODE_HEIGHT + BRANCH_MERGE_RAIL_GAP,
    );
    expect(merge.bounds.height).toBe(
      2 * CHAIN_NODE_HEIGHT + BRANCH_MERGE_RAIL_GAP,
    );
    expect(controls.bounds.height).toBe(
      2 * CHAIN_NODE_HEIGHT + CONTROL_BEARING_INTERVAL,
    );
    expect(simple.bounds.height).toBeLessThan(
      3 * CHAIN_NODE_HEIGHT + 2 * BRANCH_MERGE_RAIL_GAP,
    );

    const controlBottom = Math.max(
      ...Object.values(controls.controls.coordinates).map(({ y }) => y + 120),
    );
    const targetTop =
      controls.bounds.y + CHAIN_NODE_HEIGHT + CONTROL_BEARING_INTERVAL;
    expect(targetTop - controlBottom).toBeGreaterThanOrEqual(
      CARD_COLLISION_CLEARANCE,
    );
  });
});
