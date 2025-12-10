import { useCallback, useEffect, useState } from "react";
import type { FileMenuRenderProps } from "../FileMenu/FileMenu";

type ToolbarProps = FileMenuRenderProps & {
  onAddChainNode: () => void;
  onDeleteSelection: () => void;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mapTitle: string;
  onMapTitleChange: (title: string) => void;
};

const buttonBase =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const Toolbar = ({
  onNew,
  onOpen,
  onSave,
  onExportPng,
  mapTitle,
  onMapTitleChange,
  onAddChainNode,
  onDeleteSelection,
  canDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps): JSX.Element => {
  const [draftTitle, setDraftTitle] = useState(mapTitle);

  useEffect(() => {
    setDraftTitle(mapTitle);
  }, [mapTitle]);

  const handleCommit = useCallback(() => {
    onMapTitleChange(draftTitle);
  }, [draftTitle, onMapTitleChange]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={buttonBase}
          onClick={onNew}
          aria-label="Create a new map"
        >
          New
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => void onOpen()}
          aria-label="Open an existing map"
        >
          Open…
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => void onSave()}
          aria-label="Save the current map"
        >
          Save
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={onExportPng}
          aria-label="Export the current map as a PNG"
        >
          Export PNG
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="sr-only">Map title</span>
          <input
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={handleCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCommit();
              }
            }}
            placeholder="Untitled Map"
            aria-label="Map title"
            className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonBase}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo the last action"
        >
          Undo
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo the previously undone action"
        >
          Redo
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={onAddChainNode}
          aria-label="Add a new chain node"
        >
          Add ChainNode
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={onDeleteSelection}
          disabled={!canDelete}
          aria-label="Delete the selected node"
        >
          Delete
        </button>
      </div>
    </header>
  );
};
