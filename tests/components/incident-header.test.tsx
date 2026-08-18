import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IncidentHeader } from "../../src/components/IncidentHeader/IncidentHeader";

const { state } = vi.hoisted(() => ({
  state: {
    metadata: {},
    actions: {
      setMapTitle: vi.fn(),
      updateMetadata: vi.fn(),
    },
  },
}));

vi.mock("../../src/state/useAppStore", () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

describe("IncidentHeader", () => {
  it("makes every pinned context detail available to the summary bar", () => {
    const contextItems = Array.from({ length: 6 }, (_, index) => ({
      id: `context-${index}`,
      label: `Detail ${index + 1}`,
      value: `Value ${index + 1}`,
      displayMode: "Chip" as const,
      showOnCard: true,
    }));
    state.metadata = { contextItems };

    render(<IncidentHeader readOnly />);

    const summary = screen.getByLabelText("Pinned incident context");
    contextItems.forEach((item) => {
      expect(within(summary).getByText(item.value)).toBeInTheDocument();
    });
  });
});
