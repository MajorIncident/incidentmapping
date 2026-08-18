import { memo } from "react";
import { BaseEdge, type EdgeProps, type EdgeTypes } from "reactflow";

export type Point = { x: number; y: number };

type IncidentEdgeData = {
  kind?: string;
  presentationRole?: string;
  route?: readonly Point[];
  sharedSegments?: readonly { from: Point; to: Point }[];
};
export const IncidentEdge = memo(
  (props: EdgeProps<IncidentEdgeData>): JSX.Element => {
    const points = props.data?.route ?? [
      { x: props.sourceX, y: props.sourceY },
      { x: props.targetX, y: props.targetY },
    ];
    const path =
      points
        .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
        .join(" ") +
      (props.data?.sharedSegments ?? [])
        .map(
          (segment) =>
            ` M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`,
        )
        .join("");
    return (
      <BaseEdge
        path={path}
        markerEnd={
          props.data?.kind === "ActionEdge" ? props.markerEnd : undefined
        }
        style={props.style}
        interactionWidth={props.interactionWidth}
      />
    );
  },
);
IncidentEdge.displayName = "IncidentEdge";
export const edgeTypes: EdgeTypes = { incident: IncidentEdge };
