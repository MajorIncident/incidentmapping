import type {
  CaseSummaryModel,
  SummaryItem,
} from "../../features/presentation/caseSummary";
import { ContextPresentation } from "../Context/ContextPresentation";
import type { AssertionState, ContextItem } from "../../features/maps/schema";
import type { BarrierNodeData, ChainNodeData } from "../../state/useAppStore";
import { selectCaseSummary } from "../../features/presentation/caseSummary";

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

const Counts = ({ values }: { values: Record<string, number> }) => (
  <span>
    {Object.entries(values)
      .map(([name, count]) => `${name} ${count}`)
      .join(" · ") || "None"}
  </span>
);

const Items = ({
  items,
  onSelect,
}: {
  items: SummaryItem[];
  onSelect: (id: string) => void;
}) =>
  items.length ? (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onSelect(item.id)}>
            {item.label}
            {item.referenceId ? ` (${item.referenceId})` : ""}
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <p>None explicitly recorded.</p>
  );

export const CaseSummary = (props: {
  summary?: CaseSummaryModel;
  onSelect?: (id: string) => void;
  mobile?: boolean;
  onClose?: () => void;
  /** Legacy inputs retained for embedders while the app uses the pure selector. */
  factors?: ChainNodeData[];
  controls?: BarrierNodeData[];
  contextItems?: ContextItem[];
}): JSX.Element => {
  const { mobile = false, onClose } = props;
  const onSelect = props.onSelect ?? (() => undefined);
  const summary =
    props.summary ??
    selectCaseSummary(
      (props.factors ?? []).map((data, index) => ({
        id: data.referenceId ?? `summary-${index}`,
        position: { x: 0, y: 0 },
        data,
      })),
      (props.controls ?? []).map((control, index) => ({
        ...control,
        id: control.referenceId ?? `control-${index}`,
      })),
      [],
      props.contextItems,
    );
  return (
    <section
      className={`case-summary${mobile ? " case-summary--sheet" : ""}`}
      aria-labelledby="case-summary-title"
    >
      <header>
        <h2 id="case-summary-title">Case Summary</h2>
        {onClose ? (
          <button
            type="button"
            aria-label="Close case summary"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </header>
      <section>
        <h3>What Happened</h3>
        <Items items={summary.impacts} onSelect={onSelect} />
      </section>
      <section>
        <h3>Root Causes ({summary.rootCauses.length})</h3>
        <Items items={summary.rootCauses} onSelect={onSelect} />
      </section>
      <section>
        <h3>Key Factors ({summary.keyFactors.length})</h3>
        <Items items={summary.keyFactors} onSelect={onSelect} />
      </section>
      <section>
        <h3>
          Failed / Missing Controls ({summary.failedOrMissingControls.length})
        </h3>
        <Counts values={summary.controlCounts} />
        <Items items={summary.failedOrMissingControls} onSelect={onSelect} />
      </section>
      <section>
        <h3>Actions</h3>
        <p>
          Type: <Counts values={summary.actionTypeCounts} /> · Status:{" "}
          <Counts values={summary.actionStatusCounts} /> · Completed{" "}
          {summary.completedActionCount}
        </p>
        <Items items={summary.incompleteActions} onSelect={onSelect} />
      </section>
      <section>
        <h3>Evidence</h3>
        <Counts values={summary.evidenceTypeCounts} />
      </section>
      <section>
        <h3>Assertions</h3>
        <p>
          Confirmed {summary.assertionCounts.Confirmed} · Working{" "}
          {summary.assertionCounts.Working}
        </p>
      </section>
      {summary.context.length ? (
        <ContextPresentation
          items={summary.context}
          ariaLabel="Pinned summary context"
        />
      ) : null}
    </section>
  );
};
