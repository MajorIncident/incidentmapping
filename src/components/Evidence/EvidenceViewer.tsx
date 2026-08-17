import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import type { Attachment } from "../../features/maps/schema";
import { attachmentRuntimeStore } from "../../features/persistence/attachmentRuntimeStore";

export const EvidenceViewer = ({
  attachment,
  evidenceTitle,
  onClose,
}: {
  attachment: Attachment;
  evidenceTitle: string;
  onClose: () => void;
}) => {
  useSyncExternalStore(
    attachmentRuntimeStore.subscribe,
    () => attachmentRuntimeStore.revision,
  );
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const url = attachmentRuntimeStore.getBlobUrl(
    attachment.id,
    attachment.mimeType,
  );
  useEffect(() => {
    const restoreFocus = returnFocus.current;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      attachmentRuntimeStore.releaseBlobUrl(attachment.id);
      restoreFocus?.focus();
    };
  }, [attachment.id]);
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>("button,a,video"),
    ];
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (index - 1 + focusable.length) % focusable.length
      : (index + 1) % focusable.length;
    event.preventDefault();
    focusable[next]?.focus();
  };
  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/80 sm:p-6"
      role="presentation"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-preview-title"
        onKeyDown={keys}
        className="flex h-full w-full flex-col bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-5xl sm:rounded-xl"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="evidence-preview-title" className="font-semibold">
            Preview {attachment.filename}
          </h2>
          <button
            className="min-h-11 min-w-11 rounded border"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        {!url ? (
          <div
            role="alert"
            className="my-auto rounded border border-amber-400 bg-amber-50 p-4"
          >
            Attachment content is unavailable. Its Evidence metadata has been
            preserved.
          </div>
        ) : attachment.mimeType.startsWith("image/") ? (
          <img
            className="min-h-0 flex-1 object-contain"
            src={url}
            alt={`${evidenceTitle} evidence`}
          />
        ) : attachment.mimeType.startsWith("video/") ? (
          <div className="my-auto">
            <video
              className="max-h-[75vh] w-full"
              src={url}
              controls
              tabIndex={0}
            />
            <p className="mt-2 text-sm">
              Captions are not included automatically; provide a captioned
              source when available.
            </p>
          </div>
        ) : attachment.mimeType === "application/pdf" ? (
          <iframe
            title={`PDF preview: ${evidenceTitle}`}
            sandbox="allow-same-origin"
            className="min-h-0 flex-1"
            src={url}
          />
        ) : null}
        {url ? (
          <a
            className="mt-3 min-h-11 self-start rounded border px-3 py-2"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={attachment.filename}
          >
            Open or download file
          </a>
        ) : null}
      </div>
    </div>
  );
};
