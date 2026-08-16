import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";
import { NodeTagMenu } from "../NodeTagMenu/NodeTagMenu";

const nodeTypeOptions = ["Event", "Factor", "Impact", "Action"].map(
  (value) => ({
    value: value as NonNullable<ChainNodeData["nodeType"]>,
    label: value,
  }),
);
const factorCategoryOptions = [
  "Human",
  "Equipment",
  "Environment",
  "Procedure",
  "Organization",
].map((value) => ({
  value: value as NonNullable<ChainNodeData["factorCategory"]>,
  label: value,
}));
const significanceOptions = [
  { value: "Normal" as const, label: "Normal" },
  { value: "KeyFactor" as const, label: "Key Factor" },
  { value: "RootCause" as const, label: "Root Cause" },
];
const actionStatusOptions = [
  "Proposed",
  "Planned",
  "InProgress",
  "Completed",
  "Cancelled",
].map((value) => ({
  value: value as NonNullable<ChainNodeData["actionStatus"]>,
  label: value === "InProgress" ? "In Progress" : value,
}));

const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";

const containerClasses =
  "relative min-w-[190px] max-w-[260px] rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left shadow-node transition duration-200 focus-within:ring-2 focus-within:ring-canvas-accent";

const barrierClasses =
  "relative min-w-[160px] max-w-[220px] rounded-[24px] border-2 px-4 py-3 text-left shadow-node transition";

const titleClasses = "text-sm font-semibold text-slate-800";

const ChainNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<ChainNodeData>): JSX.Element => {
  const renameNode = useAppStore((state) => state.actions.renameNode);
  const setNodeType = useAppStore((state) => state.actions.setNodeType);
  const setFactorCategory = useAppStore(
    (state) => state.actions.setFactorCategory,
  );
  const setFactorSignificance = useAppStore(
    (state) => state.actions.setFactorSignificance,
  );
  const setNodeActionStatus = useAppStore(
    (state) => state.actions.setNodeActionStatus,
  );
  const startEditing = useAppStore((state) => state.actions.startEditing);
  const finishEditing = useAppStore((state) => state.actions.finishEditing);
  const requestEditorFocus = useAppStore(
    (state) => state.actions.requestEditorFocus,
  );
  const clearEditorFocusRequest = useAppStore(
    (state) => state.actions.clearEditorFocusRequest,
  );
  const editorFocusRequest = useAppStore((state) => state.editorFocusRequest);
  const viewportRequest = useAppStore((state) => state.viewportRequest);
  const showDetails = useAppStore((state) => state.showDetails);
  const editingId = useAppStore((state) => state.editingId);
  const isEditing = editingId === id;
  const [value, setValue] = useState(data.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (
      editorFocusRequest?.field === "title" &&
      editorFocusRequest.entityId === id &&
      !viewportRequest
    ) {
      startEditing(id);
    }
  }, [editorFocusRequest, id, startEditing, viewportRequest]);

  useEffect(() => {
    if (isEditing && !viewportRequest) {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (
        editorFocusRequest?.field === "title" &&
        editorFocusRequest.entityId === id
      ) {
        clearEditorFocusRequest(editorFocusRequest.id);
      }
    }
  }, [
    clearEditorFocusRequest,
    editorFocusRequest,
    id,
    isEditing,
    viewportRequest,
  ]);

  useEffect(() => {
    setValue(data.title);
  }, [data.title, isEditing]);

  const openEditor = useCallback(() => {
    setValue(data.title);
    startEditing(id);
  }, [data.title, id, startEditing]);

  const commitEdit = useCallback(
    (continueToDescription = false) => {
      const renamed = renameNode(id, value);
      if (!renamed) {
        setValue(data.title);
      }
      finishEditing();
      if (renamed && continueToDescription)
        requestEditorFocus(id, "description");
    },
    [data.title, finishEditing, id, renameNode, requestEditorFocus, value],
  );

  const cancelEdit = useCallback(() => {
    setValue(data.title);
    finishEditing();
  }, [data.title, finishEditing]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit, commitEdit],
  );

  const presentation = data.presentation;
  const containerClassName = useMemo(() => {
    const significance = data.factorSignificance ?? "Normal";
    const root = presentation?.isRoot
      ? "border-violet-400"
      : "border-slate-200";
    const classification =
      data.nodeType === "Factor" && significance === "RootCause"
        ? "border-rose-500 shadow-[0_8px_24px_rgba(190,24,93,0.16)]"
        : data.nodeType === "Factor" && significance === "KeyFactor"
          ? "border-amber-400"
          : "";
    const related = presentation?.isUnrelated
      ? "opacity-45 saturate-50"
      : "opacity-100";
    const active = selected
      ? "ring-4 ring-sky-500 ring-offset-2 border-sky-700 shadow-lg"
      : presentation?.isOnSelectedPath
        ? "ring-2 ring-slate-300"
        : "ring-0";
    return `${containerClasses} ${root} ${classification} ${related} ${active}`;
  }, [data.factorSignificance, data.nodeType, presentation, selected]);

  const positivePoints = (data.positiveConsequenceBulletPoints ?? []).filter(
    (point) => point.trim().length > 0,
  );
  const negativePoints = (data.negativeConsequenceBulletPoints ?? []).filter(
    (point) => point.trim().length > 0,
  );
  const hasPositivePoints = positivePoints.length > 0;
  const hasNegativePoints = negativePoints.length > 0;
  const hasDescription = Boolean(data.description?.trim());
  const hasVisibleDetails =
    hasDescription || hasPositivePoints || hasNegativePoints;

  return (
    <div
      className={containerClassName}
      onDoubleClick={openEditor}
      data-testid="chain-node"
      data-root={presentation?.isRoot || undefined}
      data-leaf={presentation?.isLeaf || undefined}
      data-selected-path={presentation?.isOnSelectedPath || undefined}
      data-unrelated={presentation?.isUnrelated || undefined}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-600"
      />
      <div className="mb-2 flex min-h-6 flex-wrap items-center gap-1.5">
        <NodeTagMenu
          label="Node type"
          value={data.nodeType ?? "Event"}
          options={nodeTypeOptions}
          onChange={(value) => setNodeType(id, value)}
          className={`node-tag--type node-tag--${(data.nodeType ?? "Event").toLowerCase()}`}
        />
        <span
          className="node-reference"
          aria-label={`Reference ${data.referenceId ?? "Unassigned"}`}
        >
          {data.referenceId ?? "Unassigned"}
        </span>
        {presentation?.isRoot ? (
          <span className="node-structural-tag">Top Event</span>
        ) : null}
        {data.nodeType === "Factor" ? (
          <>
            <NodeTagMenu
              label="Factor category"
              value={data.factorCategory ?? "Human"}
              options={factorCategoryOptions}
              onChange={(value) => setFactorCategory(id, value)}
            />
            <NodeTagMenu
              label="Factor significance"
              value={data.factorSignificance ?? "Normal"}
              options={significanceOptions}
              onChange={(value) => setFactorSignificance(id, value)}
              className={`node-tag--${(data.factorSignificance ?? "Normal").toLowerCase()}`}
            />
          </>
        ) : null}
        {data.nodeType === "Action" ? (
          <NodeTagMenu
            label="Action status"
            value={data.actionStatus ?? "Proposed"}
            options={actionStatusOptions}
            onChange={(value) => setNodeActionStatus(id, value)}
          />
        ) : null}
      </div>
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-600"
      />
      {isEditing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => commitEdit()}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          aria-label="Node title"
        />
      ) : (
        <div
          className={`${titleClasses} whitespace-pre-wrap break-words leading-snug`}
        >
          {data.title}
        </div>
      )}
      {!isEditing && showDetails && hasVisibleDetails ? (
        <div
          className="mt-2 space-y-2 text-xs text-slate-600"
          data-testid="node-details"
        >
          {hasDescription ? (
            <p className="whitespace-pre-wrap break-words text-[13px] text-slate-700">
              {data.description}
            </p>
          ) : null}
          {hasPositivePoints || hasNegativePoints ? (
            <div
              className={`grid gap-2 ${
                hasPositivePoints && hasNegativePoints
                  ? "grid-cols-2"
                  : "grid-cols-1"
              }`}
              data-testid="consequence-grid"
            >
              {hasPositivePoints ? (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                    Positive
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                    {positivePoints.map((point, index) => (
                      <li
                        key={`${id}-positive-${index}`}
                        className="whitespace-pre-wrap break-words"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasNegativePoints ? (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                    Negative
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                    {negativePoints.map((point, index) => (
                      <li
                        key={`${id}-negative-${index}`}
                        className="whitespace-pre-wrap break-words"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!isEditing &&
      !showDetails &&
      (hasPositivePoints || hasNegativePoints) ? (
        <div className="mt-2 flex gap-1.5" aria-label="Consequences">
          {hasPositivePoints ? (
            <span
              className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
              aria-label={`${positivePoints.length} positive consequences`}
            >
              +{positivePoints.length}
            </span>
          ) : null}
          {hasNegativePoints ? (
            <span
              className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800"
              aria-label={`${negativePoints.length} negative consequences`}
            >
              −{negativePoints.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const BarrierNodeComponent = ({
  data,
  selected,
}: NodeProps<BarrierNodeData>): JSX.Element => {
  const bulletPoints = data.breachedItems ?? [];
  const bulletVisible = data.breached && bulletPoints.length > 0;
  const badgeText = data.breached ? "Breached" : "Holding";
  const badgeClasses = data.breached
    ? "bg-rose-100 text-rose-700 border-rose-300"
    : "bg-emerald-100 text-emerald-700 border-emerald-300";
  const description = data.description?.trim();

  return (
    <div
      className={`${barrierClasses} ${
        selected ? "ring-2 ring-canvas-accent" : "ring-0"
      } ${data.breached ? "border-rose-500 bg-rose-50" : "border-sky-500 bg-sky-50"}`}
      data-testid="barrier-node"
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!bg-sky-500"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-sky-500"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">
          Barrier
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses}`}
        >
          {badgeText}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-700">
        {description ?? "No barrier description provided."}
      </p>
      {bulletVisible ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rose-700">
          {bulletPoints.map((point, index) => (
            <li
              key={`${data.upstreamNodeId}-${data.downstreamNodeId}-${index}`}
            >
              {point}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          {data.breached ? "No breach items recorded." : "Barrier intact."}
        </p>
      )}
    </div>
  );
};

export const nodeTypes = {
  ChainNode: memo(ChainNodeComponent),
  Barrier: memo(BarrierNodeComponent),
};
