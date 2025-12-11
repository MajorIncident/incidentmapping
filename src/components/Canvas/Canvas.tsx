import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
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
    const nodeLookup = new Map(chainNodes.map((node) => [node.id, node]));
    const barrierNodes: Node<BarrierNodeData>[] = [];
    const flowEdges = edges.flatMap((edge) => {
      const matchingBarrier = barriers.find(
        (barrier) =>
          barrier.upstreamNodeId === edge.source &&
          barrier.downstreamNodeId === edge.target,
      );

      if (!matchingBarrier) {
        return [edge];
      }

      const upstream = nodeLookup.get(edge.source);
      const downstream = nodeLookup.get(edge.target);
      if (!upstream || !downstream) {
        return [edge];
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
          ...edge,
          id: `${edge.id}-${matchingBarrier.id}-upstream`,
          target: matchingBarrier.id,
        },
        {
          ...edge,
          id: `${edge.id}-${matchingBarrier.id}-downstream`,
          source: matchingBarrier.id,
        },
      ];
    });

    return {
      nodes: [...chainNodes, ...barrierNodes],
      renderedEdges: flowEdges,
    };
  }, [barriers, chainNodes, edges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData | BarrierNodeData>) => {
      select(node.id);
    },
    [select],
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
    reactFlow.fitView({ padding: 0.2, includeHiddenNodes: true });
  }, [layoutVersion, reactFlow]);

  const memorizedNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <ReactFlow
      key={showDetails ? "details" : "summary"}
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
    </ReactFlow>
  );
};
