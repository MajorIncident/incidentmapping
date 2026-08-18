import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ContextEditor } from "../../src/components/Context/ContextEditor";
import { useAppStore } from "../../src/state/useAppStore";

const IncidentEditor = () => {
  const items = useAppStore((state) => state.metadata?.contextItems ?? []);
  return <ContextEditor target="incident" items={items} />;
};

describe("ContextEditor", () => {
  beforeEach(() => useAppStore.getState().actions.newMap());

  it("exposes Context teaching state only while its editor is active", () => {
    render(<IncidentEditor />);
    const input = screen.getByLabelText("New label");
    fireEvent.focus(input);
    expect(useAppStore.getState().contextEditing).toBe(true);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(useAppStore.getState().contextEditing).toBe(false);
  });

  it("prevents blank records and adds complete incident Context with Enter", async () => {
    const user = userEvent.setup();
    render(<IncidentEditor />);

    await user.click(screen.getByRole("button", { name: "Add context" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter both a label and a value.",
    );
    expect(useAppStore.getState().metadata?.contextItems).toHaveLength(0);

    await user.type(screen.getByLabelText("New label"), "Weather");
    await user.type(screen.getByLabelText("New value"), "Heavy rain{Enter}");
    expect(useAppStore.getState().metadata?.contextItems).toEqual([
      expect.objectContaining({ label: "Weather", value: "Heavy rain" }),
    ]);
  });

  it("supports keyboard editing, pinning, deletion, and mobile-safe stacked rows", async () => {
    const user = userEvent.setup();
    useAppStore.getState().actions.addContext("incident", "Shift", "Night");
    render(<IncidentEditor />);

    const row = screen.getByTestId("context-row");
    expect(row).toHaveClass("flex-col");
    expect(row).not.toHaveClass("overflow-x-auto");
    const toggle = screen.getByRole("button", {
      name: "Show Shift on compact card",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Hide Shift on compact card");

    await user.click(screen.getByRole("button", { name: /delete context/i }));
    expect(useAppStore.getState().metadata?.contextItems).toHaveLength(0);
  });

  it("lets investigators choose Metric and optionally author a unit", async () => {
    const user = userEvent.setup();
    render(<IncidentEditor />);
    await user.type(screen.getByLabelText("New label"), "Reading");
    await user.selectOptions(screen.getByLabelText("Display mode"), "Metric");
    await user.type(screen.getByLabelText("Unit (optional)"), "ms");
    await user.type(screen.getByLabelText("New value"), "42");
    await user.click(screen.getByRole("button", { name: "Add context" }));
    expect(useAppStore.getState().metadata?.contextItems).toEqual([
      expect.objectContaining({ displayMode: "Metric", unit: "ms" }),
    ]);
    expect(screen.getByTestId("context-row").firstChild).not.toHaveClass(
      "sm:grid-cols-2",
    );
  });
});
