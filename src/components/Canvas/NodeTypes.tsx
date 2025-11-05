import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { useAppStore } from "../../state/useAppStore";
import type { ChainNodeData } from "../../state/useAppStore";

const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";

const containerClasses =
  "min-w-[180px] max-w-[240px] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left shadow-node transition";

const titleClasses = "text-sm font-semibold text-slate-800";

const ChainNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<ChainNodeData>): JSX.Element => {
  const renameNode = useAppStore((state) => state.actions.renameNode);
  const [isEditing, setIsEditing] = useState(false);
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
  }, [data.title]);

  const openEditor = useCallback(() => {
    setValue(data.title);
    setIsEditing(true);
  }, [data.title]);

  const commitEdit = useCallback(() => {
    renameNode(id, value);
    setIsEditing(false);
  }, [id, renameNode, value]);

  const cancelEdit = useCallback(() => {
    setValue(data.title);
    setIsEditing(false);
  }, [data.title]);

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

  return (
    <div
      className={`${containerClasses} ${selected ? "ring-2 ring-canvas-accent" : "ring-0"}`}
      onDoubleClick={openEditor}
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
    </div>
  );
};

export const nodeTypes = {
  ChainNode: memo(ChainNodeComponent),
};
