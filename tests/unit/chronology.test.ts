import { describe, expect, it } from "vitest";
import type { Node } from "reactflow";
import type { ChainNodeData } from "../../src/state/useAppStore";
import { selectChronologyGroups } from "../../src/state/selectors";

const event = (
  id: string,
  referenceId: string,
  timestamp?: string,
  eventPhase?: ChainNodeData["eventPhase"],
): Node<ChainNodeData> => ({
  id,
  type: "ChainNode",
  position: { x: 0, y: 0 },
  data: {
    nodeType: "Event",
    referenceId,
    title: `Event ${referenceId}`,
    timestamp,
    eventPhase,
  },
});

describe("selectChronologyGroups", () => {
  it("filters Events, orders parsed instants with a reference tie-breaker, and groups phases", () => {
    const factor = {
      ...event("factor", "F-1", "2024-01-01T00:00:00Z"),
      data: { ...event("factor", "F-1").data, nodeType: "Factor" as const },
    };
    const groups = selectChronologyGroups([
      event("late", "E-3", "2024-02-01T00:00:00Z", "Recovery"),
      event("tie-b", "E-2", "2024-01-01T00:00:00Z", "Incident"),
      event("tie-a", "E-1", "2024-01-01T00:00:00Z", "Incident"),
      factor,
    ]);
    expect(groups.map((group) => group.phase)).toEqual([
      "Incident",
      "Recovery",
    ]);
    expect(groups[0].events.map(({ id }) => id)).toEqual(["tie-a", "tie-b"]);
  });

  it("retains missing and invalid timestamps in the final Untimed Events group", () => {
    const groups = selectChronologyGroups([
      event("missing", "E-2", undefined, "Precursor"),
      event("invalid", "E-1", "not-a-date", "Recovery"),
      event("timed", "E-3", "2024-01-01T00:00:00Z", "Response"),
    ]);
    expect(groups.at(-1)?.phase).toBe("Untimed Events");
    expect(groups.at(-1)?.events.map(({ id }) => id)).toEqual([
      "invalid",
      "missing",
    ]);
  });
});

describe("Event time formatting", () => {
  it("formats ordered durations without unnecessary seconds", async () => {
    const { formatEventDuration, timestampNeedsSeconds } = await import(
      "../../src/state/selectors"
    );
    expect(
      formatEventDuration("2026-08-16T08:00:00Z", "2026-08-16T09:30:00Z"),
    ).toBe("1h 30m");
    expect(timestampNeedsSeconds("2026-08-16T08:00:00Z")).toBe(false);
    expect(timestampNeedsSeconds("2026-08-16T08:00:01Z")).toBe(true);
  });
});
