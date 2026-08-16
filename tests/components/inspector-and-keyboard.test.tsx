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
import {
  Inspector,
  localControlToPersistedTimestamp,
  persistedTimestampToLocalControl,
} from "../../src/components/Sidebar/Inspector";
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

  it("edits Event Phase with the exact persisted enum value", async () => {
    const user = userEvent.setup();
    const id = await renderSelectedNode();
    const phase = screen.getByRole("combobox", { name: "Event Phase" });

    await user.selectOptions(phase, "Response");

    expect(
      useAppStore.getState().nodes.find((node) => node.id === id)?.data
        .eventPhase,
    ).toBe("Response");
    expect(screen.queryByRole("combobox", { name: "Action Type" })).toBeNull();
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

    const timestampInput = screen.getByLabelText(/^Occurred at$/i);
    expect(timestampInput).toHaveAttribute("type", "datetime-local");
    await act(async () => {
      await userEvent.clear(timestampInput);
      await userEvent.type(timestampInput, "2024-06-01T12:00");
    });
    expect(useAppStore.getState().nodes[0]?.data.timestamp).toBe(
      new Date(2024, 5, 1, 12, 0).toISOString(),
    );
  });

  it("converts timestamps without slicing timezone-dependent strings", () => {
    const persisted = new Date(2024, 5, 1, 12, 30, 45).toISOString();
    expect(persistedTimestampToLocalControl(persisted)).toBe(
      "2024-06-01T12:30:45",
    );
    expect(localControlToPersistedTimestamp("2024-06-01T12:30:45")).toBe(
      persisted,
    );
    expect(localControlToPersistedTimestamp("")).toBeUndefined();
    expect(
      localControlToPersistedTimestamp("2024-02-31T12:30"),
    ).toBeUndefined();
    expect(persistedTimestampToLocalControl("not-a-date")).toBe("");
  });

  it("shows consequence editing only for Impact and Event nodes", async () => {
    const nodeId = await renderSelectedNode();
    const consequences = () =>
      screen.queryByRole("heading", { name: "Consequences" });

    expect(consequences()).toBeVisible();
    act(() => {
      useAppStore.getState().actions.updateNodeData(nodeId, {
        positiveConsequenceBulletPoints: ["Persisted outcome"],
      });
      useAppStore.getState().actions.setNodeType(nodeId, "Impact");
    });
    expect(consequences()).toBeVisible();

    act(() => useAppStore.getState().actions.setNodeType(nodeId, "Factor"));
    expect(consequences()).not.toBeInTheDocument();
    expect(
      useAppStore.getState().nodes.find((node) => node.id === nodeId)?.data
        .positiveConsequenceBulletPoints,
    ).toEqual(["Persisted outcome"]);

    let actionId = "";
    act(() => {
      actionId = useAppStore.getState().actions.addAction(nodeId) ?? "";
      useAppStore.getState().actions.select(actionId);
    });
    expect(consequences()).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().actions.loadMap(sampleMap);
      useAppStore.getState().actions.select("barrier-root-child");
    });
    expect(consequences()).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().actions.loadMap(emptyMap);
      const eventId = useAppStore.getState().actions.addChild() ?? "";
      useAppStore.getState().actions.select(eventId);
    });
    expect(consequences()).toBeVisible();
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

    await screen.findByRole("button", { name: "Add Below" });
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

  it("keeps Enter and Shift+Enter in parity with causal Add Below availability", () => {
    render(<App />);
    let nodeId = "";
    act(() => {
      nodeId = useAppStore.getState().actions.addChild() ?? "";
      useAppStore.getState().actions.finishEditing();
    });

    for (const nodeType of ["Impact", "Event", "Factor"] as const) {
      act(() => {
        const actions = useAppStore.getState().actions;
        actions.select(nodeId);
        actions.setNodeType(nodeId, nodeType);
      });
      const before = useAppStore.getState().nodes.length;
      expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(false);
      expect(useAppStore.getState().nodes).toHaveLength(before + 1);
    }

    act(() => {
      const actions = useAppStore.getState().actions;
      actions.select(nodeId);
      nodeId = actions.addAction(nodeId) ?? "";
      actions.finishEditing();
    });
    let before = useAppStore.getState().nodes.length;
    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(window, { key: "Enter", shiftKey: true })).toBe(
      true,
    );
    expect(useAppStore.getState().nodes).toHaveLength(before);

    act(() => {
      useAppStore.getState().actions.loadMap(sampleMap);
      useAppStore.getState().actions.select("barrier-root-child");
    });
    before = useAppStore.getState().nodes.length;
    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(window, { key: "Enter", shiftKey: true })).toBe(
      true,
    );
    expect(useAppStore.getState().nodes).toHaveLength(before);

    act(() => useAppStore.getState().actions.select(null));
    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
    expect(useAppStore.getState().nodes).toHaveLength(before);
  });

  it("focuses a new Control purpose, updates its card live, and undoes it as one edit", async () => {
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
    expect(screen.getByTestId("control-node")).toHaveTextContent(
      "Firewall active",
    );

    act(() => {
      useAppStore.getState().actions.undo();
    });
    expect(screen.getByTestId("control-node")).toHaveTextContent(
      "No control purpose provided.",
    );
  });

  it("lists every downstream branch and creates a Control on a chosen non-first child", async () => {
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

    expect(screen.getByText("Add Control to branch")).toBeVisible();
    expect(screen.getByText(/Branch 1 of 2.*ld-one/)).toBeVisible();
    expect(screen.getByText(/Branch 2 of 2.*ld-two/)).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Control exists: Parent → Duplicate",
      }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Add Control: Parent → Duplicate" }),
    );
    expect(useAppStore.getState().barriers[1]).toMatchObject({
      downstreamNodeId: "child-two",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Control between Parent and Duplicate",
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

  it("creates typed evidence atomically and unlinks without deleting it", async () => {
    const nodeId = await renderSelectedNode();
    const user = userEvent.setup();
    const evidenceHeading = screen.getByRole("heading", { name: "Evidence" });
    const section = evidenceHeading.parentElement?.parentElement as HTMLElement;
    await user.click(
      within(section).getByRole("button", { name: "Add Evidence" }),
    );
    await user.selectOptions(
      within(section).getByLabelText("Type"),
      "SystemLog",
    );
    await user.type(within(section).getByLabelText("Title"), "Witness account");
    await user.type(within(section).getByLabelText("Source"), "Dispatch");
    await user.click(
      screen.getAllByRole("button", { name: "Add Evidence" })[1],
    );

    expect(useAppStore.getState().evidence[0]).toMatchObject({
      id: "EV-001",
      type: "SystemLog",
      title: "Witness account",
    });
    expect(
      screen.getByText(/EV-001 · System Log · Witness account/),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(
      useAppStore.getState().nodes.find((candidate) => candidate.id === nodeId)
        ?.data.evidenceIds,
    ).toEqual([]);
    expect(useAppStore.getState().evidence).toHaveLength(1);
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
