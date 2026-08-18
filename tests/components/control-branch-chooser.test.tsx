import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ControlBranchChooser } from "../../src/components/Sidebar/ControlBranchChooser";

describe("ControlBranchChooser", () => {
  it("asks an accessible question and returns the chosen relationship", () => {
    const onChoose = vi.fn();
    const relationships = [
      {
        edgeId: "edge-a",
        upstreamNodeId: "event",
        downstreamNodeId: "factor-a",
        label: "N-002 → N-004",
      },
      {
        edgeId: "edge-b",
        upstreamNodeId: "event",
        downstreamNodeId: "factor-b",
        label: "N-002 → N-006",
      },
    ];
    render(
      <ControlBranchChooser
        relationships={relationships}
        onChoose={onChoose}
      />,
    );
    expect(
      screen.getByText("Where was the Control intended to act?"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "N-002 → N-004" }));
    expect(onChoose).toHaveBeenCalledWith(relationships[0]);
  });
});
