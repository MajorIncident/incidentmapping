import { useEffect, useId, useRef, useState } from "react";
import {
  contextEffectDefinitions,
  type ContextDisplayMode,
  type ContextEffect,
  type ContextItem,
} from "../../features/maps/schema";
import { useAppStore } from "../../state/useAppStore";

export const contextHelpText = contextEffectDefinitions.Neutral.help;

type Props = {
  target: "incident" | string;
  items: ContextItem[];
  effect?: ContextEffect;
  lockedEffect?: ContextEffect;
  preselectedEffect?: ContextEffect;
};
const fieldClasses =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";

export const ContextEditor = ({
  target,
  items,
  effect,
  lockedEffect,
  preselectedEffect,
}: Props): JSX.Element => {
  const uid = useId().replace(/:/g, "");
  const actions = useAppStore((state) => state.actions);
  const editorRequest = useAppStore((state) => state.editorFocusRequest);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [displayMode, setDisplayMode] = useState<ContextDisplayMode>("Text");
  const [unit, setUnit] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<ContextEffect>(
    lockedEffect ?? preselectedEffect ?? effect ?? "Neutral",
  );
  const [error, setError] = useState(false);
  const newLabelRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const visibleItems = effect
    ? items.filter((item) => (item.effect ?? "Neutral") === effect)
    : items;
  const creationEffect = lockedEffect ?? selectedEffect;
  const definition =
    contextEffectDefinitions[effect ?? lockedEffect ?? "Neutral"];

  useEffect(() => {
    const requestedEffect =
      editorRequest?.section === "ContextAggravating"
        ? "Aggravating"
        : editorRequest?.section === "ContextMitigating"
          ? "Mitigating"
          : editorRequest?.section === "Context"
            ? "Neutral"
            : null;
    if (
      editorRequest?.entityId !== target ||
      editorRequest.intent !== "Create" ||
      requestedEffect !== creationEffect
    )
      return;
    newLabelRef.current?.focus();
    actions.clearEditorFocusRequest(editorRequest.id);
  }, [actions, creationEffect, editorRequest, target]);

  const addItem = () => {
    if (!label.trim() || !value.trim()) return setError(true);
    if (
      actions.addContext(
        target,
        label,
        value,
        undefined,
        displayMode,
        unit,
        creationEffect,
      )
    ) {
      setLabel("");
      setValue("");
      setDisplayMode("Text");
      setUnit("");
      setError(false);
      newLabelRef.current?.focus();
    }
  };
  const enterAdds = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };
  const deleteItem = (item: ContextItem, index: number) => {
    actions.deleteContext(target, item.id);
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLElement>(
        `[data-context-editor="${uid}"] [data-testid="context-row"]`,
      );
      const row = rows[Math.min(index, rows.length - 1)];
      row?.querySelector<HTMLElement>("button")?.focus() ??
        addButtonRef.current?.focus();
    });
  };

  return (
    <section
      className="min-w-0 space-y-3 [grid-column:1/-1]"
      aria-label={definition.heading}
      data-context-editor={uid}
      onFocusCapture={() => actions.setContextEditing(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          actions.setContextEditing(false);
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {definition.heading}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {definition.help}
        </p>
      </div>
      <div className="space-y-2" data-testid="context-rows">
        {visibleItems.map((item, index) => {
          const name = item.label || `item ${index + 1}`;
          return (
            <div
              key={item.id}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              data-testid="context-row"
            >
              <div className="grid min-w-0 grid-cols-1 gap-2">
                <label className="min-w-0 text-xs font-medium text-slate-600">
                  Label {index + 1}
                  <input
                    className={fieldClasses}
                    defaultValue={item.label}
                    aria-label={`${definition.heading} item ${index + 1} label`}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim();
                      if (!next) event.currentTarget.value = item.label;
                      else
                        actions.updateContext(target, item.id, { label: next });
                    }}
                  />
                </label>
                <label className="min-w-0 text-xs font-medium text-slate-600">
                  Value {index + 1}
                  <input
                    className={fieldClasses}
                    defaultValue={item.value}
                    aria-label={`${definition.heading} item ${index + 1} value`}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim();
                      if (!next) event.currentTarget.value = item.value;
                      else
                        actions.updateContext(target, item.id, { value: next });
                    }}
                  />
                </label>
                {!lockedEffect ? (
                  <label className="min-w-0 text-xs font-medium text-slate-600">
                    Effect {index + 1}
                    <select
                      className={fieldClasses}
                      aria-label={`Context item ${index + 1} effect`}
                      value={item.effect ?? "Neutral"}
                      onChange={(event) =>
                        actions.updateContext(target, item.id, {
                          effect: event.target.value as ContextEffect,
                        })
                      }
                    >
                      {Object.keys(contextEffectDefinitions).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="min-w-0 text-xs font-medium text-slate-600">
                  Display mode {index + 1}
                  <select
                    className={fieldClasses}
                    aria-label={`Context item ${index + 1} display mode`}
                    value={item.displayMode}
                    onChange={(event) => {
                      const next = event.target.value as ContextDisplayMode;
                      actions.updateContext(target, item.id, {
                        displayMode: next,
                        ...(next !== "Metric" ? { unit: undefined } : {}),
                      });
                    }}
                  >
                    <option>Text</option>
                    <option>Chip</option>
                    <option>Metric</option>
                  </select>
                </label>
                {item.displayMode === "Metric" ? (
                  <label className="min-w-0 text-xs font-semibold text-slate-800">
                    Unit {index + 1} (optional)
                    <input
                      className={fieldClasses}
                      aria-label={`Context item ${index + 1} unit`}
                      defaultValue={item.unit ?? ""}
                      onBlur={(event) =>
                        actions.updateContext(target, item.id, {
                          unit: event.currentTarget.value.trim() || undefined,
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-canvas-accent"
                  aria-label={`${item.showOnCard ? "Hide" : "Show"} ${name} on compact card`}
                  aria-pressed={Boolean(item.showOnCard)}
                  onClick={() =>
                    actions.toggleContextShowOnCard(target, item.id)
                  }
                >
                  {item.showOnCard ? "Hide on Card" : "Show on Card"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  aria-label={`Delete ${definition.heading.toLowerCase()} item ${name}`}
                  onClick={() => deleteItem(item, index)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-dashed border-slate-300 p-3">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor={`${uid}-new-label`}
        >
          New label
          <input
            ref={newLabelRef}
            id={`${uid}-new-label`}
            className={fieldClasses}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setError(false);
            }}
            onKeyDown={enterAdds}
          />
        </label>
        {!lockedEffect ? (
          <label className="text-xs font-medium text-slate-600">
            Effect
            <select
              className={fieldClasses}
              aria-label="Effect"
              value={selectedEffect}
              onChange={(event) =>
                setSelectedEffect(event.target.value as ContextEffect)
              }
            >
              {Object.keys(contextEffectDefinitions).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-xs font-medium text-slate-600">
          Display mode
          <select
            className={fieldClasses}
            aria-label="Display mode"
            value={displayMode}
            onChange={(event) => {
              const next = event.target.value as ContextDisplayMode;
              setDisplayMode(next);
              if (next !== "Metric") setUnit("");
            }}
          >
            <option>Text</option>
            <option>Chip</option>
            <option>Metric</option>
          </select>
        </label>
        {displayMode === "Metric" ? (
          <label className="text-xs font-semibold text-slate-800">
            Unit (optional)
            <input
              className={fieldClasses}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              onKeyDown={enterAdds}
            />
          </label>
        ) : null}
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor={`${uid}-new-value`}
        >
          New value
          <input
            id={`${uid}-new-value`}
            className={fieldClasses}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(false);
            }}
            onKeyDown={enterAdds}
          />
        </label>
        {error ? (
          <p className="text-xs font-medium text-red-600" role="alert">
            Enter both a label and a value.
          </p>
        ) : null}
        <button
          ref={addButtonRef}
          type="button"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-canvas-accent"
          aria-label={contextEffectDefinitions[creationEffect].addLabel}
          onClick={addItem}
        >
          {contextEffectDefinitions[creationEffect].addLabel}
        </button>
      </div>
    </section>
  );
};
