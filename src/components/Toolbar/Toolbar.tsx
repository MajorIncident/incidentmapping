import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FileMenuRenderProps } from "../FileMenu/FileMenu";
import type { ChainNode } from "../../features/maps/schema";
import type { CanvasDetail } from "../../features/layout/policy";
import { Icon, type IconName } from "./Icons";

type ToolbarProps = FileMenuRenderProps & {
  onAddSemanticNode: (nodeType: ChainNode["nodeType"]) => void;
  selectedNodeType?: ChainNode["nodeType"];
  onDeleteSelection: () => void;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOrganize: () => void;
  canOrganize: boolean;
  canvasDetail: CanvasDetail;
  onCanvasDetailChange: (detail: CanvasDetail) => void;
  onPresent: () => void;
  onInvestigationCheck: () => void;
  learningGuideEnabled: boolean;
  onLearningGuideChange: (enabled: boolean) => void;
  onHelpTopic: (topic: "map" | "basics" | "shortcuts" | "about") => void;
};

const buttonBase =
  "command-button inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm";
const menuItem =
  "command-button flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-3 text-left text-sm font-medium";

const Menu = ({
  label,
  icon,
  align = "left",
  children,
}: {
  label: string;
  icon: IconName;
  align?: "left" | "right";
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const closeAndReturnFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const items = [
      ...(rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    }
  };
  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={buttonBase}
        aria-label={`${label} menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${label} menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={icon} />
        <span className="hidden sm:inline">{label}</span>
        <span aria-hidden="true" className="hidden text-xs sm:inline">
          ▾
        </span>
      </button>
      {open ? (
        <div
          className={`command-popover absolute top-[calc(100%+0.5rem)] z-50 min-w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
          role="menu"
          aria-label={`${label} actions`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('[role="menuitem"]'))
              closeAndReturnFocus();
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

const Item = ({
  icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName }) => (
  <button type="button" role="menuitem" className={menuItem} {...props}>
    <Icon name={icon} />
    {children}
  </button>
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
        <Icon name="add" />
        <span className="hidden sm:inline">New</span>
      </button>
      <Menu label="File" icon="file">
        <Item
          icon="export"
          onClick={props.onExportJson}
          aria-label="Export map metadata as JSON"
        >
          Export JSON
        </Item>
        <Item
          icon="open"
          onClick={() => void props.onOpen()}
          aria-label="Open an existing map"
        >
          Open…
        </Item>
        <Item
          icon="save"
          onClick={() => void props.onSave()}
          aria-label="Save the current map"
        >
          Save <span className="ml-auto text-xs text-slate-500">Ctrl/⌘ S</span>
        </Item>
        <Item
          icon="export"
          onClick={props.onExportPng}
          aria-label="Export the current map as a PNG"
        >
          Export PNG
        </Item>
      </Menu>
      <span
        className={`save-state ${props.isSaved ? "save-state--saved" : "save-state--unsaved"}`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">●</span> {props.isSaved ? "Saved" : "Unsaved"}
      </span>
    </nav>
    <nav className="flex items-center gap-2" aria-label="Editing commands">
      <Menu label="+ Add" icon="add">
        {props.selectedNodeType === "Impact" ? (
          <Item icon="add" onClick={() => props.onAddSemanticNode("Event")}>
            Event — What happened?
          </Item>
        ) : null}
        {props.selectedNodeType === "Event" ? (
          <>
            <Item icon="add" onClick={() => props.onAddSemanticNode("Event")}>
              Event — Another occurrence
            </Item>
            <Item icon="add" onClick={() => props.onAddSemanticNode("Factor")}>
              Factor — A condition explaining why
            </Item>
          </>
        ) : null}
        {props.selectedNodeType === "Factor" ? (
          <>
            <Item icon="add" onClick={() => props.onAddSemanticNode("Factor")}>
              Factor — Ask why again
            </Item>
            <Item icon="add" onClick={() => props.onAddSemanticNode("Action")}>
              Action — Address this finding
            </Item>
          </>
        ) : null}
        {!props.selectedNodeType || props.selectedNodeType === "Action" ? (
          <Item icon="add" disabled>
            Select an Impact, Event, or Factor
          </Item>
        ) : null}
      </Menu>
      <button
        type="button"
        className={buttonBase}
        onClick={props.onPresent}
        aria-label="Present map"
      >
        <span aria-hidden="true">▶</span>
        <span>Present</span>
      </button>
      <Menu label="More" icon="more" align="right">
        <Item
          icon="undo"
          onClick={props.onUndo}
          disabled={!props.canUndo}
          aria-label="Undo the last action"
          title="Undo (Ctrl/⌘ Z)"
        >
          Undo <span className="ml-auto text-xs text-slate-500">Ctrl/⌘ Z</span>
        </Item>
        <Item
          icon="redo"
          onClick={props.onRedo}
          disabled={!props.canRedo}
          aria-label="Redo the previously undone action"
          title="Redo (Ctrl/⌘ Shift Z)"
        >
          Redo{" "}
          <span className="ml-auto text-xs text-slate-500">Ctrl/⌘ ⇧ Z</span>
        </Item>
        <Item
          icon="arrange"
          onClick={props.onOrganize}
          disabled={!props.canOrganize}
          aria-label="Arrange Map"
          title="Recompute structured geometry (manual card positions may change)"
        >
          Arrange Map
        </Item>
        <Item
          icon="details"
          onClick={() => props.onCanvasDetailChange("Compact")}
          aria-label="Use Compact canvas detail"
          aria-pressed={props.canvasDetail === "Compact"}
        >
          Compact canvas
          {props.canvasDetail === "Compact" ? (
            <span className="ml-auto" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </Item>
        <Item
          icon="details"
          onClick={() => props.onCanvasDetailChange("Expanded")}
          aria-label="Use Expanded canvas detail"
          aria-pressed={props.canvasDetail === "Expanded"}
        >
          Expanded canvas
          {props.canvasDetail === "Expanded" ? (
            <span className="ml-auto" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </Item>
        <Item
          icon="delete"
          className={`${menuItem} command-button--danger`}
          onClick={props.onDeleteSelection}
          disabled={!props.canDelete}
          aria-label="Delete selected item"
          title="Delete selected item (Delete)"
        >
          Delete selected item
        </Item>
        <Item
          icon="details"
          onClick={props.onInvestigationCheck}
          aria-label="Open Investigation Check"
        >
          Investigation Check
        </Item>
      </Menu>
      <Menu label="Help" icon="more" align="right">
        <Item
          icon="details"
          aria-pressed={props.learningGuideEnabled}
          onClick={() =>
            props.onLearningGuideChange(!props.learningGuideEnabled)
          }
        >
          Learning Guide: {props.learningGuideEnabled ? "On" : "Off"}
        </Item>
        <Item icon="details" onClick={() => props.onHelpTopic("map")}>
          Learn the Map
        </Item>
        <Item icon="details" onClick={() => props.onHelpTopic("basics")}>
          Investigation Basics
        </Item>
        <Item icon="details" onClick={() => props.onHelpTopic("shortcuts")}>
          Keyboard Shortcuts
        </Item>
        <Item icon="details" onClick={() => props.onHelpTopic("about")}>
          About IncidentMapping
        </Item>
      </Menu>
    </nav>
  </header>
);
