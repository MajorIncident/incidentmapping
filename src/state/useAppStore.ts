import { create } from "zustand";
import type { Edge, Node, XYPosition } from "reactflow";
import type {
  Barrier,
  ChainNode,
  MapData,
  MapDataV1,
  RelationshipEdge,
} from "../features/maps/schema";
import { parseAndMigrateMapData } from "../features/maps/migration";
import { createId } from "../lib/id";
import {
  applyHierarchyLayout,
  getNodeSize,
  snapPosition,
  VERTICAL_GAP,
} from "../features/layout/hierarchy";

export { GRID_SIZE } from "../features/layout/hierarchy";

export type ChainNodeData = {
  referenceId?: string;
  nodeType?: ChainNode["nodeType"];
  title: string;
  description?: string;
  owner?: string;
  timestamp?: string;
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  evidenceItems?: ChainNode["evidenceItems"];
  severity?: ChainNode["severity"];
  incidentStatus?: ChainNode["incidentStatus"];
  factorCategory?: ChainNode["factorCategory"];
  factorSignificance?: ChainNode["factorSignificance"];
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
  status: Barrier["status"];
  failureReason?: Barrier["failureReason"];
  failureDetails?: string;
  /** Compatibility view used by the current barrier editor; never persisted. */
  breached?: boolean;
  breachedItems?: string[];
};

type RuntimeBarrier = Barrier & {
  breached?: boolean;
  breachedItems?: string[];
};

type HistoryEntry = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: MapData["metadata"];
  barriers: RuntimeBarrier[];
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
  barriers: RuntimeBarrier[];
  selectionId: string | null;
  editingId: string | null;
  showDetails: boolean;
  layoutVersion: number;
  viewportRequest: { id: number; nodeIds: string[] } | null;
  editorFocusRequest: {
    id: number;
    entityId: string;
    field: "title" | "description" | "barrier-description";
  } | null;
  history: HistoryState;
  canUndo: boolean;
  canRedo: boolean;
  actions: {
    newMap: () => void;
    loadMap: (map: MapData | MapDataV1) => void;
    toMap: () => MapData;
    addChainNode: (options?: { parentId?: string }) => void;
    addChild: (parentId?: string) => string | null;
    addSibling: (siblingId?: string) => string | null;
    addBarrier: (
      upstreamNodeId: string,
      downstreamNodeId: string,
    ) => string | null;
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
        Pick<
          RuntimeBarrier,
          | "status"
          | "failureReason"
          | "failureDetails"
          | "description"
          | "breached"
          | "breachedItems"
        >
      >,
      options?: { debounceHistory?: boolean },
    ) => void;
    undo: () => void;
    redo: () => void;
    clearViewportRequest: (id: number) => void;
    requestEditorFocus: (
      entityId: string,
      field: "title" | "description" | "barrier-description",
    ) => void;
    clearEditorFocusRequest: (id: number) => void;
  };
};

const MOVE_DEBOUNCE_MS = 200;
const TEXT_EDIT_DEBOUNCE_MS = 500;

let moveDebounceActive = false;
let nextEditorFocusRequestId = 1;
let nextNewMapViewportRequestId = 1;
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let textEditDebounceKey: string | null = null;
let textEditDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetMoveDebounce = () => {
  moveDebounceActive = false;
  if (moveDebounceTimer) {
    clearTimeout(moveDebounceTimer);
    moveDebounceTimer = null;
  }
};

const resetTextEditDebounce = () => {
  textEditDebounceKey = null;
  if (textEditDebounceTimer) {
    clearTimeout(textEditDebounceTimer);
    textEditDebounceTimer = null;
  }
};

const chainNodeToReactNode = (node: ChainNode): Node<ChainNodeData> => ({
  id: node.id,
  type: "ChainNode",
  position: snapPosition(node.position),
  data: {
    title: node.title,
    referenceId: node.referenceId,
    nodeType: node.nodeType,
    description: node.description,
    owner: node.owner,
    timestamp: node.timestamp,
    positiveConsequenceBulletPoints: node.positiveConsequenceBulletPoints ?? [],
    negativeConsequenceBulletPoints: node.negativeConsequenceBulletPoints ?? [],
    evidenceItems: node.evidenceItems.map((item) => ({ ...item })),
    severity: node.severity,
    incidentStatus: node.incidentStatus,
    factorCategory: node.factorCategory,
    factorSignificance: node.factorSignificance,
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
    data: {
      kind: edge.kind,
      ...(edge.kind === "ActionEdge" && edge.status
        ? { status: edge.status }
        : {}),
    },
  }));

const serializeNodes = (nodes: Node<ChainNodeData>[]): ChainNode[] =>
  nodes.map((node) => ({
    id: node.id,
    kind: "ChainNode",
    title: node.data.title,
    referenceId: node.data.referenceId ?? "N-001",
    nodeType: node.data.nodeType ?? "Event",
    description: node.data.description,
    owner: node.data.owner,
    timestamp: node.data.timestamp,
    positiveConsequenceBulletPoints: node.data.positiveConsequenceBulletPoints,
    negativeConsequenceBulletPoints: node.data.negativeConsequenceBulletPoints,
    evidenceItems: (node.data.evidenceItems ?? []).map((item) => ({ ...item })),
    severity: node.data.severity,
    incidentStatus: node.data.incidentStatus,
    factorCategory: node.data.factorCategory,
    factorSignificance: node.data.factorSignificance,
    position: snapPosition(node.position),
  }));

const cloneNode = (node: Node<ChainNodeData>): Node<ChainNodeData> => ({
  ...node,
  position: { ...node.position },
  data: {
    ...node.data,
    positiveConsequenceBulletPoints: [
      ...node.data.positiveConsequenceBulletPoints,
    ],
    negativeConsequenceBulletPoints: [
      ...node.data.negativeConsequenceBulletPoints,
    ],
    evidenceItems: (node.data.evidenceItems ?? []).map((item) => ({ ...item })),
  },
});

const cloneEdge = (edge: Edge): Edge => ({
  ...edge,
  data: edge.data ? { ...edge.data } : undefined,
});

const cloneBarrier = (barrier: RuntimeBarrier): RuntimeBarrier => ({
  ...barrier,
  breachedItems: barrier.breachedItems ? [...barrier.breachedItems] : undefined,
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
  options?: { debounce?: "move" | "text" | null; debounceKey?: string },
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

  if (options?.debounce === "text") {
    const key = options.debounceKey ?? "text";
    const history =
      textEditDebounceKey === key
        ? state.history
        : pushHistory(state.history, prevSnapshot);
    textEditDebounceKey = key;
    textEditDebounceTimer && clearTimeout(textEditDebounceTimer);
    textEditDebounceTimer = setTimeout(() => {
      textEditDebounceKey = null;
      textEditDebounceTimer = null;
    }, TEXT_EDIT_DEBOUNCE_MS);
    return history;
  }

  resetMoveDebounce();
  resetTextEditDebounce();
  return pushHistory(state.history, prevSnapshot);
};

const computeParentId = (edges: Edge[], childId: string): string | null => {
  const parentEdge = edges.find((edge) => edge.target === childId);
  return parentEdge ? parentEdge.source : null;
};

export const findDownstreamEdges = (
  edges: Edge[],
  upstreamId: string,
): Edge[] => edges.filter((edge) => edge.source === upstreamId);

/** Creates the initial event for an interactive map without mutating a fixture. */
export const createRootNode = (): ChainNode => ({
  id: createId("node"),
  kind: "ChainNode",
  title: "New incident",
  referenceId: "N-001",
  nodeType: "Event",
  description: "",
  positiveConsequenceBulletPoints: [],
  negativeConsequenceBulletPoints: [],
  evidenceItems: [],
  position: snapPosition({ x: 0, y: 0 }),
});

/** Creates a fresh interactive map; imported maps may still legitimately be empty. */
export const createNewMap = (): MapData => ({
  schemaVersion: 2,
  metadata: { title: "Untitled Map" },
  nodes: [createRootNode()],
  edges: [],
  barriers: [],
});

export const createNewMapState = () => {
  const map = createNewMap();
  const rootId = map.nodes[0].id;
  return {
    nodes: mapNodesToReactNodes(map.nodes),
    edges: mapEdgesToReactEdges(map),
    metadata: map.metadata ? { ...map.metadata } : undefined,
    barriers: map.barriers ? [...map.barriers] : [],
    selectionId: rootId,
    editingId: rootId,
    showDetails: true,
    layoutVersion: 0,
    viewportRequest: { id: nextNewMapViewportRequestId++, nodeIds: [rootId] },
    editorFocusRequest: {
      id: nextEditorFocusRequestId++,
      entityId: rootId,
      field: "title" as const,
    },
    history: createEmptyHistory(),
    canUndo: false,
    canRedo: false,
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  ...createNewMapState(),
  actions: {
    newMap: () => {
      resetMoveDebounce();
      resetTextEditDebounce();
      set((state) => ({
        ...createNewMapState(),
        showDetails: state.showDetails,
      }));
    },
    loadMap: (input) => {
      const map = parseAndMigrateMapData(input);
      resetMoveDebounce();
      resetTextEditDebounce();
      set((state) => ({
        nodes: applyLayout(
          mapNodesToReactNodes(map.nodes),
          mapEdgesToReactEdges(map),
          state.showDetails,
        ).nodes,
        edges: mapEdgesToReactEdges(map),
        metadata: map.metadata ? { ...map.metadata } : undefined,
        barriers: map.barriers.map((barrier) => ({
          ...barrier,
          breached: barrier.status === "Failed",
          breachedItems: barrier.failureDetails?.split("\n") ?? [],
        })),
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
        schemaVersion: 2,
        metadata,
        nodes: serializeNodes(nodes),
        edges: edges.map(
          (edge): RelationshipEdge =>
            edge.data?.kind === "ActionEdge"
              ? {
                  id: edge.id,
                  kind: "ActionEdge",
                  fromId: edge.source,
                  toId: edge.target,
                  status: edge.data.status,
                }
              : {
                  id: edge.id,
                  kind: "CauseEffectEdge",
                  fromId: edge.source,
                  toId: edge.target,
                },
        ),
        barriers: barriers.map((barrier) => {
          const description = barrier.description?.trim();
          return {
            id: barrier.id,
            kind: barrier.kind,
            upstreamNodeId: barrier.upstreamNodeId,
            downstreamNodeId: barrier.downstreamNodeId,
            status:
              barrier.breached === undefined
                ? barrier.status
                : barrier.breached
                  ? ("Failed" as const)
                  : ("Effective" as const),
            failureReason: barrier.failureReason,
            failureDetails: barrier.breachedItems
              ? barrier.breachedItems.filter(Boolean).join("\n") || undefined
              : barrier.failureDetails,
            description: description?.length ? description : undefined,
          };
        }),
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
            title: "New Event",
            referenceId: `N-${String(state.nodes.length + 1).padStart(3, "0")}`,
            nodeType: "Event",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
            evidenceItems: [],
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
            entityId: newNodeId,
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
            title: "New Event",
            referenceId: `N-${String(state.nodes.length + 1).padStart(3, "0")}`,
            nodeType: "Event",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
            evidenceItems: [],
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
            entityId: newNodeId,
            field: "title",
          },
          history,
          canUndo: history.past.length > 0,
          canRedo: history.future.length > 0,
        };
      });
      return created ? newNodeId : null;
    },
    addBarrier: (upstreamNodeId, downstreamNodeId) => {
      const prevSnapshot = snapshotFromState(get());
      let createdId: string | null = null;
      set((state) => {
        const matchingEdge = findDownstreamEdges(
          state.edges,
          upstreamNodeId,
        ).find((edge) => edge.target === downstreamNodeId);
        if (!matchingEdge) {
          return {};
        }
        const alreadyExists = state.barriers.some(
          (barrier) =>
            barrier.upstreamNodeId === upstreamNodeId &&
            barrier.downstreamNodeId === downstreamNodeId,
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
            upstreamNodeId,
            downstreamNodeId,
            status: "Failed" as const,
            breached: true,
            breachedItems: [],
          },
        ];
        const candidate = {
          ...state,
          barriers: nextBarriers,
          selectionId: barrierId,
          editingId: null,
          editorFocusRequest: {
            id: nextEditorFocusRequestId++,
            entityId: barrierId,
            field: "barrier-description",
          },
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
          editorFocusRequest: candidate.editorFocusRequest,
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
      const { selectionId, edges } = get();
      if (!selectionId) {
        return;
      }
      const barrier = get().barriers.find((item) => item.id === selectionId);
      if (barrier) {
        get().actions.removeBarrier(selectionId);
        return;
      }
      const descendants = new Set<string>();
      const pending = edges
        .filter((edge) => edge.source === selectionId)
        .map((edge) => edge.target);
      while (pending.length) {
        const id = pending.pop()!;
        if (descendants.has(id)) continue;
        descendants.add(id);
        pending.push(
          ...edges
            .filter((edge) => edge.source === id)
            .map((edge) => edge.target),
        );
      }
      if (
        descendants.size > 0 &&
        !window.confirm(
          `Delete this event and its ${descendants.size} descendant${descendants.size === 1 ? "" : "s"}? This will remove the entire branch.`,
        )
      ) {
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
    updateBarrierData: (id, patch, options) => {
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
          } satisfies RuntimeBarrier;
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
          options?.debounceHistory
            ? { debounce: "text", debounceKey: `barrier:${id}:description` }
            : undefined,
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
    requestEditorFocus: (entityId, field) => {
      set({
        editorFocusRequest: { id: nextEditorFocusRequestId++, entityId, field },
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
