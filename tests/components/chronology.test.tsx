import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import { Chronology } from "../../src/components/Presentation/Chronology";
import type { ChainNodeData } from "../../src/state/useAppStore";

const nodes: Node<ChainNodeData>[] = [
  {
    id: "event",
    type: "ChainNode",
    position: { x: 0, y: 0 },
    data: {
      nodeType: "Event",
      referenceId: "E-1",
      title: "Alarm sounded",
      timestamp: "2024-01-02T12:30:00Z",
      eventPhase: "Detection",
    },
  },
  {
    id: "untimed",
    type: "ChainNode",
    position: { x: 0, y: 0 },
    data: {
      nodeType: "Event",
      referenceId: "E-2",
      title: "Investigation began",
    },
  },
];

describe("Chronology", () => {
  it("renders a wide side panel and selects an entry without closing it", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <Chronology
        nodes={nodes}
        selectedId="event"
        mobile={false}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Detection" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Untimed Events" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Alarm sounded/ }),
    ).toHaveAttribute("aria-current", "true");
    await userEvent.click(
      screen.getByRole("button", { name: /Investigation began/ }),
    );
    expect(onSelect).toHaveBeenCalledWith("untimed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a labelled modal sheet on mobile, traps focus, and closes with Escape", async () => {
    const onClose = vi.fn();
    render(
      <Chronology
        nodes={nodes}
        selectedId={null}
        mobile
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Chronology" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Close chronology" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
