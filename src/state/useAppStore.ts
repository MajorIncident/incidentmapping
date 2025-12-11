import { create } from "zustand";
import type { Edge, Node, XYPosition } from "reactflow";
import { emptyMap, sampleMap } from "../features/maps/fixtures";
import type { Barrier, ChainNode, MapData } from "../features/maps/schema";
import { createId } from "../lib/id";

export type ChainNodeData = {
  title: string;
  description?: string;
  owner?: string;
  timestamp?: string;
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
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
    setMapTitle: (title: string) => void;
    renameNode: (id: string, title: string) => boolean;
    moveNode: (id: string, position: XYPosition) => void;
    nudgeNodeBy: (id: string, dx: number, dy: number) => void;
    deleteNode: (id: string) => void;
    deleteSelection: () => void;
    select: (id: string | null) => void;
    startEditing: (id: string) => void;
    finishEditing: () => void;
    setShowDetails: (visible: boolean) => void;
    toggleShowDetails: () => void;
    updateNodeData: (
      id: string,
      patch: Partial<Omit<ChainNodeData, "title">>,
    ) => void;
    undo: () => void;
    redo: () => void;
  };
};

export const GRID_SIZE = 8;

const MOVE_DEBOUNCE_MS = 200;
const MIN_VERTICAL_MARGIN = 24;
const MIN_HORIZONTAL_MARGIN = 24;
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 140;
const DETAILS_HEIGHT = 140;

let moveDebounceActive = false;
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetMoveDebounce = () => {
  moveDebounceActive = false;
  if (moveDebounceTimer) {
    clearTimeout(moveDebounceTimer);
    moveDebounceTimer = null;
  }
};

const snapPosition = ({ x, y }: XYPosition): XYPosition => ({
  x: Math.round(x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(y / GRID_SIZE) * GRID_SIZE,
});

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
    type: "default",
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

const getEstimatedSize = (
  node: Node<ChainNodeData>,
  showDetails: boolean,
): { width: number; height: number } => ({
  width: node.width ?? DEFAULT_NODE_WIDTH,
  height:
    node.height ??
    (showDetails ? DEFAULT_NODE_HEIGHT + DETAILS_HEIGHT : DEFAULT_NODE_HEIGHT),
});

const overlapsWithMargin = (
  a: Node<ChainNodeData>,
  b: Node<ChainNodeData>,
  showDetails: boolean,
) => {
  const aSize = getEstimatedSize(a, showDetails);
  const bSize = getEstimatedSize(b, showDetails);
  return (
    a.position.x < b.position.x + bSize.width + MIN_HORIZONTAL_MARGIN &&
    a.position.x + aSize.width + MIN_HORIZONTAL_MARGIN > b.position.x &&
    a.position.y < b.position.y + bSize.height + MIN_VERTICAL_MARGIN &&
    a.position.y + aSize.height + MIN_VERTICAL_MARGIN > b.position.y
  );
};

const layoutNodes = (
  nodes: Node<ChainNodeData>[],
  showDetails: boolean,
): Node<ChainNodeData>[] => {
  const sorted = [...nodes].sort((a, b) =>
    a.position.y === b.position.y
      ? a.position.x - b.position.x
      : a.position.y - b.position.y,
  );

  const positioned = new Map<string, Node<ChainNodeData>>();

  sorted.forEach((node) => {
    let candidate: Node<ChainNodeData> = { ...node };
    const attempts = nodes.length * 4;

    for (let i = 0; i < attempts; i += 1) {
      const colliding = Array.from(positioned.values()).find((other) =>
        overlapsWithMargin(candidate, other, showDetails),
      );

      if (!colliding) {
        break;
      }

      const collidingSize = getEstimatedSize(colliding, showDetails);

      const shiftRight = {
        ...candidate,
        position: snapPosition({
          x: colliding.position.x + collidingSize.width + MIN_HORIZONTAL_MARGIN,
          y: candidate.position.y,
        }),
      };

      if (!overlapsWithMargin(shiftRight, colliding, showDetails)) {
        candidate = shiftRight;
        continue;
      }

      candidate = {
        ...candidate,
        position: snapPosition({
          x: candidate.position.x,
          y: colliding.position.y + collidingSize.height + MIN_VERTICAL_MARGIN,
        }),
      };
    }

    positioned.set(candidate.id, candidate);
  });

  return nodes.map((node) => positioned.get(node.id) ?? node);
};

const applyLayout = (
  nodes: Node<ChainNodeData>[],
  showDetails: boolean,
): { nodes: Node<ChainNodeData>[]; changed: boolean } => {
  const laidOut = layoutNodes(nodes, showDetails);
  const previousPositions = new Map(
    nodes.map((node) => [node.id, `${node.position.x}-${node.position.y}`]),
  );
  const changed = laidOut.some((node) => {
    const previous = previousPositions.get(node.id);
    return previous !== `${node.position.x}-${node.position.y}`;
  });
  return { nodes: laidOut, changed };
};

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

const createEmptyState = () => ({
  nodes: mapNodesToReactNodes(emptyMap.nodes),
  edges: mapEdgesToReactEdges(emptyMap),
  metadata: emptyMap.metadata ? { ...emptyMap.metadata } : undefined,
  barriers: emptyMap.barriers ? [...emptyMap.barriers] : [],
  selectionId: null,
  editingId: null,
  showDetails: true,
  layoutVersion: 0,
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
        nodes: applyLayout(mapNodesToReactNodes(map.nodes), state.showDetails)
          .nodes,
        edges: mapEdgesToReactEdges(map),
        metadata: map.metadata ? { ...map.metadata } : undefined,
        barriers: map.barriers ? [...map.barriers] : [],
        selectionId: map.nodes[0]?.id ?? null,
        editingId: null,
        showDetails: state.showDetails,
        layoutVersion: state.layoutVersion + 1,
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
      const created = get().actions.addChild(parentId);
      if (created) {
        get().actions.startEditing(created);
      }
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
        const basePosition = parentNode
          ? {
              x: parentNode.position.x,
              y: parentNode.position.y + 160,
            }
          : { x: 0, y: 0 };
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
        const nextEdges = parentNode
          ? [
              ...state.edges,
              {
                id: createId("edge"),
                source: parentNode.id,
                target: newNodeId,
                type: "default",
                data: { kind: "CauseEffectEdge" },
              },
            ]
          : state.edges;
        created = true;
        const { nodes: laidOutNodes, changed: layoutChanged } = applyLayout(
          nextNodes,
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
                type: "default",
                data: { kind: "CauseEffectEdge" },
              },
            ]
          : state.edges;
        created = true;
        const { nodes: laidOutNodes, changed: layoutChanged } = applyLayout(
          nextNodes,
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
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return created ? newNodeId : null;
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

        const candidate = {
          ...state,
          nodes: remainingNodes,
          edges: remainingEdges,
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
      get().actions.deleteNode(selectionId);
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
