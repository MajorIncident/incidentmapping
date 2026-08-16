import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
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
import { EditableMapTitle } from "./EditableMapTitle";

export type GraphPresentation = {
  roots: Set<string>;
  leaves: Set<string>;
  upstream: Set<string>;
  downstream: Set<string>;
  selectedPath: Set<string>;
  unrelated: Set<string>;
};

/** Derives transient visual state from the directed graph; nothing is persisted. */
export const deriveGraphPresentation = (
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
  selectedId: string | null,
): GraphPresentation => {
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
}: {
  onInspect?: () => void;
}): JSX.Element => {
  const chainNodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const barriers = useAppStore((state) => state.barriers);
  const selectionId = useAppStore((state) => state.selectionId);
  const mapTitle = useAppStore(
    (state) => state.metadata?.title || "Untitled Map",
  );
  const viewportRequest = useAppStore((state) => state.viewportRequest);
  const { clearViewportRequest, moveNode, select, setMapTitle } = useAppStore(
    (state) => state.actions,
  );
  const reactFlow = useReactFlow();

  const { nodes, renderedEdges } = useMemo(() => {
    const presentation = deriveGraphPresentation(
      chainNodes.map((node) => node.id),
      edges,
      selectionId,
    );
    const presentedNodes = chainNodes.map((node) => ({
      ...node,
      selected: node.id === selectionId,
      data: {
        ...node.data,
        presentation: {
          isRoot: presentation.roots.has(node.id),
          isLeaf: presentation.leaves.has(node.id),
          isOnSelectedPath: presentation.selectedPath.has(node.id),
          isUnrelated: presentation.unrelated.has(node.id),
        },
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
          breached: matchingBarrier.breached,
          breachedItems: matchingBarrier.breachedItems,
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
        selectable: true,
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
      const upstream = edge.data?.presentationRole === "upstream";
      const downstream = edge.data?.presentationRole === "downstream";
      const highlighted = upstream || downstream;
      const unrelated = Boolean(selectionId) && !highlighted;
      return {
        ...edge,
        className: highlighted
          ? `incident-edge incident-edge--${upstream ? "upstream" : "downstream"}`
          : `incident-edge${unrelated ? " incident-edge--unrelated" : ""}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: {
          stroke: upstream ? "#7c3aed" : downstream ? "#0369a1" : "#475569",
          strokeWidth: highlighted ? 3 : unrelated ? 1.5 : 2.25,
          strokeDasharray: upstream ? "7 4" : undefined,
        },
      };
    });
    return {
      nodes: [...presentedNodes, ...barrierNodes],
      renderedEdges: styledEdges,
    };
  }, [barriers, chainNodes, edges, selectionId]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData | BarrierNodeData>) => {
      select(node.id);
      onInspect?.();
    },
    [onInspect, select],
  );

  const handlePaneClick = useCallback(() => {
    select(null);
  }, [select]);

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
          duration: 400,
        });
        setTimeout(() => clearViewportRequest(viewportRequest.id), 400);
      } else {
        clearViewportRequest(viewportRequest.id);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [clearViewportRequest, reactFlow, viewportRequest]);

  const memorizedNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <div
      className="relative h-full w-full"
      aria-label={`${mapTitle} incident map`}
    >
      <EditableMapTitle title={mapTitle} onCommit={setMapTitle} />
      <aside
        className="absolute bottom-4 left-4 z-10 max-w-xs rounded-xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-sm"
        aria-label="Incident map legend"
      >
        <div className="mb-1 font-semibold text-slate-900">
          How to read this map
        </div>
        <p>
          Events flow top to bottom. Dashed purple edges are upstream; heavy
          blue edges are downstream.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />
            Barrier holding
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />
            Barrier breached
          </span>
          <span>
            <b className="text-emerald-700">+</b> positive
          </span>
          <span>
            <b className="text-rose-700">−</b> negative
          </span>
        </div>
      </aside>
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
        nodesFocusable
        nodesDraggable
        elementsSelectable
        selectionOnDrag
      >
        <Background color="#E2E8F0" gap={8} />
        <Controls showInteractive={false} />
        <MiniMap
          ariaLabel="Incident map overview"
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === "Barrier")
              return node.data.breached ? "#e11d48" : "#0ea5e9";
            if (node.data.presentation?.isRoot) return "#7c3aed";
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
