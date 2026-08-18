import { useEffect, useRef, useState } from "react";
import { learnMapPages } from "../../content/learnMap";
import { HowToReadMap } from "./HowToReadMap";

export const LearnMapDialog = ({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element => {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement as HTMLElement | null,
  );
  const page = learnMapPages[index];

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => returnFocus?.focus();
  }, []);

  const close = () => onClose();
  return (
    <div className="learn-map-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="learn-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`learn-map-${page.id}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== "Tab") return;
          const controls = [
            ...(dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ) ?? []),
          ];
          if (!controls.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className="learn-map-dialog__header">
          <div>
            <span>Learn the Map</span>
            <p>
              Page {index + 1} of {learnMapPages.length}
            </p>
          </div>
          <button
            type="button"
            className="learn-map-dialog__close"
            aria-label="Close Learn the Map"
            onClick={close}
          >
            ×
          </button>
        </header>
        <nav
          className="learn-map-dialog__topics"
          aria-label="Learn the Map pages"
        >
          {learnMapPages.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              aria-current={itemIndex === index ? "page" : undefined}
              onClick={() => setIndex(itemIndex)}
            >
              {item.id === "presenting"
                ? "Presenting"
                : item.title.split(" ")[0]}
            </button>
          ))}
        </nav>
        <HowToReadMap page={page} />
        <footer className="learn-map-dialog__footer">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            ← Previous
          </button>
          <span aria-live="polite">
            {index + 1} / {learnMapPages.length}
          </span>
          {index < learnMapPages.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((value) => value + 1)}
            >
              Next →
            </button>
          ) : (
            <button type="button" onClick={close}>
              Done
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};
