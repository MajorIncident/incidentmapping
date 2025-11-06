import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRID_SIZE, useAppStore } from "../../src/state/useAppStore";

describe("useAppStore actions", () => {
  beforeEach(() => {
    const { newMap } = useAppStore.getState().actions;
    newMap();
  });

  it("supports add → rename → move → delete flow", () => {
    const { actions } = useAppStore.getState();

    actions.addChainNode();
    let state = useAppStore.getState();
    expect(state.nodes).toHaveLength(1);
    const parentId = state.nodes[0]?.id;
    expect(parentId).toBeDefined();
    if (!parentId) {
      throw new Error("Expected a parent id");
    }

    actions.renameNode(parentId, "Primary Event");
    state = useAppStore.getState();
    expect(state.nodes[0]?.data.title).toBe("Primary Event");

    actions.addChainNode({ parentId });
    state = useAppStore.getState();
    expect(state.nodes).toHaveLength(2);
    const child = state.nodes.find((node) => node.id !== parentId);
    expect(child).toBeDefined();
    if (!child) {
      throw new Error("Expected a child node");
    }
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({
      source: parentId,
      target: child.id,
    });

    actions.moveNode(parentId, { x: 24, y: 24 });
    state = useAppStore.getState();
    expect(state.nodes[0]?.position).toEqual({ x: 24, y: 24 });

    actions.deleteNode(parentId);
    state = useAppStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });

  it("records history for add, rename, undo, and redo", () => {
    const { actions } = useAppStore.getState();

    const id = actions.addChild();
    expect(id).toBeTruthy();
    actions.renameNode(id as string, "Primary Event");

    let state = useAppStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.nodes[0]?.data.title).toBe("Primary Event");

    actions.undo();
    state = useAppStore.getState();
    expect(state.nodes[0]?.data.title).toBe("New ChainNode");
    expect(state.canRedo).toBe(true);

    actions.redo();
    state = useAppStore.getState();
    expect(state.nodes[0]?.data.title).toBe("Primary Event");
  });

  it("debounces nudge history entries", () => {
    vi.useFakeTimers();
    try {
      const { actions } = useAppStore.getState();
      const id = actions.addChild();
      expect(id).toBeTruthy();
      const initialHistory = useAppStore.getState().history.past.length;

      actions.nudgeNodeBy(id as string, GRID_SIZE, 0);
      actions.nudgeNodeBy(id as string, GRID_SIZE, 0);

      let state = useAppStore.getState();
      expect(state.history.past.length).toBe(initialHistory + 1);

      vi.advanceTimersByTime(250);
      actions.nudgeNodeBy(id as string, GRID_SIZE, 0);
      state = useAppStore.getState();
      expect(state.history.past.length).toBe(initialHistory + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("connects parent to new child", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild();
    expect(parentId).toBeTruthy();
    const childId = actions.addChild(parentId ?? undefined);
    expect(childId).toBeTruthy();

    const state = useAppStore.getState();
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({
      source: parentId,
      target: childId,
    });
  });

  it("creates siblings that share the same parent", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild();
    const firstChild = actions.addChild(parentId ?? undefined);
    expect(firstChild).toBeTruthy();

    const siblingId = actions.addSibling(firstChild ?? undefined);
    expect(siblingId).toBeTruthy();

    const state = useAppStore.getState();
    const edgesFromParent = state.edges.filter(
      (edge) => edge.source === parentId,
    );
    expect(edgesFromParent).toHaveLength(2);
    expect(edgesFromParent.map((edge) => edge.target)).toEqual(
      expect.arrayContaining([firstChild, siblingId]),
    );
  });
});
