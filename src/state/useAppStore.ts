import { create } from "zustand";
import type { Edge, Node, XYPosition } from "reactflow";
import { emptyMap, sampleMap } from "../features/maps/fixtures";
import type { Barrier, ChainNode, MapData } from "../features/maps/schema";
import { createId } from "../lib/id";
import {
  applyHierarchyLayout,
  getNodeSize,
  snapPosition,
  VERTICAL_GAP,
} from "../features/layout/hierarchy";

export { GRID_SIZE } from "../features/layout/hierarchy";

export type ChainNodeData = {
  title: string;
  description?: string;
  owner?: string;
  timestamp?: string;
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  /** Ephemeral canvas-only styling hints. This field is never serialized. */
  presentation?: {
    isRoot: boolean;
    isLeaf: boolean;
    isOnSelectedPath: boolean;
    isUnrelated: boolean;
  };
};

export type BarrierNodeData = {
  kind: "Barrier";
  upstreamNodeId: string;
  downstreamNodeId: string;
  description?: string;
  breached: boolean;
  breachedItems: string[];
};

type HistoryEntry = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: MapData["metadata"];
  barriers: Barrier[];
  selectionId: string | null;
};

type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

type AppState = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: MapData["metadata"];
  barriers: Barrier[];
  selectionId: string | null;
  editingId: string | null;
  showDetails: boolean;
  layoutVersion: number;
  viewportRequest: { id: number; nodeIds: string[] } | null;
  editorFocusRequest: {
    id: number;
    nodeId: string;
    field: "title" | "description";
  } | null;
  history: HistoryState;
  canUndo: boolean;
  canRedo: boolean;
  actions: {
    newMap: () => void;
    loadMap: (map: MapData) => void;
    toMap: () => MapData;
    addChainNode: (options?: { parentId?: string }) => void;
    addChild: (parentId?: string) => string | null;
    addSibling: (siblingId?: string) => string | null;
    addBarrierForFirstDownstream: (upstreamId?: string) => string | null;
    setMapTitle: (title: string) => void;
    renameNode: (id: string, title: string) => boolean;
    moveNode: (id: string, position: XYPosition) => void;
    nudgeNodeBy: (id: string, dx: number, dy: number) => void;
    deleteNode: (id: string) => void;
    deleteSelection: () => void;
    removeBarrier: (barrierId: string) => void;
    select: (id: string | null) => void;
    startEditing: (id: string) => void;
    finishEditing: () => void;
    setShowDetails: (visible: boolean) => void;
    toggleShowDetails: () => void;
    organizeNodes: () => void;
    updateNodeData: (
      id: string,
      patch: Partial<Omit<ChainNodeData, "title">>,
    ) => void;
    updateBarrierData: (
      id: string,
      patch: Partial<
        Pick<Barrier, "breached" | "breachedItems" | "description">
      >,
    ) => void;
    undo: () => void;
    redo: () => void;
    clearViewportRequest: (id: number) => void;
    requestEditorFocus: (
      nodeId: string,
      field: "title" | "description",
    ) => void;
    clearEditorFocusRequest: (id: number) => void;
  };
};

const MOVE_DEBOUNCE_MS = 200;

let moveDebounceActive = false;
let nextEditorFocusRequestId = 1;
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetMoveDebounce = () => {
  moveDebounceActive = false;
  if (moveDebounceTimer) {
    clearTimeout(moveDebounceTimer);
    moveDebounceTimer = null;
  }
};

const chainNodeToReactNode = (node: ChainNode): Node<ChainNodeData> => ({
  id: node.id,
  type: "ChainNode",
  position: snapPosition(node.position),
  data: {
    title: node.title,
    description: node.description,
    owner: node.owner,
    timestamp: node.timestamp,
    positiveConsequenceBulletPoints: node.positiveConsequenceBulletPoints ?? [],
    negativeConsequenceBulletPoints: node.negativeConsequenceBulletPoints ?? [],
  },
});

const mapNodesToReactNodes = (nodes: ChainNode[]): Node<ChainNodeData>[] =>
  nodes.map(chainNodeToReactNode);

const mapEdgesToReactEdges = (map: MapData): Edge[] =>
  map.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    type: "step",
    sourceHandle: "bottom",
    targetHandle: "top",
    data: { kind: edge.kind },
  }));

const serializeNodes = (nodes: Node<ChainNodeData>[]): ChainNode[] =>
  nodes.map((node) => ({
    id: node.id,
    kind: "ChainNode",
    title: node.data.title,
    description: node.data.description,
    owner: node.data.owner,
    timestamp: node.data.timestamp,
    positiveConsequenceBulletPoints: node.data.positiveConsequenceBulletPoints,
    negativeConsequenceBulletPoints: node.data.negativeConsequenceBulletPoints,
    position: snapPosition(node.position),
  }));

const cloneNode = (node: Node<ChainNodeData>): Node<ChainNodeData> => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data },
});

const cloneEdge = (edge: Edge): Edge => ({
  ...edge,
  data: edge.data ? { ...edge.data } : undefined,
});

const cloneBarrier = (barrier: Barrier): Barrier => ({
  ...barrier,
  breachedItems: [...barrier.breachedItems],
});

const snapshotFromState = (state: AppState): HistoryEntry => ({
  nodes: state.nodes.map(cloneNode),
  edges: state.edges.map(cloneEdge),
  metadata: state.metadata ? { ...state.metadata } : undefined,
  barriers: state.barriers.map(cloneBarrier),
  selectionId: state.selectionId,
});

const snapshotsEqual = (a: HistoryEntry, b: HistoryEntry): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const applyLayout = (
  nodes: Node<ChainNodeData>[],
  edges: Edge[],
  showDetails: boolean,
  barriers: Barrier[] = [],
) =>
  applyHierarchyLayout(nodes, edges, { showDetails, barrierEdges: barriers });

const createEmptyHistory = (): HistoryState => ({ past: [], future: [] });

const applyHistorySnapshot = (snapshot: HistoryEntry) => ({
  nodes: snapshot.nodes.map(cloneNode),
  edges: snapshot.edges.map(cloneEdge),
  metadata: snapshot.metadata ? { ...snapshot.metadata } : undefined,
  barriers: snapshot.barriers.map(cloneBarrier),
  selectionId: snapshot.selectionId,
});

const pushHistory = (
  history: HistoryState,
  snapshot: HistoryEntry,
): HistoryState => ({
  past: [...history.past, snapshot],
  future: [],
});

const updateHistoryState = (
  state: AppState,
  prevSnapshot: HistoryEntry,
  changed: boolean,
  options?: { debounce?: "move" | null },
): HistoryState => {
  if (!changed) {
    return state.history;
  }

  if (options?.debounce === "move") {
    if (!moveDebounceActive) {
      const history = pushHistory(state.history, prevSnapshot);
      moveDebounceActive = true;
      moveDebounceTimer && clearTimeout(moveDebounceTimer);
      moveDebounceTimer = setTimeout(() => {
        moveDebounceActive = false;
        moveDebounceTimer = null;
      }, MOVE_DEBOUNCE_MS);
      return history;
    }

    moveDebounceTimer && clearTimeout(moveDebounceTimer);
    moveDebounceTimer = setTimeout(() => {
      moveDebounceActive = false;
      moveDebounceTimer = null;
    }, MOVE_DEBOUNCE_MS);
    return state.history;
  }

  resetMoveDebounce();
  return pushHistory(state.history, prevSnapshot);
};

const computeParentId = (edges: Edge[], childId: string): string | null => {
  const parentEdge = edges.find((edge) => edge.target === childId);
  return parentEdge ? parentEdge.source : null;
};

const findFirstDownstreamEdge = (
  edges: Edge[],
  upstreamId: string,
): Edge | null => edges.find((edge) => edge.source === upstreamId) ?? null;

const createEmptyState = () => ({
  nodes: mapNodesToReactNodes(emptyMap.nodes),
  edges: mapEdgesToReactEdges(emptyMap),
  metadata: emptyMap.metadata ? { ...emptyMap.metadata } : undefined,
  barriers: emptyMap.barriers ? [...emptyMap.barriers] : [],
  selectionId: null,
  editingId: null,
  showDetails: true,
  layoutVersion: 0,
  viewportRequest: null,
  editorFocusRequest: null,
  history: createEmptyHistory(),
  canUndo: false,
  canRedo: false,
});

export const useAppStore = create<AppState>((set, get) => ({
  nodes: mapNodesToReactNodes(sampleMap.nodes),
  edges: mapEdgesToReactEdges(sampleMap),
  metadata: sampleMap.metadata ? { ...sampleMap.metadata } : undefined,
  barriers: sampleMap.barriers ? [...sampleMap.barriers] : [],
  selectionId: sampleMap.nodes[0]?.id ?? null,
  editingId: null,
  showDetails: true,
  layoutVersion: 0,
  viewportRequest: null,
  editorFocusRequest: null,
  history: createEmptyHistory(),
  canUndo: false,
  canRedo: false,
  actions: {
    newMap: () => {
      resetMoveDebounce();
      set((state) => ({
        ...createEmptyState(),
        showDetails: state.showDetails,
      }));
    },
    loadMap: (map) => {
      resetMoveDebounce();
      set((state) => ({
        nodes: applyLayout(
          mapNodesToReactNodes(map.nodes),
          mapEdgesToReactEdges(map),
          state.showDetails,
        ).nodes,
        edges: mapEdgesToReactEdges(map),
        metadata: map.metadata ? { ...map.metadata } : undefined,
        barriers: map.barriers ? [...map.barriers] : [],
        selectionId: map.nodes[0]?.id ?? null,
        editingId: null,
        showDetails: state.showDetails,
        layoutVersion: state.layoutVersion + 1,
        viewportRequest: null,
        editorFocusRequest: null,
        history: createEmptyHistory(),
        canUndo: false,
        canRedo: false,
      }));
    },
    toMap: () => {
      const { nodes, edges, metadata, barriers } = get();
      return {
        schemaVersion: 1,
        metadata,
        nodes: serializeNodes(nodes),
        edges: edges.map((edge) => ({
          id: edge.id,
          kind: "CauseEffectEdge" as const,
          fromId: edge.source,
          toId: edge.target,
        })),
        barriers: barriers.map(cloneBarrier),
      };
    },
    addChainNode: (options) => {
      const parentId = options?.parentId;
      get().actions.addChild(parentId);
    },
    setMapTitle: (title) => {
      const nextTitle = title.trim();
      const prevSnapshot = snapshotFromState(get());
      set((state) => {
        const currentTitle = state.metadata?.title ?? "";
        if (currentTitle === nextTitle) {
          return {};
        }
        const nextMetadata = nextTitle.length
          ? { ...(state.metadata ?? {}), title: nextTitle }
          : undefined;
        const candidate = {
          ...state,
          metadata: nextMetadata,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          metadata: nextMetadata,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    addChild: (parentId) => {
      const initialParentId = parentId ?? get().selectionId ?? undefined;
      const newNodeId = createId("node");
      const prevSnapshot = snapshotFromState(get());
      let created = false;
      set((state) => {
        const parentNode = initialParentId
          ? (state.nodes.find((node) => node.id === initialParentId) ?? null)
          : null;
        const newNode: Node<ChainNodeData> = {
          id: newNodeId,
          type: "ChainNode",
          position: { x: 0, y: 0 },
          data: {
            title: "New ChainNode",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
          },
        };
        const outgoingChildCount = parentNode
          ? state.edges.filter((edge) => edge.source === parentNode.id).length
          : 0;
        const position = parentNode
          ? (() => {
              const parentSize = getNodeSize(parentNode, state.showDetails);
              const childSize = getNodeSize(newNode, state.showDetails);
              return snapPosition({
                x:
                  parentNode.position.x +
                  parentSize.width / 2 -
                  childSize.width / 2,
                y: parentNode.position.y + parentSize.height + VERTICAL_GAP,
              });
            })()
          : snapPosition({ x: 0, y: 0 });
        newNode.position = position;
        const nextNodes = [...state.nodes, newNode];
        const nextEdges = parentNode
          ? [
              ...state.edges,
              {
                id: createId("edge"),
                source: parentNode.id,
                target: newNodeId,
                type: "step",
                sourceHandle: "bottom",
                targetHandle: "top",
                data: { kind: "CauseEffectEdge" },
              },
            ]
          : state.edges;
        created = true;
        const firstChild = Boolean(parentNode && outgoingChildCount === 0);
        const { nodes: laidOutNodes, changed: layoutChanged } = firstChild
          ? { nodes: nextNodes, changed: false }
          : applyLayout(nextNodes, nextEdges, state.showDetails);
        const candidate = {
          ...state,
          nodes: laidOutNodes,
          edges: nextEdges,
          selectionId: newNodeId,
          editingId: newNodeId,
          layoutVersion: layoutChanged
            ? state.layoutVersion + 1
            : state.layoutVersion,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: laidOutNodes,
          edges: nextEdges,
          selectionId: newNodeId,
          editingId: newNodeId,
          layoutVersion: candidate.layoutVersion,
          viewportRequest: parentNode
            ? {
                id: (state.viewportRequest?.id ?? 0) + 1,
                nodeIds: [
                  parentNode.id,
                  ...nextEdges
                    .filter((edge) => edge.source === parentNode.id)
                    .map((edge) => edge.target),
                ],
              }
            : null,
          editorFocusRequest: {
            id: nextEditorFocusRequestId++,
            nodeId: newNodeId,
            field: "title",
          },
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return created ? newNodeId : null;
    },
    addSibling: (siblingId) => {
      const targetSiblingId = siblingId ?? get().selectionId ?? undefined;
      if (!targetSiblingId) {
        return get().actions.addChild(undefined);
      }
      const prevSnapshot = snapshotFromState(get());
      const newNodeId = createId("node");
      let created = false;
      set((state) => {
        const parentId = computeParentId(state.edges, targetSiblingId);
        const siblingNode = state.nodes.find(
          (node) => node.id === targetSiblingId,
        );
        if (!siblingNode) {
          return {};
        }
        const parentNode = parentId
          ? (state.nodes.find((node) => node.id === parentId) ?? null)
          : null;
        const basePosition = parentNode
          ? {
              x: siblingNode.position.x + 200,
              y: parentNode.position.y + 160,
            }
          : {
              x: siblingNode.position.x + 200,
              y: siblingNode.position.y,
            };
        const position = snapPosition(basePosition);
        const newNode: Node<ChainNodeData> = {
          id: newNodeId,
          type: "ChainNode",
          position,
          data: {
            title: "New ChainNode",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
          },
        };
        const nextNodes = [...state.nodes, newNode];
        const nextEdges = parentId
          ? [
              ...state.edges,
              {
                id: createId("edge"),
                source: parentId,
                target: newNodeId,
                type: "step",
                sourceHandle: "bottom",
                targetHandle: "top",
                data: { kind: "CauseEffectEdge" },
              },
            ]
          : state.edges;
        created = true;
        const { nodes: laidOutNodes, changed: layoutChanged } = applyLayout(
          nextNodes,
          nextEdges,
          state.showDetails,
        );
        const candidate = {
          ...state,
          nodes: laidOutNodes,
          edges: nextEdges,
          selectionId: newNodeId,
          editingId: newNodeId,
          layoutVersion: layoutChanged
            ? state.layoutVersion + 1
            : state.layoutVersion,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: laidOutNodes,
          edges: nextEdges,
          selectionId: newNodeId,
          editingId: newNodeId,
          layoutVersion: candidate.layoutVersion,
          viewportRequest: parentNode
            ? {
                id: (state.viewportRequest?.id ?? 0) + 1,
                nodeIds: [
                  parentNode.id,
                  ...nextEdges
                    .filter((edge) => edge.source === parentNode.id)
                    .map((edge) => edge.target),
                ],
              }
            : null,
          editorFocusRequest: {
            id: nextEditorFocusRequestId++,
            nodeId: newNodeId,
            field: "title",
          },
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return created ? newNodeId : null;
    },
    addBarrierForFirstDownstream: (upstreamId) => {
      const targetUpstreamId = upstreamId ?? get().selectionId ?? undefined;
      if (!targetUpstreamId) {
        return null;
      }
      const prevSnapshot = snapshotFromState(get());
      let createdId: string | null = null;
      set((state) => {
        const downstreamEdge = findFirstDownstreamEdge(
          state.edges,
          targetUpstreamId,
        );
        if (!downstreamEdge) {
          return {};
        }
        const alreadyExists = state.barriers.some(
          (barrier) =>
            barrier.upstreamNodeId === targetUpstreamId &&
            barrier.downstreamNodeId === downstreamEdge.target,
        );
        if (alreadyExists) {
          return {};
        }
        const barrierId = createId("barrier");
        createdId = barrierId;
        const nextBarriers = [
          ...state.barriers,
          {
            id: barrierId,
            kind: "Barrier" as const,
            upstreamNodeId: targetUpstreamId,
            downstreamNodeId: downstreamEdge.target,
            breached: false,
            breachedItems: [],
          },
        ];
        const candidate = {
          ...state,
          barriers: nextBarriers,
          selectionId: barrierId,
          editingId: null,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          barriers: nextBarriers,
          selectionId: barrierId,
          editingId: null,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return createdId;
    },
    renameNode: (id, title) => {
      const trimmed = title.trim();
      if (trimmed.length === 0) {
        return false;
      }
      const prevState = get();
      const prevSnapshot = snapshotFromState(prevState);
      let changed = false;
      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }
          if (node.data.title === trimmed) {
            return node;
          }
          changed = true;
          return {
            ...node,
            data: { ...node.data, title: trimmed },
          };
        });
        if (!changed) {
          return {};
        }
        const candidate = {
          ...state,
          nodes: nextNodes,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: nextNodes,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return changed;
    },
    moveNode: (id, position) => {
      const snapped = snapPosition(position);
      const prevSnapshot = snapshotFromState(get());
      let changed = false;
      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }
          if (node.position.x === snapped.x && node.position.y === snapped.y) {
            return node;
          }
          changed = true;
          return {
            ...node,
            position: snapped,
          };
        });
        if (!changed) {
          return {};
        }
        const candidate = {
          ...state,
          nodes: nextNodes,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: nextNodes,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    nudgeNodeBy: (id, dx, dy) => {
      const prevSnapshot = snapshotFromState(get());
      let changed = false;
      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }
          const position = snapPosition({
            x: node.position.x + dx,
            y: node.position.y + dy,
          });
          if (
            position.x === node.position.x &&
            position.y === node.position.y
          ) {
            return node;
          }
          changed = true;
          return {
            ...node,
            position,
          };
        });
        if (!changed) {
          return {};
        }
        const candidate = {
          ...state,
          nodes: nextNodes,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
          { debounce: "move" },
        );
        return {
          nodes: nextNodes,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    deleteNode: (id) => {
      const prevSnapshot = snapshotFromState(get());
      set((state) => {
        const { edges } = state;
        const toRemove = new Set<string>();
        const visit = (nodeId: string) => {
          if (toRemove.has(nodeId)) {
            return;
          }
          toRemove.add(nodeId);
          edges
            .filter((edge) => edge.source === nodeId)
            .forEach((edge) => visit(edge.target));
        };

        const exists = state.nodes.some((node) => node.id === id);
        if (!exists) {
          return {};
        }

        visit(id);
        const remainingNodes = state.nodes.filter(
          (node) => !toRemove.has(node.id),
        );
        const remainingEdges = state.edges.filter(
          (edge) => !toRemove.has(edge.source) && !toRemove.has(edge.target),
        );
        const remainingBarriers = state.barriers.filter(
          (barrier) =>
            !toRemove.has(barrier.upstreamNodeId) &&
            !toRemove.has(barrier.downstreamNodeId),
        );

        const candidate = {
          ...state,
          nodes: remainingNodes,
          edges: remainingEdges,
          barriers: remainingBarriers,
          selectionId: null,
          editingId: null,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: remainingNodes,
          edges: remainingEdges,
          barriers: remainingBarriers,
          selectionId: null,
          editingId: null,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    deleteSelection: () => {
      const { selectionId } = get();
      if (!selectionId) {
        return;
      }
      const barrier = get().barriers.find((item) => item.id === selectionId);
      if (barrier) {
        get().actions.removeBarrier(selectionId);
        return;
      }
      get().actions.deleteNode(selectionId);
    },
    removeBarrier: (barrierId) => {
      const prevSnapshot = snapshotFromState(get());
      set((state) => {
        const nextBarriers = state.barriers.filter(
          (barrier) => barrier.id !== barrierId,
        );
        if (nextBarriers.length === state.barriers.length) {
          return {};
        }
        const candidate = {
          ...state,
          barriers: nextBarriers,
          selectionId:
            state.selectionId === barrierId ? null : state.selectionId,
          editingId: state.selectionId === barrierId ? null : state.editingId,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          barriers: nextBarriers,
          selectionId: candidate.selectionId,
          editingId: candidate.editingId,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    select: (id) => {
      set({ selectionId: id ?? null, editingId: null });
    },
    startEditing: (id) => {
      set({ editingId: id, selectionId: id });
    },
    finishEditing: () => {
      set({ editingId: null });
    },
    setShowDetails: (visible) => {
      set((state) => {
        const { nodes: laidOutNodes, changed } = applyLayout(
          state.nodes,
          state.edges,
          visible,
        );
        return {
          showDetails: visible,
          nodes: laidOutNodes,
          layoutVersion: changed
            ? state.layoutVersion + 1
            : state.layoutVersion,
        };
      });
    },
    toggleShowDetails: () => {
      set((state) => {
        const nextShowDetails = !state.showDetails;
        const { nodes: laidOutNodes, changed } = applyLayout(
          state.nodes,
          state.edges,
          nextShowDetails,
        );
        return {
          showDetails: nextShowDetails,
          nodes: laidOutNodes,
          layoutVersion: changed
            ? state.layoutVersion + 1
            : state.layoutVersion,
        };
      });
    },
    organizeNodes: () => {
      const prevSnapshot = snapshotFromState(get());
      set((state) => {
        if (state.nodes.length < 2) return {};
        const { nodes, changed } = applyLayout(
          state.nodes,
          state.edges,
          state.showDetails,
          state.barriers,
        );
        if (!changed) return {};
        const history = updateHistoryState(state, prevSnapshot, true);
        return {
          nodes,
          history,
          canUndo: true,
          canRedo: false,
          layoutVersion: state.layoutVersion + 1,
          viewportRequest: {
            id: (state.viewportRequest?.id ?? 0) + 1,
            nodeIds: nodes.map((node) => node.id),
          },
        };
      });
    },
    updateNodeData: (id, patch) => {
      const prevSnapshot = snapshotFromState(get());
      let changed = false;
      set((state) => {
        const nextNodes = state.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }
          const nextData = { ...node.data, ...patch };
          if (JSON.stringify(nextData) === JSON.stringify(node.data)) {
            return node;
          }
          changed = true;
          return {
            ...node,
            data: nextData,
          };
        });
        if (!changed) {
          return {};
        }
        const { nodes: laidOutNodes, changed: layoutChanged } = applyLayout(
          nextNodes,
          state.edges,
          state.showDetails,
        );
        const candidate = {
          ...state,
          nodes: laidOutNodes,
          layoutVersion: layoutChanged
            ? state.layoutVersion + 1
            : state.layoutVersion,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          nodes: laidOutNodes,
          history,
          layoutVersion: candidate.layoutVersion,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    updateBarrierData: (id, patch) => {
      const prevSnapshot = snapshotFromState(get());
      let changed = false;
      set((state) => {
        const nextBarriers = state.barriers.map((barrier) => {
          if (barrier.id !== id) {
            return barrier;
          }
          const hasBreachedItems = patch.breachedItems !== undefined;
          const nextBarrier = {
            ...barrier,
            ...patch,
            breachedItems: hasBreachedItems
              ? [...(patch.breachedItems ?? [])]
              : barrier.breachedItems,
          } satisfies Barrier;
          if (JSON.stringify(nextBarrier) === JSON.stringify(barrier)) {
            return barrier;
          }
          changed = true;
          return nextBarrier;
        });
        if (!changed) {
          return {};
        }
        const candidate = {
          ...state,
          barriers: nextBarriers,
        } satisfies AppState;
        const nextSnapshot = snapshotFromState(candidate);
        const history = updateHistoryState(
          state,
          prevSnapshot,
          !snapshotsEqual(prevSnapshot, nextSnapshot),
        );
        return {
          barriers: nextBarriers,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    clearViewportRequest: (id) => {
      set((state) =>
        state.viewportRequest?.id === id ? { viewportRequest: null } : {},
      );
    },
    requestEditorFocus: (nodeId, field) => {
      set({
        editorFocusRequest: { id: nextEditorFocusRequestId++, nodeId, field },
      });
    },
    clearEditorFocusRequest: (id) => {
      set((state) =>
        state.editorFocusRequest?.id === id ? { editorFocusRequest: null } : {},
      );
    },
    undo: () => {
      set((state) => {
        if (state.history.past.length === 0) {
          return {};
        }
        const previous = state.history.past[state.history.past.length - 1];
        const past = state.history.past.slice(0, -1);
        const currentSnapshot = snapshotFromState(state);
        const history: HistoryState = {
          past,
          future: [currentSnapshot, ...state.history.future],
        };
        resetMoveDebounce();
        const applied = applyHistorySnapshot(previous);
        return {
          ...applied,
          editingId: null,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
    redo: () => {
      set((state) => {
        if (state.history.future.length === 0) {
          return {};
        }
        const [next, ...remainingFuture] = state.history.future;
        const currentSnapshot = snapshotFromState(state);
        const history: HistoryState = {
          past: [...state.history.past, currentSnapshot],
          future: remainingFuture,
        };
        resetMoveDebounce();
        const applied = applyHistorySnapshot(next);
        return {
          ...applied,
          editingId: null,
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
    },
  },
}));
