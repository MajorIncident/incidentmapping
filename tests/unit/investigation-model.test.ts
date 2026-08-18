import { describe, expect, it } from "vitest";
import {
  INVESTIGATION_CONCEPT_IDS,
  createInvestigationConceptCollection,
  getInvestigationConcept,
  investigationConcepts,
  investigationDecisionGuide,
} from "../../src/content/investigationModel";

describe("investigation model content", () => {
  it("is complete and retains its stable order", () => {
    expect(investigationConcepts.map(({ id }) => id)).toEqual(
      INVESTIGATION_CONCEPT_IDS,
    );
    expect(Object.values(investigationDecisionGuide)).toEqual([
      "impact",
      "event",
      "factor",
      "aggravating-context",
      "mitigating-context",
      "context",
      "control",
      "evidence",
      "action",
    ]);
  });

  it("has unique IDs, valid relationships, and all required educational fields", () => {
    const ids = new Set(investigationConcepts.map(({ id }) => id));
    expect(ids.size).toBe(investigationConcepts.length);
    for (const concept of investigationConcepts) {
      expect(concept.name).not.toHaveLength(0);
      expect(concept.shortDefinition).not.toHaveLength(0);
      expect(concept.definition).not.toHaveLength(0);
      expect(concept.investigativeQuestion).not.toHaveLength(0);
      expect(concept.examples.length).toBeGreaterThan(0);
      expect(concept.visualRole).not.toHaveLength(0);
      expect(concept.relatedConceptIds.length).toBeGreaterThan(0);
      concept.relatedConceptIds.forEach((relatedId) =>
        expect(ids.has(relatedId)).toBe(true),
      );
    }
  });

  it("provides the eight post-Impact classification decisions and questions", () => {
    const decisionIds = Object.values(investigationDecisionGuide).filter(
      (id) => id !== "impact",
    );
    expect(decisionIds).toEqual([
      "event",
      "factor",
      "aggravating-context",
      "mitigating-context",
      "context",
      "control",
      "evidence",
      "action",
    ]);
    decisionIds.forEach((id) =>
      expect(getInvestigationConcept(id).investigativeQuestion).toMatch(/\?$/),
    );
  });

  it("fails clearly for duplicate and unknown IDs", () => {
    expect(() =>
      createInvestigationConceptCollection([{ id: "same" }, { id: "same" }]),
    ).toThrow('Duplicate investigation concept ID: "same"');
    expect(() => getInvestigationConcept("missing")).toThrow(
      'Unknown investigation concept ID: "missing"',
    );
  });
});
