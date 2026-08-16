import type { AssertionState } from "../../features/maps/schema";

export const assertionStateDetails: Record<AssertionState, string> = {
  Confirmed: "Confirmed by direct evidence or an authoritative source.",
  Working: "A current working finding that remains under active review.",
  Inferred:
    "Analytically derived from the available information; this does not necessarily mean uncertain or unreliable.",
};

const marker: Record<AssertionState, string> = {
  Confirmed: "C",
  Working: "W",
  Inferred: "I",
};

export const AssertionMarker = ({ state }: { state?: AssertionState }) =>
  state ? (
    <span
      className="assertion-marker"
      aria-label={`Assertion state: ${state}. ${assertionStateDetails[state]}`}
      title={`${state}: ${assertionStateDetails[state]}`}
      data-assertion-state={state}
    >
      <span aria-hidden="true">{marker[state]}</span>
      <span className="sr-only">{state}</span>
    </span>
  ) : null;

export const AssertionStateField = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value?: AssertionState;
  onChange: (value?: AssertionState) => void;
}): JSX.Element => {
  const helpId = `${id}-help`;
  return (
    <fieldset className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Assertion State
      </label>
      <select
        id={id}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent"
        value={value ?? ""}
        aria-describedby={helpId}
        onChange={(event) =>
          onChange(
            (event.target.value || undefined) as AssertionState | undefined,
          )
        }
      >
        <option value="">Not set</option>
        {(Object.keys(assertionStateDetails) as AssertionState[]).map(
          (state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ),
        )}
      </select>
      <details id={helpId} className="text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">
          What do these states mean?
        </summary>
        <dl className="mt-2 space-y-1.5">
          {(
            Object.entries(assertionStateDetails) as [AssertionState, string][]
          ).map(([state, description]) => (
            <div key={state}>
              <dt className="inline font-semibold">{state}: </dt>
              <dd className="inline">{description}</dd>
            </div>
          ))}
        </dl>
      </details>
    </fieldset>
  );
};
