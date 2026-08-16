import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";

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
    const root = presentation?.isRoot
      ? "border-violet-600 bg-violet-50/70 pt-5"
      : "border-slate-200";
    const related = presentation?.isUnrelated
      ? "opacity-45 saturate-50"
      : "opacity-100";
    const active = selected
      ? "ring-4 ring-sky-500 ring-offset-2 border-sky-700 shadow-lg"
      : presentation?.isOnSelectedPath
        ? "ring-2 ring-slate-300"
        : "ring-0";
    return `${containerClasses} ${root} ${related} ${active}`;
  }, [presentation, selected]);

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
      {presentation?.isRoot ? (
        <div className="absolute inset-x-0 top-0 rounded-t-[14px] bg-violet-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
          Root event
        </div>
      ) : null}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-600"
      />
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
