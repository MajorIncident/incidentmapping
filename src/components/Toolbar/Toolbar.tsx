import type { ReactNode } from "react";
import type { FileMenuRenderProps } from "../FileMenu/FileMenu";

type ToolbarProps = FileMenuRenderProps & {
  onAddChainNode: () => void;
  onDeleteSelection: () => void;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOrganize: () => void;
  canOrganize: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
};

const buttonBase =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const menuItem =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

const Icon = ({ children }: { children: ReactNode }) => (
  <span aria-hidden="true" className="w-5 text-center text-lg leading-none">
    {children}
  </span>
);

const Menu = ({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: ReactNode;
}) => (
  <details className="group relative">
    <summary
      className={`${buttonBase} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      aria-label={`${label} menu`}
      title={`${label} menu`}
    >
      <Icon>{label === "File" ? "▤" : "•••"}</Icon>
      <span className="hidden sm:inline">{label}</span>
      <span aria-hidden="true" className="hidden text-xs sm:inline">
        ▾
      </span>
    </summary>
    <div
      className={`absolute top-[calc(100%+0.5rem)] z-50 min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
      role="menu"
      aria-label={`${label} actions`}
    >
      {children}
    </div>
  </details>
);

export const Toolbar = (props: ToolbarProps): JSX.Element => (
  <header className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-[max(0.5rem,env(safe-area-inset-left))] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm sm:px-[max(1rem,env(safe-area-inset-left))]">
    <nav className="flex items-center gap-2" aria-label="Map commands">
      <button
        type="button"
        className={buttonBase}
        onClick={props.onNew}
        aria-label="Create a new map"
        title="Create a new map"
      >
        <Icon>＋</Icon>
        <span className="hidden sm:inline">New</span>
      </button>
      <Menu label="File">
        <button
          className={menuItem}
          onClick={() => void props.onOpen()}
          aria-label="Open an existing map"
        >
          <Icon>↥</Icon>Open…
        </button>
        <button
          className={menuItem}
          onClick={() => void props.onSave()}
          aria-label="Save the current map"
        >
          <Icon>↓</Icon>Save
        </button>
        <button
          className={menuItem}
          onClick={props.onExportPng}
          aria-label="Export the current map as a PNG"
        >
          <Icon>▧</Icon>Export PNG
        </button>
      </Menu>
    </nav>
    <nav className="flex items-center gap-2" aria-label="Editing commands">
      <button
        type="button"
        className={`${buttonBase} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`}
        onClick={props.onAddChainNode}
        aria-label="Add a new chain node"
        title="Add a new chain node"
      >
        <Icon>＋</Icon>
        <span className="hidden sm:inline">Add node</span>
      </button>
      <Menu label="More" align="right">
        <button
          className={menuItem}
          onClick={props.onUndo}
          disabled={!props.canUndo}
          aria-label="Undo the last action"
        >
          <Icon>↶</Icon>Undo
        </button>
        <button
          className={menuItem}
          onClick={props.onRedo}
          disabled={!props.canRedo}
          aria-label="Redo the previously undone action"
        >
          <Icon>↷</Icon>Redo
        </button>
        <button
          className={menuItem}
          onClick={props.onOrganize}
          disabled={!props.canOrganize}
          aria-label="Organize all nodes"
        >
          <Icon>⌘</Icon>Organize
        </button>
        <button
          className={menuItem}
          onClick={props.onToggleDetails}
          aria-label="Toggle node detail visibility"
        >
          <Icon>◫</Icon>
          {props.showDetails ? "Hide details" : "Show details"}
        </button>
        <button
          className={`${menuItem} text-rose-700`}
          onClick={props.onDeleteSelection}
          disabled={!props.canDelete}
          aria-label="Delete the selected node"
        >
          <Icon>⌫</Icon>Delete selection
        </button>
        <div className="mt-1 border-t border-slate-200 px-3 pt-2 text-xs text-slate-500 sm:hidden">
          Privacy · EULA
        </div>
      </Menu>
    </nav>
  </header>
);
