import { useEffect, useSyncExternalStore } from "react";
import { attachmentRuntimeStore } from "../../features/persistence/attachmentRuntimeStore";
import type { StoryStep } from "../../features/presentation/story";
import { formatEventDateTime } from "../../state/selectors";

const label = (value?: string) =>
  value === "InProgress" ? "In progress" : value;

const AttachmentPreview = ({
  id,
  title,
  mimeType,
}: {
  id: string;
  title: string;
  mimeType: string;
}) => {
  useSyncExternalStore(
    attachmentRuntimeStore.subscribe,
    () => attachmentRuntimeStore.revision,
  );
  const url = attachmentRuntimeStore.getBlobUrl(id, mimeType);
  if (!url) return null;
  return mimeType.startsWith("image/") ? (
    <img
      className="story-attachment"
      src={url}
      alt={`Attachment preview: ${title}`}
    />
  ) : (
    <a
      className="story-attachment-link"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      Preview {title}
    </a>
  );
};

export const StoryPanel = ({
  step,
  index,
  count,
  onPrevious,
  onNext,
  onExit,
}: {
  step: StoryStep;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
}) => {
  useEffect(() => {
    document
      .getElementById("story-step-heading")
      ?.focus({ preventScroll: true });
  }, [step.id]);
  const node = step.node?.data;
  return (
    <section
      className="story-panel"
      aria-label="Guided Story"
      aria-describedby="story-position"
    >
      <div className="story-panel__eyebrow">
        <span>{step.type}</span>
        <span>
          {step.branchCount > 1
            ? `Finding ${step.branch} of ${step.branchCount} · `
            : ""}
          Step {index + 1} of {count}
        </span>
      </div>
      <h2 id="story-step-heading" tabIndex={-1}>
        {step.title}
      </h2>
      <p id="story-position" className="sr-only" aria-live="polite">
        Step {index + 1} of {count}. {step.type}: {step.title}
      </p>
      {node?.description ? <p>{node.description}</p> : null}
      {node?.timestamp ? (
        <dl>
          <dt>Date</dt>
          <dd>{formatEventDateTime(node.timestamp) ?? node.timestamp}</dd>
        </dl>
      ) : null}
      {node?.actionStatus ? (
        <dl>
          <dt>Status</dt>
          <dd>{label(node.actionStatus)}</dd>
        </dl>
      ) : null}
      {step.control ? (
        <dl>
          <dt>Status</dt>
          <dd>{label(step.control.status)}</dd>
          {step.control.controlRole ? (
            <>
              <dt>Role</dt>
              <dd>{step.control.controlRole}</dd>
            </>
          ) : null}
          {step.control.failureReason ? (
            <>
              <dt>Failure</dt>
              <dd>{label(step.control.failureReason)}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {step.evidence ? (
        <div className="story-evidence">
          <p>{step.evidence.description}</p>
          <dl>
            <dt>Type</dt>
            <dd>{step.evidence.type}</dd>
            {step.evidence.source ? (
              <>
                <dt>Source</dt>
                <dd>{step.evidence.source}</dd>
              </>
            ) : null}
          </dl>
          {step.attachments?.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              id={attachment.id}
              title={attachment.filename}
              mimeType={attachment.mimeType}
            />
          ))}
        </div>
      ) : null}
      <div className="story-panel__actions">
        <button type="button" onClick={onPrevious} disabled={index === 0}>
          Previous
        </button>
        <button type="button" onClick={onNext} disabled={index === count - 1}>
          Next
        </button>
        <button type="button" onClick={onExit}>
          Exit Story
        </button>
      </div>
    </section>
  );
};
