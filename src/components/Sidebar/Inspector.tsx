import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
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
  const renameNode = useAppStore((state) => state.actions.renameNode);
  const updateNodeData = useAppStore((state) => state.actions.updateNodeData);
  const startEditing = useAppStore((state) => state.actions.startEditing);
  const select = useAppStore((state) => state.actions.select);
  const { fitView } = useReactFlow();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setTitle(node.data.title);
      setDescription(node.data.description ?? "");
      setTitleError(null);
    } else {
      setTitle("");
      setDescription("");
      setTitleError(null);
    }
  }, [node]);

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

  const handleFocusTitle = useCallback(() => {
    if (selectionId) {
      startEditing(selectionId);
    }
  }, [selectionId, startEditing]);

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
    if (!node) {
      return (
        <p className="text-sm text-slate-500" role="status">
          Select a node to edit its details.
        </p>
      );
    }
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
            id="inspector-description"
            className={textAreaClasses}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={handleDescriptionBlur}
          />
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
    handleCenter,
    handleDescriptionBlur,
    handleFocusTitle,
    handleOwnerChange,
    handleSubmit,
    handleTimestampChange,
    handleTitleCommit,
    node,
    ownerValue,
    timestampValue,
    title,
    titleError,
    description,
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
        {node ? (
          <span className="text-xs text-slate-500" aria-live="polite">
            Node ID: {node.id}
          </span>
        ) : null}
      </div>
      {body}
    </aside>
  );
};
