export const Legend = (): JSX.Element => (
  <aside className="presentation-legend" aria-label="Presentation legend">
    <strong>Map legend</strong>
    <span>
      <i className="legend-dot bg-violet-500" /> Top Event
    </span>
    <span>
      <i className="legend-dot bg-amber-400" /> Key Factor
    </span>
    <span>
      <i className="legend-dot bg-rose-500" /> Root Cause / failed control
    </span>
    <span>
      <i className="legend-dot bg-emerald-500" /> Effective control
    </span>
  </aside>
);
