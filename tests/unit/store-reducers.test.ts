import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../src/state/useAppStore";

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
});
