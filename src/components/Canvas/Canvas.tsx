import { useCallback, useMemo } from "react";
import ReactFlow, { Background, Controls, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore, type ChainNodeData } from "../../state/useAppStore";
import { nodeTypes } from "./NodeTypes";

export const Canvas = (): JSX.Element => {
  const nodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const { moveNode, select } = useAppStore((state) => state.actions);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<ChainNodeData>) => {
      select(node.id);
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

  const memorizedNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <ReactFlow
      style={{ width: "100%", height: "100%" }}
      nodes={nodes}
      edges={edges}
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
