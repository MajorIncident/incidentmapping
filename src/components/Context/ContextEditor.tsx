import { useId, useState } from "react";
import type { ContextItem } from "../../features/maps/schema";
import { useAppStore } from "../../state/useAppStore";

export const contextHelpText =
  "Context records facts relevant to understanding the incident. A Context item does not mean the fact caused the incident.";

type Props = { target: "incident" | string; items: ContextItem[] };
const fieldClasses =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent";

export const ContextEditor = ({ target, items }: Props): JSX.Element => {
  const uid = useId().replace(/:/g, "");
  const actions = useAppStore((state) => state.actions);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const addItem = () => {
    if (!label.trim() || !value.trim()) return setError(true);
    if (actions.addContext(target, label, value)) {
      setLabel("");
      setValue("");
      setError(false);
    }
  };
  const enterAdds = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  return (
    <section
      className="min-w-0 space-y-3 [grid-column:1/-1]"
      aria-label="Context"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Context</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {contextHelpText}
        </p>
      </div>
      <div className="space-y-2" data-testid="context-rows">
        {items.map((item, index) => {
          const name = item.label || `item ${index + 1}`;
          return (
            <div
              key={item.id}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              data-testid="context-row"
            >
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className="min-w-0 text-xs font-medium text-slate-600"
                  htmlFor={`${uid}-${item.id}-label`}
                >
                  Label {index + 1}
                  <input
                    id={`${uid}-${item.id}-label`}
                    className={fieldClasses}
                    defaultValue={item.label}
                    aria-label={`Context item ${index + 1} label`}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim();
                      if (!next) event.currentTarget.value = item.label;
                      else
                        actions.updateContext(target, item.id, { label: next });
                    }}
                  />
                </label>
                <label
                  className="min-w-0 text-xs font-medium text-slate-600"
                  htmlFor={`${uid}-${item.id}-value`}
                >
                  Value {index + 1}
                  <input
                    id={`${uid}-${item.id}-value`}
                    className={fieldClasses}
                    defaultValue={item.value}
                    aria-label={`Context item ${index + 1} value`}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim();
                      if (!next) event.currentTarget.value = item.value;
                      else
                        actions.updateContext(target, item.id, { value: next });
                    }}
                  />
                </label>
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
                  {item.showOnCard ? "Shown on card" : "Hidden from card"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  aria-label={`Delete context item ${name}`}
                  onClick={() => actions.deleteContext(target, item.id)}
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
          type="button"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-canvas-accent"
          onClick={addItem}
        >
          Add Context
        </button>
      </div>
    </section>
  );
};
