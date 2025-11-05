import type { FileMenuRenderProps } from "../FileMenu/FileMenu";

type ToolbarProps = FileMenuRenderProps & {
  onAddChainNode: () => void;
  onDeleteSelection: () => void;
  canDelete: boolean;
};

const buttonBase =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const Toolbar = ({
  onNew,
  onOpen,
  onSave,
  onExportPng,
  onAddChainNode,
  onDeleteSelection,
  canDelete,
}: ToolbarProps): JSX.Element => {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button type="button" className={buttonBase} onClick={onNew}>
          New
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => void onOpen()}
        >
          Open…
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => void onSave()}
        >
          Save
        </button>
        <button type="button" className={buttonBase} onClick={onExportPng}>
          Export PNG
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonBase} onClick={onAddChainNode}>
          Add ChainNode
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={onDeleteSelection}
          disabled={!canDelete}
        >
          Delete
        </button>
      </div>
    </header>
  );
};
