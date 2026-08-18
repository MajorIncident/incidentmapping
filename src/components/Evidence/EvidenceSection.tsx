import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { validateAttachmentFile } from "../../features/persistence/attachments";
import { EvidenceViewer } from "./EvidenceViewer";
import type { EvidenceType } from "../../features/maps/schema";
import {
  selectEvidenceLinkedEntityLabels,
  selectEvidenceLinkCounts,
} from "../../state/selectors";
import { useAppStore } from "../../state/useAppStore";

const types: EvidenceType[] = [
  "Note",
  "Photo",
  "Video",
  "Document",
  "SystemLog",
  "Interview",
  "Other",
];
const typeLabel = (type: EvidenceType) =>
  type === "SystemLog" ? "System Log" : type;
const input =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-accent";
const button =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas-accent";

export type EvidenceTarget = { kind: "node" | "control"; id: string };

export const EvidenceSection = ({ target }: { target: EvidenceTarget }) => {
  const evidence = useAppStore((state) => state.evidence);
  const nodes = useAppStore((state) => state.nodes);
  const controls = useAppStore((state) => state.barriers);
  const actions = useAppStore((state) => state.actions);
  const editorRequest = useAppStore((state) => state.editorFocusRequest);
  const attachments = useAppStore((state) => state.attachments);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const linkedIds = useMemo(
    () =>
      target.kind === "node"
        ? (nodes.find((node) => node.id === target.id)?.data.evidenceIds ?? [])
        : (controls.find((control) => control.id === target.id)?.evidenceIds ??
          []),
    [controls, nodes, target.id, target.kind],
  );
  const linked = useMemo(
    () => linkedIds.flatMap((id) => evidence.filter((item) => item.id === id)),
    [evidence, linkedIds],
  );
  const available = evidence.filter((item) => !linkedIds.includes(item.id));
  const counts = selectEvidenceLinkCounts(evidence, nodes, controls);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const linkButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    type: "Note" as EvidenceType,
    title: "",
    description: "",
    source: "",
    reference: "",
    externalUrl: "",
    attachmentIds: [] as string[],
  });

  useEffect(() => {
    if (
      editorRequest?.entityId !== target.id ||
      editorRequest.section !== "Evidence"
    )
      return;
    if (editorRequest.intent === "Create") {
      setAdding(true);
      setLinking(false);
    } else {
      setLinking(true);
      setAdding(false);
    }
    actions.clearEditorFocusRequest(editorRequest.id);
  }, [actions, editorRequest, target.id]);

  useEffect(() => {
    if (adding) requestAnimationFrame(() => titleInput.current?.focus());
  }, [adding]);

  useEffect(() => {
    if (!linking) return;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLinking(false);
        requestAnimationFrame(() => linkButton.current?.focus());
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [linking]);

  const link = (id: string) => {
    if (target.kind === "node") actions.linkEvidenceToNode(target.id, id);
    else actions.linkEvidenceToControl(target.id, id);
  };
  const unlink = (id: string) => {
    if (target.kind === "node") actions.unlinkEvidenceFromNode(target.id, id);
    else actions.unlinkEvidenceFromControl(target.id, id);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    if (
      actions.createAndLinkEvidence(target, {
        ...draft,
        externalUrl: draft.externalUrl || undefined,
      })
    ) {
      setDraft({
        type: "Note",
        title: "",
        description: "",
        source: "",
        reference: "",
        externalUrl: "",
        attachmentIds: [],
      });
      setAdding(false);
      requestAnimationFrame(() => addButton.current?.focus());
    }
  };

  return (
    <section
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
      aria-labelledby={`evidence-${target.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={`evidence-${target.id}`}
          className="text-sm font-semibold text-slate-900"
        >
          Evidence
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            ref={addButton}
            type="button"
            className={button}
            onClick={() => setAdding((value) => !value)}
          >
            Add Evidence
          </button>
          <button
            ref={linkButton}
            type="button"
            className={button}
            onClick={() => setLinking(true)}
          >
            Link Existing
          </button>
        </div>
      </div>
      {linked.length === 0 ? (
        <p className="text-xs text-slate-500">No evidence linked.</p>
      ) : null}
      <ul className="space-y-3">
        {linked.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="font-semibold text-slate-900">
              {item.id} · {typeLabel(item.type)} · {item.title}
            </div>
            {item.source ? (
              <div>
                <span className="font-medium">Source:</span> {item.source}
              </div>
            ) : null}
            {item.reference ? (
              <div>
                <span className="font-medium">Reference:</span> {item.reference}
              </div>
            ) : null}
            {item.description ? (
              <p className="mt-1 text-slate-600">{item.description}</p>
            ) : null}
            {item.externalUrl ? (
              <a
                className="mt-2 block text-blue-700 underline"
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open external source
              </a>
            ) : null}
            {item.attachmentIds.map((attachmentId) => {
              const attachment = attachments.find(
                (entry) => entry.id === attachmentId,
              );
              return attachment ? (
                <div
                  key={attachmentId}
                  className="mt-2 flex flex-wrap items-center gap-2 rounded border p-2"
                >
                  <span>{attachment.filename}</span>
                  <button
                    className={button}
                    type="button"
                    onClick={() => setPreviewId(attachmentId)}
                  >
                    Preview
                  </button>
                  <button
                    className={button}
                    type="button"
                    onClick={() =>
                      actions.removeAttachment(item.id, attachmentId)
                    }
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <p key={attachmentId} role="alert" className="text-amber-700">
                  Attachment metadata is missing.
                </p>
              );
            })}
            <label className={`${button} mt-2 inline-block cursor-pointer`}>
              Add File
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    validateAttachmentFile(
                      file,
                      attachments.reduce((sum, entry) => sum + entry.size, 0),
                    );
                    actions.addAttachment(
                      item.id,
                      file,
                      new Uint8Array(await file.arrayBuffer()),
                    );
                    setFileError("");
                  } catch (error) {
                    setFileError(
                      error instanceof Error
                        ? error.message
                        : "Unable to add file",
                    );
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {fileError ? (
              <p role="alert" className="mt-1 text-sm text-rose-700">
                {fileError}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Linked to:{" "}
              {selectEvidenceLinkedEntityLabels(item.id, nodes, controls).join(
                ", ",
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => unlink(item.id)}
              >
                Unlink
              </button>
              <button
                type="button"
                className={`${button} text-rose-700`}
                onClick={() => {
                  const count = counts[item.id] ?? 0;
                  if (
                    count > 1 &&
                    !window.confirm(
                      `Delete ${item.id}? It is linked to ${count} entities. Deleting it will remove all ${count} links.`,
                    )
                  )
                    return;
                  actions.deleteEvidence(item.id);
                }}
              >
                Delete Evidence
              </button>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="space-y-3 rounded-lg border border-slate-300 bg-white p-3"
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setAdding(false);
              requestAnimationFrame(() => addButton.current?.focus());
            }
          }}
        >
          <label className="block text-xs font-semibold">
            Type
            <select
              className={input}
              value={draft.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as EvidenceType })
              }
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold">
            Title
            <input
              ref={titleInput}
              required
              className={input}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            Description
            <textarea
              className={input}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-semibold">
            Source
            <input
              className={input}
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            Reference
            <input
              className={input}
              value={draft.reference}
              onChange={(e) =>
                setDraft({ ...draft, reference: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-semibold">
            External URL
            <input
              className={input}
              type="url"
              pattern="https?://.*"
              placeholder="https://example.com"
              value={draft.externalUrl}
              onChange={(e) =>
                setDraft({ ...draft, externalUrl: e.target.value })
              }
            />
          </label>
          <div className="flex gap-2">
            <button className={button} type="submit">
              Add Evidence
            </button>
            <button
              className={button}
              type="button"
              onClick={() => {
                setAdding(false);
                addButton.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {linking ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setLinking(false);
              linkButton.current?.focus();
            }
          }}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`link-evidence-${target.id}`}
            className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-2xl"
          >
            <h2
              id={`link-evidence-${target.id}`}
              className="text-lg font-semibold"
            >
              Link Existing Evidence
            </h2>
            {available.length ? (
              <ul className="mt-3 space-y-2">
                {available.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`${button} w-full text-left`}
                      type="button"
                      onClick={() => {
                        link(item.id);
                        setLinking(false);
                        requestAnimationFrame(() =>
                          linkButton.current?.focus(),
                        );
                      }}
                    >
                      {item.id} · {typeLabel(item.type)} · {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="my-3 text-sm">No unlinked evidence items.</p>
            )}
            <button
              className={`${button} mt-3`}
              type="button"
              onClick={() => {
                setLinking(false);
                linkButton.current?.focus();
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      {previewId
        ? (() => {
            const attachment = attachments.find(
              (item) => item.id === previewId,
            );
            const owner = evidence.find((item) =>
              item.attachmentIds.includes(previewId),
            );
            return attachment && owner ? (
              <EvidenceViewer
                attachment={attachment}
                evidenceTitle={owner.title}
                onClose={() => setPreviewId(null)}
              />
            ) : null;
          })()
        : null}
    </section>
  );
};
