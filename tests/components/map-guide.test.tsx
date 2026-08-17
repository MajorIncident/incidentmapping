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

const match = {
  entry: investigationGuide[0],
  context: "empty-map" as const,
  reason: "The map has no entities.",
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
      screen.getByRole("heading", { name: "Start with Impact" }),
    ).toBeVisible();
    expect(screen.getByText(/Context: empty map/i)).toBeVisible();
    expect(screen.getByText("More detail")).toBeVisible();
    expect(screen.getByText("Why this tip?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add Impact" }));
    expect(onAction).toHaveBeenCalledWith("add-impact");
  });

  it("collapses, expands, restores focus, and acknowledges first use for this session", async () => {
    render(<LearningGuide match={match} enabled onAction={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Learning Guide" }),
    );
    const trigger = screen.getByRole("button", { name: "? Guide" });
    fireEvent.click(trigger);
    expect(sessionStorage.getItem(learningGuideStorageKeys.acknowledged)).toBe(
      "true",
    );
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "? Guide" })).toHaveFocus(),
    );
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
});
