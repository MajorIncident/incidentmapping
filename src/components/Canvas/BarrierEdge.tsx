import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow";

export type BarrierEdgeData = {
  barrierId: string;
  description?: string;
  breached: boolean;
  breachedItems: string[];
  onSelect?: (barrierId: string) => void;
};

export const BarrierEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
  style,
}: EdgeProps<BarrierEdgeData>): JSX.Element => {
  const breached = data?.breached ?? false;
  const strokeColor = breached ? "#fb7185" : "#0284c7";
  const indicatorClassName = breached
    ? "block h-3.5 w-3.5 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]"
    : "block h-3.5 w-3.5 rotate-45 bg-sky-500 shadow-[0_0_0_2px_rgba(14,148,191,0.35)]";
  const statusText = breached ? "Breached" : "Holding";
  const label = data?.description?.trim() || "Barrier";
  const breachedItems = data?.breachedItems ?? [];
  const tooltipLines = [label];

  if (breached && breachedItems.length > 0) {
    tooltipLines.push(`Breached items: ${breachedItems.join(", ")}`);
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: selected ? 3 : 2,
          opacity: breached ? 0.9 : 0.85,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "auto",
          }}
          className="nodrag nopan"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data?.onSelect?.(data.barrierId);
            }}
            title={tooltipLines.join("\n")}
            className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition ${
              breached
                ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
                : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300"
            } ${selected ? "ring-2 ring-canvas-accent" : "ring-0"}`}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              <span className={indicatorClassName} aria-hidden />
            </span>
            <span className="max-w-[180px] truncate text-left" title={label}>
              {label}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                breached ? "text-rose-600" : "text-sky-600"
              }`}
            >
              {statusText}
            </span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
