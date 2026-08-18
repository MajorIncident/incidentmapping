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
    expect(screen.getByText("Dispatch verification · Failed")).toBeVisible();
    const controlDiagram = screen.getByRole("figure", {
      name: /Top-down transition: Event.*Control.*Factor/,
    });
    expect(
      within(controlDiagram)
        .getAllByText(/Event|Control|Factor/)
        .map((node) => node.textContent),
    ).toEqual(["Event", "Control", "Factor"]);
    expect(
      screen.getByText(/position explains where the safeguard/),
    ).toBeVisible();
  });

  it("navigates all pages and reports its position", async () => {
    render(<LearnMapDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", {
      name: "Start with the Impact",
    });
    expect(within(dialog).getByText("Page 1 of 9")).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next →" }),
    );
    expect(
      screen.getByRole("heading", { name: "Events describe what happened" }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Where does this information belong?",
      }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Where does this information belong?",
      }),
    ).toBeVisible();
    expect(within(dialog).getByText("8 / 9")).toBeVisible();
    expect(
      screen.getByText(/What occurred\? Vehicle departed late/),
    ).toBeVisible();
    expect(
      screen.getByText(/What information supports this\? The dispatch record/),
    ).toBeVisible();
    expect(
      screen.getByRole("figure", { name: /Eight classification decisions/ }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Present the story, not the canvas",
      }),
    );
    expect(within(dialog).getByText("9 / 9")).toBeVisible();
  });

  it("uses one delivery scenario throughout the teaching examples", () => {
    const copy = JSON.stringify(learnMapPages);
    [
      "Delivery arrived late",
      "Vehicle departed late",
      "Handover was incomplete",
      "Dispatch verification",
      "severe weather",
      "backup vehicle",
      "Dispatch record",
      "Revise the handover process",
    ].forEach((example) => expect(copy).toContain(example));
    expect(copy).not.toMatch(/configuration|deployment|requests|checkout/i);
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
