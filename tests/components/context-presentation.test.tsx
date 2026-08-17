import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextPresentation } from "../../src/components/Context/ContextPresentation";
import { CaseSummary } from "../../src/components/Presentation/CaseSummary";
import {
  selectCompactContext,
  selectContextGroups,
} from "../../src/state/selectors";

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
  it("normalizes missing effects and partitions without mutating author order", () => {
    const groups = selectContextGroups([
      items[0],
      { ...items[1], effect: "Aggravating" },
      { ...items[2], effect: "Mitigating" },
    ]);
    expect(groups.Neutral.map((item) => item.id)).toEqual(["text"]);
    expect(groups.Aggravating.map((item) => item.id)).toEqual(["chip"]);
    expect(groups.Mitigating.map((item) => item.id)).toEqual(["metric"]);
  });

  it("caps compact Context at one per direction and two overall", () => {
    const selection = selectCompactContext([
      { ...items[0], effect: "Aggravating" },
      { ...items[1], effect: "Aggravating" },
      { ...items[2], effect: "Mitigating" },
      { ...items[3], showOnCard: true },
    ]);
    expect(selection.Aggravating).toHaveLength(1);
    expect(selection.Mitigating).toHaveLength(1);
    expect(selection.Neutral).toHaveLength(0);
    expect(selection.overflow).toBe(2);
  });

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
