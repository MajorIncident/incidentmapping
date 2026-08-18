import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningGuide } from "../../src/components/LearningGuide/LearningGuide";
import { investigationGuide } from "../../src/content/investigationGuide";
import {
  getDismissedLearningTips,
  getLearningGuideEnabled,
  learningGuideStorageKeys,
  setLearningGuideEnabled,
} from "../../src/features/guidance/preferences";
import { selectInvestigationGuidance } from "../../src/features/guidance/selectors";

const match = {
  entry: investigationGuide[0],
  context: "empty-map" as const,
  reason: "The map has no entities.",
  mode: "Onboarding" as const,
};

describe("Learning Guide", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("defaults On and stores the global preference outside map data", () => {
    expect(getLearningGuideEnabled()).toBe(true);
    setLearningGuideEnabled(false);
    expect(getLearningGuideEnabled()).toBe(false);
    expect(localStorage.getItem(learningGuideStorageKeys.enabled)).toBe(
      "false",
    );
    expect(sessionStorage.getItem(learningGuideStorageKeys.enabled)).toBeNull();
  });

  it("renders semantic content, disclosures, and invokes its suggested action", () => {
    const onAction = vi.fn();
    render(<LearningGuide match={match} enabled onAction={onAction} />);
    expect(
      screen.getByRole("complementary", { name: "Learning Guide" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "STEP 1 · START HERE" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Name the Impact" }),
    ).toBeVisible();
    expect(screen.getByText("What outcome or consequence resulted?"));
    for (const example of ["Injury", "Service interruption", "Financial loss"])
      expect(screen.getByText(example)).toBeVisible();
    expect(
      screen.getByText("Describe the outcome, not the cause."),
    ).toBeVisible();
    expect(screen.queryByText(/Context:|Current signal:/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Add Impact/i })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("collapses, expands, restores focus, and persists first-use introduction", async () => {
    render(<LearningGuide match={match} enabled onAction={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Learning Guide" }),
    );
    const trigger = screen.getByRole("button", { name: "? Guide" });
    fireEvent.click(trigger);
    expect(
      localStorage.getItem(learningGuideStorageKeys.introductionSeen),
    ).toBe("true");
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "? Guide" })).toHaveFocus(),
    );
  });

  it("starts later browser sessions compact but opens Step 1 for a new map", () => {
    localStorage.setItem(learningGuideStorageKeys.introductionSeen, "true");
    const { rerender } = render(
      <LearningGuide match={match} enabled onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "? Guide" })).toBeVisible();
    expect(screen.queryByText(/Welcome to the Learning Guide/)).toBeNull();

    rerender(
      <LearningGuide
        match={match}
        enabled
        mapSession={{ source: "New", fresh: true }}
        onAction={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "STEP 1 · START HERE" }),
    ).toBeVisible();
  });

  it("automatically follows committed titles and exposes both Step 3 choices", () => {
    const impact = {
      id: "impact",
      nodeType: "Impact" as const,
      title: "Injury",
    };
    const step2 = selectInvestigationGuidance({
      nodes: [impact],
      selectedEntity: "impact",
      mapSession: { source: "New", fresh: false },
    });
    expect(step2.primary?.entry.title).toBe("STEP 2 · WHAT HAPPENED?");
    expect(step2.primary?.entry.suggestedActions[0].label).toBe("+ Add Event");

    const draft = {
      id: "event",
      nodeType: "Event" as const,
      title: "New Event",
    };
    const whileEditing = selectInvestigationGuidance({
      nodes: [impact, draft],
      selectedEntity: "event",
    });
    expect(whileEditing.primary?.entry.title).toBe("STEP 2 · WHAT HAPPENED?");

    const committed = selectInvestigationGuidance({
      nodes: [impact, { ...draft, title: "Alarm activated" }],
      selectedEntity: "event",
    });
    expect(committed.primary?.entry.title).toBe("STEP 3 · ASK WHY");
    expect(
      committed.primary?.entry.suggestedActions.map(({ label }) => label),
    ).toEqual(["+ Event", "+ Factor"]);
  });

  it("dismisses an individual tip only in session storage", () => {
    render(<LearningGuide match={match} enabled onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss this tip/i }));
    expect(getDismissedLearningTips()).toContain("new-map");
    expect(localStorage.getItem(learningGuideStorageKeys.dismissed)).toBeNull();
  });

  it("renders nothing when globally Off", () => {
    render(<LearningGuide match={match} enabled={false} onAction={vi.fn()} />);
    expect(screen.queryByLabelText("Learning Guide")).not.toBeInTheDocument();
  });

  it("falls back safely when browser storage is unavailable", () => {
    const local = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Storage disabled", "SecurityError");
      });
    const session = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage disabled", "SecurityError");
      });

    expect(getLearningGuideEnabled()).toBe(true);
    expect(() => setLearningGuideEnabled(false)).not.toThrow();
    render(<LearningGuide match={match} enabled onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss this tip/i }));
    expect(
      screen.getByRole("complementary", { name: "Learning Guide" }),
    ).toBeVisible();

    local.mockRestore();
    session.mockRestore();
  });

  it("keeps review guidance behind onboarding and selected-object coaching", () => {
    const onboarding = selectInvestigationGuidance({
      presentation: true,
      mapSession: { source: "New", fresh: true },
    });
    expect(onboarding.primary?.mode).toBe("Onboarding");

    const selection = selectInvestigationGuidance({
      nodes: [{ id: "impact", nodeType: "Impact" }],
      selectedEntity: "impact",
      presentation: true,
    });
    expect(selection.primary?.mode).toBe("Selection");
    expect(
      selection.matches.find((item) => item.mode === "Review"),
    ).toBeDefined();
  });
});
