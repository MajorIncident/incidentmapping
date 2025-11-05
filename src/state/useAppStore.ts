import { create } from "zustand";
import type { Edge, Node, XYPosition } from "reactflow";
import { emptyMap, sampleMap } from "../features/maps/fixtures";
import type { ChainNode, MapData } from "../features/maps/schema";
import { createId } from "../lib/id";

export type ChainNodeData = {
  title: string;
  description?: string;
  owner?: string;
  timestamp?: string;
};

type AppState = {
  nodes: Node<ChainNodeData>[];
  edges: Edge[];
  metadata: MapData["metadata"];
  selectionId: string | null;
  actions: {
    newMap: () => void;
    loadMap: (map: MapData) => void;
    toMap: () => MapData;
    addChainNode: (options?: { parentId?: string }) => void;
    renameNode: (id: string, title: string) => void;
    moveNode: (id: string, position: XYPosition) => void;
    deleteNode: (id: string) => void;
    select: (id: string | null) => void;
  };
};

const SNAP = 8;

const snapPosition = ({ x, y }: XYPosition): XYPosition => ({
  x: Math.round(x / SNAP) * SNAP,
  y: Math.round(y / SNAP) * SNAP,
});

const chainNodeToReactNode = (node: ChainNode): Node<ChainNodeData> => ({
  id: node.id,
  type: "ChainNode",
  position: snapPosition(node.position),
  data: {
    title: node.title,
    description: node.description,
    owner: node.owner,
    timestamp: node.timestamp,
  },
});

const mapNodesToReactNodes = (nodes: ChainNode[]): Node<ChainNodeData>[] =>
  nodes.map(chainNodeToReactNode);

const mapEdgesToReactEdges = (map: MapData): Edge[] =>
  map.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    type: "default",
    data: { kind: edge.kind },
  }));

const serializeNodes = (nodes: Node<ChainNodeData>[]): ChainNode[] =>
  nodes.map((node) => ({
    id: node.id,
    kind: "ChainNode",
    title: node.data.title,
    description: node.data.description,
    owner: node.data.owner,
    timestamp: node.data.timestamp,
    position: snapPosition(node.position),
  }));

const createEmptyState = () => ({
  nodes: mapNodesToReactNodes(emptyMap.nodes),
  edges: mapEdgesToReactEdges(emptyMap),
  metadata: emptyMap.metadata ? { ...emptyMap.metadata } : undefined,
  selectionId: null,
});

export const useAppStore = create<AppState>((set, get) => ({
  nodes: mapNodesToReactNodes(sampleMap.nodes),
  edges: mapEdgesToReactEdges(sampleMap),
  metadata: sampleMap.metadata ? { ...sampleMap.metadata } : undefined,
  selectionId: sampleMap.nodes[0]?.id ?? null,
  actions: {
    newMap: () => {
      set(createEmptyState());
    },
    loadMap: (map) => {
      set({
        nodes: mapNodesToReactNodes(map.nodes),
        edges: mapEdgesToReactEdges(map),
        metadata: map.metadata ? { ...map.metadata } : undefined,
        selectionId: map.nodes[0]?.id ?? null,
      });
    },
    toMap: () => {
      const { nodes, edges, metadata } = get();
      return {
        schemaVersion: 1,
        metadata,
        nodes: serializeNodes(nodes),
        edges: edges.map((edge) => ({
          id: edge.id,
          kind: "CauseEffectEdge" as const,
          fromId: edge.source,
          toId: edge.target,
        })),
      };
    },
    addChainNode: (options) => {
      const parentId = options?.parentId ?? get().selectionId ?? undefined;
      const { nodes, edges } = get();
      const parentNode = parentId
        ? (nodes.find((node) => node.id === parentId) ?? null)
        : null;
      const basePosition = parentNode
        ? { x: parentNode.position.x, y: parentNode.position.y + 160 }
        : { x: 0, y: 0 };
      const position = snapPosition(basePosition);
      const newNodeId = createId("node");
      const newNode: Node<ChainNodeData> = {
        id: newNodeId,
        type: "ChainNode",
        position,
        data: { title: "New ChainNode" },
      };
      const nextNodes = [...nodes, newNode];
      const nextEdges = parentNode
        ? [
            ...edges,
            {
              id: createId("edge"),
              source: parentNode.id,
              target: newNodeId,
              type: "default",
              data: { kind: "CauseEffectEdge" },
            },
          ]
        : edges;

      set({ nodes: nextNodes, edges: nextEdges, selectionId: newNodeId });
    },
    renameNode: (id, title) => {
      const trimmed = title.trim();
      if (trimmed.length === 0) {
        return;
      }

      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: { ...node.data, title: trimmed },
              }
            : node,
        ),
      }));
    },
    moveNode: (id, position) => {
      const snapped = snapPosition(position);
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                position: snapped,
              }
            : node,
        ),
      }));
    },
    deleteNode: (id) => {
      const { nodes, edges } = get();
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

      visit(id);
      const remainingNodes = nodes.filter((node) => !toRemove.has(node.id));
      const remainingEdges = edges.filter(
        (edge) => !toRemove.has(edge.source) && !toRemove.has(edge.target),
      );

      set({ nodes: remainingNodes, edges: remainingEdges, selectionId: null });
    },
    select: (id) => {
      set({ selectionId: id ?? null });
    },
  },
}));
