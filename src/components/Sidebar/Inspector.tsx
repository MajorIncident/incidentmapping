import { useMemo } from "react";
import { useAppStore } from "../../state/useAppStore";

export const Inspector = (): JSX.Element => {
  const selectionId = useAppStore((state) => state.selectionId);
  const node = useAppStore((state) =>
    state.nodes.find((candidate) => candidate.id === selectionId),
  );

  const details = useMemo(() => {
    if (!node) {
      return null;
    }
    return {
      title: node.data.title,
      position: node.position,
    };
  }, [node]);

  return (
    <aside className="flex h-full flex-col gap-4 border-l border-slate-200 bg-white p-4 text-sm text-slate-700">
      <h2 className="text-base font-semibold text-slate-900">Inspector</h2>
      {details ? (
        <dl className="space-y-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Title
            </dt>
            <dd>{details.title}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Position
            </dt>
            <dd>
              x: {details.position.x}, y: {details.position.y}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-slate-500">Select a node to view details.</p>
      )}
    </aside>
  );
};
