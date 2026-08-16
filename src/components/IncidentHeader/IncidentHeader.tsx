import { useEffect, useRef, useState } from "react";
import type { MapMetadataV2 as MapMetadata } from "../../features/maps/schema";
import { useAppStore } from "../../state/useAppStore";
import { EditableMapTitle } from "../Canvas/EditableMapTitle";
import { ContextEditor } from "../Context/ContextEditor";
import { selectPinnedContext } from "../../state/selectors";
import { ContextPresentation } from "../Context/ContextPresentation";

const severities = ["Low", "Medium", "High", "Critical"] as const;
const statuses = ["Draft", "Open", "InProgress", "Closed"] as const;

const displayDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const IncidentHeader = ({
  readOnly = false,
}: {
  readOnly?: boolean;
}): JSX.Element => {
  const metadata = useAppStore((state) => state.metadata);
  const { setMapTitle, updateMetadata } = useAppStore((state) => state.actions);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MapMetadata>(metadata ?? {});
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(metadata ?? {}), [metadata]);

  const commitText = (key: "incidentId" | "occurredAt" | "location") => {
    updateMetadata({ [key]: draft[key] });
  };
  const details = [
    metadata?.incidentId,
    metadata?.occurredAt ? displayDate(metadata.occurredAt) : undefined,
    metadata?.location,
    metadata?.severity,
    metadata?.status === "InProgress" ? "In progress" : metadata?.status,
  ].filter(Boolean);
  const pinnedContext = selectPinnedContext(metadata?.contextItems ?? []).slice(
    0,
    4,
  );

  return (
    <section className="incident-header" aria-label="Incident header">
      {readOnly ? (
        <h1 className="text-lg font-semibold text-slate-900">
          {metadata?.title || "Untitled Map"}
        </h1>
      ) : (
        <EditableMapTitle
          title={metadata?.title || "Untitled Map"}
          onCommit={setMapTitle}
        />
      )}
      <div
        className="incident-header__summary"
        aria-label="Incident metadata summary"
      >
        {details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </div>
      {pinnedContext.length ? (
        <ContextPresentation
          items={pinnedContext}
          ariaLabel="Pinned incident context"
        />
      ) : null}
      {!readOnly ? (
        <button
          type="button"
          className="incident-header__edit"
          aria-expanded={open}
          aria-controls="incident-metadata-editor"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close details" : "Edit details"}
        </button>
      ) : null}
      {open && !readOnly ? (
        <div
          ref={panelRef}
          id="incident-metadata-editor"
          className="incident-header__popover"
          aria-label="Edit incident details"
        >
          <label>
            Incident ID
            <input
              value={draft.incidentId ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, incidentId: event.target.value })
              }
              onBlur={() => commitText("incidentId")}
            />
          </label>
          <label>
            Occurred at
            <input
              type="datetime-local"
              value={draft.occurredAt ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, occurredAt: event.target.value })
              }
              onBlur={() => commitText("occurredAt")}
            />
          </label>
          <label>
            Location
            <input
              value={draft.location ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, location: event.target.value })
              }
              onBlur={() => commitText("location")}
            />
          </label>
          <label>
            Severity
            <select
              value={draft.severity ?? ""}
              onChange={(event) =>
                updateMetadata({
                  severity: (event.target.value ||
                    undefined) as MapMetadata["severity"],
                })
              }
            >
              <option value="">Not set</option>
              {severities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.status ?? ""}
              onChange={(event) =>
                updateMetadata({
                  status: (event.target.value ||
                    undefined) as MapMetadata["status"],
                })
              }
            >
              <option value="">Not set</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <ContextEditor
            target="incident"
            items={metadata?.contextItems ?? []}
          />
        </div>
      ) : null}
    </section>
  );
};
