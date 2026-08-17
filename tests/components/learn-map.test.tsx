import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LearnMapDialog } from "../../src/components/LearningGuide/LearnMapDialog";
import { HowToReadMap } from "../../src/components/LearningGuide/HowToReadMap";
import { learnMapPages } from "../../src/content/learnMap";

describe("Learn the Map", () => {
  it("renders the reusable view from shared content", () => {
    render(<HowToReadMap page={learnMapPages[3]} />);
    expect(
      screen.getByRole("heading", { name: "Controls belong on transitions" }),
    ).toBeVisible();
    expect(screen.getByText("Configuration validation · Failed")).toBeVisible();
    expect(
      screen.getByText(/position explains where the safeguard/),
    ).toBeVisible();
  });

  it("navigates all pages and reports its position", async () => {
    render(<LearnMapDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", {
      name: "Start with the Impact",
    });
    expect(within(dialog).getByText("Page 1 of 8")).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next →" }),
    );
    expect(
      screen.getByRole("heading", { name: "Events describe what happened" }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Presenting" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Present the story, not the canvas",
      }),
    ).toBeVisible();
    expect(within(dialog).getByText("8 / 8")).toBeVisible();
  });

  it("contains focus, closes with Escape, and restores the opener", async () => {
    const close = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<LearnMapDialog onClose={close} />);
    const dialog = screen.getByRole("dialog");
    const first = within(dialog).getByRole("button", {
      name: "Close Learn the Map",
    });
    const last = within(dialog).getByRole("button", { name: "Next →" });
    expect(first).toHaveFocus();
    last.focus();
    await userEvent.keyboard("{Tab}");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
