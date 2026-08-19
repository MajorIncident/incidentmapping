import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../src/state/useAppStore";
import { emptyMap } from "../../src/features/maps/fixtures";
import { getNodeSize } from "../../src/features/layout/policy";

describe("top-level Impact creation", () => {
  beforeEach(() => useAppStore.getState().actions.loadMap(emptyMap));

  it("creates second and third top-level outcomes without causal edges or overlap", () => {
    const actions = useAppStore.getState().actions;
    const ids = [
      actions.createImpact(),
      actions.createImpact(),
      actions.createImpact(),
    ];
    expect(ids.every(Boolean)).toBe(true);
    const state = useAppStore.getState();
    expect(state.edges).toEqual([]);
    expect(state.nodes.map((node) => node.data.referenceId)).toEqual([
      "N-001",
      "N-002",
      "N-003",
    ]);
    expect(state.selectionId).toBe(ids[2]);
    expect(state.editingId).toBe(ids[2]);
    for (let left = 0; left < state.nodes.length; left += 1) {
      for (let right = left + 1; right < state.nodes.length; right += 1) {
        const a = state.nodes[left];
        const b = state.nodes[right];
        const as = getNodeSize(a, state.canvasDetail);
        const bs = getNodeSize(b, state.canvasDetail);
        expect(
          a.position.x + as.width <= b.position.x ||
            b.position.x + bs.width <= a.position.x ||
            a.position.y + as.height <= b.position.y ||
            b.position.y + bs.height <= a.position.y,
        ).toBe(true);
      }
    }
  });

  it("round-trips every Impact through V5 persistence", () => {
    const actions = useAppStore.getState().actions;
    actions.createImpact();
    actions.createImpact();
    const map = actions.toMap();
    actions.loadMap(map);
    expect(
      useAppStore
        .getState()
        .nodes.filter((node) => node.data.nodeType === "Impact"),
    ).toHaveLength(2);
    expect(actions.toMap().schemaVersion).toBe(5);
  });
});
