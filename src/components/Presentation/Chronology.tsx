import { useEffect, useMemo, useRef } from "react";
import type { Node } from "reactflow";
import type { ChainNodeData } from "../../state/useAppStore";
import { selectChronologyGroups } from "../../state/selectors";

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};

type ChronologyProps = {
  nodes: Node<ChainNodeData>[];
  selectedId: string | null;
  mobile: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export const Chronology = ({
  nodes,
  selectedId,
  mobile,
  onClose,
  onSelect,
}: ChronologyProps): JSX.Element => {
  const panelRef = useRef<HTMLElement>(null);
  const groups = useMemo(() => selectChronologyGroups(nodes), [nodes]);

  useEffect(() => {
    if (!mobile) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(panelRef.current?.querySelectorAll<HTMLElement>("button") ?? []),
      ];
      if (!focusable.length) return;
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (current - 1 + focusable.length) % focusable.length
        : (current + 1) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [mobile, onClose]);

  const content = (
    <>
      <header className="chronology__header">
        <div>
          <h2 id="chronology-title">Chronology</h2>
          <p>Events are grouped by phase; untimed Events appear last.</p>
        </div>
        <button type="button" aria-label="Close chronology" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="chronology__body">
        {groups.length ? (
          groups.map((group) => (
            <section key={group.phase}>
              <h3>{group.phase}</h3>
              <ol>
                {group.events.map((event) => {
                  const time = formatTimestamp(event.data.timestamp);
                  const selected = selectedId === event.id;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => onSelect(event.id)}
                      >
                        {time ? (
                          <time dateTime={event.data.timestamp}>{time}</time>
                        ) : (
                          <span className="chronology__no-time">
                            Time not set
                          </span>
                        )}
                        <strong>{event.data.title}</strong>
                        <span>{event.data.referenceId}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        ) : (
          <p className="chronology__empty">No Events in this map.</p>
        )}
      </div>
    </>
  );

  return mobile ? (
    <div className="chronology-backdrop">
      <section
        ref={panelRef}
        className="chronology chronology--sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chronology-title"
      >
        {content}
      </section>
    </div>
  ) : (
    <aside
      ref={panelRef}
      className="chronology chronology--panel"
      aria-labelledby="chronology-title"
    >
      {content}
    </aside>
  );
};
