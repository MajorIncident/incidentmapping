import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  getNodesBounds,
  type Node,
  type NodeChange,
  useNodesInitialized,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  useAppStore,
  type BarrierNodeData,
  type ChainNodeData,
} from "../../state/useAppStore";
import { selectContextByEffect } from "../../state/selectors";
import { nodeTypes } from "./NodeTypes";
import { BRANCH_LANE_GAP, edgeTypes } from "./IncidentEdge";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../../features/layout/dimensions";
import type { EvidenceItem } from "../../features/maps/schema";
import {
  selectLensPresentation,
  type PresentationLens,
} from "../../features/presentation/selectors";

export const GuideContent = (): JSX.Element => (
  <>
    <p className="map-guide__intro">
      Start with the <strong>Impact</strong> at the top. Investigators work
      downward by asking <strong>why</strong>; lower nodes identify the
      contributing events and factors.
    </p>
    <p className="map-guide__intro">
      Unconnected timestamped Events appear in a separate chronological lane.
      Their order shows time, not causation.
    </p>
    <div className="map-guide__key" aria-label="Map key">
      {[
        ["Impact", "impact"],
        ["Event", "event"],
        ["Factor", "factor"],
        ["Action", "action"],
        ["Control", "control"],
        ["Key Factor", "key-factor"],
        ["Root Cause", "root-cause"],
      ].map(([label, kind]) => (
        <span
          key={kind}
          className={`map-guide__key-item map-guide__key-item--${kind}`}
        >
          <i aria-hidden="true" /> {label}
        </span>
      ))}
    </div>
  </>
);

export type GraphRole = {
  roots: Set<string>;
  leaves: Set<string>;
  upstream: Set<string>;
  downstream: Set<string>;
  selectedPath: Set<string>;
  unrelated: Set<string>;
};

type PositionedSize = {
  position: { x: number; y: number };
  width: number;
  height: number;
};

/** Centers a Control between the source bottom and target top handles. */
export const calculateControlPosition = (
  source: PositionedSize,
  target: PositionedSize,
  control: { width: number; height: number },
): { x: number; y: number } => {
  const sourceBottom = {
    x: source.position.x + source.width / 2,
    y: source.position.y + source.height,
  };
  const targetTop = {
    x: target.position.x + target.width / 2,
    y: target.position.y,
  };

  return {
    x: (sourceBottom.x + targetTop.x) / 2 - control.width / 2,
    y: (sourceBottom.y + targetTop.y) / 2 - control.height / 2,
  };
};

/** Replaces a causal edge with explicitly connected segments around a Control. */
export const splitEdgeAtControl = <
  T extends { id: string; source: string; target: string },
>(
  edge: T,
  controlId: string,
) => [
  {
    ...edge,
    id: `${edge.id}-${controlId}-upstream`,
    target: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    ...edge,
    id: `${edge.id}-${controlId}-downstream`,
    source: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
];

export const viewportAnimationDuration = (duration: number): number =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : duration;

/** Derives transient visual state from the directed graph; nothing is persisted. */
export const deriveGraphPresentation = (
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  selectedId: string | null,
): GraphRole => {
  const ids = new Set(nodeIds);
  const incoming = new Map(nodeIds.map((id) => [id, [] as string[]]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  edges.forEach(({ source, target }) => {
    if (ids.has(source) && ids.has(target)) {
      outgoing.get(source)?.push(target);
      incoming.get(target)?.push(source);
    }
  });
  const walk = (start: string, graph: Map<string, string[]>) => {
    const found = new Set<string>();
    const pending = [...(graph.get(start) ?? [])];
    while (pending.length) {
      const id = pending.pop()!;
      if (found.has(id)) continue;
      found.add(id);
      pending.push(...(graph.get(id) ?? []));
    }
    return found;
  };
  const hasSelection = Boolean(selectedId && ids.has(selectedId));
  const upstream = hasSelection
    ? walk(selectedId!, incoming)
    : new Set<string>();
  const downstream = hasSelection
    ? walk(selectedId!, outgoing)
    : new Set<string>();
  const selectedPath = new Set([...upstream, ...downstream]);
  if (hasSelection) selectedPath.add(selectedId!);
  return {
    roots: new Set(nodeIds.filter((id) => incoming.get(id)?.length === 0)),
    leaves: new Set(nodeIds.filter((id) => outgoing.get(id)?.length === 0)),
    upstream,
    downstream,
    selectedPath,
    unrelated: new Set(
      hasSelection ? nodeIds.filter((id) => !selectedPath.has(id)) : [],
    ),
  };
};

type PresentationNode = { id: string; nodeType?: ChainNodeData["nodeType"] };
type PresentationBarrier = {
  id: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
};

/** Resolves causal, Action, and Control selections onto one review relationship. */
export const deriveRelationshipPresentation = (
  nodes: PresentationNode[],
  edges: Array<{ source: string; target: string; kind?: string }>,
  barriers: PresentationBarrier[],
  selectedId: string | null,
): GraphRole => {
  const causalIds = nodes
    .filter((node) => node.nodeType !== "Action")
    .map((node) => node.id);
  const causalEdges = edges.filter((edge) => edge.kind !== "ActionEdge");
  const action = nodes.find(
    (node) => node.id === selectedId && node.nodeType === "Action",
  );
  const control = barriers.find((barrier) => barrier.id === selectedId);
  const actionEdge = action
    ? edges.find(
        (edge) => edge.kind === "ActionEdge" && edge.target === action.id,
      )
    : undefined;
  const anchors = actionEdge
    ? [actionEdge.source]
    : selectedId
      ? [selectedId]
      : [];
  const roles = control
    ? []
    : anchors.map((anchor) =>
        deriveGraphPresentation(causalIds, causalEdges, anchor),
      );
  const selectedPath = new Set(roles.flatMap((role) => [...role.selectedPath]));
  let controlUpstream = new Set<string>();
  let controlDownstream = new Set<string>();
  if (control) {
    const upstreamRole = deriveGraphPresentation(
      causalIds,
      causalEdges,
      control.upstreamNodeId,
    );
    const downstreamRole = deriveGraphPresentation(
      causalIds,
      causalEdges,
      control.downstreamNodeId,
    );
    controlUpstream = upstreamRole.upstream;
    controlDownstream = downstreamRole.downstream;
    controlUpstream.forEach((id) => selectedPath.add(id));
    selectedPath.add(control.upstreamNodeId);
    selectedPath.add(control.downstreamNodeId);
    controlDownstream.forEach((id) => selectedPath.add(id));
  }
  if (action) selectedPath.add(action.id);
  if (control) selectedPath.add(control.id);
  // Actions attached to the selected relationship remain part of its context.
  edges
    .filter(
      (edge) => edge.kind === "ActionEdge" && selectedPath.has(edge.source),
    )
    .forEach((edge) => selectedPath.add(edge.target));
  barriers
    .filter(
      (barrier) =>
        selectedPath.has(barrier.upstreamNodeId) &&
        selectedPath.has(barrier.downstreamNodeId),
    )
    .forEach((barrier) => selectedPath.add(barrier.id));
  const allIds = [
    ...nodes.map((node) => node.id),
    ...barriers.map((b) => b.id),
  ];
  const defaultRole = deriveGraphPresentation(causalIds, causalEdges, null);
  const hasSelection = Boolean(control || anchors.length > 0);
  return {
    roots: roles[0]?.roots ?? defaultRole.roots,
    leaves: roles[0]?.leaves ?? defaultRole.leaves,
    upstream: control
      ? controlUpstream
      : new Set(roles.flatMap((role) => [...role.upstream])),
    downstream: control
      ? controlDownstream
      : new Set(roles.flatMap((role) => [...role.downstream])),
    selectedPath,
    unrelated: new Set(
      hasSelection ? allIds.filter((id) => !selectedPath.has(id)) : [],
    ),
  };
};

export const Canvas = ({
  onInspect,
  onPresentationInteract,
  presenting = false,
  presentationShowDetails = false,
  showTimelineEvents = false,
  presentationLens = "Overview",
  evidence = [],
  storyFocusIds,
}: {
  onInspect?: () => void;
  onPresentationInteract?: () => void;
  presenting?: boolean;
  presentationShowDetails?: boolean;
  showTimelineEvents?: boolean;
  presentationLens?: PresentationLens;
  evidence?: EvidenceItem[];
  storyFocusIds?: string[];
}): JSX.Element => {
  const chainNodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const barriers = useAppStore((state) => state.barriers);
  const selectionId = useAppStore((state) => state.selectionId);
  const mapTitle = useAppStore(
    (state) => state.metadata?.title || "Untitled Map",
  );
  const viewportRequest = useAppStore((state) => state.viewportRequest);
  const measuredControlDimensions = useAppStore(
    (state) => state.measuredControlDimensions,
  );
  const { clearViewportRequest, moveNode, select, applyMeasuredLayout } =
    useAppStore((state) => state.actions);
  const reactFlow = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const measurementFrame = useRef(0);
  const submitMeasurements = useCallback(
    (measuredNodes: Node[]) => {
      if (presenting) return;
      const dimensions = Object.fromEntries(
        measuredNodes.flatMap((node) =>
          node.width && node.height
            ? [[node.id, { width: node.width, height: node.height }]]
            : [],
        ),
      );
      if (Object.keys(dimensions).length) applyMeasuredLayout(dimensions);
    },
    [applyMeasuredLayout, presenting],
  );
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!changes.some((change) => change.type === "dimensions")) return;
      cancelAnimationFrame(measurementFrame.current);
      measurementFrame.current = requestAnimationFrame(() =>
        submitMeasurements(reactFlow.getNodes()),
      );
    },
    [reactFlow, submitMeasurements],
  );

  useEffect(() => {
    if (nodesInitialized) submitMeasurements(reactFlow.getNodes());
  }, [nodesInitialized, reactFlow, submitMeasurements]);

  const fitMap = useCallback(() => {
    void reactFlow.fitView({
      padding: 0.2,
      duration: viewportAnimationDuration(400),
    });
  }, [reactFlow]);

  const visibleChainNodes = useMemo(() => {
    const normal = chainNodes.filter(
      (node) => node.data.eventDisplay !== "ChronologyOnly",
    );
    if (!showTimelineEvents && presentationLens !== "Chronology") return normal;
    const timeline = chainNodes
      .filter((node) => node.data.eventDisplay === "ChronologyOnly")
      .slice()
      .sort(
        (a, b) =>
          Date.parse(a.data.timestamp ?? "") -
            Date.parse(b.data.timestamp ?? "") || a.id.localeCompare(b.id),
      );
    const right =
      Math.max(
        0,
        ...normal.map(
          (node) => node.position.x + (node.width ?? CHAIN_NODE_WIDTH),
        ),
      ) + 128;
    const top = Math.min(0, ...normal.map((node) => node.position.y));
    return [
      ...normal,
      ...timeline.map((node, index) => ({
        ...node,
        position: { x: right, y: top + index * (CHAIN_NODE_HEIGHT + 48) },
        className: `${node.className ?? ""} timeline-event-node`,
      })),
    ];
  }, [chainNodes, presentationLens, showTimelineEvents]);
  const visibleIds = useMemo(
    () => new Set(visibleChainNodes.map((node) => node.id)),
    [visibleChainNodes],
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ),
    [edges, visibleIds],
  );
  useEffect(() => {
    if (
      selectionId &&
      !visibleIds.has(selectionId) &&
      !barriers.some((item) => item.id === selectionId) &&
      !evidence.some((item) => item.id === selectionId)
    )
      select(null);
  }, [barriers, evidence, selectionId, select, visibleIds]);

  const { nodes, renderedEdges } = useMemo(() => {
    const lensPresentation = selectLensPresentation(presentationLens, {
      nodes: visibleChainNodes,
      edges: visibleEdges,
      controls: barriers,
      evidence,
      selectedId: selectionId,
    });
    const presentation = deriveRelationshipPresentation(
      visibleChainNodes.map((node) => ({
        id: node.id,
        nodeType: node.data.nodeType,
      })),
      visibleEdges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        kind: edge.data?.kind,
      })),
      barriers,
      selectionId,
    );
    const presentedNodes = visibleChainNodes
      .filter((node) => lensPresentation.visibleIds.has(node.id))
      .map((node) => ({
        ...node,
        selected: node.id === selectionId,
        data: {
          ...node.data,
          graphRole: {
            isRoot: presentation.roots.has(node.id),
            isLeaf: presentation.leaves.has(node.id),
            isOnSelectedPath: presentation.selectedPath.has(node.id),
            isUnrelated: storyFocusIds
              ? !storyFocusIds.includes(node.id)
              : presentation.unrelated.has(node.id),
          },
          readOnly: presenting,
          viewShowDetails: presentationShowDetails,
        },
        className: `${node.className ?? ""}${lensPresentation.emphasizedIds.has(node.id) ? " presentation-emphasized" : ""}${lensPresentation.softenedIds.has(node.id) ? " presentation-softened" : ""}`,
      }));
    const nodeLookup = new Map(presentedNodes.map((node) => [node.id, node]));
    const barrierNodes: Node<BarrierNodeData>[] = [];
    const flowEdges = visibleEdges.flatMap((edge) => {
      const presentationRole =
        edge.data?.kind !== "ActionEdge" &&
        presentation.selectedPath.has(edge.source) &&
        presentation.selectedPath.has(edge.target)
          ? "related"
          : undefined;
      const presentedEdge = {
        ...edge,
        data: { ...edge.data, presentationRole },
      };
      const matchingBarrier = barriers.find(
        (barrier) =>
          edge.data?.kind !== "ActionEdge" &&
          barrier.upstreamNodeId === edge.source &&
          barrier.downstreamNodeId === edge.target,
      );

      if (!matchingBarrier) {
        return [presentedEdge];
      }

      const upstream = nodeLookup.get(edge.source);
      const downstream = nodeLookup.get(edge.target);
      if (!upstream || !downstream) {
        return [presentedEdge];
      }

      const controlSize = measuredControlDimensions[matchingBarrier.id];
      const controlWidth = controlSize?.width ?? CONTROL_NODE_WIDTH;
      const controlHeight = controlSize?.height ?? CONTROL_NODE_HEIGHT;
      const upstreamWidth = upstream.width ?? CHAIN_NODE_WIDTH;
      const upstreamHeight = upstream.height ?? CHAIN_NODE_HEIGHT;
      const downstreamWidth = downstream.width ?? CHAIN_NODE_WIDTH;
      const downstreamHeight = downstream.height ?? CHAIN_NODE_HEIGHT;

      const barrierNode: Node<BarrierNodeData> = {
        id: matchingBarrier.id,
        type: "Barrier",
        data: {
          kind: "Barrier",
          upstreamNodeId: matchingBarrier.upstreamNodeId,
          downstreamNodeId: matchingBarrier.downstreamNodeId,
          description: matchingBarrier.description,
          status: matchingBarrier.status,
          failureReason: matchingBarrier.failureReason,
          failureDetails: matchingBarrier.failureDetails,
          referenceId: matchingBarrier.referenceId,
          controlRole: matchingBarrier.controlRole,
          assertionState: matchingBarrier.assertionState,
          evidenceIds: [...matchingBarrier.evidenceIds],
          readOnly: presenting,
          viewShowDetails: presentationShowDetails,
          graphRole: {
            isOnSelectedPath: presentation.selectedPath.has(matchingBarrier.id),
            isUnrelated: storyFocusIds
              ? !storyFocusIds.includes(matchingBarrier.id)
              : presentation.unrelated.has(matchingBarrier.id),
          },
        },
        position: calculateControlPosition(
          {
            position: upstream.position,
            width: upstreamWidth,
            height: upstreamHeight,
          },
          {
            position: downstream.position,
            width: downstreamWidth,
            height: downstreamHeight,
          },
          { width: controlWidth, height: controlHeight },
        ),
        draggable: false,
        selectable: true,
        className: `${lensPresentation.emphasizedIds.has(matchingBarrier.id) ? "presentation-emphasized" : ""}${lensPresentation.softenedIds.has(matchingBarrier.id) ? " presentation-softened" : ""}`,
      };

      barrierNodes.push(barrierNode);

      return splitEdgeAtControl(presentedEdge, matchingBarrier.id);
    });

    const allRenderedNodes = [...presentedNodes, ...barrierNodes];
    const obstacleRectangles = allRenderedNodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width:
        node.width ??
        (node.type === "Barrier" ? CONTROL_NODE_WIDTH : CHAIN_NODE_WIDTH),
      height:
        node.height ??
        (node.type === "Barrier" ? CONTROL_NODE_HEIGHT : CHAIN_NODE_HEIGHT),
    }));
    const branches = new Map<string, typeof flowEdges>();
    flowEdges.forEach((edge) => {
      const key = `${edge.source}:${edge.data?.kind === "ActionEdge" ? "action" : "causal"}`;
      branches.set(key, [...(branches.get(key) ?? []), edge]);
    });
    const styledEdges = flowEdges.map((edge) => {
      const isAction = edge.data?.kind === "ActionEdge";
      const related = edge.data?.presentationRole === "related";
      const highlighted =
        related ||
        (isAction &&
          presentation.selectedPath.has(edge.source) &&
          presentation.selectedPath.has(edge.target));
      const unrelated = Boolean(selectionId) && !highlighted;
      return {
        ...edge,
        type: "incident",
        data: {
          ...edge.data,
          obstacles: obstacleRectangles.filter(
            (rectangle) =>
              rectangle.id !== edge.source && rectangle.id !== edge.target,
          ),
          laneOffset:
            ((branches
              .get(`${edge.source}:${isAction ? "action" : "causal"}`)
              ?.indexOf(edge) ?? 0) -
              ((branches.get(`${edge.source}:${isAction ? "action" : "causal"}`)
                ?.length ?? 1) -
                1) /
                2) *
            BRANCH_LANE_GAP,
        },
        className: isAction
          ? `incident-edge incident-edge--action${unrelated ? " incident-edge--unrelated" : ""}${highlighted ? " incident-edge--related" : ""}`
          : highlighted
            ? "incident-edge incident-edge--related"
            : `incident-edge${unrelated ? " incident-edge--unrelated" : ""}`,
        style: {
          stroke: isAction ? "#94a3b8" : "#475569",
          strokeWidth: isAction
            ? 1.5
            : highlighted
              ? 3
              : unrelated
                ? 1.5
                : 2.25,
          strokeDasharray: isAction ? "5 5" : undefined,
        },
      };
    });
    return {
      nodes: [...presentedNodes, ...barrierNodes],
      renderedEdges: styledEdges,
    };
  }, [
    barriers,
    evidence,
    visibleChainNodes,
    visibleEdges,
    measuredControlDimensions,
    presentationShowDetails,
    presenting,
    presentationLens,
    selectionId,
    storyFocusIds,
  ]);

  useEffect(() => {
    if (!presenting || !selectionId) return;
    const frame = requestAnimationFrame(() => {
      const selected = reactFlow.getNode(selectionId);
      if (selected)
        void reactFlow.fitBounds(getNodesBounds([selected]), {
          padding: 0.7,
          duration: viewportAnimationDuration(300),
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [presenting, reactFlow, selectionId]);

  useEffect(() => {
    if (!presenting || !storyFocusIds?.length) return;
    const frame = requestAnimationFrame(() => {
      const focused = reactFlow
        .getNodes()
        .filter((node) => storyFocusIds.includes(node.id));
      if (focused.length)
        void reactFlow.fitBounds(getNodesBounds(focused), {
          padding: 0.35,
          duration: viewportAnimationDuration(300),
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [presenting, reactFlow, storyFocusIds]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData | BarrierNodeData>) => {
      select(node.id);
      if (presenting) onPresentationInteract?.();
      else onInspect?.();
    },
    [onInspect, onPresentationInteract, presenting, select],
  );

  const handlePaneClick = useCallback(() => {
    select(null);
    if (presenting) onPresentationInteract?.();
  }, [onPresentationInteract, presenting, select]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData | BarrierNodeData>) => {
      if (node.type === "Barrier") {
        return;
      }
      moveNode(node.id, node.position);
    },
    [moveNode],
  );

  useEffect(() => {
    if (!viewportRequest) return;

    const frame = requestAnimationFrame(() => {
      const requestedIds = new Set(viewportRequest.nodeIds);
      const requestedNodes = reactFlow
        .getNodes()
        .filter((node) => requestedIds.has(node.id));
      if (requestedNodes.length > 0) {
        void reactFlow.fitBounds(getNodesBounds(requestedNodes), {
          padding: 0.25,
          duration: viewportAnimationDuration(400),
        });
        setTimeout(
          () => clearViewportRequest(viewportRequest.id),
          viewportAnimationDuration(400),
        );
      } else {
        clearViewportRequest(viewportRequest.id);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [clearViewportRequest, reactFlow, viewportRequest]);

  useEffect(() => {
    if (!presenting) return;
    // Wait for the header, legend and read-only node rendering to settle.
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void reactFlow.fitView({
          padding: 0.3,
          includeHiddenNodes: true,
          duration: viewportAnimationDuration(400),
        });
      });
    });
    return () => cancelAnimationFrame(firstFrame);
  }, [presenting, reactFlow]);

  // A mobile inspector changes the usable canvas without changing graph data.
  // Keep the selected node visible when that sheet opens or is resized.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !selectionId ||
      typeof window.matchMedia !== "function" ||
      typeof ResizeObserver === "undefined" ||
      !window.matchMedia("(max-width: 767px)").matches
    )
      return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selectedNode = reactFlow.getNode(selectionId);
        if (selectedNode) {
          void reactFlow.fitBounds(getNodesBounds([selectedNode]), {
            padding: 0.6,
            duration: viewportAnimationDuration(250),
          });
        }
      });
    });
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reactFlow, selectionId]);

  const memorizedNodeTypes = useMemo(() => nodeTypes, []);
  const memorizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full"
      aria-label={`${mapTitle} incident map`}
    >
      {!presenting ? (
        <aside
          className="map-guide absolute bottom-4 left-4 z-10 max-w-xs rounded-xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-sm"
          aria-label="Incident map legend"
        >
          <div className="mb-1 font-semibold text-slate-900">
            How to read this map
          </div>
          <GuideContent />
        </aside>
      ) : null}
      {!presenting ? (
        <div className="map-mobile-actions absolute right-3 top-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            className="map-overlay-button"
            aria-label="How to read this map"
            aria-expanded={guideOpen}
            aria-controls="mobile-map-guide"
            onClick={() => setGuideOpen((open) => !open)}
          >
            <span aria-hidden="true">i</span>
          </button>
          <button
            type="button"
            className="map-overlay-button"
            onClick={fitMap}
            aria-label="Fit map"
            title="Fit Map (F)"
          >
            <span aria-hidden="true">⌗</span>
          </button>
        </div>
      ) : null}
      {guideOpen && !presenting ? (
        <aside
          id="mobile-map-guide"
          className="mobile-map-guide absolute inset-x-3 bottom-3 z-20 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg"
          aria-label="How to read this map"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">
                How to read this map
              </h2>
              <GuideContent />
            </div>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-lg text-xl"
              aria-label="Dismiss map guide"
              onClick={() => {
                sessionStorage.setItem("incident-map-guide-dismissed", "true");
                setGuideOpen(false);
              }}
            >
              ×
            </button>
          </div>
        </aside>
      ) : null}
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={renderedEdges}
        nodeTypes={memorizedNodeTypes}
        edgeTypes={memorizedEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        snapToGrid
        snapGrid={[8, 8]}
        nodesFocusable
        nodesDraggable={!presenting}
        nodesConnectable={false}
        elementsSelectable
        selectionOnDrag={!presenting}
      >
        <Background color="#E2E8F0" gap={8} />
        {!presenting ? (
          <Controls
            position="top-right"
            showInteractive={false}
            onFitView={fitMap}
          />
        ) : null}
        <MiniMap
          ariaLabel="Incident map overview"
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === "Barrier")
              return node.data.status === "Effective" ? "#059669" : "#e11d48";
            if (node.data.graphRole?.isRoot) return "#7c3aed";
            if (
              selectContextByEffect(node.data.contextItems ?? [], "Mitigating")
                .length > 0
            )
              return "#059669";
            if (
              selectContextByEffect(node.data.contextItems ?? [], "Aggravating")
                .length > 0
            )
              return "#e11d48";
            return "#64748b";
          }}
          maskColor="rgba(241, 245, 249, 0.72)"
        />
      </ReactFlow>
    </div>
  );
};
