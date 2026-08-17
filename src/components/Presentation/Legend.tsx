import { useId, useMemo, useState } from "react";
import { useAppStore } from "../../state/useAppStore";
import { getInvestigationConcept } from "../../content/investigationModel";

type LegendItem = readonly [label: string, treatment: string];

const orderedValues = <T extends string>(
  order: readonly T[],
  values: Iterable<T | undefined>,
): T[] => {
  const present = new Set(values);
  return order.filter((value) => present.has(value));
};

const item = (value: string): LegendItem => [
  value.replace(/([a-z])([A-Z])/g, "$1 $2"),
  value.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
];

const primaryConcepts = (["impact", "event", "factor", "action"] as const).map(
  getInvestigationConcept,
);

const Items = ({ items }: { items: LegendItem[] }): JSX.Element => (
  <ul>
    {items.map(([label, treatment]) => (
      <li key={label}>
        <i
          className={`legend-swatch legend-swatch--${treatment}`}
          aria-hidden="true"
        />
        <span>{label}</span>
      </li>
    ))}
  </ul>
);

export const Legend = ({
  onLearnMap,
}: {
  onLearnMap?: () => void;
}): JSX.Element => {
  const nodes = useAppStore((state) => state.nodes);
  const barriers = useAppStore((state) => state.barriers);
  const selectionId = useAppStore((state) => state.selectionId);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const primaryItems = useMemo(() => {
    const presentTypes = new Set(nodes.map((node) => node.data.nodeType));
    const types: LegendItem[] = primaryConcepts
      .filter(({ name }) =>
        presentTypes.has(name as (typeof nodes)[number]["data"]["nodeType"]),
      )
      .map(({ name, visualRole }) => [name, visualRole]);
    if (barriers.length) {
      const { name, visualRole } = getInvestigationConcept("control");
      types.push([name, visualRole]);
    }
    if (selectionId) types.push(["Selected relationship", "relationship"]);
    return types;
  }, [barriers.length, nodes, selectionId]);

  const secondaryGroups = useMemo(() => {
    const phases = orderedValues(
      ["Precursor", "Incident", "Detection", "Response", "Recovery"] as const,
      nodes.map((node) => node.data.eventPhase),
    ).map(item);
    const significance = orderedValues(
      ["KeyFactor", "RootCause"] as const,
      nodes.map((node) => node.data.factorSignificance),
    ).map(item);
    const controls = [
      ...orderedValues(
        ["Preventive", "Detective", "Mitigating"] as const,
        barriers.map((control) => control.controlRole),
      ).map(
        (value) => [value, `control-role-${value.toLowerCase()}`] as LegendItem,
      ),
      ...orderedValues(
        ["Effective", "Degraded", "Failed", "Missing"] as const,
        barriers.map((control) => control.status),
      ).map(item),
    ];
    const assertions = orderedValues(
      ["Confirmed", "Working", "Inferred"] as const,
      [
        ...nodes.map((node) => node.data.assertionState),
        ...barriers.map((control) => control.assertionState),
      ],
    ).map((value) => [value, `assertion-${value.toLowerCase()}`] as LegendItem);
    const actions = orderedValues(
      ["Immediate", "Corrective", "Preventive"] as const,
      nodes.map((node) => node.data.actionType),
    ).map(
      (value) => [value, `action-type-${value.toLowerCase()}`] as LegendItem,
    );

    const groups: Array<readonly [string, string, LegendItem[]]> = [
      ["Event Phase", "event-phase", phases],
      ["Analysis significance", "analysis", significance],
      ["Control Role and Status", "controls", controls],
      ["Assertion State", "assertions", assertions],
      ["Action Type", "action-type", actions],
    ];
    return groups.filter(([, , items]) => items.length);
  }, [barriers, nodes]);

  return (
    <aside className="presentation-legend" aria-label="Presentation legend">
      <div className="presentation-legend__heading">
        <h2>Map legend</h2>
        {onLearnMap ? (
          <button type="button" onClick={onLearnMap}>
            How to read the map
          </button>
        ) : null}
      </div>
      <section
        className="presentation-legend__primary"
        aria-labelledby={`${panelId}-nodes`}
      >
        <h3 id={`${panelId}-nodes`}>Nodes</h3>
        <Items items={primaryItems} />
      </section>
      {secondaryGroups.length ? (
        <>
          <button
            type="button"
            className="presentation-legend__toggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((open) => !open)}
          >
            Legend <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
          {expanded ? (
            <div id={panelId} className="presentation-legend__details">
              {secondaryGroups.map(([name, id, items]) => (
                <section key={id} aria-labelledby={`${panelId}-${id}`}>
                  <h3 id={`${panelId}-${id}`}>{name}</h3>
                  <Items items={items} />
                </section>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
};
