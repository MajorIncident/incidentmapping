import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNewMapState,
  GRID_SIZE,
  useAppStore,
} from "../../src/state/useAppStore";
import {
  getNodeSize,
  snapPosition,
  VERTICAL_GAP,
} from "../../src/features/layout/hierarchy";
import { emptyMap, sampleMap } from "../../src/features/maps/fixtures";

describe("useAppStore actions", () => {
  beforeEach(() => {
    useAppStore.getState().actions.loadMap(emptyMap);
    if (!useAppStore.getState().showDetails) {
      useAppStore.getState().actions.setShowDetails(true);
    }
  });

  it("uses a fresh, clean root state both initially and after newMap", () => {
    const initial = createNewMapState();
    const initialRoot = initial.nodes[0];

    for (const state of [initial]) {
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toEqual([]);
      expect(state.barriers).toEqual([]);
      expect(state.selectionId).toBe(state.nodes[0].id);
      expect(state.editingId).toBe(state.nodes[0].id);
      expect(state.history).toEqual({ past: [], future: [] });
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    }

    useAppStore.getState().actions.newMap();
    const reset = useAppStore.getState();
    expect(reset.nodes).toHaveLength(1);
    expect(reset.edges).toEqual([]);
    expect(reset.barriers).toEqual([]);
    expect(reset.selectionId).toBe(reset.nodes[0].id);
    expect(reset.editingId).toBe(reset.nodes[0].id);
    expect(reset.history).toEqual({ past: [], future: [] });
    expect(reset.canUndo).toBe(false);
    expect(reset.canRedo).toBe(false);
    expect(reset.nodes[0].id).not.toBe(initialRoot.id);
    expect(reset.viewportRequest?.id).not.toBe(initial.viewportRequest?.id);
    expect(reset.editorFocusRequest?.id).not.toBe(
      initial.editorFocusRequest?.id,
    );
  });

  it("creates a fresh selected root in edit mode without history", () => {
    const { actions } = useAppStore.getState();
    actions.addChild();
    actions.renameNode(useAppStore.getState().selectionId!, "Old incident");

    actions.newMap();
    const first = useAppStore.getState();
    const root = first.nodes[0];
    expect(first.nodes).toHaveLength(1);
    expect(root.data).toMatchObject({
      title: "Undesirable outcome",
      nodeType: "Impact",
      referenceId: "N-001",
      description: "",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
    });
    expect(root.position).toEqual(snapPosition({ x: 0, y: 0 }));
    expect(first.edges).toEqual([]);
    expect(first.barriers).toEqual([]);
    expect(first.selectionId).toBe(root.id);
    expect(first.editingId).toBe(root.id);
    expect(first.viewportRequest?.nodeIds).toEqual([root.id]);
    expect(first.editorFocusRequest).toMatchObject({
      entityId: root.id,
      field: "title",
    });
    expect(first.history).toEqual({ past: [], future: [] });
    expect(first.canUndo).toBe(false);
    expect(first.canRedo).toBe(false);

    actions.newMap();
    expect(useAppStore.getState().nodes[0].id).not.toBe(root.id);
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
    expect(state.nodes[0]?.data.title).toBe("New Event");
    expect(state.canRedo).toBe(true);

    actions.redo();
    state = useAppStore.getState();
    expect(state.nodes[0]?.data.title).toBe("Primary Event");
  });

  it("allocates stable node references without reusing deleted references", () => {
    const { actions } = useAppStore.getState();
    const first = actions.addChild() as string;
    const second = actions.addChild(first) as string;
    const third = actions.addChild(second) as string;
    expect(
      useAppStore.getState().nodes.map((node) => node.data.referenceId),
    ).toEqual(["N-001", "N-002", "N-003"]);

    actions.deleteNode(third);
    const replacement = actions.addChild(second) as string;
    expect(
      useAppStore.getState().nodes.find((node) => node.id === replacement)?.data
        .referenceId,
    ).toBe("N-004");
    expect(actions.toMap().metadata?.nodeReferenceHighWaterMark).toBe(4);
  });

  it("keeps evidence identifiers stable and restores deep-cloned evidence", () => {
    const { actions } = useAppStore.getState();
    const nodeId = actions.addChild() as string;
    const first = actions.addEvidence(nodeId, "Witness statement") as string;
    const second = actions.addEvidence(nodeId, "Camera footage") as string;
    expect([first, second]).toEqual(["EV-001", "EV-002"]);

    actions.removeEvidence(nodeId, first);
    expect(actions.addEvidence(nodeId, "Operator log")).toBe("EV-003");
    actions.updateEvidence(nodeId, second, "Reviewed footage");
    const changed = useAppStore.getState().nodes[0].data.evidenceItems!;
    actions.undo();
    const restored = useAppStore.getState().nodes[0].data.evidenceItems!;
    expect(restored.find((item) => item.id === second)?.text).toBe(
      "Camera footage",
    );
    expect(restored).not.toBe(changed);
    expect(restored[0]).not.toBe(changed[0]);
    expect(actions.addEvidence(nodeId, "   ")).toBeNull();
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

  it("adds, serializes, deletes, and restores an action atomically", () => {
    const { actions } = useAppStore.getState();
    const sourceId = actions.addChild() as string;
    actions.moveNode(sourceId, { x: 80, y: 40 });
    const before = useAppStore.getState();
    const sourcePosition = before.nodes[0].position;
    const historyLength = before.history.past.length;

    const actionId = actions.addAction(sourceId) as string;
    let state = useAppStore.getState();
    const action = state.nodes.find((node) => node.id === actionId)!;
    expect(state.nodes.find((node) => node.id === sourceId)?.position).toEqual(
      sourcePosition,
    );
    expect(action.data).toMatchObject({
      nodeType: "Action",
      actionStatus: "Proposed",
    });
    expect(action.position.x).toBeGreaterThan(sourcePosition.x);
    expect(action.position.x % GRID_SIZE).toBe(0);
    expect(
      state.edges.filter((edge) => edge.data?.kind === "ActionEdge"),
    ).toEqual([
      expect.objectContaining({
        source: sourceId,
        target: actionId,
        sourceHandle: "right",
        targetHandle: "left",
      }),
    ]);
    expect(state.history.past).toHaveLength(historyLength + 1);
    expect(actions.toMap().edges[0].kind).toBe("ActionEdge");

    actions.undo();
    expect(
      useAppStore.getState().nodes.some((node) => node.id === actionId),
    ).toBe(false);
    actions.redo();
    expect(
      useAppStore.getState().nodes.some((node) => node.id === actionId),
    ).toBe(true);

    actions.deleteNode(actionId);
    state = useAppStore.getState();
    expect(state.nodes.some((node) => node.id === sourceId)).toBe(true);
    expect(state.edges).toHaveLength(0);
  });

  it("deletes attached actions with their causal source", () => {
    const { actions } = useAppStore.getState();
    const sourceId = actions.addChild() as string;
    const childId = actions.addChild(sourceId) as string;
    const actionId = actions.addAction(sourceId) as string;
    actions.deleteNode(sourceId);
    expect(useAppStore.getState().nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sourceId }),
        expect.objectContaining({ id: childId }),
        expect.objectContaining({ id: actionId }),
      ]),
    );
    expect(useAppStore.getState().edges).toEqual([]);
  });

  it("creates a failed, selected barrier and requests description focus", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const childId = actions.addChild(parentId) as string;

    const barrierId = actions.addBarrier(parentId, childId);
    const state = useAppStore.getState();

    expect(barrierId).toBeTruthy();
    expect(state.barriers).toContainEqual(
      expect.objectContaining({
        id: barrierId,
        status: "Failed",
      }),
    );
    expect(state.selectionId).toBe(barrierId);
    expect(state.editorFocusRequest).toMatchObject({
      entityId: barrierId,
      field: "barrier-description",
    });
  });

  it("creates barriers only for an explicit existing branch and prevents duplicates per edge", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const firstChildId = actions.addChild(parentId) as string;
    actions.select(parentId);
    const secondChildId = actions.addChild(parentId) as string;

    expect(actions.addBarrier(parentId, "not-a-child")).toBeNull();
    expect(actions.addBarrier(parentId, secondChildId)).toBeTruthy();
    expect(actions.addBarrier(parentId, secondChildId)).toBeNull();
    expect(actions.addBarrier(parentId, firstChildId)).toBeTruthy();
    expect(useAppStore.getState().barriers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          upstreamNodeId: parentId,
          downstreamNodeId: firstChildId,
        }),
        expect.objectContaining({
          upstreamNodeId: parentId,
          downstreamNodeId: secondChildId,
        }),
      ]),
    );
  });

  it("does not create barriers on action relationships", () => {
    const { actions } = useAppStore.getState();
    const upstreamId = actions.addChild() as string;
    const downstreamId = actions.addChild(upstreamId) as string;
    useAppStore.setState((state) => ({
      edges: state.edges.map((edge) =>
        edge.source === upstreamId && edge.target === downstreamId
          ? { ...edge, data: { kind: "ActionEdge" } }
          : edge,
      ),
    }));

    expect(actions.addBarrier(upstreamId, downstreamId)).toBeNull();
    expect(useAppStore.getState().barriers).toEqual([]);
  });

  it("does not create a barrier for a node without downstream edges", () => {
    const { actions } = useAppStore.getState();
    const leafId = actions.addChild() as string;

    expect(actions.addBarrier(leafId, "missing")).toBeNull();
    expect(useAppStore.getState().barriers).toEqual([]);
  });

  it("retains the status of loaded barriers", () => {
    useAppStore.getState().actions.loadMap(sampleMap);

    expect(useAppStore.getState().barriers[0]).toMatchObject({
      id: "barrier-root-child",
      status: "Effective",
    });
  });

  it("batches live barrier description changes into one undo entry", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    const childId = actions.addChild(parentId) as string;
    const barrierId = actions.addBarrier(parentId, childId) as string;
    const initialHistoryLength = useAppStore.getState().history.past.length;

    actions.updateBarrierData(
      barrierId,
      { description: "F" },
      { debounceHistory: true },
    );
    actions.updateBarrierData(
      barrierId,
      { description: "Firewall" },
      { debounceHistory: true },
    );

    expect(useAppStore.getState().history.past).toHaveLength(
      initialHistoryLength + 1,
    );
    expect(useAppStore.getState().barriers[0]?.description).toBe("Firewall");
    actions.undo();
    expect(useAppStore.getState().barriers[0]?.description).toBeUndefined();
  });

  it.each([true, false])(
    "centers a first child below its parent without moving existing nodes (details: %s)",
    (showDetails) => {
      const { actions } = useAppStore.getState();
      actions.setShowDetails(showDetails);
      const parentId = actions.addChild() as string;
      actions.select(null);
      const unrelatedId = actions.addChild() as string;
      actions.moveNode(parentId, { x: 104, y: 72 });
      actions.moveNode(unrelatedId, { x: 776, y: 344 });
      useAppStore.setState((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === parentId
            ? { ...node, width: 248, height: showDetails ? 312 : 152 }
            : node,
        ),
      }));
      const before = useAppStore.getState();
      const parentBefore = before.nodes.find((node) => node.id === parentId)!;
      const unrelatedBefore = before.nodes.find(
        (node) => node.id === unrelatedId,
      )!;
      const childId = actions.addChild(parentId) as string;
      const state = useAppStore.getState();
      const parent = state.nodes.find((node) => node.id === parentId)!;
      const child = state.nodes.find((node) => node.id === childId)!;
      const parentSize = getNodeSize(parent, showDetails);
      const childSize = getNodeSize(child, showDetails);
      const expected = snapPosition({
        x: parent.position.x + parentSize.width / 2 - childSize.width / 2,
        y: parent.position.y + parentSize.height + VERTICAL_GAP,
      });

      expect(child.position).toEqual(expected);
      expect(
        Math.abs(
          child.position.x +
            childSize.width / 2 -
            (parent.position.x + parentSize.width / 2),
        ),
      ).toBeLessThanOrEqual(GRID_SIZE / 2);
      expect(parent.position).toEqual(parentBefore.position);
      expect(
        state.nodes.find((node) => node.id === unrelatedId)?.position,
      ).toEqual(unrelatedBefore.position);
      expect(state.layoutVersion).toBe(before.layoutVersion);
      expect(child.position.x % GRID_SIZE).toBe(0);
      expect(child.position.y % GRID_SIZE).toBe(0);
    },
  );

  it("uses both measured widths and relayouts an evenly split second child", () => {
    const { actions } = useAppStore.getState();
    const parentId = actions.addChild() as string;
    useAppStore.setState((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === parentId ? { ...node, width: 320, height: 184 } : node,
      ),
    }));
    const firstId = actions.addChild(parentId) as string;
    useAppStore.setState((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === firstId ? { ...node, width: 192 } : node,
      ),
    }));
    const beforeSecond = useAppStore.getState();
    const parentBefore = beforeSecond.nodes.find(
      (node) => node.id === parentId,
    )!;
    const firstBefore = beforeSecond.nodes.find((node) => node.id === firstId)!;
    expect(firstBefore.position.x).toBe(
      snapPosition({
        x: parentBefore.position.x + 320 / 2 - 240 / 2,
        y: parentBefore.position.y + 184 + VERTICAL_GAP,
      }).x,
    );

    const secondId = actions.addChild(parentId) as string;
    const state = useAppStore.getState();
    const parent = state.nodes.find((node) => node.id === parentId)!;
    const first = state.nodes.find((node) => node.id === firstId)!;
    const second = state.nodes.find((node) => node.id === secondId)!;
    expect(first.position.y).toBe(second.position.y);
    expect((first.position.x + second.position.x + 240) / 2).toBe(
      parent.position.x + 320 / 2,
    );
    expect(state.layoutVersion).toBeGreaterThan(beforeSecond.layoutVersion);
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

  it.each([
    ["incidentId", "INC-204"],
    ["occurredAt", "2026-08-16T09:30"],
    ["location", "Plant 4"],
    ["severity", "High"],
    ["status", "InProgress"],
  ] as const)("persists and restores the %s metadata field", (field, value) => {
    const { actions } = useAppStore.getState();
    actions.updateMetadata({ [field]: value });
    expect(actions.toMap().metadata?.[field]).toBe(value);

    actions.undo();
    expect(useAppStore.getState().metadata?.[field]).toBeUndefined();
    actions.redo();
    expect(useAppStore.getState().metadata?.[field]).toBe(value);
  });

  it("normalizes a blank field without dropping other metadata", () => {
    const { actions } = useAppStore.getState();
    actions.updateMetadata({ incidentId: " INC-204 ", location: "Plant 4" });
    actions.updateMetadata({ incidentId: "   " });

    expect(actions.toMap().metadata).toMatchObject({
      title: "Untitled Map",
      location: "Plant 4",
    });
    expect(actions.toMap().metadata).not.toHaveProperty("incidentId");
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

  it("allocates evidence globally from reconciled metadata in one history entry", () => {
    const { actions } = useAppStore.getState();
    const firstNode = actions.addChild() as string;
    const secondNode = actions.addSibling(firstNode) as string;
    useAppStore.setState((state) => ({
      metadata: { ...state.metadata, evidenceReferenceHighWaterMark: 1 },
      nodes: state.nodes.map((node) =>
        node.id === firstNode
          ? {
              ...node,
              data: {
                ...node.data,
                evidenceItems: [{ id: "EV-009", text: "Imported" }],
              },
            }
          : node,
      ),
    }));
    const historyLength = useAppStore.getState().history.past.length;

    expect(actions.addEvidence(secondNode, "Global evidence")).toBe("EV-010");
    expect(
      useAppStore.getState().metadata?.evidenceReferenceHighWaterMark,
    ).toBe(10);
    expect(useAppStore.getState().history.past).toHaveLength(historyLength + 1);
    actions.undo();
    expect(
      useAppStore.getState().metadata?.evidenceReferenceHighWaterMark,
    ).toBe(1);
    expect(
      useAppStore.getState().nodes.find((node) => node.id === secondNode)?.data
        .evidenceItems,
    ).toEqual([]);
    actions.redo();
    expect(
      actions.toMap().nodes.find((node) => node.id === secondNode)
        ?.evidenceItems,
    ).toEqual([{ id: "EV-010", text: "Global evidence" }]);
  });

  it("preserves sparse evidence through save and reload before allocating the next ID", () => {
    const canonical = {
      ...sampleMap,
      metadata: { evidenceReferenceHighWaterMark: 3 },
      nodes: sampleMap.nodes.map((node, index) => ({
        ...node,
        evidenceItems: [
          { id: index === 0 ? "EV-001" : "EV-003", text: "Imported" },
        ],
      })),
    };
    const { actions } = useAppStore.getState();
    actions.loadMap(canonical);
    const saved = actions.toMap();
    expect(
      saved.nodes.flatMap((node) => node.evidenceItems.map(({ id }) => id)),
    ).toEqual(["EV-001", "EV-003"]);
    expect(saved.metadata?.evidenceReferenceHighWaterMark).toBe(3);

    actions.loadMap(saved);
    expect(actions.addEvidence("root", "New evidence")).toBe("EV-004");
    expect(actions.toMap().metadata?.evidenceReferenceHighWaterMark).toBe(4);
  });

  it("restricts generic type changes to causal nodes and clears factor fields", () => {
    const { actions } = useAppStore.getState();
    const causalId = actions.addChild() as string;
    actions.setNodeType(causalId, "Factor");
    expect(useAppStore.getState().nodes[0].data).toMatchObject({
      nodeType: "Factor",
      factorSignificance: "Normal",
    });
    expect(useAppStore.getState().nodes[0].data.factorCategory).toBeUndefined();
    actions.setFactorCategory(causalId, "Human");
    actions.setNodeType(causalId, "Impact");
    expect(useAppStore.getState().nodes[0].data.factorCategory).toBeUndefined();
    expect(
      useAppStore.getState().nodes[0].data.factorSignificance,
    ).toBeUndefined();
    actions.setNodeType(causalId, "Action");
    expect(useAppStore.getState().nodes[0].data.nodeType).toBe("Impact");

    const actionId = actions.addAction(causalId) as string;
    actions.setNodeType(actionId, "Event");
    expect(
      useAppStore.getState().nodes.find((node) => node.id === actionId)?.data
        .nodeType,
    ).toBe("Action");
    actions.setNodeActionDueDate(actionId, " 2026-09-01 ");
    expect(
      actions.toMap().nodes.find((node) => node.id === actionId)?.actionDueDate,
    ).toBe("2026-09-01");
  });
});
