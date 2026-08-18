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
  it("offers secondary Control and Action coaching only when applicable", () => {
    const result = selectInvestigationGuidance({
      selectedEntity: "event",
      nodes: [node("event", "Event", { title: "Alarm" })],
      eligibleControlRelationshipCount: 1,
    });
    expect(
      result.primary?.entry.suggestedActions.map((action) => action.label),
    ).toEqual(["+ Event", "+ Factor", "+ Action", "+ Control"]);
  });

  it("uses advisory rather than mandatory Action wording for a Root Cause", () => {
    const result = selectInvestigationGuidance({
      selectedEntity: "factor",
      nodes: [node("factor", "Factor", { factorSignificance: "RootCause" })],
    });
    expect(result.primary?.entry.content).toContainEqual(
      expect.objectContaining({
        text: expect.stringMatching(/Action is optional/),
      }),
    );
  });
  it("handles missing/default fields without mutating the input", () => {
    const input: GuidanceInput = {};
    const result = selectInvestigationGuidance(input);
    expect(result.contexts).not.toContain("empty-map");
    expect(result.primary?.mode).not.toBe("Onboarding");
    expect(result.stage).toBe("Getting Started");
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
      mapSession: { source: "New", fresh: true },
    });
    const event = result.matches.find(
      (match) => match.context === "event-selected",
    );
    expect(event?.reason).toBe("The selected Event has no child Factors.");
    expect(result.primary?.entry.id).toBe("new-map");
    expect(result.primary?.mode).toBe("Onboarding");
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
    [{}, "Getting Started"],
    [
      {
        ...core,
        nodes: core.nodes?.map((n) => ({
          ...n,
          factorSignificance: undefined,
        })),
      },
      "Exploring Causes",
    ],
    [core, "Exploring Causes"],
    [
      {
        ...core,
        controls: [{ id: "control" }],
        evidence: [{ id: "evidence" }],
      },
      "Developing Findings",
    ],
    [
      {
        ...core,
        nodes: [...(core.nodes ?? []), node("action", "Action")],
        controls: [{ id: "control" }],
        evidence: [{ id: "evidence" }],
      },
      "Reviewing the Investigation",
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
    expect(checklist.find((item) => item.concept === "Root Cause")?.state).toBe(
      "Identified",
    );
    expect(checklist.find((item) => item.concept === "Controls")?.reason).toBe(
      "None identified; consider relevant safeguards when useful.",
    );
  });

  it("treats Root Cause as optional and never as a stage gate", () => {
    const withoutRootCause: GuidanceInput = {
      ...core,
      nodes: [
        node("impact", "Impact"),
        node("event", "Event"),
        node("factor", "Factor"),
        node("action", "Action"),
      ],
      controls: [{ id: "control" }],
    };
    expect(deriveInvestigationStage(withoutRootCause)).toBe(
      "Reviewing the Investigation",
    );
    expect(
      deriveInvestigationChecklist(withoutRootCause).find(
        (item) => item.concept === "Root Cause",
      ),
    ).toMatchObject({ state: "None identified" });
    expect(
      selectInvestigationGuidance(withoutRootCause).contexts,
    ).not.toContain("missing-root-cause");
    expect(selectInvestigationGuidance(withoutRootCause).primary?.mode).toBe(
      "Review",
    );
  });
});
