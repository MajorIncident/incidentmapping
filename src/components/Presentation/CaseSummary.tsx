import type { AssertionState, ContextItem } from "../../features/maps/schema";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";
import {
  AssertionMarker,
  assertionStateDetails,
} from "../AssertionState/AssertionState";
import { ContextPresentation } from "../Context/ContextPresentation";
import { selectPinnedContext } from "../../state/selectors";

export const countAssertions = (
  factors: Array<Pick<ChainNodeData, "nodeType" | "assertionState">>,
  controls: Array<Pick<BarrierNodeData, "assertionState">>,
) => {
  const counts: Record<AssertionState | "Not set", number> = {
    Confirmed: 0,
    Working: 0,
    Inferred: 0,
    "Not set": 0,
  };
  factors
    .filter((item) => item.nodeType === "Factor")
    .concat(controls as Array<Pick<ChainNodeData, "assertionState">>)
    .forEach((item) => counts[item.assertionState ?? "Not set"]++);
  return counts;
};

export const CaseSummary = ({
  factors,
  controls,
  contextItems = [],
}: {
  factors: ChainNodeData[];
  controls: BarrierNodeData[];
  contextItems?: ContextItem[];
}): JSX.Element => {
  const counts = countAssertions(factors, controls);
  const summaryContext = selectPinnedContext(contextItems).filter(
    (item) => item.displayMode === "Chip" || item.displayMode === "Metric",
  );
  return (
    <section className="case-summary" aria-labelledby="case-summary-title">
      <h2 id="case-summary-title">Case Summary</h2>
      <p>
        {factors.filter((item) => item.nodeType === "Factor").length} factors ·{" "}
        {controls.length} controls
      </p>
      {summaryContext.length ? (
        <ContextPresentation
          items={summaryContext}
          ariaLabel="Pinned summary context"
        />
      ) : null}
      <ul aria-label="Assertion state counts">
        {(Object.keys(counts) as Array<keyof typeof counts>).map((state) => (
          <li key={state}>
            {state !== "Not set" ? <AssertionMarker state={state} /> : null}
            <span>{state}</span> <strong>{counts[state]}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-2">
        <strong>Controls lens:</strong> assertion markers accompany control
        status; failed and missing status remains primary.
      </p>
      <p>
        <strong>Guided Story:</strong> markers provide provenance without
        dimming Inferred findings.
      </p>
      <p>
        <strong>Causal Story:</strong> Root Cause and Key Factor emphasis is
        preserved for every assertion state.
      </p>
      <details>
        <summary>Assertion state help</summary>
        <p>
          <strong>Inferred</strong> is analytically derived, not necessarily
          uncertain or unreliable.
        </p>
        {Object.entries(assertionStateDetails).map(([state, detail]) => (
          <p key={state}>
            <strong>{state}:</strong> {detail}
          </p>
        ))}
      </details>
    </section>
  );
};
