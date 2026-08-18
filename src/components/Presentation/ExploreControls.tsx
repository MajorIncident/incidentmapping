import type { PresentationLens } from "../../features/presentation/selectors";
import { PRESENTATION_LENSES } from "../../features/presentation/selectors";

export const ExploreControls = ({
  lens,
  onLens,
  onReturn,
  onExit,
  showDetails,
  showTimeline,
  onDetails,
  onTimeline,
}: {
  lens: PresentationLens;
  onLens: (lens: PresentationLens) => void;
  onReturn: () => void;
  onExit: () => void;
  showDetails: boolean;
  showTimeline: boolean;
  onDetails: () => void;
  onTimeline: () => void;
}) => (
  <nav className="explore-controls" aria-label="Explore Map controls">
    <button type="button" onClick={onReturn}>
      ← Return to Briefing
    </button>
    <label>
      View{" "}
      <select
        aria-label="Presentation view"
        value={lens}
        onChange={(event) => onLens(event.target.value as PresentationLens)}
      >
        {PRESENTATION_LENSES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </label>
    <details>
      <summary>More</summary>
      <div>
        <button type="button" aria-pressed={showDetails} onClick={onDetails}>
          {showDetails ? "Hide Details" : "Show Details"}
        </button>
        <button type="button" aria-pressed={showTimeline} onClick={onTimeline}>
          {showTimeline ? "Hide Timeline Events" : "Timeline Events"}
        </button>
      </div>
    </details>
    <button type="button" onClick={onExit}>
      Exit
    </button>
  </nav>
);
