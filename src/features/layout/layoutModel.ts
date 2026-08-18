/**
 * The public layout contract.  Deliberately contains no React Flow (or layout
 * engine) types so it can be used by workers and by non-React renderers.
 */
export type LayoutId = string;

export type Point = Readonly<{ x: number; y: number }>;
export type Rectangle = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type MeasuredDimensions = Readonly<{ width: number; height: number }>;

export type SemanticNodeKind = "Event" | "Factor" | "Impact";
export type SemanticNode = Readonly<{
  id: LayoutId;
  kind: SemanticNodeKind;
  position?: Point;
  dimensions?: MeasuredDimensions;
  layoutHints?: LayoutHints;
}>;

export type Action = Readonly<{
  id: LayoutId;
  kind: "Action";
  attachedToId: LayoutId;
  position?: Point;
  dimensions?: MeasuredDimensions;
  layoutHints?: LayoutHints;
}>;

export type Control = Readonly<{
  id: LayoutId;
  kind: "Control";
  relationshipId: LayoutId;
  upstreamNodeId: LayoutId;
  downstreamNodeId: LayoutId;
  dimensions?: MeasuredDimensions;
  layoutHints?: LayoutHints;
}>;

export type CausalRelationship = Readonly<{
  id: LayoutId;
  kind: "Causal";
  fromId: LayoutId;
  toId: LayoutId;
}>;

export type ActionRelationship = Readonly<{
  id: LayoutId;
  kind: "Action";
  fromId: LayoutId;
  toId: LayoutId;
}>;

export type ChronologyItem = Readonly<{
  nodeId: LayoutId;
  timestamp: string;
  order?: number;
}>;

export type LayoutHints = Readonly<{
  fixed?: boolean;
  preferredPosition?: Point;
  rank?: number;
  order?: number;
}>;

export type CausalRouteRole = "Direct" | "Branch" | "Merge" | "BranchAndMerge";

export type LayoutNodeRole = "Semantic" | "Control" | "Action";
export type LayoutNodeGeometry = Readonly<{
  id: LayoutId;
  role: LayoutNodeRole;
  rectangle: Rectangle;
  /** Present only for ephemeral projected Control nodes. */
  controlId?: LayoutId;
  /** The persisted relationship represented by a projected Control. */
  relationshipId?: LayoutId;
}>;

export type OrthogonalRoute = readonly [Point, Point, ...Point[]];
export type RoutedRelationship = Readonly<{
  id: LayoutId;
  relationshipId: LayoutId;
  kind: "Causal" | "Action";
  fromId: LayoutId;
  toId: LayoutId;
  role: CausalRouteRole;
  /** Ordered points; every adjacent pair is horizontal or vertical. */
  route: OrthogonalRoute;
}>;

export type LayoutResult = Readonly<{
  nodes: readonly LayoutNodeGeometry[];
  relationships: readonly RoutedRelationship[];
  bounds: Rectangle;
}>;

export type InvestigationLayoutInput = Readonly<{
  nodes: readonly SemanticNode[];
  relationships: readonly (CausalRelationship | ActionRelationship)[];
  controls?: readonly Control[];
  actions?: readonly Action[];
  chronology?: readonly ChronologyItem[];
}>;

export type LayoutMode = "Incremental" | "ArrangeMap";
export type InvestigationLayoutOptions = Readonly<{
  mode: LayoutMode;
  gridSize?: number;
  horizontalGap?: number;
  verticalGap?: number;
}>;
