import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "reactflow";
import { Inspector } from "../../src/components/Sidebar/Inspector";
import { App } from "../../src/app/App";
import { useAppStore } from "../../src/state/useAppStore";
import { emptyMap, sampleMap } from "../../src/features/maps/fixtures";

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver;
}

describe("Inspector and keyboard workflows", () => {
  const renderSelectedNode = async () => {
    const { actions } = useAppStore.getState();
    let id: string | null = null;
    act(() => {
      id = actions.addChild();
      actions.select(id);
    });
    await act(async () => {
      render(
        <ReactFlowProvider>
          <Inspector />
        </ReactFlowProvider>,
      );
    });
    await screen.findByRole("textbox", { name: /^Title$/i });
    expect(id).toBeTruthy();
    return id ?? "";
  };

  const consequenceSection = (label: "Positive" | "Negative") =>
    screen.getByText(label).parentElement?.parentElement as HTMLElement;

  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    vi.stubGlobal("alert", vi.fn());
  });

  beforeEach(() => {
    const { actions } = useAppStore.getState();
    act(() => {
      actions.loadMap(emptyMap);
    });
  });

  it("shows inspector fields for the selected node and updates metadata", async () => {
    const { actions } = useAppStore.getState();
    let id: string | null = null;
    act(() => {
      id = actions.addChild();
    });
    expect(id).toBeTruthy();
    act(() => {
      actions.select(id ?? null);
    });

    await act(async () => {
      render(
        <ReactFlowProvider>
          <Inspector />
        </ReactFlowProvider>,
      );
    });

    const titleInput = await screen.findByRole("textbox", { name: /^Title$/i });
    expect(titleInput).toHaveValue("New Event");

    const ownerInput = screen.getByRole("textbox", { name: /^Owner$/i });
    await act(async () => {
      await userEvent.clear(ownerInput);
      await userEvent.type(ownerInput, "Incident Manager");
    });
    expect(useAppStore.getState().nodes[0]?.data.owner).toBe(
      "Incident Manager",
    );

    const timestampInput = screen.getByRole("textbox", {
      name: /^Timestamp$/i,
    });
    await act(async () => {
      await userEvent.clear(timestampInput);
      await userEvent.type(timestampInput, "2024-06-01T12:00:00Z");
    });
    expect(useAppStore.getState().nodes[0]?.data.timestamp).toBe(
      "2024-06-01T12:00:00Z",
    );
  });

  it("adds a child via Enter and starts inline editing", async () => {
    const { actions } = useAppStore.getState();
    let rootId: string | null = null;
    act(() => {
      rootId = actions.addChild();
    });
    expect(rootId).toBeTruthy();
    act(() => {
      actions.finishEditing();
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByRole("button", { name: "Add Event" });
    await waitFor(() => {
      expect(useAppStore.getState().nodes).toHaveLength(1);
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    await waitFor(() => {
      expect(useAppStore.getState().nodes).toHaveLength(2);
    });

    const nodes = await screen.findAllByTestId("chain-node");
    expect(nodes).toHaveLength(2);

    const newNodeId = useAppStore.getState().nodes[1]?.id;
    expect(useAppStore.getState().editingId).toBe(newNodeId);

    await waitFor(() => {
      const editor = document.querySelector<HTMLInputElement>(
        'input[aria-label="Node title"]',
      );
      expect(editor).not.toBeNull();
      expect(editor).toBe(document.activeElement);
    });
  });

  it("focuses a new barrier description, updates its card live, and undoes it as one edit", async () => {
    const mapWithoutBarrier = { ...sampleMap, barriers: [] };
    act(() => {
      useAppStore.getState().actions.loadMap(mapWithoutBarrier);
    });
    render(<App />);

    act(() => {
      useAppStore.getState().actions.addBarrier("root", "child");
    });

    const description = await screen.findByRole("textbox", {
      name: /^Control Purpose$/i,
    });
    await waitFor(() => expect(description).toHaveFocus());
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue(
      "Failed",
    );

    const user = userEvent.setup();
    await user.type(description, "Firewall active");
    expect(screen.getByTestId("barrier-node")).toHaveTextContent(
      "Firewall active",
    );

    act(() => {
      useAppStore.getState().actions.undo();
    });
    expect(screen.getByTestId("barrier-node")).toHaveTextContent(
      "No control purpose provided.",
    );
  });

  it("lists every downstream branch and creates a barrier on a chosen non-first child", async () => {
    act(() => {
      useAppStore.getState().actions.loadMap({
        schemaVersion: 1,
        nodes: [
          {
            id: "parent",
            kind: "ChainNode",
            title: "Parent",
            position: { x: 0, y: 0 },
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
          },
          {
            id: "child-one",
            kind: "ChainNode",
            title: "Duplicate",
            position: { x: -200, y: 200 },
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
          },
          {
            id: "child-two",
            kind: "ChainNode",
            title: "Duplicate",
            position: { x: 200, y: 200 },
            positiveConsequenceBulletPoints: [],
            negativeConsequenceBulletPoints: [],
          },
        ],
        edges: [
          {
            id: "edge-one",
            kind: "CauseEffectEdge",
            fromId: "parent",
            toId: "child-one",
          },
          {
            id: "edge-two",
            kind: "CauseEffectEdge",
            fromId: "parent",
            toId: "child-two",
          },
        ],
        barriers: [
          {
            id: "existing",
            kind: "Barrier",
            upstreamNodeId: "parent",
            downstreamNodeId: "child-one",
            breached: false,
            breachedItems: [],
          },
        ],
      });
      useAppStore.getState().actions.select("parent");
    });
    render(
      <ReactFlowProvider>
        <Inspector />
      </ReactFlowProvider>,
    );

    expect(screen.getByText("Add barrier to branch")).toBeVisible();
    expect(screen.getByText(/Branch 1 of 2.*ld-one/)).toBeVisible();
    expect(screen.getByText(/Branch 2 of 2.*ld-two/)).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Barrier exists: Parent → Duplicate",
      }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Add barrier: Parent → Duplicate" }),
    );
    expect(useAppStore.getState().barriers[1]).toMatchObject({
      downstreamNodeId: "child-two",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Barrier between Parent and Duplicate",
      }),
    ).toBeVisible();
  });

  it.each([
    ["Positive", "Add a positive consequence"],
    ["Negative", "Add a negative consequence"],
  ] as const)(
    "adds and focuses successive %s consequences with Enter",
    async (label, placeholder) => {
      await renderSelectedNode();
      const user = userEvent.setup();
      await user.click(
        within(consequenceSection(label)).getByRole("button", { name: "Add" }),
      );
      const first = screen.getByPlaceholderText(placeholder);
      expect(first).toHaveFocus();

      await user.type(first, "First value{Enter}");
      const inputs = screen.getAllByPlaceholderText(placeholder);
      expect(inputs).toHaveLength(2);
      expect(inputs[1]).toHaveFocus();
      await user.type(inputs[1], "Second value");
      expect(inputs[1]).toHaveValue("Second value");
    },
  );

  it("keeps focus on the first invalid consequence when Enter validation fails", async () => {
    await renderSelectedNode();
    const user = userEvent.setup();
    await user.click(
      within(consequenceSection("Positive")).getByRole("button", {
        name: "Add",
      }),
    );
    const input = screen.getByPlaceholderText("Add a positive consequence");
    await user.keyboard("{Enter}");

    expect(
      screen.getAllByPlaceholderText("Add a positive consequence"),
    ).toHaveLength(1);
    expect(input).toHaveFocus();
    expect(screen.getByText("This field is required.")).toBeVisible();
  });

  it("adds evidence with Enter, preserves its label, and removes blank edits", async () => {
    const nodeId = await renderSelectedNode();
    const user = userEvent.setup();
    const evidenceHeading = screen.getByRole("heading", { name: "Evidence" });
    const section = evidenceHeading.parentElement?.parentElement as HTMLElement;
    await user.click(within(section).getByRole("button", { name: "Add" }));

    const first = screen.getByPlaceholderText("Add supporting evidence");
    expect(first).toHaveFocus();
    await user.type(first, "  Witness account  {Enter}");

    const inputs = screen.getAllByPlaceholderText("Add supporting evidence");
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toHaveFocus();
    expect(useAppStore.getState().nodes[0].data.evidenceItems).toEqual([
      { id: "EV-001", text: "Witness account" },
    ]);
    expect(screen.getByText("EV-001")).toBeVisible();

    await user.clear(inputs[0]);
    await user.tab();
    expect(
      useAppStore.getState().nodes.find((candidate) => candidate.id === nodeId)
        ?.data.evidenceItems,
    ).toEqual([]);
  });

  it("focuses Add after removing the only empty item and the previous input otherwise", async () => {
    await renderSelectedNode();
    const user = userEvent.setup();
    const section = consequenceSection("Negative");
    const addButton = within(section).getByRole("button", { name: "Add" });
    await user.click(addButton);
    await user.keyboard("{Backspace}");
    expect(addButton).toHaveFocus();

    await user.click(addButton);
    await user.type(
      screen.getByPlaceholderText("Add a negative consequence"),
      "Kept{Enter}",
    );
    const inputs = screen.getAllByPlaceholderText("Add a negative consequence");
    await user.keyboard("{Backspace}");
    expect(inputs[0]).toHaveFocus();
  });

  it("clears pending list focus when the selected node changes", async () => {
    await renderSelectedNode();
    const { actions } = useAppStore.getState();
    const addButton = within(consequenceSection("Positive")).getByRole(
      "button",
      { name: "Add" },
    );
    fireEvent.click(addButton);
    act(() => {
      const nextId = actions.addChild();
      actions.select(nextId);
    });

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Add a positive consequence"),
      ).not.toBeInTheDocument();
    });
    expect(document.activeElement).not.toHaveAttribute(
      "placeholder",
      "Add a positive consequence",
    );
  });

  it("shows failure fields only for non-effective statuses and preserves their values", async () => {
    act(() => useAppStore.getState().actions.loadMap(sampleMap));
    act(() => useAppStore.getState().actions.select("barrier-root-child"));
    render(
      <ReactFlowProvider>
        <Inspector />
      </ReactFlowProvider>,
    );

    expect(screen.queryByLabelText("Why Did It Fail?")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Degraded");
    await userEvent.selectOptions(
      screen.getByLabelText("Why Did It Fail?"),
      "InadequateDesign",
    );
    await userEvent.type(
      screen.getByLabelText("Failure Details"),
      "Coverage gap",
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Effective");
    expect(screen.queryByLabelText("Failure Details")).not.toBeInTheDocument();
    expect(useAppStore.getState().barriers[0]).toMatchObject({
      status: "Effective",
      failureReason: "InadequateDesign",
      failureDetails: "Coverage gap",
    });
  });
});
