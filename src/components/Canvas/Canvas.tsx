import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  getNodesBounds,
  type Node,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  useAppStore,
  type BarrierNodeData,
  type ChainNodeData,
} from "../../state/useAppStore";
import { nodeTypes } from "./NodeTypes";

const GuideContent = (): JSX.Element => (
  <>
    <p className="map-guide__intro">
      Start with the <strong>Impact</strong> at the top. Investigators work
      downward by asking <strong>why</strong>; lower nodes identify the
      contributing events and factors.
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

export const Canvas = ({
  onInspect,
  presenting = false,
}: {
  onInspect?: () => void;
  presenting?: boolean;
}): JSX.Element => {
  const chainNodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const barriers = useAppStore((state) => state.barriers);
  const selectionId = useAppStore((state) => state.selectionId);
  const mapTitle = useAppStore(
    (state) => state.metadata?.title || "Untitled Map",
  );
  const viewportRequest = useAppStore((state) => state.viewportRequest);
  const { clearViewportRequest, moveNode, select } = useAppStore(
    (state) => state.actions,
  );
  const reactFlow = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const fitMap = useCallback(() => {
    void reactFlow.fitView({
      padding: 0.2,
      duration: viewportAnimationDuration(400),
    });
  }, [reactFlow]);

  const { nodes, renderedEdges } = useMemo(() => {
    const presentation = deriveGraphPresentation(
      chainNodes
        .filter((node) => node.data.nodeType !== "Action")
        .map((node) => node.id),
      edges.filter((edge) => edge.data?.kind !== "ActionEdge"),
      selectionId,
    );
    const presentedNodes = chainNodes.map((node) => ({
      ...node,
      selected: !presenting && node.id === selectionId,
      data: {
        ...node.data,
        graphRole: {
          isRoot: presentation.roots.has(node.id),
          isLeaf: presentation.leaves.has(node.id),
          isOnSelectedPath: presentation.selectedPath.has(node.id),
          isUnrelated: presentation.unrelated.has(node.id),
        },
        readOnly: presenting,
      },
    }));
    const nodeLookup = new Map(presentedNodes.map((node) => [node.id, node]));
    const barrierNodes: Node<BarrierNodeData>[] = [];
    const flowEdges = edges.flatMap((edge) => {
      const presentationRole =
        presentation.upstream.has(edge.source) &&
        (presentation.upstream.has(edge.target) || edge.target === selectionId)
          ? "upstream"
          : (edge.source === selectionId ||
                presentation.downstream.has(edge.source)) &&
              presentation.downstream.has(edge.target)
            ? "downstream"
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
          readOnly: presenting,
        },
        position: {
          x:
            upstream.position.x +
            (downstream.position.x - upstream.position.x) / 2,
          y:
            upstream.position.y +
            (downstream.position.y - upstream.position.y) / 2,
        },
        draggable: false,
        selectable: !presenting,
      };

      barrierNodes.push(barrierNode);

      return [
        {
          ...presentedEdge,
          id: `${edge.id}-${matchingBarrier.id}-upstream`,
          target: matchingBarrier.id,
        },
        {
          ...presentedEdge,
          id: `${edge.id}-${matchingBarrier.id}-downstream`,
          source: matchingBarrier.id,
        },
      ];
    });

    const styledEdges = flowEdges.map((edge) => {
      const isAction = edge.data?.kind === "ActionEdge";
      const upstream = edge.data?.presentationRole === "upstream";
      const downstream = edge.data?.presentationRole === "downstream";
      const highlighted = upstream || downstream;
      const unrelated = Boolean(selectionId) && !highlighted;
      return {
        ...edge,
        type: "step",
        className: isAction
          ? "incident-edge incident-edge--action"
          : highlighted
            ? `incident-edge incident-edge--${upstream ? "upstream" : "downstream"}`
            : `incident-edge${unrelated ? " incident-edge--unrelated" : ""}`,
        style: {
          stroke: isAction
            ? "#94a3b8"
            : upstream
              ? "#7c3aed"
              : downstream
                ? "#0369a1"
                : "#475569",
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
  }, [barriers, chainNodes, edges, presenting, selectionId]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData | BarrierNodeData>) => {
      if (presenting) return;
      select(node.id);
      onInspect?.();
    },
    [onInspect, presenting, select],
  );

  const handlePaneClick = useCallback(() => {
    if (!presenting) select(null);
  }, [presenting, select]);

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
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        snapToGrid
        snapGrid={[8, 8]}
        nodesFocusable={!presenting}
        nodesDraggable={!presenting}
        nodesConnectable={false}
        elementsSelectable={!presenting}
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
            if ((node.data.positiveConsequenceBulletPoints?.length ?? 0) > 0)
              return "#059669";
            if ((node.data.negativeConsequenceBulletPoints?.length ?? 0) > 0)
              return "#e11d48";
            return "#64748b";
          }}
          maskColor="rgba(241, 245, 249, 0.72)"
        />
      </ReactFlow>
    </div>
  );
};
