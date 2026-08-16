const groups = [
  {
    name: "Nodes",
    id: "nodes",
    items: [
      ["Impact", "impact"],
      ["Event", "event"],
      ["Factor", "factor"],
      ["Action", "action"],
    ],
  },
  {
    name: "Analysis",
    id: "analysis",
    items: [
      ["Key Factor", "key-factor"],
      ["Root Cause", "root-cause"],
    ],
  },
  {
    name: "Controls",
    id: "controls",
    items: [
      ["Effective", "effective"],
      ["Degraded", "degraded"],
      ["Failed", "failed"],
      ["Missing", "missing"],
    ],
  },
] as const;

export const Legend = (): JSX.Element => (
  <aside className="presentation-legend" aria-label="Presentation legend">
    <h2>Map legend</h2>
    <div className="presentation-legend__groups">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`legend-${group.id}`}>
          <h3 id={`legend-${group.id}`}>{group.name}</h3>
          <ul>
            {group.items.map(([label, treatment]) => (
              <li key={label}>
                <i
                  className={`legend-swatch legend-swatch--${treatment}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </aside>
);
