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
import { selectContextGroups } from "../../state/selectors";
import { nodeTypes } from "./NodeTypes";
import { edgeTypes } from "./IncidentEdge";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
} from "../../features/layout/dimensions";
import type { EvidenceItem } from "../../features/maps/schema";
import {
  calculateControlPosition,
  layoutInvestigation,
  splitEdgeAtControl,
} from "../../features/layout/investigationLayout";
import type {
  LayoutGraph,
  LayoutResult,
} from "../../features/layout/layoutModel";
import {
  deriveHoverPresentation,
  deriveRelationshipPresentation,
  selectLensPresentation,
  type PresentationLens,
} from "../../features/presentation/selectors";
// Compatibility exports for callers migrating to the layout-layer adapter.
export { calculateControlPosition, splitEdgeAtControl };

/** Thin React Flow adapter: routing geometry remains owned by the layout layer. */
export const adaptLayoutEdgeData = <T extends Record<string, unknown>>(
  data: T,
  rendererEdgeId: string,
  relationshipId: string,
  layout: LayoutResult,
) => {
  const routed =
    layout.relationships.find(
      (relationship) => relationship.id === rendererEdgeId,
    ) ??
    layout.relationships.find(
      (relationship) => relationship.relationshipId === relationshipId,
    );
  return {
    ...data,
    originalEdgeId: relationshipId,
    route: routed?.route,
    // Shared ink has one renderer owner. Other member relationships retain the
    // segment membership for interaction in the layout result, but do not
    // append another copy of the same SVG path.
    sharedSegments: layout.sharedSegments.filter(
      (segment) =>
        segment.relationshipIds[0] === relationshipId &&
        !rendererEdgeId.endsWith("-downstream"),
    ),
  };
};

export const viewportAnimationDuration = (duration: number): number =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : duration;

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
      .slice();
    return [
      ...normal,
      ...timeline.map((node) => ({
        ...node,
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
    const hover = deriveHoverPresentation(
      visibleChainNodes.map((node) => ({
        id: node.id,
        nodeType: node.data.nodeType,
      })),
      visibleEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.data?.kind,
      })),
      barriers,
      hoveredId,
    );
    const hasHover = Boolean(hoveredId);
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
        className: `${node.className ?? ""}${lensPresentation.emphasizedIds.has(node.id) ? " presentation-emphasized" : ""}${lensPresentation.softenedIds.has(node.id) ? " presentation-softened" : ""}${hasHover ? (hover.emphasizedIds.has(node.id) ? " canvas-hover-related" : " canvas-hover-unrelated") : ""}`,
      }));
    const actionIds = new Set(
      presentedNodes
        .filter((node) => node.data.nodeType === "Action")
        .map((node) => node.id),
    );
    const actionAnchors = new Map(
      visibleEdges
        .filter((edge) => edge.data?.kind === "ActionEdge")
        .map((edge) => [edge.target, edge.source]),
    );
    const dimensions = (node: Node<ChainNodeData>) => ({
      width: node.width ?? CHAIN_NODE_WIDTH,
      height: node.height ?? CHAIN_NODE_HEIGHT,
    });
    const layoutRelationships: LayoutGraph["relationships"] = visibleEdges.map(
      (edge) => ({
        id: edge.id,
        kind: edge.data?.kind === "ActionEdge" ? "Action" : "Causal",
        fromId: edge.source,
        toId: edge.target,
      }),
    );
    const layoutGraph: LayoutGraph = {
      nodes: presentedNodes
        .filter((node) => !actionIds.has(node.id))
        .map((node) => ({
          id: node.id,
          kind:
            node.data.nodeType === "Event" || node.data.nodeType === "Impact"
              ? node.data.nodeType
              : "Factor",
          referenceId: node.data.referenceId,
          position: node.position,
          dimensions: dimensions(node),
          eventDisplay: node.data.eventDisplay,
        })),
      actions: presentedNodes
        .filter((node) => actionIds.has(node.id))
        .map((node) => ({
          id: node.id,
          kind: "Action",
          attachedToId: actionAnchors.get(node.id) ?? "",
          referenceId: node.data.referenceId,
          position: node.position,
          dimensions: dimensions(node),
        })),
      relationships: layoutRelationships,
      controls: barriers.flatMap((control) => {
        const relationship = layoutRelationships.find(
          (item) =>
            item.kind === "Causal" &&
            item.fromId === control.upstreamNodeId &&
            item.toId === control.downstreamNodeId,
        );
        return relationship
          ? [
              {
                id: control.id,
                kind: "Control" as const,
                relationshipId: relationship.id,
                upstreamNodeId: control.upstreamNodeId,
                downstreamNodeId: control.downstreamNodeId,
                referenceId: control.referenceId,
                dimensions: measuredControlDimensions[control.id],
              },
            ]
          : [];
      }),
    };
    const layout = layoutInvestigation(layoutGraph, {
      mode: "Incremental",
      priorGeometry: presentedNodes.map((node) => ({
        id: node.id,
        role: actionIds.has(node.id) ? "Action" : "Semantic",
        rectangle: { ...node.position, ...dimensions(node) },
      })),
    });
    const layoutNodes = new Map(layout.nodes.map((node) => [node.id, node]));
    const positionedNodes = presentedNodes.map((node) => {
      const geometry = layoutNodes.get(node.id);
      return geometry
        ? {
            ...node,
            position: { x: geometry.rectangle.x, y: geometry.rectangle.y },
          }
        : node;
    });
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
        data: { ...edge.data, presentationRole, originalEdgeId: edge.id },
      };
      const matchingBarrier = barriers.find(
        (barrier) =>
          edge.data?.kind !== "ActionEdge" &&
          barrier.upstreamNodeId === edge.source &&
          barrier.downstreamNodeId === edge.target,
      );

      if (!matchingBarrier) return [presentedEdge];

      const controlGeometry = layoutNodes.get(matchingBarrier.id);

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
        position: controlGeometry
          ? { x: controlGeometry.rectangle.x, y: controlGeometry.rectangle.y }
          : { x: 0, y: 0 },
        draggable: false,
        selectable: true,
        selected: matchingBarrier.id === selectionId,
        className: `${lensPresentation.emphasizedIds.has(matchingBarrier.id) ? "presentation-emphasized" : ""}${lensPresentation.softenedIds.has(matchingBarrier.id) ? " presentation-softened" : ""}${hasHover ? (hover.emphasizedIds.has(matchingBarrier.id) ? " canvas-hover-related" : " canvas-hover-unrelated") : ""}`,
      };

      barrierNodes.push(barrierNode);

      return splitEdgeAtControl(presentedEdge, matchingBarrier.id);
    });

    const styledEdges = flowEdges.map((edge) => {
      const isAction = edge.data?.kind === "ActionEdge";
      const hoverRelated = hover.emphasizedEdges.has(
        edge.data?.originalEdgeId ?? edge.id,
      );
      const related = edge.data?.presentationRole === "related";
      const highlighted =
        related ||
        (isAction &&
          presentation.selectedPath.has(edge.source) &&
          presentation.selectedPath.has(edge.target));
      const unrelated = hasHover
        ? !hoverRelated
        : Boolean(selectionId) && !highlighted;
      const visuallyRelated = hasHover ? hoverRelated : highlighted;
      return {
        ...edge,
        type: "incident",
        data: {
          ...adaptLayoutEdgeData(
            edge.data ?? {},
            edge.id,
            edge.data?.originalEdgeId ?? edge.id,
            layout,
          ),
        },
        className: isAction
          ? `incident-edge incident-edge--action${unrelated ? " incident-edge--unrelated" : ""}${visuallyRelated ? " incident-edge--related" : ""}`
          : visuallyRelated
            ? "incident-edge incident-edge--related"
            : `incident-edge${unrelated ? " incident-edge--unrelated" : ""}`,
        style: {
          stroke: isAction ? "#94a3b8" : "#475569",
          strokeWidth: isAction
            ? 1.5
            : visuallyRelated
              ? 3
              : unrelated
                ? 1.5
                : 2.25,
          strokeDasharray: isAction ? "5 5" : undefined,
        },
      };
    });
    return {
      nodes: [...positionedNodes, ...barrierNodes],
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
    hoveredId,
  ]);

  useEffect(() => {
    if (!presenting || !selectionId) return;
    const frame = requestAnimationFrame(() => {
      if (
        import.meta.env.MODE === "development" &&
        typeof performance !== "undefined"
      )
        performance.mark("incidentmapping:initial-viewport:start");
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
  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoveredId(node.id);
    },
    [],
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  useEffect(() => {
    if (!viewportRequest || !nodesInitialized) return;

    const frame = requestAnimationFrame(() => {
      const requestedIds = new Set(viewportRequest.nodeIds);
      const requestedNodes = reactFlow
        .getNodes()
        .filter((node) => requestedIds.has(node.id));
      if (requestedNodes.length > 0) {
        const causalIds = new Set(
          viewportRequest.causalNodeIds ?? viewportRequest.nodeIds,
        );
        const fittedNodes = requestedNodes.filter((node) =>
          causalIds.has(node.id),
        );
        const fittedBounds = getNodesBounds(fittedNodes);
        const available = canvasRef.current?.getBoundingClientRect();
        const zoom = available
          ? Math.min(
              1,
              (available.width * 0.8) / Math.max(1, fittedBounds.width),
              (available.height * 0.8) / Math.max(1, fittedBounds.height),
            )
          : 1;
        const impacts = fittedNodes.filter(
          (node) => (node.data as ChainNodeData).nodeType === "Impact",
        );
        const anchor = getNodesBounds(impacts.length ? impacts : fittedNodes);
        const width = available?.width ?? 1;
        const height = available?.height ?? 1;
        void reactFlow.setViewport(
          {
            x: width / 2 - (anchor.x + anchor.width / 2) * zoom,
            y: height * 0.25 - (anchor.y + anchor.height / 2) * zoom,
            zoom,
          },
          { duration: viewportAnimationDuration(300) },
        );
        if (
          import.meta.env.MODE === "development" &&
          typeof performance !== "undefined"
        ) {
          performance.mark("incidentmapping:initial-viewport:end");
          performance.measure(
            "incidentmapping:initial-viewport",
            "incidentmapping:initial-viewport:start",
            "incidentmapping:initial-viewport:end",
          );
        }
        setTimeout(
          () => clearViewportRequest(viewportRequest.id),
          viewportAnimationDuration(400),
        );
      } else {
        clearViewportRequest(viewportRequest.id);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [clearViewportRequest, nodesInitialized, reactFlow, viewportRequest]);

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
        <div className="map-mobile-actions absolute right-3 top-3 z-20 flex flex-col gap-2">
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
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={renderedEdges}
        nodeTypes={memorizedNodeTypes}
        edgeTypes={memorizedEdgeTypes}
        proOptions={{ hideAttribution: true }}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
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
            if (["Impact", "Event"].includes(node.data.nodeType)) {
              const groups = selectContextGroups(node.data.contextItems ?? []);
              // A distinct combined treatment prevents one effect masking the other.
              if (groups.Aggravating.length && groups.Mitigating.length)
                return "#7c3aed";
              if (groups.Aggravating.length) return "#e11d48";
              if (groups.Mitigating.length) return "#059669";
            }
            return "#64748b";
          }}
          maskColor="rgba(241, 245, 249, 0.72)"
        />
      </ReactFlow>
    </div>
  );
};
