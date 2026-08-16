import { create } from "zustand";
import type { Edge, Node, XYPosition } from "reactflow";
import type {
  Attachment,
  ChainNode,
  ContextItem,
  EvidenceItem,
  MapData,
  RelationshipEdge,
} from "../features/maps/schema";
import { parseAndMigrateMapData } from "../features/maps/migration";
import { createId } from "../lib/id";
import {
  applyHierarchyLayout,
  ACTION_HORIZONTAL_GAP,
  ACTION_VERTICAL_GAP,
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
  endTimestamp?: ChainNode["endTimestamp"];
  eventDisplay?: ChainNode["eventDisplay"];
  positiveConsequenceBulletPoints: string[];
  negativeConsequenceBulletPoints: string[];
  evidenceItems?: Array<{ id: string; text: string }>;
  evidenceIds?: string[];
  contextItems?: ChainNode["contextItems"];
  severity?: ChainNode["severity"];
  factorCategory?: ChainNode["factorCategory"];
  factorSignificance?: ChainNode["factorSignificance"];
  assertionState?: ChainNode["assertionState"];
  actionStatus?: ChainNode["actionStatus"];
  actionDueDate?: ChainNode["actionDueDate"];
  actionCompletedAt?: ChainNode["actionCompletedAt"];
  eventPhase?: ChainNode["eventPhase"];
  actionType?: ChainNode["actionType"];
  /** Ephemeral canvas-only styling hints. This field is never serialized. */
  graphRole?: {
    isRoot: boolean;
    isLeaf: boolean;
    isOnSelectedPath: boolean;
    isUnrelated: boolean;
  };
  /** Ephemeral view-only flag. This field is never serialized. */
  readOnly?: boolean;
  /** Ephemeral detail visibility resolved by the canvas for this view. */
  viewShowDetails?: boolean;
};

export type BarrierNodeData = {
  kind: "Barrier";
  upstreamNodeId: string;
  downstreamNodeId: string;
  description?: string;
  status: RuntimeBarrier["status"];
  failureReason?: RuntimeBarrier["failureReason"];
  failureDetails?: string;
  referenceId?: string;
  controlRole?: RuntimeBarrier["controlRole"];
  assertionState?: RuntimeBarrier["assertionState"];
  evidenceIds?: string[];
  readOnly?: boolean;
  /** Ephemeral detail visibility resolved by the canvas for this view. */
  viewShowDetails?: boolean;
  graphRole?: {
    isOnSelectedPath: boolean;
    isUnrelated: boolean;
  };
};

type RuntimeBarrier = MapData["barriers"][number];
type RuntimeMetadata = Omit<
  NonNullable<MapData["metadata"]>,
  "contextItems"
> & {
  contextItems?: NonNullable<MapData["metadata"]>["contextItems"];
};

type HistoryEntry = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: RuntimeMetadata | undefined;
  barriers: RuntimeBarrier[];
  evidence: EvidenceItem[];
  attachments: Attachment[];
  selectionId: string | null;
};

type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

type EvidenceDraft = Omit<EvidenceItem, "id" | "attachmentIds"> & {
  attachmentIds?: string[];
};

type AppState = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: RuntimeMetadata | undefined;
  barriers: RuntimeBarrier[];
  evidence: EvidenceItem[];
  attachments: Attachment[];
  selectionId: string | null;
  editingId: string | null;
  showDetails: boolean;
  layoutVersion: number;
  measuredControlDimensions: Record<string, { width: number; height: number }>;
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
    loadMap: (map: unknown) => void;
    toMap: () => MapData;
    addChainNode: (options?: { parentId?: string }) => void;
    addChild: (parentId?: string) => string | null;
    addSibling: (siblingId?: string) => string | null;
    addAction: (sourceId?: string) => string | null;
    addBarrier: (
      upstreamNodeId: string,
      downstreamNodeId: string,
    ) => string | null;
    setMapTitle: (title: string) => void;
    updateMetadata: (patch: Partial<NonNullable<MapData["metadata"]>>) => void;
    setNodeType: (id: string, value: ChainNode["nodeType"]) => void;
    setFactorCategory: (
      id: string,
      value?: ChainNode["factorCategory"],
    ) => void;
    setFactorSignificance: (
      id: string,
      value?: ChainNode["factorSignificance"],
    ) => void;
    setNodeActionStatus: (
      id: string,
      value?: ChainNode["actionStatus"],
    ) => void;
    setNodeActionDueDate: (id: string, dueDate?: string) => void;
    setEventPhase: (id: string, value?: ChainNode["eventPhase"]) => void;
    setActionType: (id: string, value?: ChainNode["actionType"]) => void;
    setControlRole: (id: string, value?: RuntimeBarrier["controlRole"]) => void;
    addContext: (
      target: "incident" | string,
      label: string,
      value: string,
      showOnCard?: boolean,
    ) => string | null;
    updateContext: (
      target: "incident" | string,
      contextId: string,
      patch: Partial<Omit<ContextItem, "id">>,
    ) => boolean;
    deleteContext: (target: "incident" | string, contextId: string) => void;
    toggleContextShowOnCard: (
      target: "incident" | string,
      contextId: string,
    ) => void;
    createEvidence: (item: EvidenceDraft) => string | null;
    createAndLinkEvidence: (
      target: { kind: "node" | "control"; id: string },
      item: EvidenceDraft,
    ) => string | null;
    editEvidence: (
      id: string,
      patch: Partial<Omit<EvidenceItem, "id">>,
    ) => boolean;
    linkEvidenceToNode: (nodeId: string, evidenceId: string) => boolean;
    unlinkEvidenceFromNode: (nodeId: string, evidenceId: string) => void;
    linkEvidenceToControl: (controlId: string, evidenceId: string) => boolean;
    unlinkEvidenceFromControl: (controlId: string, evidenceId: string) => void;
    deleteEvidence: (evidenceId: string) => void;
    addEvidence: (nodeId: string, text: string) => string | null;
    updateEvidence: (
      nodeId: string,
      evidenceId: string,
      text: string,
    ) => boolean;
    removeEvidence: (nodeId: string, evidenceId: string) => void;
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
    applyMeasuredLayout: (
      dimensions: Readonly<Record<string, { width: number; height: number }>>,
    ) => void;
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
          | "controlRole"
          | "evidenceIds"
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
const CONTROL_REFERENCE_PATTERN = /^C-(\d{3,})$/;

const controlReferenceNumber = (referenceId?: string): number => {
  const match = referenceId?.match(CONTROL_REFERENCE_PATTERN);
  const value = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
};

const formatControlReference = (value: number) =>
  `C-${String(value).padStart(3, "0")}`;

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

const chainNodeToReactNode = (
  node: ChainNode,
  evidence: MapData["evidence"],
): Node<ChainNodeData> => ({
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
    endTimestamp: node.endTimestamp,
    eventDisplay: node.eventDisplay,
    positiveConsequenceBulletPoints: node.positiveConsequenceBulletPoints ?? [],
    negativeConsequenceBulletPoints: node.negativeConsequenceBulletPoints ?? [],
    evidenceItems: node.evidenceIds.map((id) => {
      const item = evidence.find((candidate) => candidate.id === id)!;
      return { id, text: item.title };
    }),
    evidenceIds: [...node.evidenceIds],
    contextItems: node.contextItems.map((item) => ({ ...item })),
    severity: node.severity,
    factorCategory: node.factorCategory,
    factorSignificance: node.factorSignificance,
    assertionState: node.assertionState,
    actionStatus: node.actionStatus,
    actionDueDate: node.actionDueDate,
    actionCompletedAt: node.actionCompletedAt,
    eventPhase: node.eventPhase,
    actionType: node.actionType,
  },
});

const mapNodesToReactNodes = (map: MapData): Node<ChainNodeData>[] =>
  map.nodes.map((node) => chainNodeToReactNode(node, map.evidence));

const mapEdgesToReactEdges = (map: MapData): Edge[] =>
  map.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    type: "step",
    sourceHandle: edge.kind === "ActionEdge" ? "right" : "bottom",
    targetHandle: edge.kind === "ActionEdge" ? "left" : "top",
    data: { kind: edge.kind },
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
    endTimestamp: node.data.endTimestamp,
    eventDisplay:
      (node.data.nodeType ?? "Event") === "Event"
        ? (node.data.eventDisplay ?? "Map")
        : undefined,
    positiveConsequenceBulletPoints: node.data.positiveConsequenceBulletPoints,
    negativeConsequenceBulletPoints: node.data.negativeConsequenceBulletPoints,
    evidenceIds: [
      ...(node.data.evidenceIds ??
        (node.data.evidenceItems ?? []).map((item) => item.id)),
    ],
    contextItems: (node.data.contextItems ?? []).map((item) => ({ ...item })),
    severity: node.data.severity,
    factorCategory: node.data.factorCategory,
    factorSignificance: node.data.factorSignificance,
    assertionState: node.data.assertionState,
    actionStatus: node.data.actionStatus,
    actionDueDate: node.data.actionDueDate,
    actionCompletedAt: node.data.actionCompletedAt,
    eventPhase: node.data.eventPhase,
    actionType: node.data.actionType,
    position: snapPosition(node.position),
  }));

const cloneNode = (node: Node<ChainNodeData>): Node<ChainNodeData> => {
  const {
    graphRole: _graphRole,
    readOnly: _readOnly,
    ...persistedData
  } = node.data;
  return {
    ...node,
    position: { ...node.position },
    data: {
      ...persistedData,
      positiveConsequenceBulletPoints: [
        ...node.data.positiveConsequenceBulletPoints,
      ],
      negativeConsequenceBulletPoints: [
        ...node.data.negativeConsequenceBulletPoints,
      ],
      evidenceItems: (node.data.evidenceItems ?? []).map((item) => ({
        ...item,
      })),
      evidenceIds: [...(node.data.evidenceIds ?? [])],
      contextItems: (node.data.contextItems ?? []).map((item) => ({ ...item })),
    },
  };
};

const cloneEdge = (edge: Edge): Edge => ({
  ...edge,
  data: edge.data ? { ...edge.data } : undefined,
});

const cloneBarrier = (barrier: RuntimeBarrier): RuntimeBarrier => ({
  ...barrier,
  evidenceIds: [...barrier.evidenceIds],
});

const cloneEvidence = (item: EvidenceItem): EvidenceItem => ({
  ...item,
  attachmentIds: [...(item.attachmentIds ?? [])],
});
const cloneAttachment = (item: Attachment): Attachment => ({ ...item });
const cloneMetadata = (metadata: RuntimeMetadata | undefined) =>
  metadata
    ? {
        ...metadata,
        contextItems: (metadata.contextItems ?? []).map((item) => ({
          ...item,
        })),
      }
    : undefined;

const snapshotFromState = (state: AppState): HistoryEntry => ({
  nodes: state.nodes.map(cloneNode),
  edges: state.edges.map(cloneEdge),
  metadata: cloneMetadata(state.metadata),
  barriers: state.barriers.map(cloneBarrier),
  evidence: state.evidence.map(cloneEvidence),
  attachments: state.attachments.map(cloneAttachment),
  selectionId: state.selectionId,
});

const snapshotsEqual = (a: HistoryEntry, b: HistoryEntry): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const applyLayout = (
  nodes: Node<ChainNodeData>[],
  edges: Edge[],
  showDetails: boolean,
  barriers: RuntimeBarrier[] = [],
  controlDimensions: Readonly<
    Record<string, { width: number; height: number }>
  > = {},
) => {
  const causalRelationships = new Set(
    edges
      .filter((edge) => edge.data?.kind !== "ActionEdge")
      .map((edge) => `${edge.source}\u0000${edge.target}`),
  );
  return applyHierarchyLayout(nodes, edges, {
    showDetails,
    controlDimensions,
    barrierEdges: barriers.filter((barrier) =>
      causalRelationships.has(
        `${barrier.upstreamNodeId}\u0000${barrier.downstreamNodeId}`,
      ),
    ),
  });
};

const createEmptyHistory = (): HistoryState => ({ past: [], future: [] });

const applyHistorySnapshot = (snapshot: HistoryEntry) => ({
  nodes: snapshot.nodes.map(cloneNode),
  edges: snapshot.edges.map(cloneEdge),
  metadata: cloneMetadata(snapshot.metadata),
  barriers: snapshot.barriers.map(cloneBarrier),
  evidence: snapshot.evidence.map(cloneEvidence),
  attachments: snapshot.attachments.map(cloneAttachment),
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
  const parentEdge = edges.find(
    (edge) => edge.target === childId && edge.data?.kind !== "ActionEdge",
  );
  return parentEdge ? parentEdge.source : null;
};

export const findDownstreamEdges = (
  edges: Edge[],
  upstreamId: string,
): Edge[] =>
  edges.filter(
    (edge) => edge.source === upstreamId && edge.data?.kind !== "ActionEdge",
  );

/** Creates the initial impact for an interactive map without mutating a fixture. */
export const createRootNode = (): ChainNode => ({
  id: createId("node"),
  kind: "ChainNode",
  title: "Undesirable outcome",
  referenceId: "N-001",
  nodeType: "Impact",
  description: "",
  positiveConsequenceBulletPoints: [],
  negativeConsequenceBulletPoints: [],
  evidenceIds: [],
  contextItems: [],
  position: snapPosition({ x: 0, y: 0 }),
});

/** Creates a fresh interactive map; imported maps may still legitimately be empty. */
export const createNewMap = (): MapData => ({
  schemaVersion: 4,
  metadata: {
    title: "Untitled Map",
    nodeReferenceHighWaterMark: 1,
    evidenceReferenceHighWaterMark: 0,
    controlReferenceHighWaterMark: 0,
    attachmentReferenceHighWaterMark: 0,
    contextItems: [],
  },
  nodes: [createRootNode()],
  edges: [],
  barriers: [],
  evidence: [],
  attachments: [],
});

export const createNewMapState = () => {
  const map = createNewMap();
  const rootId = map.nodes[0].id;
  return {
    nodes: mapNodesToReactNodes(map),
    edges: mapEdgesToReactEdges(map),
    metadata: map.metadata ? { ...map.metadata } : undefined,
    barriers: map.barriers ? [...map.barriers] : [],
    evidence: map.evidence.map(cloneEvidence),
    attachments: map.attachments.map(cloneAttachment),
    selectionId: rootId,
    editingId: rootId,
    showDetails: true,
    layoutVersion: 0,
    measuredControlDimensions: {},
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
      const runtimeNodes = mapNodesToReactNodes(map);
      const runtimeEdges = mapEdgesToReactEdges(map);
      const runtimeBarriers = map.barriers.map(cloneBarrier);
      resetMoveDebounce();
      resetTextEditDebounce();
      set((state) => ({
        nodes: applyLayout(
          runtimeNodes,
          runtimeEdges,
          state.showDetails,
          runtimeBarriers,
        ).nodes,
        edges: runtimeEdges,
        metadata: {
          ...(map.metadata ?? {}),
          nodeReferenceHighWaterMark: Math.max(
            map.metadata?.nodeReferenceHighWaterMark ?? 0,
            ...map.nodes.map((node) =>
              Number(node.referenceId.match(/N-(\d+)/)?.[1] ?? 0),
            ),
          ),
          evidenceReferenceHighWaterMark: Math.max(
            map.metadata?.evidenceReferenceHighWaterMark ?? 0,
            ...map.evidence.map((item) =>
              Number(item.id.match(/^EV-(\d+)$/)?.[1] ?? 0),
            ),
          ),
          controlReferenceHighWaterMark: Math.max(
            map.metadata?.controlReferenceHighWaterMark ?? 0,
            ...map.barriers.map((item) =>
              controlReferenceNumber(item.referenceId),
            ),
          ),
          attachmentReferenceHighWaterMark: Math.max(
            map.metadata?.attachmentReferenceHighWaterMark ?? 0,
            ...map.attachments.map((item) =>
              Number(item.id.match(/^AT-(\d+)$/)?.[1] ?? 0),
            ),
          ),
        },
        barriers: runtimeBarriers,
        evidence: map.evidence.map(cloneEvidence),
        attachments: map.attachments.map(cloneAttachment),
        selectionId: map.nodes[0]?.id ?? null,
        editingId: null,
        showDetails: state.showDetails,
        layoutVersion: state.layoutVersion + 1,
        measuredControlDimensions: {},
        viewportRequest: null,
        editorFocusRequest: null,
        history: createEmptyHistory(),
        canUndo: false,
        canRedo: false,
      }));
    },
    toMap: () => {
      const { nodes, edges, metadata, barriers, evidence, attachments } = get();
      return {
        schemaVersion: 4,
        metadata: metadata
          ? {
              ...metadata,
              contextItems: (metadata.contextItems ?? []).map((item) => ({
                ...item,
              })),
            }
          : undefined,
        nodes: serializeNodes(nodes),
        edges: edges.map(
          (edge): RelationshipEdge =>
            edge.data?.kind === "ActionEdge"
              ? {
                  id: edge.id,
                  kind: "ActionEdge",
                  fromId: edge.source,
                  toId: edge.target,
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
            status: barrier.status,
            failureReason: barrier.failureReason,
            failureDetails: barrier.failureDetails,
            description: description?.length ? description : undefined,
            referenceId: barrier.referenceId ?? "C-001",
            controlRole: barrier.controlRole,
            assertionState: barrier.assertionState,
            evidenceIds: [...barrier.evidenceIds],
          };
        }),
        evidence: evidence.map(cloneEvidence),
        attachments: attachments.map(cloneAttachment),
      };
    },
    addChainNode: (options) => {
      const parentId = options?.parentId;
      get().actions.addChild(parentId);
    },
    setMapTitle: (title) => get().actions.updateMetadata({ title }),
    updateMetadata: (patch) => {
      const normalized = Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [
          key,
          typeof value === "string"
            ? value.trim()
              ? value.trim()
              : undefined
            : value,
        ]),
      ) as Partial<NonNullable<MapData["metadata"]>>;
      const prevSnapshot = snapshotFromState(get());
      set((state) => {
        const metadata = { ...(state.metadata ?? {}), ...normalized };
        if (normalized.contextItems)
          metadata.contextItems = normalized.contextItems.map((item) => ({
            ...item,
          }));
        for (const key of Object.keys(metadata) as Array<
          keyof typeof metadata
        >) {
          if (metadata[key] === undefined) delete metadata[key];
        }
        if (JSON.stringify(metadata) === JSON.stringify(state.metadata ?? {}))
          return {};
        const history = updateHistoryState(state, prevSnapshot, true);
        return {
          metadata: Object.keys(metadata).length ? metadata : undefined,
          history,
          canUndo: history.past.length > 0,
          canRedo: false,
        };
      });
    },
    setNodeType: (id, value) => {
      const node = get().nodes.find((item) => item.id === id);
      if (
        !node ||
        node.data.nodeType === value ||
        node.data.nodeType === "Action" ||
        value === "Action"
      )
        return;
      // Causal-type conversion preserves universal narrative, Context and Evidence
      // fields, but drops every classification that is invalid for the destination.
      get().actions.updateNodeData(id, {
        nodeType: value,
        factorCategory: undefined,
        factorSignificance: value === "Factor" ? "Normal" : undefined,
        eventPhase: value === "Event" ? node.data.eventPhase : undefined,
        actionType: undefined,
        actionStatus: undefined,
        actionDueDate: undefined,
      });
    },
    setFactorCategory: (id, value) => {
      if (
        get().nodes.find((node) => node.id === id)?.data.nodeType === "Factor"
      )
        get().actions.updateNodeData(id, { factorCategory: value });
    },
    setFactorSignificance: (id, value) => {
      if (
        get().nodes.find((node) => node.id === id)?.data.nodeType === "Factor"
      )
        get().actions.updateNodeData(id, { factorSignificance: value });
    },
    setNodeActionStatus: (id, value) => {
      if (
        get().nodes.find((node) => node.id === id)?.data.nodeType === "Action"
      )
        get().actions.updateNodeData(id, { actionStatus: value });
    },
    setNodeActionDueDate: (id, dueDate) => {
      if (
        get().nodes.find((node) => node.id === id)?.data.nodeType === "Action"
      )
        get().actions.updateNodeData(id, {
          actionDueDate: dueDate?.trim() || undefined,
        });
    },
    setEventPhase: (id, value) => {
      const node = get().nodes.find((item) => item.id === id);
      if (node?.data.nodeType !== "Event") return;
      get().actions.updateNodeData(id, { eventPhase: value });
    },
    setActionType: (id, value) => {
      const node = get().nodes.find((item) => item.id === id);
      if (node?.data.nodeType !== "Action") return;
      get().actions.updateNodeData(id, { actionType: value });
    },
    setControlRole: (id, value) => {
      if (!get().barriers.some((item) => item.id === id)) return;
      get().actions.updateBarrierData(id, { controlRole: value });
    },
    addContext: (target, rawLabel, rawValue, showOnCard) => {
      const label = rawLabel.trim();
      const value = rawValue.trim();
      if (!label || !value) return null;
      const state = get();
      const node = state.nodes.find((item) => item.id === target);
      if (target !== "incident" && (!node || node.data.nodeType === "Action"))
        return null;
      const used = new Set(
        [
          ...(state.metadata?.contextItems ?? []),
          ...state.nodes.flatMap((item) => item.data.contextItems ?? []),
        ].map((item) => item.id),
      );
      let id = createId("context");
      while (used.has(id)) id = createId("context");
      const item: ContextItem = {
        id,
        label,
        value,
        displayMode: "Text",
        ...(showOnCard === undefined ? {} : { showOnCard }),
      };
      if (target === "incident")
        get().actions.updateMetadata({
          contextItems: [...(state.metadata?.contextItems ?? []), item],
        });
      else
        get().actions.updateNodeData(target, {
          contextItems: [...(node!.data.contextItems ?? []), item],
        });
      return id;
    },
    updateContext: (target, contextId, patch) => {
      const items =
        target === "incident"
          ? (get().metadata?.contextItems ?? [])
          : (get().nodes.find((item) => item.id === target)?.data
              .contextItems ?? []);
      if (!items.some((item) => item.id === contextId)) return false;
      const next = items.map((item) =>
        item.id === contextId
          ? {
              ...item,
              ...patch,
              label: patch.label?.trim() || item.label,
              value: patch.value?.trim() || item.value,
            }
          : item,
      );
      if (target === "incident")
        get().actions.updateMetadata({ contextItems: next });
      else get().actions.updateNodeData(target, { contextItems: next });
      return true;
    },
    deleteContext: (target, contextId) => {
      const items =
        target === "incident"
          ? (get().metadata?.contextItems ?? [])
          : (get().nodes.find((item) => item.id === target)?.data
              .contextItems ?? []);
      const next = items.filter((item) => item.id !== contextId);
      if (next.length === items.length) return;
      if (target === "incident")
        get().actions.updateMetadata({ contextItems: next });
      else get().actions.updateNodeData(target, { contextItems: next });
    },
    toggleContextShowOnCard: (target, contextId) => {
      const items =
        target === "incident"
          ? (get().metadata?.contextItems ?? [])
          : (get().nodes.find((item) => item.id === target)?.data
              .contextItems ?? []);
      const item = items.find((candidate) => candidate.id === contextId);
      if (!item) return;
      get().actions.updateContext(target, contextId, {
        showOnCard: !item.showOnCard,
      });
    },
    createEvidence: (input) => {
      const title = input.title.trim();
      if (!title) return null;
      const state = get();
      const highWater = Math.max(
        state.metadata?.evidenceReferenceHighWaterMark ?? 0,
        ...state.evidence.map((item) =>
          Number(item.id.match(/^EV-(\d+)$/)?.[1] ?? 0),
        ),
      );
      const id = `EV-${String(highWater + 1).padStart(3, "0")}`;
      const prev = snapshotFromState(state);
      set((current) => {
        const history = updateHistoryState(current, prev, true);
        return {
          evidence: [
            ...current.evidence,
            { ...input, attachmentIds: input.attachmentIds ?? [], title, id },
          ],
          metadata: {
            ...(current.metadata ?? {}),
            evidenceReferenceHighWaterMark: highWater + 1,
          },
          history,
          canUndo: true,
          canRedo: false,
        };
      });
      return id;
    },
    createAndLinkEvidence: (target, input) => {
      const title = input.title.trim();
      const state = get();
      const targetExists =
        target.kind === "node"
          ? state.nodes.some((node) => node.id === target.id)
          : state.barriers.some((control) => control.id === target.id);
      if (!title || !targetExists) return null;
      const highWater = Math.max(
        state.metadata?.evidenceReferenceHighWaterMark ?? 0,
        ...state.evidence.map((item) =>
          Number(item.id.match(/^EV-(\d+)$/)?.[1] ?? 0),
        ),
      );
      const id = `EV-${String(highWater + 1).padStart(3, "0")}`;
      const prev = snapshotFromState(state);
      set((current) => {
        const nodes = current.nodes.map((node) =>
          target.kind === "node" && node.id === target.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  evidenceIds: [...(node.data.evidenceIds ?? []), id],
                },
              }
            : node,
        );
        const barriers = current.barriers.map((control) =>
          target.kind === "control" && control.id === target.id
            ? { ...control, evidenceIds: [...control.evidenceIds, id] }
            : control,
        );
        return {
          nodes,
          barriers,
          evidence: [
            ...current.evidence,
            { ...input, attachmentIds: input.attachmentIds ?? [], title, id },
          ],
          metadata: {
            ...(current.metadata ?? {}),
            evidenceReferenceHighWaterMark: highWater + 1,
          },
          history: updateHistoryState(current, prev, true),
          canUndo: true,
          canRedo: false,
        };
      });
      return id;
    },
    editEvidence: (id, patch) => {
      const item = get().evidence.find((candidate) => candidate.id === id);
      if (!item) return false;
      const normalized = {
        ...patch,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      };
      if (normalized.title === "") return false;
      const prev = snapshotFromState(get());
      set((state) => {
        const evidence = state.evidence.map((candidate) =>
          candidate.id === id ? { ...candidate, ...normalized } : candidate,
        );
        if (JSON.stringify(evidence) === JSON.stringify(state.evidence))
          return {};
        const history = updateHistoryState(state, prev, true, {
          debounce: "text",
          debounceKey: `registry:${id}`,
        });
        const nodes = state.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            evidenceItems: node.data.evidenceItems?.map((linked) =>
              linked.id === id && normalized.title
                ? { ...linked, text: normalized.title }
                : linked,
            ),
          },
        }));
        return { evidence, nodes, history, canUndo: true, canRedo: false };
      });
      return true;
    },
    linkEvidenceToNode: (nodeId, evidenceId) => {
      const state = get();
      const node = state.nodes.find((item) => item.id === nodeId);
      if (
        !node ||
        !state.evidence.some((item) => item.id === evidenceId) ||
        (node.data.evidenceIds ?? []).includes(evidenceId)
      )
        return false;
      get().actions.updateNodeData(nodeId, {
        evidenceIds: [...(node.data.evidenceIds ?? []), evidenceId],
      });
      return true;
    },
    unlinkEvidenceFromNode: (nodeId, evidenceId) => {
      const node = get().nodes.find((item) => item.id === nodeId);
      if (node?.data.evidenceIds?.includes(evidenceId))
        get().actions.updateNodeData(nodeId, {
          evidenceIds: node.data.evidenceIds.filter((id) => id !== evidenceId),
          evidenceItems: (node.data.evidenceItems ?? []).filter(
            (item) => item.id !== evidenceId,
          ),
        });
    },
    linkEvidenceToControl: (controlId, evidenceId) => {
      const state = get();
      const control = state.barriers.find((item) => item.id === controlId);
      if (
        !control ||
        !state.evidence.some((item) => item.id === evidenceId) ||
        control.evidenceIds.includes(evidenceId)
      )
        return false;
      get().actions.updateBarrierData(controlId, {
        evidenceIds: [...control.evidenceIds, evidenceId],
      });
      return true;
    },
    unlinkEvidenceFromControl: (controlId, evidenceId) => {
      const control = get().barriers.find((item) => item.id === controlId);
      if (control?.evidenceIds.includes(evidenceId))
        get().actions.updateBarrierData(controlId, {
          evidenceIds: control.evidenceIds.filter((id) => id !== evidenceId),
        });
    },
    deleteEvidence: (evidenceId) => {
      const state = get();
      if (!state.evidence.some((item) => item.id === evidenceId)) return;
      const prev = snapshotFromState(state);
      set((current) => {
        const nodes = current.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            evidenceIds: (node.data.evidenceIds ?? []).filter(
              (id) => id !== evidenceId,
            ),
            evidenceItems: (node.data.evidenceItems ?? []).filter(
              (item) => item.id !== evidenceId,
            ),
          },
        }));
        const barriers = current.barriers.map((item) => ({
          ...item,
          evidenceIds: item.evidenceIds.filter((id) => id !== evidenceId),
        }));
        const history = updateHistoryState(current, prev, true);
        return {
          evidence: current.evidence.filter((item) => item.id !== evidenceId),
          nodes,
          barriers,
          history,
          canUndo: true,
          canRedo: false,
        };
      });
    },
    addEvidence: (nodeId, value) => {
      const title = value.trim();
      const state = get();
      if (!title || !state.nodes.some((item) => item.id === nodeId))
        return null;
      const highWater = Math.max(
        state.metadata?.evidenceReferenceHighWaterMark ?? 0,
        ...state.evidence.map((item) =>
          Number(item.id.match(/^EV-(\d+)$/)?.[1] ?? 0),
        ),
        ...state.nodes.flatMap((node) =>
          (node.data.evidenceItems ?? []).map((item) =>
            Number(item.id.match(/^EV-(\d+)$/)?.[1] ?? 0),
          ),
        ),
      );
      const id = `EV-${String(highWater + 1).padStart(3, "0")}`;
      const prev = snapshotFromState(state);
      set((current) => {
        const nodes = current.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  evidenceIds: [...(node.data.evidenceIds ?? []), id],
                  evidenceItems: [
                    ...(node.data.evidenceItems ?? []),
                    { id, text: title },
                  ],
                },
              }
            : node,
        );
        const history = updateHistoryState(current, prev, true);
        return {
          nodes,
          evidence: [
            ...current.evidence,
            { id, type: "Note", title, attachmentIds: [] },
          ],
          metadata: {
            ...(current.metadata ?? {}),
            evidenceReferenceHighWaterMark: highWater + 1,
          },
          history,
          canUndo: true,
          canRedo: false,
        };
      });
      return id;
    },
    updateEvidence: (nodeId, evidenceId, value) =>
      get().nodes.some(
        (node) =>
          node.id === nodeId &&
          (
            node.data.evidenceIds ??
            node.data.evidenceItems?.map((item) => item.id) ??
            []
          ).includes(evidenceId),
      )
        ? value.trim()
          ? get().actions.editEvidence(evidenceId, { title: value })
          : (get().actions.unlinkEvidenceFromNode(nodeId, evidenceId), false)
        : false,
    removeEvidence: (nodeId, evidenceId) =>
      get().actions.unlinkEvidenceFromNode(nodeId, evidenceId),
    addChild: (parentId) => {
      const initialParentId = parentId ?? get().selectionId ?? undefined;
      const newNodeId = createId("node");
      const prevSnapshot = snapshotFromState(get());
      let created = false;
      set((state) => {
        const parentNode = initialParentId
          ? (state.nodes.find((node) => node.id === initialParentId) ?? null)
          : null;
        if (parentNode?.data.nodeType === "Action") return {};
        const newNode: Node<ChainNodeData> = {
          id: newNodeId,
          type: "ChainNode",
          position: { x: 0, y: 0 },
          data: {
            title: "New Event",
            referenceId: `N-${String((state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1).padStart(3, "0")}`,
            nodeType: "Event",
            eventDisplay: "Map",
            eventPhase: "Incident",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
            evidenceItems: [],
            evidenceIds: [],
            contextItems: [],
          },
        };
        const outgoingChildCount = parentNode
          ? state.edges.filter(
              (edge) =>
                edge.source === parentNode.id &&
                edge.data?.kind !== "ActionEdge",
            ).length
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
          metadata: {
            ...(state.metadata ?? {}),
            nodeReferenceHighWaterMark:
              (state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1,
          },
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
          metadata: candidate.metadata,
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
    addAction: (sourceId) => {
      const targetSourceId = sourceId ?? get().selectionId ?? undefined;
      if (!targetSourceId) return null;
      const actionId = createId("node");
      const prevSnapshot = snapshotFromState(get());
      let created = false;
      set((state) => {
        const source = state.nodes.find((node) => node.id === targetSourceId);
        if (!source || source.data.nodeType === "Action") return {};
        const attachedActionIds = state.edges
          .filter(
            (edge) =>
              edge.source === source.id && edge.data?.kind === "ActionEdge",
          )
          .map((edge) => edge.target);
        const action: Node<ChainNodeData> = {
          id: actionId,
          type: "ChainNode",
          position: snapPosition({
            x:
              source.position.x +
              getNodeSize(source, state.showDetails).width +
              ACTION_HORIZONTAL_GAP,
            y:
              source.position.y +
              attachedActionIds.length *
                (getNodeSize(source, state.showDetails).height +
                  ACTION_VERTICAL_GAP),
          }),
          data: {
            title: "New Action",
            referenceId: `N-${String((state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1).padStart(3, "0")}`,
            nodeType: "Action",
            actionStatus: "Proposed",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
            evidenceItems: [],
            evidenceIds: [],
            contextItems: [],
          },
        };
        const edge: Edge = {
          id: createId("edge"),
          source: source.id,
          target: actionId,
          type: "step",
          sourceHandle: "right",
          targetHandle: "left",
          data: { kind: "ActionEdge" },
        };
        const nodes = [...state.nodes, action];
        const edges = [...state.edges, edge];
        const metadata = {
          ...(state.metadata ?? {}),
          nodeReferenceHighWaterMark:
            (state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1,
        };
        const history = updateHistoryState(state, prevSnapshot, true);
        created = true;
        return {
          nodes,
          edges,
          metadata,
          selectionId: actionId,
          editingId: actionId,
          editorFocusRequest: {
            id: nextEditorFocusRequestId++,
            entityId: actionId,
            field: "title" as const,
          },
          history,
          canUndo: true,
          canRedo: false,
        };
      });
      return created ? actionId : null;
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
        if (siblingNode.data.nodeType === "Action") return {};
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
            referenceId: `N-${String((state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1).padStart(3, "0")}`,
            nodeType: "Event",
            eventDisplay: "Map",
            eventPhase: "Incident",
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
            evidenceItems: [],
            evidenceIds: [],
            contextItems: [],
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
          metadata: {
            ...(state.metadata ?? {}),
            nodeReferenceHighWaterMark:
              (state.metadata?.nodeReferenceHighWaterMark ?? 0) + 1,
          },
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
          metadata: candidate.metadata,
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
        const nextControlReference =
          (state.metadata?.controlReferenceHighWaterMark ?? 0) + 1;
        const nextMetadata = {
          ...(state.metadata ?? {}),
          controlReferenceHighWaterMark: nextControlReference,
        };
        createdId = barrierId;
        const nextBarriers = [
          ...state.barriers,
          {
            id: barrierId,
            kind: "Barrier" as const,
            upstreamNodeId,
            downstreamNodeId,
            referenceId: formatControlReference(nextControlReference),
            status: "Failed" as const,
            evidenceIds: [],
          },
        ];
        const candidate = {
          ...state,
          barriers: nextBarriers,
          metadata: nextMetadata,
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
          metadata: nextMetadata,
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
            .filter(
              (edge) =>
                edge.source === nodeId && edge.data?.kind !== "ActionEdge",
            )
            .forEach((edge) => visit(edge.target));
        };

        const exists = state.nodes.some((node) => node.id === id);
        if (!exists) {
          return {};
        }

        visit(id);
        // Actions attached to a removed causal entity would otherwise be
        // orphaned, so remove them in the same atomic history operation.
        edges
          .filter(
            (edge) =>
              edge.data?.kind === "ActionEdge" && toRemove.has(edge.source),
          )
          .forEach((edge) => toRemove.add(edge.target));
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
        .filter(
          (edge) =>
            edge.source === selectionId && edge.data?.kind !== "ActionEdge",
        )
        .map((edge) => edge.target);
      while (pending.length) {
        const id = pending.pop()!;
        if (descendants.has(id)) continue;
        descendants.add(id);
        pending.push(
          ...edges
            .filter(
              (edge) => edge.source === id && edge.data?.kind !== "ActionEdge",
            )
            .map((edge) => edge.target),
        );
      }
      const actionCount = edges.filter(
        (edge) =>
          edge.data?.kind === "ActionEdge" &&
          (edge.source === selectionId || descendants.has(edge.source)),
      ).length;
      if (
        (descendants.size > 0 || actionCount > 0) &&
        !window.confirm(
          `Delete this entity${descendants.size ? ` and its ${descendants.size} causal descendant${descendants.size === 1 ? "" : "s"}` : ""}${actionCount ? ` plus ${actionCount} attached action${actionCount === 1 ? "" : "s"}` : ""}? This will remove the entire branch.`,
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
    applyMeasuredLayout: (dimensions) => {
      set((state) => {
        const materiallyDifferent = (a: number | null | undefined, b: number) =>
          a == null || Math.abs(a - b) >= 1;
        const measuredNodes = state.nodes.map((node) => {
          const size = dimensions[node.id];
          if (
            !size ||
            (!materiallyDifferent(node.width, size.width) &&
              !materiallyDifferent(node.height, size.height))
          )
            return node;
          return { ...node, width: size.width, height: size.height };
        });
        const measuredControlDimensions = {
          ...state.measuredControlDimensions,
        };
        let dimensionsChanged = measuredNodes.some(
          (node, index) => node !== state.nodes[index],
        );
        state.barriers.forEach((barrier) => {
          const size = dimensions[barrier.id];
          if (!size) return;
          const previous = measuredControlDimensions[barrier.id];
          if (
            materiallyDifferent(previous?.width, size.width) ||
            materiallyDifferent(previous?.height, size.height)
          ) {
            measuredControlDimensions[barrier.id] = { ...size };
            dimensionsChanged = true;
          }
        });
        if (!dimensionsChanged) return {};
        const result = applyLayout(
          measuredNodes,
          state.edges,
          state.showDetails,
          state.barriers,
          measuredControlDimensions,
        );
        return {
          nodes: result.nodes,
          measuredControlDimensions,
          layoutVersion:
            result.changed || dimensionsChanged
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
          const normalizedPatch = Object.fromEntries(
            Object.entries(patch).map(([key, value]) => [
              key,
              typeof value === "string"
                ? value.trim()
                  ? value
                  : undefined
                : value,
            ]),
          ) as typeof patch;
          const destinationType =
            normalizedPatch.nodeType ?? node.data.nodeType;
          if (
            normalizedPatch.eventPhase !== undefined &&
            destinationType !== "Event"
          )
            delete normalizedPatch.eventPhase;
          if (destinationType !== "Action") {
            if (normalizedPatch.actionType !== undefined)
              delete normalizedPatch.actionType;
            if (normalizedPatch.actionStatus !== undefined)
              delete normalizedPatch.actionStatus;
            if (normalizedPatch.actionDueDate !== undefined)
              delete normalizedPatch.actionDueDate;
          }
          if (destinationType !== "Factor") {
            if (normalizedPatch.factorCategory !== undefined)
              delete normalizedPatch.factorCategory;
            if (normalizedPatch.factorSignificance !== undefined)
              delete normalizedPatch.factorSignificance;
          }
          const nextData = {
            ...node.data,
            ...normalizedPatch,
            ...(normalizedPatch.evidenceItems
              ? {
                  evidenceItems: normalizedPatch.evidenceItems.map((item) => ({
                    ...item,
                  })),
                }
              : {}),
            ...(normalizedPatch.evidenceIds
              ? {
                  evidenceIds: [...new Set(normalizedPatch.evidenceIds)].filter(
                    (evidenceId) =>
                      state.evidence.some((item) => item.id === evidenceId),
                  ),
                }
              : {}),
            ...(normalizedPatch.contextItems
              ? {
                  contextItems: normalizedPatch.contextItems.map((item) => ({
                    ...item,
                  })),
                }
              : {}),
          };
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
          const normalizedPatch = Object.fromEntries(
            Object.entries(patch).map(([key, value]) => [
              key,
              typeof value === "string"
                ? value.trim()
                  ? value
                  : undefined
                : value,
            ]),
          ) as typeof patch;
          const nextBarrier = {
            ...barrier,
            ...normalizedPatch,
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
            ? {
                debounce: "text",
                debounceKey: `barrier:${id}:${patch.failureDetails !== undefined ? "failureDetails" : "description"}`,
              }
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
        applied.metadata = {
          ...(applied.metadata ?? {}),
          contextItems: applied.metadata?.contextItems ?? [],
          nodeReferenceHighWaterMark: Math.max(
            applied.metadata?.nodeReferenceHighWaterMark ?? 0,
            state.metadata?.nodeReferenceHighWaterMark ?? 0,
          ),
        };
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
        applied.metadata = {
          ...(applied.metadata ?? {}),
          contextItems: applied.metadata?.contextItems ?? [],
          nodeReferenceHighWaterMark: Math.max(
            applied.metadata?.nodeReferenceHighWaterMark ?? 0,
            state.metadata?.nodeReferenceHighWaterMark ?? 0,
          ),
        };
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
