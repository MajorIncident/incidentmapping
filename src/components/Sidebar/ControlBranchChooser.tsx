import type { EligibleControlRelationship } from "../../state/selectors";

export const ControlBranchChooser = ({
  relationships,
  onChoose,
}: {
  relationships: readonly EligibleControlRelationship[];
  onChoose: (relationship: EligibleControlRelationship) => void;
}): JSX.Element | null => {
  if (!relationships.length) return null;
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-700">
        Where was the Control intended to act?
      </legend>
      {relationships.map((relationship) => (
        <button
          key={relationship.edgeId}
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-canvas-accent"
          onClick={() => onChoose(relationship)}
        >
          {relationship.label}
        </button>
      ))}
    </fieldset>
  );
};
