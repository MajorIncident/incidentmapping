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

export const Inspector = (): JSX.Element => {
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
  const addBarrier = useAppStore((state) => state.actions.addBarrier);
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
  const [barrierDescription, setBarrierDescription] = useState("");
  const [positiveErrors, setPositiveErrors] = useState<string[]>([]);
  const [negativeErrors, setNegativeErrors] = useState<string[]>([]);
  const [breachedItems, setBreachedItems] = useState<string[]>([]);
  const [breachedErrors, setBreachedErrors] = useState<string[]>([]);
  const [isBreached, setIsBreached] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const barrierDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const nextListItemId = useRef(0);
  const positiveItemIds = useRef<string[]>([]);
  const negativeItemIds = useRef<string[]>([]);
  const breachedItemIds = useRef<string[]>([]);
  const positiveInputRefs = useRef(new Map<string, HTMLInputElement>());
  const negativeInputRefs = useRef(new Map<string, HTMLInputElement>());
  const breachedInputRefs = useRef(new Map<string, HTMLInputElement>());
  const positiveAddRef = useRef<HTMLButtonElement | null>(null);
  const negativeAddRef = useRef<HTMLButtonElement | null>(null);
  const breachedAddRef = useRef<HTMLButtonElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    listType: "positive" | "negative" | "breached";
    itemId: string | null;
  } | null>(null);

  const createListItemId = useCallback(
    (listType: "positive" | "negative" | "breached") =>
      `${listType}-${nextListItemId.current++}`,
    [],
  );

  useEffect(() => {
    setPendingFocus(null);
    positiveInputRefs.current.clear();
    negativeInputRefs.current.clear();
    breachedInputRefs.current.clear();
    positiveItemIds.current = [];
    negativeItemIds.current = [];
    breachedItemIds.current = [];
  }, [selectionId]);

  useEffect(() => {
    if (node) {
      setTitle(node.data.title);
      setDescription(node.data.description ?? "");
      setTitleError(null);
      setPositiveConsequences(node.data.positiveConsequenceBulletPoints ?? []);
      setNegativeConsequences(node.data.negativeConsequenceBulletPoints ?? []);
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
    if (barrier) {
      setIsBreached(barrier.breached);
      setBreachedItems(barrier.breachedItems ?? []);
      setBarrierDescription(barrier.description ?? "");
      setBreachedErrors([]);
      if (
        breachedItemIds.current.length !== (barrier.breachedItems ?? []).length
      ) {
        breachedItemIds.current = (barrier.breachedItems ?? []).map(() =>
          createListItemId("breached"),
        );
      }
    } else {
      setIsBreached(false);
      setBreachedItems([]);
      setBarrierDescription("");
      setBreachedErrors([]);
      breachedItemIds.current = [];
    }
  }, [barrier, createListItemId]);

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
          : breachedInputRefs.current;
    const addButton =
      pendingFocus.listType === "positive"
        ? positiveAddRef.current
        : pendingFocus.listType === "negative"
          ? negativeAddRef.current
          : breachedAddRef.current;
    (pendingFocus.itemId
      ? inputRefs.get(pendingFocus.itemId)
      : addButton
    )?.focus();
    setPendingFocus(null);
  }, [pendingFocus, positiveConsequences, negativeConsequences, breachedItems]);

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

  const handleToggleBreached = useCallback(
    (checked: boolean) => {
      if (!barrier) {
        return;
      }
      setIsBreached(checked);
      updateBarrierData(barrier.id, { breached: checked });
    },
    [barrier, updateBarrierData],
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

  const validateBreachedList = useCallback((values: string[]): string[] => {
    return values.map((value) =>
      value.trim().length === 0 ? "This field is required." : "",
    );
  }, []);

  const commitBreachedItems = useCallback(
    (values: string[]) => {
      if (!barrier) {
        return;
      }
      const errors = validateBreachedList(values);
      setBreachedErrors(errors);
      setBreachedItems(values);
      if (errors.some((error) => error.length > 0)) {
        return;
      }
      const trimmed = values.map((value) => value.trim());
      updateBarrierData(barrier.id, { breachedItems: trimmed });
    },
    [barrier, updateBarrierData, validateBreachedList],
  );

  const handleBreachedListChange = useCallback(
    (index: number, event: ChangeEvent<HTMLInputElement>) => {
      const next = [...breachedItems];
      next[index] = event.target.value;
      commitBreachedItems(next);
    },
    [breachedItems, commitBreachedItems],
  );

  const handleAddBreachedItem = useCallback(() => {
    const itemId = createListItemId("breached");
    breachedItemIds.current = [...breachedItemIds.current, itemId];
    setPendingFocus({ listType: "breached", itemId });
    const next = [...breachedItems, ""];
    commitBreachedItems(next);
  }, [breachedItems, commitBreachedItems, createListItemId]);

  const handleRemoveBreachedItem = useCallback(
    (index: number) => {
      const remainingIds = breachedItemIds.current.filter(
        (_, i) => i !== index,
      );
      breachedItemIds.current = remainingIds;
      setPendingFocus({
        listType: "breached",
        itemId: remainingIds[index - 1] ?? null,
      });
      const next = breachedItems.filter((_, i) => i !== index);
      const nextErrors = breachedErrors.filter((_, i) => i !== index);
      setBreachedErrors(nextErrors);
      commitBreachedItems(next);
    },
    [breachedErrors, breachedItems, commitBreachedItems],
  );

  const handleBreachedListBlur = useCallback(() => {
    commitBreachedItems(breachedItems);
  }, [breachedItems, commitBreachedItems]);

  const handleBreachedListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, index: number) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const errors = validateBreachedList(breachedItems);
        if (!errors.some((error) => error.length > 0)) {
          handleAddBreachedItem();
        } else {
          setBreachedErrors(errors);
          const invalidIndex = errors.findIndex(Boolean);
          breachedInputRefs.current
            .get(breachedItemIds.current[invalidIndex])
            ?.focus();
        }
      }
      if (event.key === "Backspace" && event.currentTarget.value === "") {
        if (breachedItems.length > 0) {
          handleRemoveBreachedItem(index);
        }
      }
    },
    [
      breachedItems,
      handleAddBreachedItem,
      handleRemoveBreachedItem,
      validateBreachedList,
    ],
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
            <h3 className="text-sm font-semibold text-slate-900">Barrier</h3>
            <p className="text-xs text-slate-500">
              Between {upstreamNode?.data.title ?? barrier.upstreamNodeId} and{" "}
              {downstreamNode?.data.title ?? barrier.downstreamNodeId}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="barrier-description" className={labelClasses}>
              Description
            </label>
            <textarea
              ref={barrierDescriptionRef}
              id="barrier-description"
              className={textAreaClasses}
              value={barrierDescription}
              onChange={handleBarrierDescriptionChange}
              onBlur={handleBarrierDescriptionBlur}
              placeholder="Explain what this barrier does"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col">
              <span className={labelClasses}>Breached</span>
              <span className="text-xs text-slate-500">
                Toggle to reveal breached items inside the barrier card.
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={isBreached}
                onChange={(event) => handleToggleBreached(event.target.checked)}
              />
              {isBreached ? "Breached" : "Intact"}
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <span className={labelClasses}>Breached Items</span>
              <button
                ref={breachedAddRef}
                type="button"
                className={`${buttonClasses} px-2 py-1 text-xs`}
                onClick={handleAddBreachedItem}
                disabled={!isBreached}
              >
                Add
              </button>
            </div>
            {!isBreached ? (
              <p className="text-xs text-slate-500">
                Mark the barrier as breached to track how it failed.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {breachedItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No breach items yet.</p>
                ) : null}
                {breachedItems.map((item, index) => (
                  <div
                    key={breachedItemIds.current[index]}
                    className="flex gap-2"
                  >
                    <input
                      ref={(element) => {
                        const id = breachedItemIds.current[index];
                        if (element) breachedInputRefs.current.set(id, element);
                        else breachedInputRefs.current.delete(id);
                      }}
                      className={`${inputClasses} ${
                        breachedErrors[index]?.length
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : ""
                      }`}
                      value={item}
                      onChange={(event) =>
                        handleBreachedListChange(index, event)
                      }
                      onBlur={handleBreachedListBlur}
                      onKeyDown={(event) =>
                        handleBreachedListKeyDown(event, index)
                      }
                      placeholder="Describe how the barrier was breached"
                      aria-invalid={Boolean(breachedErrors[index])}
                      aria-describedby={
                        breachedErrors[index]?.length
                          ? `breach-error-${index}`
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      className={`${buttonClasses} px-2 py-1 text-xs`}
                      onClick={() => handleRemoveBreachedItem(index)}
                      aria-label={`Remove breach item ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {breachedErrors.some((error) => error.length > 0) ? (
                  <div className="flex flex-col gap-1">
                    {breachedErrors.map((error, index) =>
                      error.length ? (
                        <p
                          key={`breach-error-${index}`}
                          id={`breach-error-${index}`}
                          className="text-xs font-medium text-red-600"
                        >
                          {error}
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

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

    const downstreamEdge =
      edges.find((edge) => edge.source === node.id) ?? null;
    const downstreamNode = downstreamEdge
      ? (chainNodes.find(
          (candidate) => candidate.id === downstreamEdge.target,
        ) ?? null)
      : null;
    const existingBarrier = downstreamEdge
      ? (barriers.find(
          (item) =>
            item.upstreamNodeId === node.id &&
            item.downstreamNodeId === downstreamEdge.target,
        ) ?? null)
      : null;

    return (
      <form className="flex flex-1 flex-col gap-5" onSubmit={handleSubmit}>
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
            {existingBarrier ? (
              <span
                className={`text-xs font-semibold ${
                  existingBarrier.breached
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}
              >
                {existingBarrier.breached ? "Breached" : "Holding"}
              </span>
            ) : null}
          </div>
          {!downstreamEdge ? (
            <p className="text-xs text-slate-500">
              Add a downstream ChainNode to place a barrier.
            </p>
          ) : existingBarrier ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-700">
                Barrier between {node.data.title} and{" "}
                {downstreamNode?.data.title ?? downstreamEdge.target}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClasses}
                  onClick={() => select(existingBarrier.id)}
                >
                  Edit Barrier
                </button>
                <button
                  type="button"
                  className={`${buttonClasses} border-rose-200 text-rose-700`}
                  onClick={() => removeBarrier(existingBarrier.id)}
                >
                  Remove Barrier
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-700">
                Insert a barrier between {node.data.title} and{" "}
                {downstreamNode?.data.title ?? downstreamEdge.target}.
              </p>
              <button
                type="button"
                className={`${buttonClasses} px-2 py-1 text-xs`}
                onClick={() => addBarrier(node.id)}
              >
                Add Barrier
              </button>
            </div>
          )}
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
    barrier,
    barrierDescription,
    barriers,
    breachedErrors,
    breachedItems,
    chainNodes,
    description,
    edges,
    handleAddBreachedItem,
    handleAddListItem,
    handleBreachedListBlur,
    handleBreachedListChange,
    handleBreachedListKeyDown,
    handleBarrierDescriptionChange,
    handleBarrierDescriptionBlur,
    handleCenter,
    handleDescriptionBlur,
    handleFocusTitle,
    handleListBlur,
    handleListChange,
    handleListKeyDown,
    handleOwnerChange,
    handleRemoveBreachedItem,
    handleRemoveListItem,
    handleSubmit,
    handleTimestampChange,
    handleTitleCommit,
    handleToggleBreached,
    isBreached,
    negativeConsequences,
    negativeErrors,
    node,
    ownerValue,
    positiveConsequences,
    positiveErrors,
    removeBarrier,
    select,
    timestampValue,
    title,
    titleError,
  ]);

  return (
    <aside
      className="flex h-full min-w-[320px] max-w-sm flex-col gap-6 border-l border-slate-200 bg-white p-6 text-slate-700 shadow-xl"
      role="complementary"
      aria-labelledby="inspector-title-heading"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        <h2
          id="inspector-title-heading"
          className="text-base font-semibold text-slate-900"
        >
          Inspector
        </h2>
        {selectedEntityId ? (
          <span className="text-xs text-slate-500" aria-live="polite">
            ID: {selectedEntityId}
          </span>
        ) : null}
      </div>
      {body}
    </aside>
  );
};
