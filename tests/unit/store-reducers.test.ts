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
import type { MapData } from "../../src/features/maps/schema";

describe("useAppStore actions", () => {
  beforeEach(() => {
    useAppStore.getState().actions.loadMap(emptyMap);
    if (useAppStore.getState().canvasDetail !== "Expanded") {
      useAppStore.getState().actions.setShowDetails(true);
    }
  });

  it.each([
    ["Impact", undefined, true],
    ["Impact", "Neutral", true],
    ["Impact", "Aggravating", true],
    ["Impact", "Mitigating", true],
    ["Event", undefined, true],
    ["Event", "Neutral", true],
    ["Event", "Aggravating", true],
    ["Event", "Mitigating", true],
    ["Factor", undefined, true],
    ["Factor", "Neutral", true],
    ["Factor", "Aggravating", false],
    ["Factor", "Mitigating", false],
    ["Action", undefined, false],
    ["Action", "Neutral", false],
    ["Action", "Aggravating", false],
    ["Action", "Mitigating", false],
  ] as const)(
    "guards %s Context with %s effect (allowed: %s)",
    (nodeType, effect, allowed) => {
      const actions = useAppStore.getState().actions;
      const rootId = actions.addChild() as string;
      let nodeId = rootId;
      if (nodeType === "Event") nodeId = actions.addChild() as string;
      if (nodeType === "Factor") {
        nodeId = actions.addChild() as string;
        actions.setNodeType(nodeId, "Factor");
      }
      if (nodeType === "Action") nodeId = actions.addAction(rootId) as string;

      actions.updateNodeData(nodeId, {
        contextItems: [
          {
            id: "weather",
            label: "Weather",
            value: "Rain",
            displayMode: "Text",
            effect: effect ?? "Neutral",
          },
        ],
      });
      const items = useAppStore
        .getState()
        .nodes.find((node) => node.id === nodeId)?.data.contextItems;
      expect(items).toHaveLength(allowed ? 1 : 0);
      if (allowed) expect(items?.[0].effect).toBe(effect ?? "Neutral");
    },
  );

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

  it("tracks the ephemeral new/opened map lifecycle independently of history and serialization", () => {
    const { actions } = useAppStore.getState();
    actions.newMap();
    expect(useAppStore.getState().mapSession).toEqual({
      source: "New",
      fresh: true,
    });

    const rootId = useAppStore.getState().nodes[0].id;
    expect(actions.renameNode(rootId, "Service outage")).toBe(true);
    expect(useAppStore.getState().mapSession.fresh).toBe(false);
    expect(useAppStore.getState().history.past[0]).not.toHaveProperty(
      "mapSession",
    );
    expect(actions.toMap()).not.toHaveProperty("mapSession");
    expect(actions.toMap()).not.toHaveProperty("canvasDetail");

    actions.newMap();
    expect(actions.addChild()).not.toBeNull();
    expect(useAppStore.getState().mapSession.fresh).toBe(false);

    actions.newMap();
    actions.progressMapSession();
    expect(useAppStore.getState().mapSession.fresh).toBe(false);

    actions.loadMap(actions.toMap());
    expect(useAppStore.getState().mapSession).toEqual({
      source: "Opened",
      fresh: false,
    });
  });

  it("switches canvas detail once without changing investigation semantics", () => {
    const { actions } = useAppStore.getState();
    actions.loadMap(sampleMap);
    const before = actions.toMap();
    const initialLayoutVersion = useAppStore.getState().layoutVersion;

    actions.setCanvasDetail("Expanded");
    const expanded = useAppStore.getState();
    expect(expanded.canvasDetail).toBe("Expanded");
    expect(expanded.layoutVersion - initialLayoutVersion).toBeLessThanOrEqual(
      1,
    );
    expect(actions.toMap()).toEqual(before);

    actions.setCanvasDetail("Expanded");
    expect(useAppStore.getState().layoutVersion).toBe(expanded.layoutVersion);
    expect(actions.toMap()).toEqual(before);
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

  it("creates causal entities with their intended semantic type in one history step", () => {
    const { actions } = useAppStore.getState();
    actions.newMap();
    const rootId = useAppStore.getState().selectionId!;

    const factorId = actions.addSemanticNode("Factor", rootId)!;
    const state = useAppStore.getState();
    expect(
      state.nodes.find((node) => node.id === factorId)?.data,
    ).toMatchObject({ title: "New Factor", nodeType: "Factor" });
    expect(state.selectionId).toBe(factorId);
    expect(state.editingId).toBe(factorId);
    expect(state.editorFocusRequest).toMatchObject({
      entityId: factorId,
      field: "title",
    });
    expect(state.history.past).toHaveLength(1);

    actions.undo();
    expect(useAppStore.getState().nodes).toHaveLength(1);
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
        referenceId: "C-001",
        status: "Failed",
      }),
    );
    expect(state.selectionId).toBe(barrierId);
    expect(state.editorFocusRequest).toMatchObject({
      entityId: barrierId,
      field: "barrier-description",
    });
  });

  it("normalizes Control allocation and never reuses deleted references", () => {
    useAppStore.getState().actions.loadMap({
      ...sampleMap,
      metadata: {
        ...sampleMap.metadata,
        controlReferenceHighWaterMark: 0,
      },
      barriers: [{ ...sampleMap.barriers[0], referenceId: "C-007" }],
    });
    expect(useAppStore.getState().metadata?.controlReferenceHighWaterMark).toBe(
      7,
    );

    const { actions } = useAppStore.getState();
    actions.removeBarrier("barrier-root-child");
    expect(actions.addBarrier("root", "child")).toBeTruthy();
    expect(useAppStore.getState().barriers[0]?.referenceId).toBe("C-008");
    expect(actions.addBarrier("root", "child")).toBeNull();

    const reference = useAppStore.getState().barriers[0]?.referenceId;
    const id = useAppStore.getState().barriers[0]!.id;
    actions.updateBarrierData(id, { status: "Degraded" });
    expect(useAppStore.getState().barriers[0]?.referenceId).toBe(reference);
    expect(actions.toMap().barriers[0]?.referenceId).toBe("C-008");
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

  it("uses Control-aware clearance when laying out an imported map", () => {
    const node = (
      id: string,
      referenceId: string,
    ): MapData["nodes"][number] => ({
      id,
      kind: "ChainNode",
      referenceId,
      nodeType: "Event",
      eventDisplay: "Map",
      title: id,
      evidenceIds: [],
      contextItems: [],
      position: { x: 0, y: 0 },
    });
    const map = {
      schemaVersion: 5 as const,
      nodes: [
        node("root", "N-001"),
        node("left", "N-002"),
        node("right", "N-003"),
      ],
      edges: [
        {
          id: "root-left",
          kind: "CauseEffectEdge",
          fromId: "root",
          toId: "left",
        },
        {
          id: "root-right",
          kind: "CauseEffectEdge",
          fromId: "root",
          toId: "right",
        },
      ],
      barriers: [
        {
          id: "left-control",
          kind: "Barrier",
          upstreamNodeId: "root",
          downstreamNodeId: "left",
          status: "Effective",
          referenceId: "C-001",
          evidenceIds: [],
        },
        {
          id: "right-control",
          kind: "Barrier",
          upstreamNodeId: "root",
          downstreamNodeId: "right",
          status: "Effective",
          referenceId: "C-002",
          evidenceIds: [],
        },
      ],
      evidence: [],
      attachments: [],
    };
    const childPositions = () => {
      const byId = new Map(
        useAppStore.getState().nodes.map(({ id, position }) => [id, position]),
      );
      return { left: byId.get("left")!, right: byId.get("right")! };
    };

    useAppStore.getState().actions.loadMap({ ...map, barriers: [] });
    const withoutControls = childPositions();
    useAppStore.getState().actions.loadMap(map);
    const withControls = childPositions();

    expect(withControls.right.x - withControls.left.x).toBeGreaterThan(
      withoutControls.right.x - withoutControls.left.x,
    );
    expect(withControls.left.y).toBeGreaterThan(withoutControls.left.y);
    expect(withControls.right.y).toBeGreaterThan(withoutControls.right.y);
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

  it("organizes atomically and restores positions through undo and redo", async () => {
    const { actions } = useAppStore.getState();
    const parent = actions.addChild() as string;
    const child = actions.addChild(parent) as string;
    actions.moveNode(child, { x: 800, y: 800 });
    const before = useAppStore.getState().nodes.map((node) => node.position);
    const selection = useAppStore.getState().selectionId;
    const historyBeforeArrange = useAppStore.getState().history.past.length;

    actions.organizeNodes();
    await vi.waitFor(() =>
      expect(useAppStore.getState().history.past.length).toBe(
        historyBeforeArrange + 1,
      ),
    );
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

  it("preserves unaffected dragged geometry when a second Factor is added", () => {
    const { actions } = useAppStore.getState();
    const parent = actions.addChild() as string;
    const first = actions.addSemanticNode("Factor", parent) as string;
    actions.moveNode(parent, { x: 416, y: 96 });
    actions.moveNode(first, { x: 136, y: 504 });
    const before = new Map(
      useAppStore.getState().nodes.map((node) => [node.id, node.position]),
    );

    const second = actions.addSemanticNode("Factor", parent) as string;
    const after = useAppStore.getState();
    expect(after.nodes.find((node) => node.id === parent)?.position).toEqual(
      before.get(parent),
    );
    expect(after.nodes.find((node) => node.id === first)?.position).toEqual(
      before.get(first),
    );
    expect(after.nodes.find((node) => node.id === second)?.position.y).toBe(
      before.get(first)?.y,
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
      actions.toMap().nodes.find((node) => node.id === secondNode)?.evidenceIds,
    ).toEqual(["EV-010"]);
  });

  it("preserves sparse evidence through save and reload before allocating the next ID", () => {
    const canonical = {
      ...sampleMap,
      metadata: { evidenceReferenceHighWaterMark: 3, contextItems: [] },
      nodes: sampleMap.nodes.map((node, index) => ({
        ...node,
        evidenceIds: [index === 0 ? "EV-001" : "EV-003"],
      })),
      evidence: [
        {
          id: "EV-001",
          type: "Note" as const,
          title: "Imported",
          attachmentIds: [],
        },
        {
          id: "EV-003",
          type: "Note" as const,
          title: "Imported",
          attachmentIds: [],
        },
      ],
    };
    const { actions } = useAppStore.getState();
    actions.loadMap(canonical);
    const saved = actions.toMap();
    expect(saved.nodes.flatMap((node) => node.evidenceIds)).toEqual([
      "EV-001",
      "EV-003",
    ]);
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

  it("persists factor significance and restores it through undo and redo", () => {
    const { actions } = useAppStore.getState();
    const id = actions.addChild() as string;
    actions.setNodeType(id, "Factor");
    actions.setFactorSignificance(id, "RootCause");
    expect(actions.toMap().nodes[0].factorSignificance).toBe("RootCause");

    actions.undo();
    expect(useAppStore.getState().nodes[0].data.factorSignificance).toBe(
      "Normal",
    );
    actions.redo();
    expect(useAppStore.getState().nodes[0].data.factorSignificance).toBe(
      "RootCause",
    );

    const saved = actions.toMap();
    actions.loadMap(saved);
    expect(useAppStore.getState().nodes[0].data.factorSignificance).toBe(
      "RootCause",
    );
  });

  it("reuses registry evidence and atomically cleans every reference", () => {
    const { actions } = useAppStore.getState();
    const first = actions.addChild() as string;
    const second = actions.addSibling(first) as string;
    const evidenceId = actions.createEvidence({
      type: "Document",
      title: "Shared report",
      description: "Original",
    }) as string;
    expect(actions.linkEvidenceToNode(first, evidenceId)).toBe(true);
    expect(actions.linkEvidenceToNode(second, evidenceId)).toBe(true);
    expect(actions.linkEvidenceToNode(second, evidenceId)).toBe(false);
    actions.deleteEvidence(evidenceId);
    expect(actions.toMap().evidence).toEqual([]);
    expect(actions.toMap().nodes.flatMap((node) => node.evidenceIds)).toEqual(
      [],
    );
    actions.undo();
    expect(actions.toMap().evidence[0]).toMatchObject({ id: evidenceId });
    expect(actions.toMap().nodes.flatMap((node) => node.evidenceIds)).toEqual([
      evidenceId,
      evidenceId,
    ]);
    actions.redo();
    expect(actions.toMap().evidence).toEqual([]);
  });

  it("persists guarded classifications and collision-safe Context through reload", () => {
    const { actions } = useAppStore.getState();
    const eventId = actions.addChild() as string;
    expect(
      useAppStore.getState().nodes.find((node) => node.id === eventId)?.data
        .eventPhase,
    ).toBe("Incident");
    actions.setEventPhase(eventId, "Recovery");
    const contextId = actions.addContext(
      eventId,
      "Weather",
      "Rain",
      true,
      "Metric",
      "mm",
      "Aggravating",
    ) as string;
    expect(
      actions.updateContext(eventId, contextId, { value: "Heavy rain" }),
    ).toBe(true);
    actions.toggleContextShowOnCard(eventId, contextId);
    actions.setActionType(eventId, "Corrective");
    expect(
      useAppStore.getState().nodes.find((node) => node.id === eventId)?.data
        .actionType,
    ).toBeUndefined();
    const saved = actions.toMap();
    actions.loadMap(saved);
    expect(
      actions.toMap().nodes.find((node) => node.id === eventId),
    ).toMatchObject({
      eventPhase: "Recovery",
      contextItems: [
        {
          id: contextId,
          label: "Weather",
          value: "Heavy rain",
          displayMode: "Metric",
          unit: "mm",
          showOnCard: false,
          effect: "Aggravating",
        },
      ],
    });
  });

  it("keeps Action due and completion dates independent through history and reload", () => {
    const { actions } = useAppStore.getState();
    const sourceId = actions.addChild() as string;
    const actionId = actions.addAction(sourceId) as string;

    actions.setNodeActionDueDate(actionId, "2026-08-20");
    actions.setNodeActionStatus(actionId, "Completed");
    expect(
      useAppStore.getState().nodes.find((node) => node.id === actionId)?.data
        .actionCompletedAt,
    ).toBeUndefined();

    actions.setNodeActionCompletedAt(actionId, "2026-08-16");
    expect(
      actions.toMap().nodes.find((node) => node.id === actionId),
    ).toMatchObject({
      actionStatus: "Completed",
      actionDueDate: "2026-08-20",
      actionCompletedAt: "2026-08-16",
    });

    actions.setNodeActionStatus(actionId, "InProgress");
    expect(
      useAppStore.getState().nodes.find((node) => node.id === actionId)?.data
        .actionCompletedAt,
    ).toBe("2026-08-16");
    actions.undo();
    expect(
      useAppStore.getState().nodes.find((node) => node.id === actionId)?.data
        .actionStatus,
    ).toBe("Completed");
    actions.redo();

    const saved = actions.toMap();
    actions.loadMap(saved);
    expect(
      actions.toMap().nodes.find((node) => node.id === actionId),
    ).toMatchObject({
      actionStatus: "InProgress",
      actionDueDate: "2026-08-20",
      actionCompletedAt: "2026-08-16",
    });
  });
});
