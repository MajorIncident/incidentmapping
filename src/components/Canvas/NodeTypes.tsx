import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";

const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";

const containerClasses =
  "min-w-[180px] max-w-[240px] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left shadow-node transition";

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
  const showDetails = useAppStore((state) => state.showDetails);
  const editingId = useAppStore((state) => state.editingId);
  const isEditing = editingId === id;
  const [value, setValue] = useState(data.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setValue(data.title);
  }, [data.title, isEditing]);

  const openEditor = useCallback(() => {
    setValue(data.title);
    startEditing(id);
  }, [data.title, id, startEditing]);

  const commitEdit = useCallback(() => {
    const renamed = renameNode(id, value);
    if (!renamed) {
      setValue(data.title);
    }
    finishEditing();
  }, [data.title, finishEditing, id, renameNode, value]);

  const cancelEdit = useCallback(() => {
    setValue(data.title);
    finishEditing();
  }, [data.title, finishEditing]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit, commitEdit],
  );

  const containerClassName = useMemo(
    () =>
      `${containerClasses} ${
        selected ? "ring-2 ring-canvas-accent focus-within:ring-2" : "ring-0"
      }`,
    [selected],
  );

  const positivePoints = data.positiveConsequenceBulletPoints ?? [];
  const negativePoints = data.negativeConsequenceBulletPoints ?? [];

  return (
    <div
      className={containerClassName}
      onDoubleClick={openEditor}
      data-testid="chain-node"
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400"
      />
      {isEditing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          aria-label="Node title"
        />
      ) : (
        <div className={titleClasses}>{data.title}</div>
      )}
      {!isEditing && showDetails ? (
        <div className="mt-2 space-y-2 text-xs text-slate-600">
          {data.description ? (
            <p className="whitespace-pre-wrap break-words text-[13px] text-slate-700">
              {data.description}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                Positive
              </div>
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                {positivePoints.length > 0 ? (
                  positivePoints.map((point, index) => (
                    <li
                      key={`${id}-positive-${index}`}
                      className="whitespace-pre-wrap break-words"
                    >
                      {point}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No positive impacts</li>
                )}
              </ul>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                Negative
              </div>
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                {negativePoints.length > 0 ? (
                  negativePoints.map((point, index) => (
                    <li
                      key={`${id}-negative-${index}`}
                      className="whitespace-pre-wrap break-words"
                    >
                      {point}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No negative impacts</li>
                )}
              </ul>
            </div>
          </div>
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
      <Handle type="target" position={Position.Top} className="!bg-sky-500" />
      <Handle
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
      <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
        Between nodes
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
