import type {
  ChecklistItem,
  ChecklistConcept,
  InvestigationStage,
} from "../../features/guidance/selectors";

const groups: ReadonlyArray<readonly [string, readonly ChecklistConcept[]]> = [
  ["Story", ["Impact", "Events"]],
  ["Analysis", ["Factors", "Root Cause"]],
  ["Support", ["Evidence", "Controls"]],
  ["Response", ["Actions"]],
];

export const InvestigationCheck = ({
  stage,
  items,
  onClose,
}: {
  stage: InvestigationStage;
  items: readonly ChecklistItem[];
  onClose: () => void;
}): JSX.Element => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4"
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="investigation-check-title"
      className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-sky-700">{stage}</p>
          <h2 id="investigation-check-title" className="text-2xl font-bold">
            Investigation Check
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            An advisory orientation, not a completion gate.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Investigation Check"
          className="rounded-lg px-3 py-2 text-xl"
        >
          ×
        </button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(([title, concepts]) => (
          <section
            key={title}
            className="rounded-xl border border-slate-200 p-4"
          >
            <h3 className="mb-3 font-bold">{title}</h3>
            <ul className="space-y-3">
              {concepts.map((concept) => {
                const item = items.find(
                  (candidate) => candidate.concept === concept,
                )!;
                return (
                  <li key={concept}>
                    <div className="flex justify-between gap-3">
                      <strong>{concept}</strong>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                        {item.state}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  </div>
);
