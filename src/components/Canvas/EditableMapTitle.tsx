import { useCallback, useEffect, useId, useRef, useState } from "react";

type EditableMapTitleProps = {
  title: string;
  onCommit: (title: string) => void;
};

export const EditableMapTitle = ({
  title,
  onCommit,
}: EditableMapTitleProps): JSX.Element => {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorId = useId();
  const setInputRef = useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input;
    input?.select();
  }, []);

  useEffect(() => {
    if (!editing) setDraftTitle(title);
  }, [editing, title]);

  const startEditing = () => {
    setDraftTitle(title);
    setError(null);
    setEditing(true);
  };

  const commit = () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setError("Enter a map title.");
      requestAnimationFrame(() => inputRef.current?.select());
      return;
    }
    onCommit(nextTitle);
    setError(null);
    setEditing(false);
  };

  const stopCanvasInteraction = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="absolute left-4 top-4 z-10 max-w-[min(75vw,36rem)]">
      <div className="pointer-events-none absolute inset-0 rounded-xl border border-slate-200 bg-white/95 shadow-sm" />
      <div className="relative px-2 py-1">
        <h1 className="text-base font-bold text-slate-900">
          {editing ? (
            <input
              ref={setInputRef}
              autoFocus
              type="text"
              value={draftTitle}
              onChange={(event) => {
                setDraftTitle(event.target.value);
                if (event.target.value.trim()) setError(null);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftTitle(title);
                  setError(null);
                  setEditing(false);
                }
              }}
              onPointerDown={stopCanvasInteraction}
              onClick={stopCanvasInteraction}
              aria-label="Map title"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="min-h-11 w-[min(75vw,36rem)] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              onDoubleClick={startEditing}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  startEditing();
                }
              }}
              onPointerDown={stopCanvasInteraction}
              className="flex min-h-11 max-w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-canvas-accent"
              title="Edit map title"
            >
              <span className="truncate">{title}</span>
              <span aria-hidden="true" className="shrink-0 text-slate-500">
                ✎
              </span>
              <span className="sr-only">Edit map title</span>
            </button>
          )}
        </h1>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="px-2 pb-1 text-xs text-rose-700"
          >
            {error}
          </p>
        ) : (
          <p className="pointer-events-none px-2 pb-1 text-xs text-slate-600">
            Incident event map
          </p>
        )}
      </div>
    </div>
  );
};
