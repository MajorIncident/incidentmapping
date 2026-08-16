import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useReactFlow } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import { EvidenceSection } from "../Evidence/EvidenceSection";
import { ContextEditor } from "../Context/ContextEditor";
import { AssertionStateField } from "../AssertionState/AssertionState";

export const validateTitle = (value: string): string | null => {
  return value.trim().length === 0 ? "Title is required." : null;
};

const padDatePart = (value: number): string => String(value).padStart(2, "0");

export const persistedTimestampToLocalControl = (value?: string): string => {
  if (!value?.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`;
};

export const localControlToPersistedTimestamp = (
  value: string,
): string | undefined => {
  if (!value.trim()) return undefined;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      value,
    );
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second = "0", fraction = "0"] =
    match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, "0")),
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute) ||
    date.getSeconds() !== Number(second)
  ) {
    return undefined;
  }
  return date.toISOString();
};

const labelClasses =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";
const textAreaClasses =
  "min-h-[96px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";
const buttonClasses =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-accent disabled:cursor-not-allowed disabled:opacity-60";

type SectionProps = { children: React.ReactNode };
export const CoreFields = ({ children }: SectionProps): JSX.Element => (
  <>{children}</>
);
export const ConsequencesSection = ({
  children,
}: SectionProps): JSX.Element => <>{children}</>;
export const FactorClassification = ({
  children,
}: SectionProps): JSX.Element => <>{children}</>;
export const ActionFields = ({ children }: SectionProps): JSX.Element => (
  <>{children}</>
);
export const ControlInspector = ({ children }: SectionProps): JSX.Element => (
  <>{children}</>
);
export const InspectorHeader = ({ children }: SectionProps): JSX.Element => (
  <>{children}</>
);

export const Inspector = ({
  onClose,
}: {
  onClose?: () => void;
}): JSX.Element => {
  const selectionId = useAppStore((state) => state.selectionId);
  const node = useAppStore(
    (state) =>
      state.nodes.find((candidate) => candidate.id === selectionId) ?? null,
  );
  const chainNodes = useAppStore((state) => state.nodes);
  const barriers = useAppStore((state) => state.barriers);
  const edges = useAppStore((state) => state.edges);
  const barrier = useAppStore(
    (state) => state.barriers.find((item) => item.id === selectionId) ?? null,
  );
  const renameNode = useAppStore((state) => state.actions.renameNode);
  const updateNodeData = useAppStore((state) => state.actions.updateNodeData);
  const setNodeType = useAppStore((state) => state.actions.setNodeType);
  const setFactorCategory = useAppStore(
    (state) => state.actions.setFactorCategory,
  );
  const setFactorSignificance = useAppStore(
    (state) => state.actions.setFactorSignificance,
  );
  const setFactorAssertionState = useAppStore(
    (state) => state.actions.setFactorAssertionState,
  );
  const setNodeActionStatus = useAppStore(
    (state) => state.actions.setNodeActionStatus,
  );
  const setEventPhase = useAppStore((state) => state.actions.setEventPhase);
  const setEventDisplay = useAppStore((state) => state.actions.setEventDisplay);
  const setEventTimestamp = useAppStore(
    (state) => state.actions.setEventTimestamp,
  );
  const setEventEndTimestamp = useAppStore(
    (state) => state.actions.setEventEndTimestamp,
  );
  const setActionType = useAppStore((state) => state.actions.setActionType);
  const setControlRole = useAppStore((state) => state.actions.setControlRole);
  const setControlAssertionState = useAppStore(
    (state) => state.actions.setControlAssertionState,
  );
  const setNodeActionDueDate = useAppStore(
    (state) => state.actions.setNodeActionDueDate,
  );
  const setNodeActionCompletedAt = useAppStore(
    (state) => state.actions.setNodeActionCompletedAt,
  );
  const addBarrier = useAppStore((state) => state.actions.addBarrier);
  const addAction = useAppStore((state) => state.actions.addAction);
  const removeBarrier = useAppStore((state) => state.actions.removeBarrier);
  const updateBarrierData = useAppStore(
    (state) => state.actions.updateBarrierData,
  );
  const startEditing = useAppStore((state) => state.actions.startEditing);
  const editorFocusRequest = useAppStore((state) => state.editorFocusRequest);
  const clearEditorFocusRequest = useAppStore(
    (state) => state.actions.clearEditorFocusRequest,
  );
  const select = useAppStore((state) => state.actions.select);
  const { fitView } = useReactFlow();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [endDraft, setEndDraft] = useState("");
  const [showEndTime, setShowEndTime] = useState(false);
  const [timingError, setTimingError] = useState<string | null>(null);
  const [positiveConsequences, setPositiveConsequences] = useState<string[]>(
    [],
  );
  const [negativeConsequences, setNegativeConsequences] = useState<string[]>(
    [],
  );
  const [barrierDescription, setBarrierDescription] = useState("");
  const [positiveErrors, setPositiveErrors] = useState<string[]>([]);
  const [negativeErrors, setNegativeErrors] = useState<string[]>([]);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const barrierDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const nextListItemId = useRef(0);
  const positiveItemIds = useRef<string[]>([]);
  const negativeItemIds = useRef<string[]>([]);
  const positiveInputRefs = useRef(new Map<string, HTMLInputElement>());
  const negativeInputRefs = useRef(new Map<string, HTMLInputElement>());
  const positiveAddRef = useRef<HTMLButtonElement | null>(null);
  const negativeAddRef = useRef<HTMLButtonElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    listType: "positive" | "negative";
    itemId: string | null;
  } | null>(null);

  const createListItemId = useCallback(
    (listType: "positive" | "negative") =>
      `${listType}-${nextListItemId.current++}`,
    [],
  );

  useLayoutEffect(() => {
    setPendingFocus(null);
    positiveInputRefs.current.clear();
    negativeInputRefs.current.clear();
    positiveItemIds.current = [];
    negativeItemIds.current = [];
  }, [selectionId]);

  useEffect(() => {
    if (node) {
      setTitle(node.data.title);
      setDescription(node.data.description ?? "");
      setTitleError(null);
      setStartDraft(persistedTimestampToLocalControl(node.data.timestamp));
      setEndDraft(persistedTimestampToLocalControl(node.data.endTimestamp));
      setShowEndTime(Boolean(node.data.endTimestamp));
      setTimingError(null);
      const supportsConsequences =
        node.data.nodeType === "Impact" || node.data.nodeType === "Event";
      setPositiveConsequences(
        supportsConsequences
          ? (node.data.positiveConsequenceBulletPoints ?? [])
          : [],
      );
      setNegativeConsequences(
        supportsConsequences
          ? (node.data.negativeConsequenceBulletPoints ?? [])
          : [],
      );
      setPositiveErrors([]);
      setNegativeErrors([]);
      if (
        positiveItemIds.current.length !==
        (supportsConsequences
          ? (node.data.positiveConsequenceBulletPoints ?? [])
          : []
        ).length
      ) {
        positiveItemIds.current = supportsConsequences
          ? (node.data.positiveConsequenceBulletPoints ?? []).map(() =>
              createListItemId("positive"),
            )
          : [];
      }
      if (
        negativeItemIds.current.length !==
        (supportsConsequences
          ? (node.data.negativeConsequenceBulletPoints ?? [])
          : []
        ).length
      ) {
        negativeItemIds.current = supportsConsequences
          ? (node.data.negativeConsequenceBulletPoints ?? []).map(() =>
              createListItemId("negative"),
            )
          : [];
      }
    } else {
      setTitle("");
      setDescription("");
      setTitleError(null);
      setPositiveConsequences([]);
      setNegativeConsequences([]);
      setPositiveErrors([]);
      setNegativeErrors([]);
      positiveItemIds.current = [];
      negativeItemIds.current = [];
    }
  }, [createListItemId, node]);

  useEffect(() => {
    if (
      node &&
      editorFocusRequest?.field === "description" &&
      editorFocusRequest.entityId === node.id
    ) {
      descriptionRef.current?.focus();
      descriptionRef.current?.select();
      clearEditorFocusRequest(editorFocusRequest.id);
    }
  }, [clearEditorFocusRequest, editorFocusRequest, node]);

  useEffect(() => {
    setBarrierDescription(barrier?.description ?? "");
  }, [barrier]);

  useEffect(() => {
    if (
      barrier &&
      editorFocusRequest?.field === "barrier-description" &&
      editorFocusRequest.entityId === barrier.id
    ) {
      barrierDescriptionRef.current?.focus();
      clearEditorFocusRequest(editorFocusRequest.id);
    }
  }, [barrier, clearEditorFocusRequest, editorFocusRequest]);

  useEffect(() => {
    if (!pendingFocus) return;
    const inputRefs =
      pendingFocus.listType === "positive"
        ? positiveInputRefs.current
        : negativeInputRefs.current;
    const addButton =
      pendingFocus.listType === "positive"
        ? positiveAddRef.current
        : negativeAddRef.current;
    (pendingFocus.itemId
      ? inputRefs.get(pendingFocus.itemId)
      : addButton
    )?.focus();
    setPendingFocus(null);
  }, [pendingFocus, positiveConsequences, negativeConsequences]);

  const handleTitleCommit = useCallback(() => {
    if (!node) {
      return;
    }
    const validation = validateTitle(title);
    if (validation) {
      setTitleError(validation);
      return;
    }
    const renamed = renameNode(node.id, title);
    if (!renamed) {
      setTitle(node.data.title);
    }
    setTitleError(null);
  }, [node, renameNode, title]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleTitleCommit();
    },
    [handleTitleCommit],
  );

  const handleDescriptionBlur = useCallback(() => {
    if (!node) {
      return;
    }
    updateNodeData(node.id, {
      description: description.trim().length ? description : undefined,
    });
  }, [description, node, updateNodeData]);

  const handleOwnerChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!node) {
        return;
      }
      updateNodeData(node.id, {
        owner: event.target.value.trim().length
          ? event.target.value
          : undefined,
      });
    },
    [node, updateNodeData],
  );

  const commitEventTiming = useCallback(
    (field: "start" | "end", localValue: string) => {
      if (!node || node.data.nodeType !== "Event") return;
      field === "start" ? setStartDraft(localValue) : setEndDraft(localValue);
      const persisted = localControlToPersistedTimestamp(localValue);
      if (localValue.trim() && !persisted) {
        setTimingError("Enter a valid date and time.");
        return;
      }
      const otherLocal = field === "start" ? endDraft : startDraft;
      const other = localControlToPersistedTimestamp(otherLocal);
      const start = field === "start" ? persisted : other;
      const end = field === "end" ? persisted : other;
      if (start && end && Date.parse(end) < Date.parse(start)) {
        setTimingError(
          "End time must be the same as or later than start time.",
        );
        return;
      }
      setTimingError(null);
      field === "start"
        ? setEventTimestamp(node.id, persisted)
        : setEventEndTimestamp(node.id, persisted);
    },
    [endDraft, node, setEventEndTimestamp, setEventTimestamp, startDraft],
  );

  const handleTimestampChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (node?.data.nodeType === "Event")
        commitEventTiming("start", event.target.value);
      else if (node) {
        const timestamp = localControlToPersistedTimestamp(event.target.value);
        if (!event.target.value.trim() || timestamp)
          updateNodeData(node.id, { timestamp });
      }
    },
    [commitEventTiming, node, updateNodeData],
  );

  const handleBarrierDescriptionBlur = useCallback(() => {
    if (!barrier) {
      return;
    }
    const trimmed = barrierDescription.trim();
    const description = trimmed.length ? trimmed : undefined;
    setBarrierDescription(description ?? "");
    updateBarrierData(barrier.id, { description }, { debounceHistory: true });
  }, [barrier, barrierDescription, updateBarrierData]);

  const handleBarrierDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (!barrier) return;
      const nextDescription = event.target.value;
      setBarrierDescription(nextDescription);
      updateBarrierData(
        barrier.id,
        { description: nextDescription },
        { debounceHistory: true },
      );
    },
    [barrier, updateBarrierData],
  );

  const handleFocusTitle = useCallback(() => {
    if (selectionId) {
      startEditing(selectionId);
    }
  }, [selectionId, startEditing]);

  const validateListValues = useCallback((values: string[]): string[] => {
    return values.map((value) =>
      value.trim().length === 0 ? "This field is required." : "",
    );
  }, []);

  const commitListValues = useCallback(
    (
      listType: "positive" | "negative",
      values: string[],
      setValues: (next: string[]) => void,
      setErrors: (next: string[]) => void,
    ) => {
      if (!node || useAppStore.getState().selectionId !== node.id) {
        return;
      }

      const errors = validateListValues(values);
      setErrors(errors);
      setValues(values);

      const hasError = errors.some((error) => error.length > 0);
      if (hasError) {
        return;
      }

      const trimmedValues = values.map((value) => value.trim());
      updateNodeData(node.id, {
        [listType === "positive"
          ? "positiveConsequenceBulletPoints"
          : "negativeConsequenceBulletPoints"]: trimmedValues,
      });
    },
    [node, updateNodeData, validateListValues],
  );

  const handleListChange = useCallback(
    (
      listType: "positive" | "negative",
      index: number,
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const value = event.target.value;
      if (listType === "positive") {
        const next = [...positiveConsequences];
        next[index] = value;
        commitListValues(
          "positive",
          next,
          setPositiveConsequences,
          setPositiveErrors,
        );
      } else {
        const next = [...negativeConsequences];
        next[index] = value;
        commitListValues(
          "negative",
          next,
          setNegativeConsequences,
          setNegativeErrors,
        );
      }
    },
    [
      commitListValues,
      negativeConsequences,
      positiveConsequences,
      setNegativeConsequences,
      setPositiveConsequences,
    ],
  );

  const handleAddListItem = useCallback(
    (listType: "positive" | "negative") => {
      const itemId = createListItemId(listType);
      setPendingFocus({ listType, itemId });
      if (listType === "positive") {
        positiveItemIds.current = [...positiveItemIds.current, itemId];
        const next = [...positiveConsequences, ""];
        commitListValues(
          "positive",
          next,
          setPositiveConsequences,
          setPositiveErrors,
        );
      } else {
        negativeItemIds.current = [...negativeItemIds.current, itemId];
        const next = [...negativeConsequences, ""];
        commitListValues(
          "negative",
          next,
          setNegativeConsequences,
          setNegativeErrors,
        );
      }
    },
    [
      commitListValues,
      createListItemId,
      negativeConsequences,
      positiveConsequences,
      setNegativeConsequences,
      setPositiveConsequences,
    ],
  );

  const handleRemoveListItem = useCallback(
    (listType: "positive" | "negative", index: number) => {
      if (listType === "positive") {
        const remainingIds = positiveItemIds.current.filter(
          (_, i) => i !== index,
        );
        positiveItemIds.current = remainingIds;
        setPendingFocus({ listType, itemId: remainingIds[index - 1] ?? null });
        const next = positiveConsequences.filter((_, i) => i !== index);
        const nextErrors = positiveErrors.filter((_, i) => i !== index);
        setPositiveErrors(nextErrors);
        commitListValues(
          "positive",
          next,
          setPositiveConsequences,
          setPositiveErrors,
        );
      } else {
        const remainingIds = negativeItemIds.current.filter(
          (_, i) => i !== index,
        );
        negativeItemIds.current = remainingIds;
        setPendingFocus({ listType, itemId: remainingIds[index - 1] ?? null });
        const next = negativeConsequences.filter((_, i) => i !== index);
        const nextErrors = negativeErrors.filter((_, i) => i !== index);
        setNegativeErrors(nextErrors);
        commitListValues(
          "negative",
          next,
          setNegativeConsequences,
          setNegativeErrors,
        );
      }
    },
    [
      commitListValues,
      negativeConsequences,
      negativeErrors,
      positiveConsequences,
      positiveErrors,
      setNegativeConsequences,
      setPositiveConsequences,
    ],
  );

  const handleListBlur = useCallback(
    (
      listType: "positive" | "negative",
      currentValues: string[],
      setValues: (next: string[]) => void,
      setErrors: (next: string[]) => void,
    ) => {
      commitListValues(listType, currentValues, setValues, setErrors);
    },
    [commitListValues],
  );

  const handleListKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      listType: "positive" | "negative",
      index: number,
    ) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const values =
          listType === "positive" ? positiveConsequences : negativeConsequences;
        const errors = validateListValues(values);
        const hasError = errors.some((error) => error.length > 0);
        if (!hasError) {
          handleAddListItem(listType);
        } else {
          if (listType === "positive") {
            setPositiveErrors(errors);
          } else {
            setNegativeErrors(errors);
          }
          const itemIds =
            listType === "positive"
              ? positiveItemIds.current
              : negativeItemIds.current;
          const inputRefs =
            listType === "positive"
              ? positiveInputRefs.current
              : negativeInputRefs.current;
          inputRefs.get(itemIds[errors.findIndex(Boolean)])?.focus();
        }
      }

      if (event.key === "Backspace" && event.currentTarget.value === "") {
        const values =
          listType === "positive" ? positiveConsequences : negativeConsequences;
        if (values.length > 0) {
          handleRemoveListItem(listType, index);
        }
      }
    },
    [
      handleAddListItem,
      handleRemoveListItem,
      negativeConsequences,
      positiveConsequences,
      validateListValues,
    ],
  );

  const handleCenter = useCallback(() => {
    if (!selectionId) {
      return;
    }
    fitView({
      nodes: [{ id: selectionId }],
      duration: 300,
      padding: 0.6,
    });
  }, [fitView, selectionId]);

  const ownerValue = node?.data.owner ?? "";
  const timestampValue =
    node?.data.nodeType === "Event"
      ? startDraft
      : persistedTimestampToLocalControl(node?.data.timestamp);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        select(null);
      }
    },
    [select],
  );

  const body = useMemo(() => {
    if (barrier) {
      const upstreamNode =
        chainNodes.find(
          (candidate) => candidate.id === barrier.upstreamNodeId,
        ) ?? null;
      const downstreamNode =
        chainNodes.find(
          (candidate) => candidate.id === barrier.downstreamNodeId,
        ) ?? null;

      return (
        <form
          className="flex flex-1 flex-col gap-5"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Control between{" "}
              {upstreamNode?.data.title ?? barrier.upstreamNodeId} and{" "}
              {downstreamNode?.data.title ?? barrier.downstreamNodeId}
            </h3>
            <p className="text-xs text-slate-500">
              This control applies only to the selected connection.
            </p>
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">What is a Control?</summary>
              <p className="mt-1">
                Controls are measures intended to prevent, detect, or reduce an
                undesirable event.
              </p>
            </details>
          </div>

          <AssertionStateField
            id="barrier-assertion-state"
            value={barrier.assertionState}
            onChange={(value) => setControlAssertionState(barrier.id, value)}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="barrier-control-role" className={labelClasses}>
              Control Role
            </label>
            <select
              id="barrier-control-role"
              className={inputClasses}
              value={barrier.controlRole ?? ""}
              onChange={(event) =>
                setControlRole(
                  barrier.id,
                  (event.target.value ||
                    undefined) as typeof barrier.controlRole,
                )
              }
            >
              <option value="">Not set</option>
              {(["Preventive", "Detective", "Mitigating"] as const).map(
                (role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="barrier-description" className={labelClasses}>
              Control Purpose
            </label>
            <textarea
              ref={barrierDescriptionRef}
              id="barrier-description"
              className={textAreaClasses}
              value={barrierDescription}
              onChange={handleBarrierDescriptionChange}
              onBlur={handleBarrierDescriptionBlur}
              placeholder="Describe what this control is intended to do"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="barrier-status" className={labelClasses}>
              Status
            </label>
            <select
              id="barrier-status"
              className={inputClasses}
              value={barrier.status}
              onChange={(event) =>
                updateBarrierData(barrier.id, {
                  status: event.target.value as typeof barrier.status,
                })
              }
            >
              {(["Effective", "Degraded", "Failed", "Missing"] as const).map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
          </div>

          {barrier.status !== "Effective" ? (
            <>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="barrier-failure-reason"
                  className={labelClasses}
                >
                  Why Did It Fail?
                </label>
                <select
                  id="barrier-failure-reason"
                  className={inputClasses}
                  value={barrier.failureReason ?? ""}
                  onChange={(event) =>
                    updateBarrierData(barrier.id, {
                      failureReason: (event.target.value ||
                        undefined) as typeof barrier.failureReason,
                    })
                  }
                >
                  <option value="">Select a reason</option>
                  {(
                    [
                      "NotFollowed",
                      "Bypassed",
                      "IncorrectConfiguration",
                      "SystemFailure",
                      "InadequateDesign",
                      "Unavailable",
                      "NotInPlace",
                      "Unknown",
                      "Other",
                    ] as const
                  ).map((reason) => (
                    <option key={reason} value={reason}>
                      {reason.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="barrier-failure-details"
                  className={labelClasses}
                >
                  Failure Details
                </label>
                <textarea
                  id="barrier-failure-details"
                  className={textAreaClasses}
                  value={barrier.failureDetails ?? ""}
                  onChange={(event) =>
                    updateBarrierData(
                      barrier.id,
                      { failureDetails: event.target.value },
                      { debounceHistory: true },
                    )
                  }
                  placeholder="Briefly explain what happened."
                />
              </div>
            </>
          ) : null}

          <EvidenceSection target={{ kind: "control", id: barrier.id }} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClasses}
              onClick={() => select(barrier.upstreamNodeId)}
            >
              Select Upstream Node
            </button>
            <button
              type="button"
              className={buttonClasses}
              onClick={() => select(barrier.downstreamNodeId)}
            >
              Select Downstream Node
            </button>
            <button
              type="button"
              className={`${buttonClasses} border-rose-200 text-rose-700`}
              onClick={() => removeBarrier(barrier.id)}
            >
              Remove Control
            </button>
          </div>
        </form>
      );
    }

    if (!node) {
      return (
        <p className="text-sm text-slate-500" role="status">
          Select a node to edit its details.
        </p>
      );
    }

    const downstreamBranches = edges
      .filter(
        (edge) => edge.source === node.id && edge.data?.kind !== "ActionEdge",
      )
      .map((edge, index, branchEdges) => ({
        edge,
        node:
          chainNodes.find((candidate) => candidate.id === edge.target) ?? null,
        barrier:
          barriers.find(
            (item) =>
              item.upstreamNodeId === node.id &&
              item.downstreamNodeId === edge.target,
          ) ?? null,
        index,
        count: branchEdges.length,
      }));

    return (
      <form className="flex flex-1 flex-col gap-5" onSubmit={handleSubmit}>
        {node.data.nodeType !== "Action" ? (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-node-type" className={labelClasses}>
                Type
              </label>
              <select
                id="inspector-node-type"
                className={inputClasses}
                value={node.data.nodeType ?? "Event"}
                onChange={(event) =>
                  setNodeType(
                    node.id,
                    event.target.value as NonNullable<
                      typeof node.data.nodeType
                    >,
                  )
                }
              >
                {(["Event", "Factor", "Impact"] as const).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            {node.data.nodeType === "Event" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="inspector-event-phase" className={labelClasses}>
                  Event Phase
                </label>
                <select
                  id="inspector-event-phase"
                  className={inputClasses}
                  value={node.data.eventPhase ?? ""}
                  onChange={(event) =>
                    setEventPhase(
                      node.id,
                      (event.target.value ||
                        undefined) as typeof node.data.eventPhase,
                    )
                  }
                >
                  <option value="">Not set</option>
                  {(
                    [
                      "Precursor",
                      "Incident",
                      "Detection",
                      "Response",
                      "Recovery",
                    ] as const
                  ).map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <span className={labelClasses}>Reference</span>
              <span className="flex min-h-[38px] items-center text-sm font-semibold text-slate-600">
                {node.data.referenceId ?? "Unassigned"}
              </span>
            </div>
            {node.data.nodeType === "Factor" ? (
              <>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="inspector-factor-category"
                    className={labelClasses}
                  >
                    Category
                  </label>
                  <select
                    id="inspector-factor-category"
                    className={inputClasses}
                    value={node.data.factorCategory ?? ""}
                    onChange={(event) =>
                      setFactorCategory(
                        node.id,
                        (event.target.value ||
                          undefined) as typeof node.data.factorCategory,
                      )
                    }
                  >
                    <option value="">Uncategorized</option>
                    {(
                      [
                        "Human",
                        "Process",
                        "Equipment",
                        "Technology",
                        "Communication",
                        "Environment",
                        "Organizational",
                        "Other",
                      ] as const
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value === "Process"
                          ? "Process / Procedure"
                          : value === "Technology"
                            ? "Technology / System"
                            : value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="inspector-factor-significance"
                    className={labelClasses}
                  >
                    Significance
                  </label>
                  <select
                    id="inspector-factor-significance"
                    className={inputClasses}
                    value={node.data.factorSignificance ?? "Normal"}
                    onChange={(event) =>
                      setFactorSignificance(
                        node.id,
                        event.target.value as NonNullable<
                          typeof node.data.factorSignificance
                        >,
                      )
                    }
                  >
                    <option value="Normal">Normal</option>
                    <option value="KeyFactor">Key Factor</option>
                    <option value="RootCause">Root Cause</option>
                  </select>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {node.data.nodeType === "Factor" ? (
          <AssertionStateField
            id="factor-assertion-state"
            value={node.data.assertionState}
            onChange={(value) => setFactorAssertionState(node.id, value)}
          />
        ) : null}
        {node.data.nodeType === "Action" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-action-type" className={labelClasses}>
              Action Type
            </label>
            <select
              id="inspector-action-type"
              className={inputClasses}
              value={node.data.actionType ?? ""}
              onChange={(event) =>
                setActionType(
                  node.id,
                  (event.target.value ||
                    undefined) as typeof node.data.actionType,
                )
              }
            >
              <option value="">Not set</option>
              <option value="Immediate">Immediate / Containment</option>
              <option value="Corrective">Corrective</option>
              <option value="Preventive">Preventive</option>
            </select>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-title" className={labelClasses}>
            Title
          </label>
          <input
            id="inspector-title"
            className={`${inputClasses} ${titleError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (titleError) {
                setTitleError(null);
              }
            }}
            onBlur={handleTitleCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleTitleCommit();
              }
            }}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? "inspector-title-error" : undefined}
          />
          {titleError ? (
            <p
              id="inspector-title-error"
              role="alert"
              className="text-xs font-medium text-red-600"
            >
              {titleError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-description" className={labelClasses}>
            Description
          </label>
          <textarea
            ref={descriptionRef}
            id="inspector-description"
            className={textAreaClasses}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={handleDescriptionBlur}
          />
        </div>

        {node.data.nodeType === "Action" ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="inspector-action-status" className={labelClasses}>
                Status
              </label>
              <select
                id="inspector-action-status"
                className={inputClasses}
                value={node.data.actionStatus ?? "Proposed"}
                onChange={(event) =>
                  setNodeActionStatus(
                    node.id,
                    event.target.value as NonNullable<
                      typeof node.data.actionStatus
                    >,
                  )
                }
              >
                <option value="Proposed">Proposed</option>
                <option value="Planned">Planned</option>
                <option value="InProgress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </>
        ) : null}

        {node.data.nodeType === "Impact" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-severity" className={labelClasses}>
              Severity
            </label>
            <select
              id="inspector-severity"
              className={inputClasses}
              value={node.data.severity ?? ""}
              onChange={(event) =>
                updateNodeData(node.id, {
                  severity: (event.target.value ||
                    undefined) as typeof node.data.severity,
                })
              }
            >
              <option value="">Not set</option>
              {(["Low", "Medium", "High", "Critical"] as const).map(
                (severity) => (
                  <option key={severity}>{severity}</option>
                ),
              )}
            </select>
          </div>
        ) : null}

        {node.data.nodeType === "Event" || node.data.nodeType === "Factor" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className={labelClasses}>Controls</span>
            </div>
            {downstreamBranches.length === 0 ? (
              <p className="text-xs text-slate-500">
                Add a downstream node to place a Control.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {downstreamBranches.length > 1 ? (
                  <p className="text-sm font-medium text-slate-700">
                    Add Control to branch
                  </p>
                ) : null}
                {downstreamBranches.map((branch) => {
                  const childTitle =
                    branch.node?.data.title ?? branch.edge.target;
                  const context =
                    branch.count > 1
                      ? `Branch ${branch.index + 1} of ${branch.count} · ${branch.edge.target.slice(-6)}`
                      : null;
                  return (
                    <div
                      key={branch.edge.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 text-sm text-slate-700">
                        <span>{childTitle}</span>
                        {context ? (
                          <span className="block text-xs text-slate-500">
                            {context}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`${buttonClasses} px-2 py-1 text-xs`}
                        disabled={Boolean(branch.barrier)}
                        onClick={() => addBarrier(node.id, branch.edge.target)}
                      >
                        {branch.barrier
                          ? `Control exists: ${node.data.title} → ${childTitle}`
                          : `Add Control: ${node.data.title} → ${childTitle}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {node.data.nodeType !== "Action" ? (
          <ContextEditor
            target={node.id}
            items={node.data.contextItems ?? []}
          />
        ) : null}

        <EvidenceSection target={{ kind: "node", id: node.id }} />

        {node.data.nodeType === "Impact" || node.data.nodeType === "Event" ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Consequences
            </h3>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className={labelClasses}>Positive</span>
                <button
                  ref={positiveAddRef}
                  type="button"
                  className={`${buttonClasses} px-2 py-1 text-xs`}
                  onClick={() => handleAddListItem("positive")}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {positiveConsequences.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No positive consequences yet.
                  </p>
                ) : null}
                {positiveConsequences.map((item, index) =>
                  positiveItemIds.current[index] ? (
                    <div
                      key={positiveItemIds.current[index]}
                      className="flex gap-2"
                    >
                      <input
                        ref={(element) => {
                          const id = positiveItemIds.current[index];
                          if (element)
                            positiveInputRefs.current.set(id, element);
                          else positiveInputRefs.current.delete(id);
                        }}
                        className={`${inputClasses} ${
                          positiveErrors[index]?.length
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        value={item}
                        onChange={(event) =>
                          handleListChange("positive", index, event)
                        }
                        onBlur={() =>
                          handleListBlur(
                            "positive",
                            positiveConsequences,
                            setPositiveConsequences,
                            setPositiveErrors,
                          )
                        }
                        onKeyDown={(event) =>
                          handleListKeyDown(event, "positive", index)
                        }
                        placeholder="Add a positive consequence"
                        aria-invalid={Boolean(positiveErrors[index])}
                        aria-describedby={
                          positiveErrors[index]?.length
                            ? `positive-error-${index}`
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        className={`${buttonClasses} px-2 py-1 text-xs`}
                        onClick={() => handleRemoveListItem("positive", index)}
                        aria-label={`Remove positive consequence ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null,
                )}
                {positiveErrors.some((error) => error.length > 0) ? (
                  <div className="flex flex-col gap-1">
                    {positiveErrors.map((error, index) =>
                      error.length ? (
                        <p
                          key={`positive-error-${index}`}
                          id={`positive-error-${index}`}
                          className="text-xs font-medium text-red-600"
                        >
                          {error}
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className={labelClasses}>Negative</span>
                <button
                  ref={negativeAddRef}
                  type="button"
                  className={`${buttonClasses} px-2 py-1 text-xs`}
                  onClick={() => handleAddListItem("negative")}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {negativeConsequences.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No negative consequences yet.
                  </p>
                ) : null}
                {negativeConsequences.map((item, index) =>
                  negativeItemIds.current[index] ? (
                    <div
                      key={negativeItemIds.current[index]}
                      className="flex gap-2"
                    >
                      <input
                        ref={(element) => {
                          const id = negativeItemIds.current[index];
                          if (element)
                            negativeInputRefs.current.set(id, element);
                          else negativeInputRefs.current.delete(id);
                        }}
                        className={`${inputClasses} ${
                          negativeErrors[index]?.length
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        value={item}
                        onChange={(event) =>
                          handleListChange("negative", index, event)
                        }
                        onBlur={() =>
                          handleListBlur(
                            "negative",
                            negativeConsequences,
                            setNegativeConsequences,
                            setNegativeErrors,
                          )
                        }
                        onKeyDown={(event) =>
                          handleListKeyDown(event, "negative", index)
                        }
                        placeholder="Add a negative consequence"
                        aria-invalid={Boolean(negativeErrors[index])}
                        aria-describedby={
                          negativeErrors[index]?.length
                            ? `negative-error-${index}`
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        className={`${buttonClasses} px-2 py-1 text-xs`}
                        onClick={() => handleRemoveListItem("negative", index)}
                        aria-label={`Remove negative consequence ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null,
                )}
                {negativeErrors.some((error) => error.length > 0) ? (
                  <div className="flex flex-col gap-1">
                    {negativeErrors.map((error, index) =>
                      error.length ? (
                        <p
                          key={`negative-error-${index}`}
                          id={`negative-error-${index}`}
                          className="text-xs font-medium text-red-600"
                        >
                          {error}
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-owner" className={labelClasses}>
            Owner
          </label>
          <input
            id="inspector-owner"
            className={inputClasses}
            value={ownerValue}
            onChange={handleOwnerChange}
            placeholder="Unassigned"
          />
        </div>

        {node.data.nodeType === "Action" ? (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="sr-only">Action lifecycle dates</legend>
            {node.data.actionStatus === "Completed" ? (
              <>
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    htmlFor="inspector-action-completed-at"
                    className={labelClasses}
                  >
                    Completed at
                  </label>
                  <input
                    id="inspector-action-completed-at"
                    type="date"
                    className={inputClasses}
                    value={node.data.actionCompletedAt ?? ""}
                    onChange={(event) =>
                      setNodeActionCompletedAt(node.id, event.target.value)
                    }
                  />
                </div>
                <details className="min-w-0 text-sm text-slate-600">
                  <summary className="cursor-pointer font-medium">
                    Due date
                    {node.data.actionDueDate
                      ? `: ${node.data.actionDueDate}`
                      : ""}
                  </summary>
                  <div className="mt-2 flex min-w-0 flex-col gap-1">
                    <label
                      htmlFor="inspector-action-due-date"
                      className={labelClasses}
                    >
                      Due date
                    </label>
                    <input
                      id="inspector-action-due-date"
                      type="date"
                      className={inputClasses}
                      value={node.data.actionDueDate ?? ""}
                      onChange={(event) =>
                        setNodeActionDueDate(node.id, event.target.value)
                      }
                    />
                  </div>
                </details>
              </>
            ) : (
              <div className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor="inspector-action-due-date"
                  className={labelClasses}
                >
                  Due date
                </label>
                <input
                  id="inspector-action-due-date"
                  type="date"
                  className={inputClasses}
                  value={node.data.actionDueDate ?? ""}
                  onChange={(event) =>
                    setNodeActionDueDate(node.id, event.target.value)
                  }
                />
              </div>
            )}
          </fieldset>
        ) : null}

        {node.data.nodeType === "Event" ? (
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={timingError ? "event-timing-error" : undefined}
          >
            <legend className={labelClasses}>Event timing</legend>
            <label htmlFor="inspector-timestamp" className={labelClasses}>
              Started
            </label>
            <input
              id="inspector-timestamp"
              type="datetime-local"
              step="1"
              className={inputClasses}
              value={timestampValue}
              onChange={handleTimestampChange}
              aria-invalid={Boolean(timingError)}
              aria-describedby={timingError ? "event-timing-error" : undefined}
            />
            {showEndTime || endDraft ? (
              <>
                <label
                  htmlFor="inspector-end-timestamp"
                  className={labelClasses}
                >
                  Ended
                </label>
                <input
                  id="inspector-end-timestamp"
                  type="datetime-local"
                  step="1"
                  className={inputClasses}
                  value={endDraft}
                  onChange={(event) =>
                    commitEventTiming("end", event.target.value)
                  }
                  aria-invalid={Boolean(timingError)}
                  aria-describedby={
                    timingError ? "event-timing-error" : undefined
                  }
                />
                <button
                  type="button"
                  className={buttonClasses}
                  onClick={() => {
                    setEndDraft("");
                    setShowEndTime(false);
                    setTimingError(null);
                    setEventEndTimestamp(node.id, undefined);
                  }}
                >
                  Remove end time
                </button>
              </>
            ) : (
              <button
                type="button"
                className={buttonClasses}
                onClick={() => setShowEndTime(true)}
              >
                Add end time
              </button>
            )}
            {timingError ? (
              <p
                id="event-timing-error"
                role="alert"
                className="text-xs text-red-700"
              >
                {timingError}
              </p>
            ) : null}
          </fieldset>
        ) : node.data.nodeType !== "Action" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-timestamp" className={labelClasses}>
              Occurred at
            </label>
            <input
              id="inspector-timestamp"
              type="datetime-local"
              step="1"
              className={inputClasses}
              value={timestampValue}
              onChange={handleTimestampChange}
            />
          </div>
        ) : null}

        {node.data.nodeType === "Event" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="inspector-event-display" className={labelClasses}>
              Event display
            </label>
            <select
              id="inspector-event-display"
              className={inputClasses}
              value={node.data.eventDisplay ?? "Map"}
              onChange={(event) =>
                setEventDisplay(
                  node.id,
                  event.target.value as "Map" | "ChronologyOnly",
                )
              }
            >
              <option value="Map">Show on map</option>
              <option value="ChronologyOnly">Chronology only</option>
            </select>
            <p className="text-xs text-slate-500">
              Chronology-only Events remain in Chronology but are hidden from
              the causal map unless Show Timeline Events is enabled.
            </p>
          </div>
        ) : null}

        {node.data.nodeType === "Event" || node.data.nodeType === "Factor" ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <button
              type="button"
              className={`${buttonClasses} w-full border-sky-400 bg-sky-600 text-white hover:bg-sky-700`}
              onClick={() => addAction(node.id)}
            >
              + Action
            </button>
            <p className="mt-2 text-xs text-sky-900">
              Add a corrective action that addresses this node.
            </p>
          </div>
        ) : null}

        {node.data.nodeType === "Action"
          ? (() => {
              const addressEdge = edges.find(
                (edge) =>
                  edge.target === node.id && edge.data?.kind === "ActionEdge",
              );
              const addressed = chainNodes.find(
                (candidate) => candidate.id === addressEdge?.source,
              );
              return (
                <div className="flex flex-col gap-1">
                  <span className={labelClasses}>Addresses</span>
                  {addressed ? (
                    <button
                      type="button"
                      className={`${buttonClasses} text-left`}
                      onClick={() => select(addressed.id)}
                    >
                      {addressed.data.referenceId ?? "Unassigned"} ·{" "}
                      {addressed.data.title}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">
                      No addressed node
                    </span>
                  )}
                </div>
              );
            })()
          : null}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={buttonClasses}
            onClick={handleFocusTitle}
            aria-label="Focus the selected node title"
          >
            Focus Title
          </button>
          <button
            type="button"
            className={buttonClasses}
            onClick={handleCenter}
            aria-label="Center the canvas on the selected node"
          >
            Center on Node
          </button>
        </div>
      </form>
    );
  }, [
    addBarrier,
    addAction,
    barrier,
    barrierDescription,
    barriers,
    chainNodes,
    commitEventTiming,
    description,
    endDraft,
    edges,
    handleAddListItem,
    handleBarrierDescriptionChange,
    handleBarrierDescriptionBlur,
    handleCenter,
    handleDescriptionBlur,
    handleFocusTitle,
    handleListBlur,
    handleListChange,
    handleListKeyDown,
    handleOwnerChange,
    handleRemoveListItem,
    handleSubmit,
    handleTimestampChange,
    handleTitleCommit,
    negativeConsequences,
    negativeErrors,
    node,
    ownerValue,
    positiveConsequences,
    positiveErrors,
    removeBarrier,
    setFactorCategory,
    setFactorAssertionState,
    setFactorSignificance,
    setNodeActionStatus,
    setNodeActionDueDate,
    setNodeActionCompletedAt,
    setNodeType,
    setEventPhase,
    setEventDisplay,
    setEventEndTimestamp,
    setActionType,
    setControlRole,
    setControlAssertionState,
    select,
    showEndTime,
    timingError,
    timestampValue,
    title,
    titleError,
    updateBarrierData,
    updateNodeData,
  ]);

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[55%] min-h-[11rem] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-slate-700 shadow-2xl lg:relative lg:inset-auto lg:max-h-none lg:min-w-[320px] lg:max-w-sm lg:rounded-none lg:border-l lg:border-t-0 lg:p-6"
      role="complementary"
      aria-labelledby="inspector-title-heading"
      onKeyDown={handleKeyDown}
    >
      <InspectorHeader>
        <div className="sticky top-0 z-10 flex min-h-11 items-center justify-between bg-white">
          <h2
            id="inspector-title-heading"
            className="text-base font-semibold text-slate-900"
          >
            Inspector
          </h2>
          <div className="flex items-center gap-2">
            {node ? (
              <span
                className="text-right text-xs text-slate-500"
                aria-live="polite"
              >
                <strong className="block text-slate-700">
                  {node.data.referenceId ?? "Unassigned"} ·{" "}
                  {node.data.nodeType ?? "Event"}
                </strong>
              </span>
            ) : barrier ? (
              <span
                className="text-right text-xs text-slate-500"
                aria-live="polite"
              >
                <strong className="block text-slate-700">
                  {barrier.referenceId ?? "Unassigned"} · Control
                </strong>
                Between{" "}
                {chainNodes.find((item) => item.id === barrier.upstreamNodeId)
                  ?.data.referenceId ?? "Unassigned"}{" "}
                and{" "}
                {chainNodes.find((item) => item.id === barrier.downstreamNodeId)
                  ?.data.referenceId ?? "Unassigned"}
              </span>
            ) : null}
            <button
              type="button"
              className={`${buttonClasses} min-h-11 min-w-11 px-2`}
              onClick={onClose}
              aria-label="Close inspector"
              title="Close inspector"
            >
              ×
            </button>
          </div>
        </div>
      </InspectorHeader>
      {body}
    </aside>
  );
};
