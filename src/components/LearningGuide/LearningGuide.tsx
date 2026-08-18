import { useEffect, useRef, useState } from "react";
import type {
  GuideActionId,
  GuideContentBlock,
} from "../../content/investigationGuide";
import type { GuidanceMatch } from "../../features/guidance/selectors";
import {
  dismissLearningTip,
  hasSeenLearningGuideIntroduction,
  markLearningGuideIntroductionSeen,
} from "../../features/guidance/preferences";
import type { MapSession } from "../../state/useAppStore";

const Blocks = ({ blocks }: { blocks: readonly GuideContentBlock[] }) => (
  <div className="learning-guide__blocks">
    {blocks.map((block, index) => {
      const key = `${block.type}-${index}`;
      if (block.type === "heading")
        return block.level === 2 ? (
          <h2 key={key}>{block.text}</h2>
        ) : (
          <h3 key={key}>{block.text}</h3>
        );
      if (block.type === "mini-diagram")
        return (
          <figure
            key={key}
            className="learning-guide__diagram"
            aria-label={block.alt}
          >
            {block.nodes.map((node, nodeIndex) => (
              <span key={`${node}-${nodeIndex}`}>
                <b>{node}</b>
                {block.connectors[nodeIndex] ? (
                  <i aria-hidden="true">{block.connectors[nodeIndex]}</i>
                ) : null}
              </span>
            ))}
          </figure>
        );
      if (block.type === "keyboard-hint")
        return (
          <p key={key}>
            <strong>Keyboard:</strong>{" "}
            {block.keys.map((keyName) => (
              <kbd key={keyName}>{keyName}</kbd>
            ))}{" "}
            {block.text}
          </p>
        );
      if (block.type === "example")
        return (
          <p key={key}>
            <strong>{block.label}:</strong> {block.text}
          </p>
        );
      if (block.type === "rule")
        return (
          <p key={key}>
            <strong>Rule:</strong> {block.text}
          </p>
        );
      if (block.type === "question")
        return (
          <p key={key}>
            <strong>Ask:</strong> {block.text}
          </p>
        );
      if (block.type === "warning")
        return (
          <p key={key}>
            <strong>Warning:</strong> {block.text}
          </p>
        );
      if (block.type === "suggested-action")
        return (
          <p key={key}>
            <strong>Try:</strong> {block.text}
          </p>
        );
      return <p key={key}>{block.text}</p>;
    })}
  </div>
);

export type LearningGuideProps = {
  match: GuidanceMatch | null;
  enabled: boolean;
  mapSession?: Readonly<MapSession>;
  onAction: (action: GuideActionId) => void;
  onDismissed?: () => void;
};

export const LearningGuide = ({
  match,
  enabled,
  mapSession,
  onAction,
  onDismissed,
}: LearningGuideProps): JSX.Element | null => {
  const [firstUse] = useState(() => !hasSeenLearningGuideIntroduction());
  const [open, setOpen] = useState(firstUse);
  const [mobile, setMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(open);

  useEffect(() => {
    if (firstUse && enabled && match) markLearningGuideIntroductionSeen();
  }, [enabled, firstUse, match]);

  useEffect(() => {
    if (mapSession?.source === "New" && mapSession.fresh) setOpen(true);
  }, [mapSession]);

  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 767px)");
    const initialMobile = query?.matches ?? window.innerWidth <= 767;
    setMobile(initialMobile);
    if (initialMobile) setOpen(false);
    const update = () => setMobile(query?.matches ?? window.innerWidth <= 767);
    query?.addEventListener?.("change", update);
    return () => query?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (mobile && open) closeRef.current?.focus();
  }, [mobile, open]);

  useEffect(() => {
    if (!open && hasOpenedRef.current) triggerRef.current?.focus();
    if (open) hasOpenedRef.current = true;
  }, [open]);

  if (!enabled || !match) return null;
  const close = () => {
    setOpen(false);
  };
  const expand = () => {
    setOpen(true);
  };
  const content = (
    <>
      <div className="learning-guide__header">
        <div>
          <h2>{match.entry.title}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="learning-guide__close"
          aria-label={
            mobile ? "Close Learning Guide" : "Collapse Learning Guide"
          }
          onClick={close}
        >
          ×
        </button>
      </div>
      {firstUse ? (
        <p className="learning-guide__welcome">
          Welcome to the Learning Guide. Step 1 is to describe the undesirable
          outcome.
        </p>
      ) : null}
      <Blocks blocks={match.entry.content} />
      {match.entry.suggestedActions.length ? (
        <div className="learning-guide__actions" aria-label="Suggested actions">
          {match.entry.suggestedActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {match.entry.detail?.length ? (
        <details>
          <summary>More detail</summary>
          <Blocks blocks={match.entry.detail} />
        </details>
      ) : null}
      {import.meta.env.DEV ? (
        <details>
          <summary>Guide diagnostics</summary>
          <p>{match.entry.whyThisTip}</p>
          <p className="learning-guide__reason">Signal: {match.reason}</p>
        </details>
      ) : null}
      {match.entry.dismissible ? (
        <button
          type="button"
          className="learning-guide__dismiss"
          onClick={() => {
            dismissLearningTip(match.entry.id);
            onDismissed?.();
          }}
        >
          Dismiss this tip for this session
        </button>
      ) : null}
    </>
  );

  return (
    <div className="learning-guide-root">
      {!open ? (
        <button
          ref={triggerRef}
          type="button"
          className="learning-guide__trigger"
          aria-expanded="false"
          aria-controls="learning-guide-panel"
          onClick={expand}
        >
          ? Guide
        </button>
      ) : null}
      {open ? (
        <aside
          id="learning-guide-panel"
          className={
            mobile ? "learning-guide learning-guide--sheet" : "learning-guide"
          }
          role={mobile ? "dialog" : "complementary"}
          aria-modal={mobile || undefined}
          aria-label="Learning Guide"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          {content}
        </aside>
      ) : null}
    </div>
  );
};
