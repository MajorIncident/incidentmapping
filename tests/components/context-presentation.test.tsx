import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextPresentation } from "../../src/components/Context/ContextPresentation";
import { CaseSummary } from "../../src/components/Presentation/CaseSummary";

const items = [
  {
    id: "text",
    label: "Note",
    value: "Authored",
    displayMode: "Text" as const,
    showOnCard: true,
  },
  {
    id: "chip",
    label: "State",
    value: "Observed",
    displayMode: "Chip" as const,
    showOnCard: true,
  },
  {
    id: "metric",
    label: "Reading",
    value: "42",
    unit: "ms",
    displayMode: "Metric" as const,
    showOnCard: true,
  },
  { id: "hidden", label: "Hidden", value: "No", displayMode: "Chip" as const },
];

describe("Context presentation", () => {
  it("uses semantic definitions and exposes complete metric text", () => {
    render(<ContextPresentation items={items.slice(0, 3)} />);
    expect(
      screen
        .getAllByRole("term")
        .some((term) => term.textContent === "Reading"),
    ).toBe(true);
    expect(screen.getByLabelText("Reading 42 ms")).toHaveTextContent("42ms");
  });

  it("allows only explicitly pinned Chip and Metric values in Case Summary", () => {
    render(<CaseSummary factors={[]} controls={[]} contextItems={items} />);
    const summary = screen.getByLabelText("Pinned summary context");
    expect(within(summary).queryByText("Authored")).not.toBeInTheDocument();
    expect(within(summary).getByText("Observed")).toBeVisible();
    expect(within(summary).getByText("42")).toBeVisible();
    expect(within(summary).queryByText("No")).not.toBeInTheDocument();
  });
});
