import type { EvidenceItem } from "../../features/maps/schema";

export const SupportDrawer = ({
  evidence,
  assertionState,
  onClose,
}: {
  evidence: EvidenceItem[];
  assertionState?: string;
  onClose: () => void;
}) => (
  <aside
    className="support-drawer"
    role="dialog"
    aria-modal="false"
    aria-label="Evidence Support"
  >
    <header>
      <div>
        <span>SUPPORT</span>
        <h2>How do we know?</h2>
      </div>
      <button type="button" aria-label="Close support" onClick={onClose}>
        ×
      </button>
    </header>
    {assertionState ? (
      <p className="support-assertion">
        <strong>{assertionState}</strong>
        <br />
        Explicit investigation assertion state
      </p>
    ) : null}
    <p>
      {evidence.length} linked Evidence{" "}
      {evidence.length === 1 ? "item" : "items"}. Quantity is not a confidence
      measure.
    </p>
    <ul>
      {evidence.map((item) => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          <span>
            {item.type}
            {item.source ? ` · ${item.source}` : ""}
          </span>
          {item.reference ? <span>{item.reference}</span> : null}
          {item.description ? <p>{item.description}</p> : null}
        </li>
      ))}
    </ul>
  </aside>
);
