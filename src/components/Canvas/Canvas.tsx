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
import { BRANCH_LANE_GAP, edgeTypes, routeIncidentEdge } from "./IncidentEdge";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../../features/layout/dimensions";
import type { EvidenceItem } from "../../features/maps/schema";
import {
  calculateControlPosition,
  splitEdgeAtControl,
} from "../../features/layout/investigationLayout";
import {
  deriveHoverPresentation,
  deriveRelationshipPresentation,
  selectLensPresentation,
  type PresentationLens,
} from "../../features/presentation/selectors";
// Compatibility exports for callers migrating to the layout-layer adapter.
export { calculateControlPosition, splitEdgeAtControl };

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
        data: { ...edge.data, presentationRole, originalEdgeId: edge.id },
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
        selected: matchingBarrier.id === selectionId,
        className: `${lensPresentation.emphasizedIds.has(matchingBarrier.id) ? "presentation-emphasized" : ""}${lensPresentation.softenedIds.has(matchingBarrier.id) ? " presentation-softened" : ""}${hasHover ? (hover.emphasizedIds.has(matchingBarrier.id) ? " canvas-hover-related" : " canvas-hover-unrelated") : ""}`,
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
      const source = allRenderedNodes.find((node) => node.id === edge.source);
      const target = allRenderedNodes.find((node) => node.id === edge.target);
      const obstacles = obstacleRectangles.filter(
        (rectangle) =>
          rectangle.id !== edge.source && rectangle.id !== edge.target,
      );
      const laneOffset =
        ((branches
          .get(`${edge.source}:${isAction ? "action" : "causal"}`)
          ?.indexOf(edge) ?? 0) -
          ((branches.get(`${edge.source}:${isAction ? "action" : "causal"}`)
            ?.length ?? 1) -
            1) /
            2) *
        BRANCH_LANE_GAP;
      const sourceWidth =
        source?.width ??
        (source?.type === "Barrier" ? CONTROL_NODE_WIDTH : CHAIN_NODE_WIDTH);
      const sourceHeight =
        source?.height ??
        (source?.type === "Barrier" ? CONTROL_NODE_HEIGHT : CHAIN_NODE_HEIGHT);
      const targetWidth =
        target?.width ??
        (target?.type === "Barrier" ? CONTROL_NODE_WIDTH : CHAIN_NODE_WIDTH);
      const targetHeight =
        target?.height ??
        (target?.type === "Barrier" ? CONTROL_NODE_HEIGHT : CHAIN_NODE_HEIGHT);
      const route =
        source && target
          ? routeIncidentEdge(
              isAction
                ? {
                    x: source.position.x + sourceWidth,
                    y: source.position.y + sourceHeight / 2,
                  }
                : {
                    x: source.position.x + sourceWidth / 2,
                    y: source.position.y + sourceHeight,
                  },
              isAction
                ? {
                    x: target.position.x,
                    y: target.position.y + targetHeight / 2,
                  }
                : {
                    x: target.position.x + targetWidth / 2,
                    y: target.position.y,
                  },
              { kind: isAction ? "action" : "causal", obstacles, laneOffset },
            )
          : undefined;
      return {
        ...edge,
        type: "incident",
        data: {
          ...edge.data,
          route,
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
    hoveredId,
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
  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoveredId(node.id);
    },
    [],
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  useEffect(() => {
    if (!viewportRequest) return;

    const frame = requestAnimationFrame(() => {
      const requestedIds = new Set(viewportRequest.nodeIds);
      const requestedNodes = reactFlow
        .getNodes()
        .filter((node) => requestedIds.has(node.id));
      if (requestedNodes.length > 0) {
        let fittedNodes = requestedNodes;
        if (viewportRequest.causalNodeIds?.length && canvasRef.current) {
          const allBounds = getNodesBounds(requestedNodes);
          const available = canvasRef.current.getBoundingClientRect();
          const whitespaceFactor = 0.8;
          const allZoom = Math.min(
            (available.width * whitespaceFactor) / Math.max(1, allBounds.width),
            (available.height * whitespaceFactor) /
              Math.max(1, allBounds.height),
          );
          if (allZoom < 0.65) {
            const causalIds = new Set(viewportRequest.causalNodeIds);
            fittedNodes = requestedNodes.filter((node) =>
              causalIds.has(node.id),
            );
          }
        }
        const fittedBounds = getNodesBounds(fittedNodes);
        const available = canvasRef.current?.getBoundingClientRect();
        const readableZoom = available
          ? Math.min(
              (available.width * 0.8) / Math.max(1, fittedBounds.width),
              (available.height * 0.8) / Math.max(1, fittedBounds.height),
            )
          : 1;
        if (readableZoom < 0.65) {
          void reactFlow.setCenter(
            fittedBounds.x + fittedBounds.width / 2,
            fittedBounds.y + fittedBounds.height / 2,
            { zoom: 0.65, duration: viewportAnimationDuration(400) },
          );
        } else {
          void reactFlow.fitBounds(fittedBounds, {
            padding: 0.25,
            duration: viewportAnimationDuration(400),
          });
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
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
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
