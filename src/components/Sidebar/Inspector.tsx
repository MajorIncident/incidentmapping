import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useReactFlow } from "reactflow";
import { useAppStore } from "../../state/useAppStore";

export const validateTitle = (value: string): string | null => {
  return value.trim().length === 0 ? "Title is required." : null;
};

const labelClasses =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";
const textAreaClasses =
  "min-h-[96px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";
const buttonClasses =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-accent disabled:cursor-not-allowed disabled:opacity-60";

const evidenceLabel = (id: string): string => {
  const sequence = id.match(/^E-(\d+)$/)?.[1];
  return sequence ? `EV-${String(Number(sequence)).padStart(2, "0")}` : "New";
};

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
  const setNodeActionStatus = useAppStore(
    (state) => state.actions.setNodeActionStatus,
  );
  const addEvidence = useAppStore((state) => state.actions.addEvidence);
  const updateEvidence = useAppStore((state) => state.actions.updateEvidence);
  const removeEvidence = useAppStore((state) => state.actions.removeEvidence);
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
  const [positiveConsequences, setPositiveConsequences] = useState<string[]>(
    [],
  );
  const [negativeConsequences, setNegativeConsequences] = useState<string[]>(
    [],
  );
  const [evidenceDrafts, setEvidenceDrafts] = useState<
    Array<{ id: string; text: string; persisted: boolean }>
  >([]);
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
  const evidenceInputRefs = useRef(new Map<string, HTMLInputElement>());
  const positiveAddRef = useRef<HTMLButtonElement | null>(null);
  const negativeAddRef = useRef<HTMLButtonElement | null>(null);
  const evidenceAddRef = useRef<HTMLButtonElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    listType: "positive" | "negative" | "evidence";
    itemId: string | null;
  } | null>(null);

  const createListItemId = useCallback(
    (listType: "positive" | "negative") =>
      `${listType}-${nextListItemId.current++}`,
    [],
  );

  useEffect(() => {
    setPendingFocus(null);
    setEvidenceDrafts([]);
    positiveInputRefs.current.clear();
    negativeInputRefs.current.clear();
    evidenceInputRefs.current.clear();
    positiveItemIds.current = [];
    negativeItemIds.current = [];
  }, [selectionId]);

  useEffect(() => {
    if (node) {
      setTitle(node.data.title);
      setDescription(node.data.description ?? "");
      setTitleError(null);
      setPositiveConsequences(node.data.positiveConsequenceBulletPoints ?? []);
      setNegativeConsequences(node.data.negativeConsequenceBulletPoints ?? []);
      setEvidenceDrafts((drafts) => [
        ...(node.data.evidenceItems ?? []).map((item) => ({
          ...item,
          persisted: true,
        })),
        ...drafts.filter((item) => !item.persisted),
      ]);
      setPositiveErrors([]);
      setNegativeErrors([]);
      if (
        positiveItemIds.current.length !==
        (node.data.positiveConsequenceBulletPoints ?? []).length
      ) {
        positiveItemIds.current = (
          node.data.positiveConsequenceBulletPoints ?? []
        ).map(() => createListItemId("positive"));
      }
      if (
        negativeItemIds.current.length !==
        (node.data.negativeConsequenceBulletPoints ?? []).length
      ) {
        negativeItemIds.current = (
          node.data.negativeConsequenceBulletPoints ?? []
        ).map(() => createListItemId("negative"));
      }
    } else {
      setTitle("");
      setDescription("");
      setTitleError(null);
      setPositiveConsequences([]);
      setNegativeConsequences([]);
      setEvidenceDrafts([]);
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
        : pendingFocus.listType === "negative"
          ? negativeInputRefs.current
          : evidenceInputRefs.current;
    const addButton =
      pendingFocus.listType === "positive"
        ? positiveAddRef.current
        : pendingFocus.listType === "negative"
          ? negativeAddRef.current
          : evidenceAddRef.current;
    (pendingFocus.itemId
      ? inputRefs.get(pendingFocus.itemId)
      : addButton
    )?.focus();
    setPendingFocus(null);
  }, [
    pendingFocus,
    positiveConsequences,
    negativeConsequences,
    evidenceDrafts,
  ]);

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

  const handleTimestampChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!node) {
        return;
      }
      updateNodeData(node.id, {
        timestamp: event.target.value.trim().length
          ? event.target.value
          : undefined,
      });
    },
    [node, updateNodeData],
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
      if (!node) {
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

  const handleAddEvidence = useCallback(() => {
    const id = `draft-${nextListItemId.current++}`;
    setEvidenceDrafts((items) => [
      ...items,
      { id, text: "", persisted: false },
    ]);
    setPendingFocus({ listType: "evidence", itemId: id });
  }, []);

  const commitEvidence = useCallback(
    (id: string, createAnother = false) => {
      if (!node) return;
      const draft = evidenceDrafts.find((item) => item.id === id);
      if (!draft) return;
      const text = draft.text.trim();
      if (!text) {
        if (draft.persisted) removeEvidence(node.id, id);
        setEvidenceDrafts((items) => items.filter((item) => item.id !== id));
        return;
      }
      if (draft.persisted) {
        updateEvidence(node.id, id, text);
        setEvidenceDrafts((items) =>
          items.map((item) => (item.id === id ? { ...item, text } : item)),
        );
      } else {
        const persistedId = addEvidence(node.id, text);
        if (persistedId) {
          setEvidenceDrafts((items) => items.filter((item) => item.id !== id));
        }
      }
      if (createAnother) handleAddEvidence();
    },
    [
      addEvidence,
      evidenceDrafts,
      handleAddEvidence,
      node,
      removeEvidence,
      updateEvidence,
    ],
  );

  const handleRemoveEvidence = useCallback(
    (id: string) => {
      const index = evidenceDrafts.findIndex((item) => item.id === id);
      const draft = evidenceDrafts[index];
      if (!node || !draft) return;
      if (draft.persisted) removeEvidence(node.id, id);
      const remaining = evidenceDrafts.filter((item) => item.id !== id);
      setEvidenceDrafts(remaining);
      setPendingFocus({
        listType: "evidence",
        itemId: remaining[index - 1]?.id ?? null,
      });
    },
    [evidenceDrafts, node, removeEvidence],
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
  const timestampValue = node?.data.timestamp ?? "";
  const selectedEntityId = node?.id ?? barrier?.id ?? null;

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
              Barrier between{" "}
              {upstreamNode?.data.title ?? barrier.upstreamNodeId} and{" "}
              {downstreamNode?.data.title ?? barrier.downstreamNodeId}
            </h3>
            <p className="text-xs text-slate-500">
              This barrier applies only to the selected connection.
            </p>
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
                      "Absent",
                      "Inadequate",
                      "NotUsed",
                      "Failed",
                      "Unknown",
                    ] as const
                  ).map((reason) => (
                    <option key={reason} value={reason}>
                      {reason === "NotUsed" ? "Not Used" : reason}
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
                  placeholder="Briefly explain what happened"
                />
              </div>
            </>
          ) : null}

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
              Remove Barrier
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
          <button
            type="button"
            className={`${buttonClasses} border-sky-300 bg-sky-50 text-sky-800`}
            onClick={() => addAction(node.id)}
          >
            Add Action
          </button>
        ) : null}
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
                  event.target.value as NonNullable<typeof node.data.nodeType>,
                )
              }
            >
              {(["Event", "Factor", "Impact", "Action"] as const).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </div>
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
                  value={node.data.factorCategory ?? "Human"}
                  onChange={(event) =>
                    setFactorCategory(
                      node.id,
                      event.target.value as NonNullable<
                        typeof node.data.factorCategory
                      >,
                    )
                  }
                >
                  {(
                    [
                      "Human",
                      "Equipment",
                      "Environment",
                      "Procedure",
                      "Organization",
                    ] as const
                  ).map((value) => (
                    <option key={value}>{value}</option>
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
          {node.data.nodeType === "Action" ? (
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="inspector-action-status" className={labelClasses}>
                Action status
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
          ) : null}
        </div>
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

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className={labelClasses}>Barrier</span>
          </div>
          {downstreamBranches.length === 0 ? (
            <p className="text-xs text-slate-500">
              Add a downstream ChainNode to place a barrier.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {downstreamBranches.length > 1 ? (
                <p className="text-sm font-medium text-slate-700">
                  Add barrier to branch
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
                        ? `Barrier exists: ${node.data.title} → ${childTitle}`
                        : `Add barrier: ${node.data.title} → ${childTitle}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Evidence</h3>
            <button
              ref={evidenceAddRef}
              type="button"
              className={`${buttonClasses} px-2 py-1 text-xs`}
              onClick={handleAddEvidence}
            >
              Add
            </button>
          </div>
          {evidenceDrafts.length === 0 ? (
            <p className="text-xs text-slate-500">No evidence yet.</p>
          ) : null}
          {evidenceDrafts.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-semibold text-slate-500">
                {evidenceLabel(item.id)}
              </span>
              <input
                ref={(element) => {
                  if (element) evidenceInputRefs.current.set(item.id, element);
                  else evidenceInputRefs.current.delete(item.id);
                }}
                className={inputClasses}
                value={item.text}
                placeholder="Add supporting evidence"
                aria-label={`${evidenceLabel(item.id)} evidence`}
                onChange={(event) => {
                  const text = event.target.value;
                  setEvidenceDrafts((items) =>
                    items.map((candidate) =>
                      candidate.id === item.id
                        ? { ...candidate, text }
                        : candidate,
                    ),
                  );
                }}
                onBlur={() => commitEvidence(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitEvidence(item.id, true);
                  }
                  if (event.key === "Backspace" && !event.currentTarget.value) {
                    event.preventDefault();
                    handleRemoveEvidence(item.id);
                  }
                }}
              />
              <button
                type="button"
                className={`${buttonClasses} px-2 py-1 text-xs`}
                onClick={() => handleRemoveEvidence(item.id)}
                aria-label={`Remove ${evidenceLabel(item.id)} evidence`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Consequences</h3>

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
              {positiveConsequences.map((item, index) => (
                <div
                  key={positiveItemIds.current[index]}
                  className="flex gap-2"
                >
                  <input
                    ref={(element) => {
                      const id = positiveItemIds.current[index];
                      if (element) positiveInputRefs.current.set(id, element);
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
              ))}
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
              {negativeConsequences.map((item, index) => (
                <div
                  key={negativeItemIds.current[index]}
                  className="flex gap-2"
                >
                  <input
                    ref={(element) => {
                      const id = negativeItemIds.current[index];
                      if (element) negativeInputRefs.current.set(id, element);
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
              ))}
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

        <div className="flex flex-col gap-1">
          <label htmlFor="inspector-timestamp" className={labelClasses}>
            Timestamp
          </label>
          <input
            id="inspector-timestamp"
            className={inputClasses}
            value={timestampValue}
            onChange={handleTimestampChange}
            placeholder="YYYY-MM-DDTHH:mm:ssZ"
            aria-describedby="timestamp-help"
          />
          <p id="timestamp-help" className="text-xs text-slate-500">
            Use an ISO 8601 timestamp (UTC).
          </p>
        </div>

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
    description,
    edges,
    handleAddListItem,
    handleBarrierDescriptionChange,
    handleBarrierDescriptionBlur,
    handleCenter,
    handleDescriptionBlur,
    handleAddEvidence,
    commitEvidence,
    evidenceDrafts,
    handleFocusTitle,
    handleListBlur,
    handleListChange,
    handleListKeyDown,
    handleOwnerChange,
    handleRemoveListItem,
    handleRemoveEvidence,
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
    setFactorSignificance,
    setNodeActionStatus,
    setNodeType,
    select,
    timestampValue,
    title,
    titleError,
    updateBarrierData,
  ]);

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[55%] min-h-[11rem] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-slate-700 shadow-2xl lg:relative lg:inset-auto lg:max-h-none lg:min-w-[320px] lg:max-w-sm lg:rounded-none lg:border-l lg:border-t-0 lg:p-6"
      role="complementary"
      aria-labelledby="inspector-title-heading"
      onKeyDown={handleKeyDown}
    >
      <div className="sticky top-0 z-10 flex min-h-11 items-center justify-between bg-white">
        <h2
          id="inspector-title-heading"
          className="text-base font-semibold text-slate-900"
        >
          Inspector
        </h2>
        <div className="flex items-center gap-2">
          {selectedEntityId ? (
            <span className="text-xs text-slate-500" aria-live="polite">
              ID: {selectedEntityId}
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
      {body}
    </aside>
  );
};
