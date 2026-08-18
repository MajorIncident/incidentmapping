import { describe, expect, it } from "vitest";
import {
  GUIDE_ACTION_IDS,
  GUIDE_CONTEXTS,
  investigationGuide,
} from "../../src/content/investigationGuide";
import { INVESTIGATION_CONCEPT_IDS } from "../../src/content/investigationModel";

describe("investigation guide content", () => {
  it("uses unique, non-empty IDs", () => {
    const ids = investigationGuide.map(({ id }) => id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only refers to registered contexts, concepts, and actions", () => {
    const contexts = new Set<string>(GUIDE_CONTEXTS);
    const concepts = new Set<string>(INVESTIGATION_CONCEPT_IDS);
    const actions = new Set<string>(GUIDE_ACTION_IDS);

    for (const entry of investigationGuide) {
      expect(entry.contexts.length).toBeGreaterThan(0);
      expect(entry.contexts.every((context) => contexts.has(context))).toBe(
        true,
      );
      expect(entry.relatedConcepts.every((id) => concepts.has(id))).toBe(true);
      expect(entry.suggestedActions.every(({ id }) => actions.has(id))).toBe(
        true,
      );
      for (const block of [...entry.content, ...(entry.detail ?? [])]) {
        if (block.type === "suggested-action") {
          expect(actions.has(block.actionId)).toBe(true);
        }
      }
    }
  });

  it("provides accessibility text for non-text content", () => {
    for (const entry of investigationGuide) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.whyThisTip.trim()).not.toBe("");
      for (const block of [...entry.content, ...(entry.detail ?? [])]) {
        if (block.type === "mini-diagram")
          expect(block.alt.trim()).not.toBe("");
        if (block.type === "keyboard-hint") {
          expect(block.keys.length).toBeGreaterThan(0);
          expect(block.text.trim()).not.toBe("");
        }
      }
    }
  });

  it("has deterministic priorities in a restrained range", () => {
    for (const { priority } of investigationGuide) {
      expect(Number.isInteger(priority)).toBe(true);
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(100);
    }

    const ranked = investigationGuide
      .map((entry, order) => ({ entry, order }))
      .sort((a, b) => b.entry.priority - a.entry.priority || a.order - b.order);
    expect(ranked[0].entry.id).toBe("new-map");
  });

  it("keeps Step 1 focused exclusively on naming the outcome", () => {
    const entry = investigationGuide.find(({ id }) => id === "new-map");
    expect(entry?.title).toBe("STEP 1 · START HERE");
    expect(entry?.content).toEqual([
      { type: "heading", level: 3, text: "Name the Impact" },
      { type: "question", text: "What outcome or consequence resulted?" },
      { type: "example", label: "Example", text: "Injury" },
      { type: "example", label: "Example", text: "Service interruption" },
      { type: "example", label: "Example", text: "Financial loss" },
      { type: "rule", text: "Describe the outcome, not the cause." },
    ]);
    expect(entry?.suggestedActions).toEqual([]);
    expect(JSON.stringify(entry)).not.toMatch(
      /Evidence|Factors|Controls|Root Cause|missing|completeness/,
    );
  });

  it("offers both semantic choices with an accessible distinction in Step 3", () => {
    const entry = investigationGuide.find(({ id }) => id === "selected-event");
    expect(entry?.title).toBe("STEP 3 · ASK WHY");
    expect(entry?.suggestedActions.map(({ label }) => label)).toEqual([
      "+ Event",
      "+ Factor",
    ]);
    expect(entry?.content).toContainEqual(
      expect.objectContaining({
        type: "mini-diagram",
        alt: "Choose Event when something happened. Choose Factor when a condition existed.",
      }),
    );
  });

  it("continues selected-Factor inquiry without claiming another is required", () => {
    const entry = investigationGuide.find(({ id }) => id === "selected-factor");
    expect(entry?.title).toBe("ASK WHY");
    expect(entry?.suggestedActions.map(({ label }) => label)).toEqual([
      "+ Factor",
    ]);
    expect(JSON.stringify(entry)).not.toMatch(/required/i);
  });
});
