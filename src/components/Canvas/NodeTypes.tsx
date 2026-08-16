import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import { resolveEvidence, selectPinnedContext } from "../../state/selectors";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";
import { NodeTagMenu } from "../NodeTagMenu/NodeTagMenu";

const causalNodeTypeOptions = ["Event", "Factor", "Impact"].map((value) => ({
  value: value as NonNullable<ChainNodeData["nodeType"]>,
  label: value,
}));
const actionNodeTypeOptions = [{ value: "Action" as const, label: "Action" }];
const factorCategoryOptions = [
  "Human",
  "Process",
  "Equipment",
  "Technology",
  "Communication",
  "Environment",
  "Organizational",
  "Other",
].map((value) => ({
  value: value as NonNullable<ChainNodeData["factorCategory"]>,
  label:
    value === "Process"
      ? "Process / Procedure"
      : value === "Technology"
        ? "Technology / System"
        : value,
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

const formatLocalDateTime = (value?: string): string | undefined => {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatLocalDate = (value?: string): string | undefined => {
  if (!value?.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
};

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
  const editorShowDetails = useAppStore((state) => state.showDetails);
  const showDetails = data.readOnly
    ? (data.viewShowDetails ?? false)
    : editorShowDetails;
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

  const graphRole = data.graphRole;
  const containerClassName = useMemo(() => {
    const significance = data.factorSignificance ?? "Normal";
    const classification =
      data.nodeType === "Factor" && significance === "RootCause"
        ? "border-rose-500 shadow-[0_8px_24px_rgba(190,24,93,0.16)]"
        : data.nodeType === "Factor" && significance === "KeyFactor"
          ? "border-amber-400"
          : "";
    const related = graphRole?.isUnrelated
      ? "opacity-60 saturate-[.7]"
      : "opacity-100";
    const active = selected
      ? "ring-4 ring-sky-500 ring-offset-2 border-sky-700 shadow-lg"
      : graphRole?.isOnSelectedPath
        ? "ring-2 ring-slate-300"
        : "ring-0";
    const action =
      data.nodeType === "Action"
        ? "border-slate-300 bg-slate-50 shadow-sm"
        : "";
    return `${containerClasses} chain-node-card border-slate-200 ${classification} ${action} ${related} ${active}`;
  }, [data.factorSignificance, data.nodeType, graphRole, selected]);

  const positivePoints = (data.positiveConsequenceBulletPoints ?? []).filter(
    (point) => point.trim().length > 0,
  );
  const negativePoints = (data.negativeConsequenceBulletPoints ?? []).filter(
    (point) => point.trim().length > 0,
  );
  const hasPositivePoints = positivePoints.length > 0;
  const hasNegativePoints = negativePoints.length > 0;
  const evidenceRegistry = useAppStore((state) => state.evidence);
  const registryEvidence = resolveEvidence(
    data.evidenceIds ?? [],
    evidenceRegistry,
  );
  const evidenceItems = registryEvidence.length
    ? registryEvidence.map((item) => ({
        id: item.id,
        text: item.title,
        type: item.type === "SystemLog" ? "System Log" : item.type,
      }))
    : (data.evidenceItems ?? [])
        .filter((item) => item.text.trim().length > 0)
        .map((item) => ({ ...item, type: undefined }));
  const visibleEvidence = evidenceItems.slice(0, 3);
  const evidenceOverflow = evidenceItems.length - visibleEvidence.length;
  const hasDescription = Boolean(data.description?.trim());
  const contextItems = data.contextItems ?? [];
  const compactContext = selectPinnedContext(contextItems).slice(0, 2);
  const hasVisibleDetails =
    hasDescription ||
    hasPositivePoints ||
    hasNegativePoints ||
    evidenceItems.length > 0 ||
    contextItems.length > 0;
  const timestamp = formatLocalDateTime(data.timestamp);
  const dueDate = formatLocalDate(data.actionDueDate);
  const significance = data.factorSignificance ?? "Normal";

  return (
    <div
      className={containerClassName}
      onDoubleClick={data.readOnly ? undefined : openEditor}
      data-read-only={data.readOnly || undefined}
      data-testid="chain-node"
      data-root={graphRole?.isRoot || undefined}
      data-leaf={graphRole?.isLeaf || undefined}
      data-selected-path={graphRole?.isOnSelectedPath || undefined}
      data-unrelated={graphRole?.isUnrelated || undefined}
      data-node-type={data.nodeType ?? "Event"}
      data-significance={data.nodeType === "Factor" ? significance : undefined}
    >
      <>
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          className={`!h-3 !w-3 !border-2 !border-white !bg-slate-600 ${data.nodeType === "Action" ? "!hidden" : ""} ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          className={`!h-3 !w-3 !border-2 !border-white !bg-slate-400 ${data.nodeType === "Action" ? "" : "!hidden"} ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
      </>
      <header className="mb-2 flex min-h-6 items-center gap-1.5 border-b border-slate-100 pb-2">
        <NodeTagMenu
          readOnly={data.readOnly}
          label="Node type"
          value={data.nodeType ?? "Event"}
          options={
            data.nodeType === "Action"
              ? actionNodeTypeOptions
              : causalNodeTypeOptions
          }
          onChange={(value) => setNodeType(id, value)}
          className={`node-tag--type node-tag--${(data.nodeType ?? "Event").toLowerCase()}`}
        />
        <span
          className="node-reference"
          aria-label={`Reference ${data.referenceId ?? "Unassigned"}`}
        >
          {data.referenceId ?? "Unassigned"}
        </span>
      </header>
      <>
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className={`!h-3 !w-3 !border-2 !border-white !bg-slate-600 ${data.nodeType === "Action" ? "!hidden" : ""} ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className={`!h-3 !w-3 !border-2 !border-white !bg-slate-400 ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
      </>
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
      {!isEditing ? (
        <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-600">
          {data.nodeType === "Impact" && data.severity ? (
            <div className="node-metadata-row">
              <span>Severity</span>
              <strong>{data.severity}</strong>
            </div>
          ) : null}
          {data.nodeType === "Event" && timestamp ? (
            <div className="node-metadata-row">
              <span>Occurred</span>
              <time dateTime={data.timestamp}>{timestamp}</time>
            </div>
          ) : null}
          {data.nodeType === "Factor" ? (
            <div className="node-metadata-row">
              <span>Category</span>
              <NodeTagMenu
                readOnly={data.readOnly}
                label="Factor category"
                value={data.factorCategory}
                placeholder="Category"
                options={factorCategoryOptions}
                onChange={(next) => setFactorCategory(id, next)}
              />
            </div>
          ) : null}
          {data.nodeType === "Factor" &&
          (significance !== "Normal" || selected) ? (
            <div className="node-metadata-row">
              <span>Significance</span>
              <NodeTagMenu
                readOnly={data.readOnly}
                label="Factor significance"
                value={significance === "Normal" ? undefined : significance}
                placeholder="Set significance"
                options={significanceOptions}
                onChange={(next) => setFactorSignificance(id, next)}
                className={`node-tag--${significance.toLowerCase()}`}
              />
            </div>
          ) : null}
          {data.nodeType === "Action" ? (
            <>
              <div className="node-metadata-row">
                <span>Status</span>
                <NodeTagMenu
                  readOnly={data.readOnly}
                  label="Action status"
                  value={data.actionStatus ?? "Proposed"}
                  options={actionStatusOptions}
                  onChange={(next) => setNodeActionStatus(id, next)}
                />
              </div>
              {data.owner?.trim() ? (
                <div className="node-metadata-row">
                  <span>Owner</span>
                  <strong>{data.owner}</strong>
                </div>
              ) : null}
              {dueDate ? (
                <div className="node-metadata-row">
                  <time dateTime={data.actionDueDate}>Due {dueDate}</time>
                </div>
              ) : null}
            </>
          ) : null}
          {(data.nodeType === "Impact" || data.nodeType === "Event") &&
          evidenceItems.length > 0 ? (
            <div
              className="node-metadata-row"
              aria-label={`${evidenceItems.length} evidence items`}
            >
              <span>Evidence</span>
              <strong>{evidenceItems.length}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      {!isEditing && !showDetails && compactContext.length ? (
        <dl
          className="mt-2 space-y-1 text-[11px] text-slate-600"
          aria-label="Pinned context"
        >
          {compactContext.map((item) => (
            <div key={item.id} className="flex min-w-0 justify-between gap-2">
              <dt className="shrink-0 font-semibold">{item.label}</dt>
              <dd className="truncate text-right">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
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
          {contextItems.length ? (
            <div className="space-y-1" data-testid="context-details">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Context
              </div>
              <dl className="space-y-1 text-[13px] text-slate-700">
                {contextItems.map((item) => (
                  <div key={item.id} className="flex min-w-0 gap-1.5">
                    <dt className="shrink-0 font-semibold">{item.label}:</dt>
                    <dd className="min-w-0 break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
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
          {evidenceItems.length > 0 ? (
            <div data-testid="evidence-summary" className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                Evidence
              </div>
              <ul className="space-y-1 text-[13px] text-slate-700">
                {visibleEvidence.map((item) => (
                  <li key={item.id} className="flex min-w-0 gap-1.5">
                    <span className="shrink-0 font-semibold text-slate-500">
                      {item.id}
                    </span>
                    {item.type ? (
                      <span className="shrink-0 text-sky-700">{item.type}</span>
                    ) : null}
                    <span className="truncate">{item.text}</span>
                  </li>
                ))}
                {evidenceOverflow > 0 ? (
                  <li className="font-medium text-slate-500">
                    +{evidenceOverflow} more
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {!isEditing &&
      !showDetails &&
      !data.readOnly &&
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
      {!isEditing &&
      !showDetails &&
      evidenceItems.length > 0 &&
      data.nodeType !== "Impact" &&
      data.nodeType !== "Event" ? (
        <div
          className="mt-2 flex h-5 items-center"
          aria-label={`${evidenceItems.length} evidence items`}
        >
          <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
            Evidence {evidenceItems.length}
          </span>
        </div>
      ) : null}
    </div>
  );
};

const BarrierNodeComponent = ({
  data,
  selected,
}: NodeProps<BarrierNodeData>): JSX.Element => {
  const treatments = {
    Effective: "border-emerald-400 bg-emerald-50",
    Degraded: "border-amber-400 bg-amber-50",
    Failed: "border-rose-400 bg-rose-50",
    Missing: "border-slate-400 bg-slate-50",
  } as const;
  const badgeClasses = {
    Effective: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Degraded: "bg-amber-100 text-amber-800 border-amber-300",
    Failed: "bg-rose-100 text-rose-700 border-rose-300",
    Missing: "bg-slate-200 text-slate-700 border-slate-400",
  } as const;
  const description = data.description?.trim();
  const failureDetails = data.failureDetails?.trim();
  const editorShowDetails = useAppStore((state) => state.showDetails);
  const showDetails = data.readOnly
    ? (data.viewShowDetails ?? false)
    : editorShowDetails;
  const failureReason = data.failureReason?.replace(/([a-z])([A-Z])/g, "$1 $2");
  const evidenceRegistry = useAppStore((state) => state.evidence);
  const evidenceItems = resolveEvidence(
    data.evidenceIds ?? [],
    evidenceRegistry,
  );
  const visibleEvidence = evidenceItems.slice(0, 3);
  const evidenceOverflow = evidenceItems.length - visibleEvidence.length;

  return (
    <div
      className={`${barrierClasses} ${
        selected
          ? "ring-4 ring-sky-500 ring-offset-2 border-sky-700 shadow-lg"
          : data.graphRole?.isOnSelectedPath
            ? "ring-2 ring-slate-300"
            : "ring-0"
      } ${data.graphRole?.isUnrelated ? "opacity-60 saturate-[.7]" : "opacity-100"} ${treatments[data.status]}`}
      data-testid="control-node"
      data-read-only={data.readOnly || undefined}
    >
      <>
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          className={`!bg-sky-500 ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className={`!bg-sky-500 ${data.readOnly ? "presentation-handle" : ""}`}
          data-presentation-handle={data.readOnly || undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
      </>
      <header className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
          CONTROL
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses[data.status]}`}
        >
          {data.status}
        </span>
      </header>
      {!data.readOnly || showDetails ? (
        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
          {description ?? "No control purpose provided."}
        </p>
      ) : null}
      {(!data.readOnly || showDetails) &&
      data.status !== "Effective" &&
      data.failureReason ? (
        <p className="mt-2 text-xs font-semibold text-slate-700">
          Failure reason: {failureReason}
        </p>
      ) : null}
      {showDetails && data.status !== "Effective" && failureDetails ? (
        <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
          {failureDetails}
        </p>
      ) : null}
      {evidenceItems.length > 0 ? (
        showDetails ? (
          <div
            className="mt-2 space-y-1 text-xs"
            data-testid="control-evidence-summary"
          >
            <div className="font-semibold uppercase tracking-wide text-sky-800">
              Evidence
            </div>
            <ul>
              {visibleEvidence.map((item) => (
                <li key={item.id}>
                  {item.type === "SystemLog" ? "System Log" : item.type} ·{" "}
                  {item.title}
                </li>
              ))}
              {evidenceOverflow > 0 ? <li>+{evidenceOverflow} more</li> : null}
            </ul>
          </div>
        ) : (
          <div
            className="mt-2"
            aria-label={`${evidenceItems.length} evidence items`}
          >
            <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
              Evidence {evidenceItems.length}
            </span>
          </div>
        )
      ) : null}
    </div>
  );
};

export const nodeTypes = {
  ChainNode: memo(ChainNodeComponent),
  Barrier: memo(BarrierNodeComponent),
};
