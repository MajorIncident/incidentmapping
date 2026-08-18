declare module "elkjs/lib/elk-api" {
  export type ElkPoint = { x: number; y: number };
  export type ElkPort = {
    id: string;
    properties?: Record<string, string>;
  };
  export type ElkExtendedEdge = {
    id: string;
    sources: string[];
    targets: string[];
    sections?: Array<{
      startPoint: ElkPoint;
      bendPoints?: ElkPoint[];
      endPoint: ElkPoint;
    }>;
  };
  export type ElkNode = {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    ports?: ElkPort[];
    children?: ElkNode[];
    edges?: ElkExtendedEdge[];
    properties?: Record<string, string>;
    layoutOptions?: Record<string, string>;
  };
}

declare module "elkjs/lib/elk.bundled.js" {
  import type { ElkNode } from "elkjs/lib/elk-api";
  export default class ELK {
    layout(graph: ElkNode): Promise<ElkNode>;
  }
}
