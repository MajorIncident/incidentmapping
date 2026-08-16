import { useEffect, useRef, useState } from "react";
import type { MapMetadata } from "../../features/maps/schema";
import { useAppStore } from "../../state/useAppStore";
import { EditableMapTitle } from "../Canvas/EditableMapTitle";

const severities = ["Low", "Medium", "High", "Critical"] as const;
const statuses = ["Draft", "Open", "InProgress", "Closed"] as const;

const displayDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const IncidentHeader = (): JSX.Element => {
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

  return (
    <section className="incident-header" aria-label="Incident header">
      <EditableMapTitle
        title={metadata?.title || "Untitled Map"}
        onCommit={setMapTitle}
      />
      <div
        className="incident-header__summary"
        aria-label="Incident metadata summary"
      >
        {details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </div>
      <button
        type="button"
        className="incident-header__edit"
        aria-expanded={open}
        aria-controls="incident-metadata-editor"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close details" : "Edit details"}
      </button>
      {open ? (
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
        </div>
      ) : null}
    </section>
  );
};
