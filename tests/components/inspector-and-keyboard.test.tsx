import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "reactflow";
import {
  Inspector,
  localControlToPersistedTimestamp,
  persistedTimestampToLocalControl,
} from "../../src/components/Sidebar/Inspector";
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

    const timestampInput = screen.getByLabelText(/^(Occurred at|Started)$/i);
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

  it("uses canonical Context editing for non-Action nodes", async () => {
    const nodeId = await renderSelectedNode();
    expect(screen.getByRole("region", { name: "Context" })).toBeVisible();

    act(() => useAppStore.getState().actions.setNodeType(nodeId, "Factor"));
    expect(screen.getByRole("region", { name: "Context" })).toBeVisible();

    let actionId = "";
    act(() => {
      actionId = useAppStore.getState().actions.addAction(nodeId) ?? "";
      useAppStore.getState().actions.select(actionId);
    });
    expect(
      screen.queryByRole("region", { name: "Context" }),
    ).not.toBeInTheDocument();
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
