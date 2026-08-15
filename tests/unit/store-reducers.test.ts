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
      type: "step",
      sourceHandle: "bottom",
      targetHandle: "top",
    });
  });

  it("centers a single child directly below its parent on the grid", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const childId = actions.addChild(parentId) as string;
    const state = useAppStore.getState();
    const parent = state.nodes.find((node) => node.id === parentId)!;
    const child = state.nodes.find((node) => node.id === childId)!;

    expect(child.position.x).toBe(parent.position.x);
    expect(child.position.y).toBeGreaterThan(parent.position.y);
    expect(child.position.x % GRID_SIZE).toBe(0);
    expect(child.position.y % GRID_SIZE).toBe(0);
  });

  it("spaces siblings evenly around their parent at one level", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const firstId = actions.addChild(parentId) as string;
    const secondId = actions.addSibling(firstId) as string;
    const thirdId = actions.addSibling(secondId) as string;
    const state = useAppStore.getState();
    const parent = state.nodes.find((node) => node.id === parentId)!;
    const siblings = [firstId, secondId, thirdId].map(
      (id) => state.nodes.find((node) => node.id === id)!,
    );

    expect(new Set(siblings.map((node) => node.position.y)).size).toBe(1);
    expect(siblings[1].position.x - siblings[0].position.x).toBe(
      siblings[2].position.x - siblings[1].position.x,
    );
    expect(siblings[1].position.x).toBe(parent.position.x);
  });

  it("moves descendants with their sibling subtree without changing offsets", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const childId = actions.addChild(parentId) as string;
    const descendantId = actions.addChild(childId) as string;
    let state = useAppStore.getState();
    const childBefore = state.nodes.find((node) => node.id === childId)!;
    const descendantBefore = state.nodes.find(
      (node) => node.id === descendantId,
    )!;
    const offsetBefore = {
      x: descendantBefore.position.x - childBefore.position.x,
      y: descendantBefore.position.y - childBefore.position.y,
    };

    actions.addSibling(childId);
    state = useAppStore.getState();
    const childAfter = state.nodes.find((node) => node.id === childId)!;
    const descendantAfter = state.nodes.find(
      (node) => node.id === descendantId,
    )!;
    expect({
      x: descendantAfter.position.x - childAfter.position.x,
      y: descendantAfter.position.y - childAfter.position.y,
    }).toEqual(offsetBefore);
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

  it("updates the map title and records history", () => {
    const { actions } = useAppStore.getState();
    const initialHistory = useAppStore.getState().history.past.length;

    actions.setMapTitle("Postmortem Draft");

    let state = useAppStore.getState();
    expect(state.metadata?.title).toBe("Postmortem Draft");
    expect(state.history.past.length).toBe(initialHistory + 1);
    expect(state.canUndo).toBe(true);

    actions.undo();
    state = useAppStore.getState();
    expect(state.metadata?.title).toBe("Untitled Map");
  });

  it("organizes atomically and restores positions through undo and redo", () => {
    const { actions } = useAppStore.getState();
    const parent = actions.addChild() as string;
    const child = actions.addChild(parent) as string;
    actions.moveNode(child, { x: 800, y: 800 });
    const before = useAppStore.getState().nodes.map((node) => node.position);
    const selection = useAppStore.getState().selectionId;

    actions.organizeNodes();
    const organized = useAppStore.getState().nodes.map((node) => node.position);
    expect(organized).not.toEqual(before);
    expect(useAppStore.getState().selectionId).toBe(selection);
    expect(useAppStore.getState().viewportRequest?.nodeIds).toEqual([
      parent,
      child,
    ]);

    actions.undo();
    expect(useAppStore.getState().nodes.map((node) => node.position)).toEqual(
      before,
    );
    actions.redo();
    expect(useAppStore.getState().nodes.map((node) => node.position)).toEqual(
      organized,
    );
  });
});
