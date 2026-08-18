import { useEffect } from "react";
import type {
  PresentationChapter,
  PresentationStep,
} from "../../features/presentation/presentationStory";
import {
  formatEventDateTime,
  formatEventDuration,
} from "../../state/selectors";

const human = (value?: string) => value?.replace(/([a-z])([A-Z])/g, "$1 $2");
export const BriefingPanel = ({
  chapter,
  step,
  chapterIndex,
  stepIndex,
  chapterCount,
  onPrevious,
  onNext,
  onExplore,
  onExit,
  onSupport,
}: {
  chapter: PresentationChapter;
  step: PresentationStep;
  chapterIndex: number;
  stepIndex: number;
  chapterCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onExplore: () => void;
  onExit: () => void;
  onSupport: () => void;
}) => {
  useEffect(
    () =>
      document
        .getElementById("briefing-step-title")
        ?.focus({ preventScroll: true }),
    [step.id],
  );
  const node = step.node?.data;
  return (
    <aside className="briefing-panel" aria-label="Guided Briefing">
      <header className="briefing-panel__header">
        <div>
          <span>GUIDED BRIEFING</span>
          <strong>{chapter.question}</strong>
        </div>
        <span>
          {chapterIndex + 1} of {chapterCount}
        </span>
      </header>
      <div className="briefing-progress" aria-label="Briefing progress">
        {[
          "Brief",
          "Occurrence",
          "Findings",
          "Controls",
          "Actions",
          "Close",
        ].map((label, index) => (
          <span
            key={label}
            className={
              index === chapterIndex
                ? "is-current"
                : index < chapterIndex
                  ? "is-complete"
                  : ""
            }
          >
            {label}
          </span>
        ))}
      </div>
      <p className="briefing-panel__chapter">
        <span>{chapter.title}</span>
        {chapter.steps.length > 1 ? (
          <span className="briefing-panel__step-position">
            {" "}
            · {stepIndex + 1} of {chapter.steps.length}
          </span>
        ) : null}
      </p>
      <h2 id="briefing-step-title" tabIndex={-1}>
        {step.title}
      </h2>
      {node?.assertionState ? (
        <p className="briefing-status">
          {human(node.assertionState)}{" "}
          <small>
            {node.assertionState === "Confirmed"
              ? "Accepted investigation finding"
              : node.assertionState === "Working"
                ? "Still being evaluated"
                : "Investigator-derived conclusion"}
          </small>
        </p>
      ) : null}
      {node?.timestamp ? (
        <dl>
          <dt>Time</dt>
          <dd>{formatEventDateTime(node.timestamp) ?? node.timestamp}</dd>
          {node.eventPhase ? (
            <>
              <dt>Phase</dt>
              <dd>{node.eventPhase}</dd>
            </>
          ) : null}
          {formatEventDuration(node.timestamp, node.endTimestamp) ? (
            <>
              <dt>Duration</dt>
              <dd>{formatEventDuration(node.timestamp, node.endTimestamp)}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {step.control ? (
        <dl>
          <dt>Reference</dt>
          <dd>{step.control.referenceId ?? step.control.id}</dd>
          <dt>Status</dt>
          <dd>{step.control.status}</dd>
          {step.control.controlRole ? (
            <>
              <dt>Role</dt>
              <dd>{step.control.controlRole}</dd>
            </>
          ) : null}
          {step.control.failureReason ? (
            <>
              <dt>Failure</dt>
              <dd>{human(step.control.failureReason)}</dd>
            </>
          ) : null}
          <dt>Between</dt>
          <dd>
            {step.entityIds[0]} and {step.entityIds.at(-1)}
          </dd>
        </dl>
      ) : null}
      {step.talkingPoints?.length ? (
        <ul className="briefing-points">
          {step.talkingPoints.slice(0, 4).map((point, index) => (
            <li key={`${point.text}-${index}`}>
              {point.label ? <strong>{human(point.label)} · </strong> : null}
              {point.text}
            </li>
          ))}
        </ul>
      ) : null}
      {step.evidenceIds?.length ? (
        <button className="briefing-support" type="button" onClick={onSupport}>
          Support · {step.evidenceIds.length} Evidence
        </button>
      ) : null}
      <div className="briefing-panel__actions">
        <button
          type="button"
          onClick={onPrevious}
          disabled={chapterIndex === 0 && stepIndex === 0}
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={
            chapterIndex === chapterCount - 1 &&
            stepIndex === chapter.steps.length - 1
          }
        >
          Next →
        </button>
      </div>
      <footer>
        <button type="button" onClick={onExplore}>
          Explore Map
        </button>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </footer>
    </aside>
  );
};
