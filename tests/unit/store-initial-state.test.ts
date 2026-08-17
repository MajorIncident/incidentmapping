import { describe, expect, it } from "vitest";
import { useAppStore } from "../../src/state/useAppStore";

const expectCleanRoot = (state: ReturnType<typeof useAppStore.getState>) => {
  expect(state.nodes).toHaveLength(1);
  expect(state.edges).toEqual([]);
  expect(state.nodes[0].data).toMatchObject({
    title: "Undesirable outcome",
    referenceId: "N-001",
    nodeType: "Impact",
    contextItems: [],
  });
  expect(Object.keys(state.nodes[0].data)).not.toContain(
    "positiveConsequenceBulletPoints",
  );
  expect(Object.keys(state.nodes[0].data)).not.toContain(
    "negativeConsequenceBulletPoints",
  );
  expect(state.metadata).toMatchObject({
    nodeReferenceHighWaterMark: 1,
    evidenceReferenceHighWaterMark: 0,
  });
  expect(state.barriers).toEqual([]);
  expect(state.selectionId).toBe(state.nodes[0].id);
  expect(state.editingId).toBe(state.nodes[0].id);
  expect(state.viewportRequest?.nodeIds).toEqual([state.nodes[0].id]);
  expect(state.editorFocusRequest).toMatchObject({
    entityId: state.nodes[0].id,
    field: "title",
  });
  expect(state.history).toEqual({ past: [], future: [] });
  expect(state.canUndo).toBe(false);
  expect(state.canRedo).toBe(false);
};

describe("useAppStore initialization", () => {
  it("uses fresh clean roots for startup and new maps", () => {
    const initial = useAppStore.getState();
    expectCleanRoot(initial);
    const initialRootId = initial.nodes[0].id;
    const initialViewportRequestId = initial.viewportRequest?.id;
    const initialEditorRequestId = initial.editorFocusRequest?.id;

    initial.actions.newMap();
    const reset = useAppStore.getState();
    expectCleanRoot(reset);
    expect(reset.nodes[0].id).not.toBe(initialRootId);
    expect(reset.viewportRequest?.id).not.toBe(initialViewportRequestId);
    expect(reset.editorFocusRequest?.id).not.toBe(initialEditorRequestId);
  });
});
