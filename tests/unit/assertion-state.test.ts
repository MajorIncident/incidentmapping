import { describe, expect, it } from "vitest";
import { mapDataSchema } from "../../src/features/maps/schema";
import { countAssertions } from "../../src/components/Presentation/CaseSummary";
import { useAppStore } from "../../src/state/useAppStore";
import { sampleMap } from "../../src/features/maps/fixtures";

describe("assertion state", () => {
  it("accepts optional Factor and Control assertions and rejects assertions on other nodes", () => {
    const base = structuredClone(sampleMap);
    expect(mapDataSchema.safeParse(base).success).toBe(true);
    base.nodes[0].assertionState = "Confirmed";
    expect(mapDataSchema.safeParse(base).success).toBe(false);
    const factor = base.nodes.find((node) => node.nodeType === "Factor");
    if (factor) {
      delete base.nodes[0].assertionState;
      factor.assertionState = "Inferred";
      expect(mapDataSchema.safeParse(base).success).toBe(true);
    }
  });

  it("tracks Factor assertion edits through undo and redo", () => {
    useAppStore.getState().actions.loadMap(sampleMap);
    const first = useAppStore.getState().nodes[0];
    useAppStore.getState().actions.setNodeType(first.id, "Factor");
    const factor = useAppStore
      .getState()
      .nodes.find((node) => node.id === first.id)!;
    useAppStore
      .getState()
      .actions.setFactorAssertionState(factor!.id, "Working");
    expect(
      useAppStore
        .getState()
        .actions.toMap()
        .nodes.find((node) => node.id === factor!.id)?.assertionState,
    ).toBe("Working");
    useAppStore.getState().actions.undo();
    expect(
      useAppStore.getState().nodes.find((node) => node.id === factor!.id)?.data
        .assertionState,
    ).toBeUndefined();
    useAppStore.getState().actions.redo();
    expect(
      useAppStore.getState().nodes.find((node) => node.id === factor!.id)?.data
        .assertionState,
    ).toBe("Working");
  });

  it("counts Factor and Control assertions for Case Summary", () => {
    expect(
      countAssertions(
        [
          { nodeType: "Factor", assertionState: "Confirmed" },
          { nodeType: "Event", assertionState: undefined },
        ],
        [{ assertionState: "Inferred" }, { assertionState: undefined }],
      ),
    ).toEqual({ Confirmed: 1, Working: 0, Inferred: 1, "Not set": 1 });
  });
});
