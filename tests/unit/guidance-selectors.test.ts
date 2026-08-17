import { describe, expect, it } from "vitest";
import {
  deriveInvestigationChecklist,
  deriveInvestigationStage,
  selectInvestigationGuidance,
  type GuidanceInput,
  type GuidanceNode,
} from "../../src/features/guidance/selectors";

const node = (
  id: string,
  nodeType: GuidanceNode["nodeType"],
  extra: Partial<GuidanceNode> = {},
): GuidanceNode => ({ id, nodeType, ...extra });

const core: GuidanceInput = {
  nodes: [
    node("impact", "Impact"),
    node("event", "Event"),
    node("factor", "Factor", { factorSignificance: "RootCause" }),
  ],
  edges: [
    { source: "impact", target: "event", kind: "CauseEffectEdge" },
    { source: "event", target: "factor", kind: "CauseEffectEdge" },
  ],
};

describe("investigation guidance", () => {
  it("handles missing/default fields without mutating the input", () => {
    const input: GuidanceInput = {};
    const result = selectInvestigationGuidance(input);
    expect(result.primary?.context).toBe("empty-map");
    expect(result.stage).toBe("Building Story");
    expect(input).toEqual({});
  });

  it.each([
    ["Impact", "impact-selected"],
    ["Event", "event-selected"],
    ["Factor", "factor-selected"],
    ["Action", "action-selected"],
  ] as const)("recognizes a selected %s", (nodeType, context) => {
    const result = selectInvestigationGuidance({
      nodes: [node("selected", nodeType)],
      selectedEntity: "selected",
    });
    expect(result.contexts).toContain(context);
  });

  it.each([
    ["control", { controls: [{ id: "selected" }] }, "control-selected"],
    ["evidence", { evidence: [{ id: "selected" }] }, "evidence-selected"],
  ] as const)("recognizes selected %s", (_label, entities, context) => {
    expect(
      selectInvestigationGuidance({
        ...entities,
        selectedEntity: "selected",
      }).contexts,
    ).toContain(context);
  });

  it("returns an explicit Event reason and resolves precedence deterministically", () => {
    const result = selectInvestigationGuidance({
      nodes: [node("event", "Event")],
      selectedEntity: "event",
      newlyCreated: true,
    });
    const event = result.matches.find(
      (match) => match.context === "event-selected",
    );
    expect(event?.reason).toBe("The selected Event has no child Factors.");
    expect(result.primary?.entry.id).toBe("new-map");
  });

  it("derives editing, view, branching, and assertion contexts", () => {
    const result = selectInvestigationGuidance({
      ...core,
      edges: [...(core.edges ?? []), { source: "event", target: "other" }],
      nodes: [...(core.nodes ?? []), node("other", "Factor")],
      selectedEntity: {
        id: "factor",
        nodeType: "Factor",
        assertionState: "Working",
      },
      contextEditing: true,
      presentation: true,
      activeLens: "Chronology",
    });
    expect(result.contexts).toEqual(
      expect.arrayContaining([
        "context-editing",
        "chronology",
        "presentation",
        "multiple-branches",
        "assertion-state",
      ]),
    );
  });
});

describe("maturity and checklist derivation", () => {
  it.each([
    [{}, "Building Story"],
    [
      {
        ...core,
        nodes: core.nodes?.map((n) => ({
          ...n,
          factorSignificance: undefined,
        })),
      },
      "Analyzing Causes",
    ],
    [core, "Testing Findings"],
    [
      {
        ...core,
        controls: [{ id: "control" }],
        evidence: [{ id: "evidence" }],
      },
      "Planning Actions",
    ],
    [
      {
        ...core,
        nodes: [...(core.nodes ?? []), node("action", "Action")],
        controls: [{ id: "control" }],
        evidence: [{ id: "evidence" }],
      },
      "Ready to Review",
    ],
  ] as const)("derives %s as %s", (input, expected) => {
    expect(deriveInvestigationStage(input)).toBe(expected);
  });

  it("derives all seven non-persisted checklist items", () => {
    const checklist = deriveInvestigationChecklist(core);
    expect(checklist.map((item) => item.concept)).toEqual([
      "Impact",
      "Events",
      "Factors",
      "Controls",
      "Evidence",
      "Root Cause",
      "Actions",
    ]);
    expect(
      checklist.find((item) => item.concept === "Root Cause")?.complete,
    ).toBe(true);
    expect(checklist.find((item) => item.concept === "Controls")?.reason).toBe(
      "No Controls have been assessed.",
    );
  });
});
