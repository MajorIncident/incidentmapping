import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore, type ChainNodeData } from "../../state/useAppStore";
import { nodeTypes } from "./NodeTypes";
import { BarrierEdge, type BarrierEdgeData } from "./BarrierEdge";

type CanvasProps = {
  showDetails: boolean;
};

export const Canvas = ({ showDetails }: CanvasProps): JSX.Element => {
  const chainNodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const barriers = useAppStore((state) => state.barriers);
  const layoutVersion = useAppStore((state) => state.layoutVersion);
  const { moveNode, select } = useAppStore((state) => state.actions);
  const reactFlow = useReactFlow();

  const { nodes, renderedEdges } = useMemo(() => {
    const flowEdges: Edge<BarrierEdgeData>[] = edges.map((edge) => {
      const matchingBarrier = barriers.find(
        (barrier) =>
          barrier.upstreamNodeId === edge.source &&
          barrier.downstreamNodeId === edge.target,
      );

      if (!matchingBarrier) {
        return edge;
      }

      return {
        ...edge,
        id: `${edge.id}-${matchingBarrier.id}`,
        type: "BarrierEdge",
        data: {
          barrierId: matchingBarrier.id,
          description: matchingBarrier.description,
          breached: matchingBarrier.breached,
          breachedItems: matchingBarrier.breachedItems,
          onSelect: select,
        },
      } satisfies Edge<BarrierEdgeData>;
    });

    return {
      nodes: chainNodes,
      renderedEdges: flowEdges,
    };
  }, [barriers, chainNodes, edges, select]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData>) => {
      select(node.id);
    },
    [select],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge<BarrierEdgeData>) => {
      if (edge.type === "BarrierEdge" && edge.data?.barrierId) {
        select(edge.data.barrierId);
        return;
      }
      select(null);
    },
    [select],
  );

  const handlePaneClick = useCallback(() => {
    select(null);
  }, [select]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData>) => {
      moveNode(node.id, node.position);
    },
    [moveNode],
  );

  useEffect(() => {
    reactFlow.fitView({ padding: 0.2, includeHiddenNodes: true });
  }, [layoutVersion, reactFlow]);

  const memorizedNodeTypes = useMemo(() => nodeTypes, []);
  const memorizedEdgeTypes = useMemo(() => ({ BarrierEdge }), []);

  return (
    <ReactFlow
      key={showDetails ? "details" : "summary"}
      style={{ width: "100%", height: "100%" }}
      nodes={nodes}
      edges={renderedEdges}
      nodeTypes={memorizedNodeTypes}
      edgeTypes={memorizedEdgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
      proOptions={{ hideAttribution: true }}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
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
    </ReactFlow>
  );
};
