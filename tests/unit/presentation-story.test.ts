import { describe, expect, it } from "vitest";
import type { Node } from "reactflow";
import type { ChainNodeData } from "../../src/state/useAppStore";
import {
  derivePresentationStory,
  flattenPresentationStory,
} from "../../src/features/presentation/presentationStory";

const n = (
  id: string,
  type: ChainNodeData["nodeType"],
  extra: Partial<ChainNodeData> = {},
): Node<ChainNodeData> => ({
  id,
  position: { x: 0, y: 0 },
  data: {
    title: id,
    referenceId: id,
    nodeType: type,
    evidenceIds: [],
    ...extra,
  },
});
const input = {
  nodes: [
    n("I-2", "Impact"),
    n("I-1", "Impact"),
    n("E-2", "Event", { timestamp: "2024-01-02", eventPhase: "Response" }),
    n("E-1", "Event", { timestamp: "2024-01-01", eventPhase: "Incident" }),
    n("F-1", "Factor", {
      factorSignificance: "RootCause",
      assertionState: "Confirmed",
      evidenceIds: ["EV-1"],
    }),
    n("A-2", "Action", { actionStatus: "Completed" }),
    n("A-1", "Action", { actionStatus: "InProgress" }),
  ],
  edges: [
    {
      id: "1",
      source: "I-1",
      target: "E-1",
      data: { kind: "CauseEffectEdge" },
    },
    {
      id: "2",
      source: "E-1",
      target: "F-1",
      data: { kind: "CauseEffectEdge" },
    },
    { id: "3", source: "F-1", target: "A-2", data: { kind: "ActionEdge" } },
    { id: "4", source: "F-1", target: "A-1", data: { kind: "ActionEdge" } },
  ],
  controls: [
    {
      id: "C-effective",
      upstreamNodeId: "I-1",
      downstreamNodeId: "E-1",
      status: "Effective",
    },
    {
      id: "C-missing",
      upstreamNodeId: "E-1",
      downstreamNodeId: "F-1",
      status: "Missing",
      evidenceIds: ["EV-1"],
    },
  ],
  evidence: [
    { id: "EV-1", type: "Note" as const, title: "Record", attachmentIds: [] },
  ],
};

describe("derivePresentationStory", () => {
  it("always derives the six chapters in narrative order", () =>
    expect(derivePresentationStory(input).chapters.map((c) => c.id)).toEqual([
      "Brief",
      "Occurrence",
      "Findings",
      "Controls",
      "Actions",
      "Close",
    ]));
  it("orders chronology, control priority, and grouped actions deterministically", () => {
    const story = derivePresentationStory(input);
    expect(story.chapters[1].steps.map((s) => s.primaryEntityId)).toEqual([
      "E-1",
      "E-2",
    ]);
    expect(story.chapters[3].steps.map((s) => s.primaryEntityId)).toEqual([
      "C-missing",
      "C-effective",
    ]);
    expect(story.chapters[4].steps[0].actions?.map((a) => a.id)).toEqual([
      "A-1",
      "A-2",
    ]);
  });
  it("keeps multiple impacts together, a complete finding branch, and contextual evidence", () => {
    const story = derivePresentationStory(input);
    expect(story.chapters[0].steps[0].entityIds).toEqual(["I-1", "I-2"]);
    expect(story.chapters[2].steps[0].focusIds).toEqual(["I-1", "E-1", "F-1"]);
    expect(story.chapters[2].steps[0].evidenceIds).toEqual(["EV-1"]);
    expect(
      flattenPresentationStory(story).some(
        ({ step }) => step.presentationType === ("Evidence" as never),
      ),
    ).toBe(false);
  });
  it("uses terminal factors and neutral empty chapter steps for incomplete maps", () => {
    const story = derivePresentationStory({
      nodes: [n("factor", "Factor")],
      edges: [],
      controls: [],
      evidence: [],
    });
    expect(story.chapters[2].steps[0].primaryEntityId).toBe("factor");
    expect(story.chapters[3].steps[0].title).toBe("No Controls recorded.");
    expect(story.chapters[4].steps[0].title).toBe("No Actions recorded.");
  });
});
