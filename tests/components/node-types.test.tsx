import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NodeProps } from "reactflow";
import { ReactFlowProvider } from "reactflow";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeTypes } from "../../src/components/Canvas/NodeTypes";
import {
  useAppStore,
  type BarrierNodeData,
  type ChainNodeData,
} from "../../src/state/useAppStore";

const defaultData: ChainNodeData = {
  title: "Incident",
  description: "",
  positiveConsequenceBulletPoints: [],
  negativeConsequenceBulletPoints: [],
};

const renderBarrierNode = (data: Partial<BarrierNodeData> = {}) => {
  const BarrierNode = nodeTypes.Barrier;
  return render(
    <ReactFlowProvider>
      <BarrierNode
        {...({
          id: "control-1",
          data: {
            kind: "Barrier",
            upstreamNodeId: "a",
            downstreamNodeId: "b",
            status: "Effective",
            ...data,
          },
          selected: false,
        } as NodeProps<BarrierNodeData>)}
      />
    </ReactFlowProvider>,
  );
};

const renderChainNode = (
  data: Partial<ChainNodeData> = {},
  selected = false,
) => {
  const ChainNode = nodeTypes.ChainNode;
  const props = {
    id: "node-1",
    data: { ...defaultData, ...data },
    selected,
    type: "ChainNode",
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    dragging: false,
  } as NodeProps<ChainNodeData>;

  return render(
    <ReactFlowProvider>
      <ChainNode {...props} />
    </ReactFlowProvider>,
  );
};

describe("ChainNode details", () => {
  beforeEach(() => {
    act(() => {
      useAppStore.getState().actions.finishEditing();
      useAppStore.getState().actions.setShowDetails(true);
    });
  });

  it("does not render the details wrapper when all details are empty", () => {
    renderChainNode({
      description: "   ",
      positiveConsequenceBulletPoints: [""],
      negativeConsequenceBulletPoints: ["  "],
    });

    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
    expect(screen.queryByText("No positive impacts")).not.toBeInTheDocument();
    expect(screen.queryByText("No negative impacts")).not.toBeInTheDocument();
  });

  it("renders one populated category in a single-column grid", () => {
    renderChainNode({
      positiveConsequenceBulletPoints: ["Faster recovery", "  "],
    });

    expect(screen.getByText("Positive")).toBeInTheDocument();
    expect(screen.getByText("Faster recovery")).toBeInTheDocument();
    expect(screen.queryByText("Negative")).not.toBeInTheDocument();
    expect(screen.getByTestId("consequence-grid")).toHaveClass("grid-cols-1");
    expect(screen.getByTestId("consequence-grid")).not.toHaveClass(
      "grid-cols-2",
    );
  });

  it("renders both populated categories in a two-column grid", () => {
    renderChainNode({
      positiveConsequenceBulletPoints: ["Faster recovery"],
      negativeConsequenceBulletPoints: ["Customer disruption"],
    });

    expect(screen.getByText("Positive")).toBeInTheDocument();
    expect(screen.getByText("Negative")).toBeInTheDocument();
    expect(screen.getByTestId("consequence-grid")).toHaveClass("grid-cols-2");
  });

  it("hides populated details when the global setting is disabled", () => {
    act(() => {
      useAppStore.getState().actions.setShowDetails(false);
    });

    renderChainNode({
      description: "Root cause details",
      positiveConsequenceBulletPoints: ["Faster recovery"],
      negativeConsequenceBulletPoints: ["Customer disruption"],
    });

    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
    expect(screen.queryByText("Root cause details")).not.toBeInTheDocument();
  });

  it("shows compact accessible consequence counts in summary mode", () => {
    act(() => useAppStore.getState().actions.setShowDetails(false));
    renderChainNode({
      positiveConsequenceBulletPoints: ["Recovery"],
      negativeConsequenceBulletPoints: ["Delay", "Cost"],
    });
    expect(screen.getByLabelText("1 positive consequences")).toHaveTextContent(
      "+1",
    );
    expect(screen.getByLabelText("2 negative consequences")).toHaveTextContent(
      "−2",
    );
    expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
  });

  it("caps detailed evidence at three rows and reports overflow", () => {
    renderChainNode({
      evidenceItems: [
        { id: "E-001", text: "Photo" },
        { id: "E-002", text: "Interview" },
        { id: "E-003", text: "Log" },
        { id: "E-004", text: "Telemetry" },
        { id: "E-005", text: "Recording" },
      ],
    });

    const evidence = screen.getByTestId("evidence-summary");
    expect(within(evidence).getAllByRole("listitem")).toHaveLength(4);
    expect(within(evidence).getByText("+2 more")).toBeVisible();
    expect(within(evidence).queryByText("Telemetry")).not.toBeInTheDocument();
  });

  it("shows only an evidence count when details are hidden", () => {
    act(() => useAppStore.getState().actions.setShowDetails(false));
    renderChainNode({
      evidenceItems: [
        { id: "opaque-a", text: "Photo" },
        { id: "opaque-b", text: "Interview" },
      ],
    });

    expect(screen.getByLabelText("2 evidence items")).toHaveTextContent(
      "Evidence 2",
    );
    expect(screen.queryByText("Photo")).not.toBeInTheDocument();
  });

  it("exposes derived root, leaf, path, and unrelated presentation states", () => {
    renderChainNode(
      {
        graphRole: {
          isRoot: true,
          isLeaf: true,
          isOnSelectedPath: true,
          isUnrelated: false,
        },
      },
      true,
    );
    const node = screen.getByTestId("chain-node");
    expect(node).toHaveAttribute("data-root", "true");
    expect(node).toHaveAttribute("data-leaf", "true");
    expect(node).toHaveAttribute("data-selected-path", "true");
    expect(node).toHaveClass("ring-4", "border-sky-700");
    expect(screen.queryByText("Top Event")).not.toBeInTheDocument();
    expect(screen.queryByText(/Root event/i)).not.toBeInTheDocument();
  });

  it.each(["Event", "Factor", "Impact", "Action"] as const)(
    "renders the %s type treatment and stable reference",
    (nodeType) => {
      renderChainNode({ nodeType, referenceId: "N-042" });
      expect(
        screen.getByRole("button", { name: `Node type: ${nodeType}` }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Reference N-042")).toHaveTextContent(
        "N-042",
      );
    },
  );

  it("shows only populated impact metadata and concise evidence support", () => {
    renderChainNode({
      nodeType: "Impact",
      severity: "Critical",
      evidenceItems: [{ id: "EV-014", text: "Dispatch log" }],
    });
    expect(screen.getByText("Critical")).toBeVisible();
    expect(screen.getByLabelText("1 evidence items")).toHaveTextContent("1");
    expect(screen.getByText("EV-014")).toBeVisible();
  });

  it("omits empty impact severity", () => {
    renderChainNode({ nodeType: "Impact" });
    expect(screen.queryByText("Severity")).not.toBeInTheDocument();
  });

  it("formats an event timestamp as readable local time", () => {
    renderChainNode({ nodeType: "Event", timestamp: "2026-06-14T18:31:00Z" });
    const time = screen.getByText(/Jun 14, 2026/);
    expect(time).toHaveAttribute("datetime", "2026-06-14T18:31:00Z");
    expect(time).not.toHaveTextContent("T18:31:00Z");
  });

  it("shows the category placeholder, expanded labels, and neutral Normal state", () => {
    const { rerender } = renderChainNode({ nodeType: "Factor" });
    expect(
      screen.getByRole("button", { name: "Factor category: Category" }),
    ).toBeVisible();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
    rerender(
      <ReactFlowProvider>
        {(() => {
          const FactorNode = nodeTypes.ChainNode;
          return (
            <FactorNode
              {...({
                id: "node-1",
                data: {
                  ...defaultData,
                  nodeType: "Factor",
                  factorCategory: "Process",
                },
                selected: false,
              } as NodeProps<ChainNodeData>)}
            />
          );
        })()}
      </ReactFlowProvider>,
    );
    expect(screen.getByText("Process / Procedure")).toBeVisible();
  });

  it("shows distinct important-factor tags", () => {
    renderChainNode({ nodeType: "Factor", factorSignificance: "RootCause" });
    expect(screen.getByText("Root Cause")).toBeVisible();
  });

  it("promotes a selected Normal Factor from its card and hides Normal when unselected", async () => {
    const user = userEvent.setup();
    const { actions } = useAppStore.getState();
    actions.newMap();
    const id = useAppStore.getState().nodes[0].id;
    actions.finishEditing();
    actions.setNodeType(id, "Factor");
    const data = useAppStore.getState().nodes[0].data;
    const FactorNode = nodeTypes.ChainNode;
    const { rerender } = render(
      <ReactFlowProvider>
        <FactorNode
          {...({ id, data, selected: true } as NodeProps<ChainNodeData>)}
        />
      </ReactFlowProvider>,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Factor significance: Set significance",
      }),
    );
    await user.click(screen.getByRole("menuitemradio", { name: /Root Cause/ }));
    expect(useAppStore.getState().nodes[0].data.factorSignificance).toBe(
      "RootCause",
    );

    actions.undo();
    const normalData = useAppStore.getState().nodes[0].data;
    expect(normalData.factorSignificance).toBe("Normal");
    rerender(
      <ReactFlowProvider>
        <FactorNode
          {...({
            id,
            data: normalData,
            selected: false,
          } as NodeProps<ChainNodeData>)}
        />
      </ReactFlowProvider>,
    );
    expect(screen.queryByText("Significance")).not.toBeInTheDocument();
  });

  it("renders editable tags as buttons and read-only tags as spans", () => {
    const { unmount } = renderChainNode({ nodeType: "Factor" }, true);
    expect(screen.getByLabelText("Factor category: Category").tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByLabelText("Factor category: Category")).toHaveClass(
      "node-tag--interactive",
    );
    unmount();
    renderChainNode(
      { nodeType: "Factor", factorSignificance: "KeyFactor", readOnly: true },
      false,
    );
    expect(
      screen.getByLabelText("Factor significance: Key Factor").tagName,
    ).toBe("SPAN");
    expect(
      screen.getByLabelText("Factor significance: Key Factor"),
    ).toHaveClass("node-tag--readonly");
  });

  it("shows secondary action status, owner, and a locally formatted due date", () => {
    renderChainNode({
      nodeType: "Action",
      actionStatus: "InProgress",
      owner: "Maintenance lead",
      actionDueDate: "2026-07-01",
    });
    expect(screen.getByText("In Progress")).toBeVisible();
    expect(screen.getByText("Maintenance lead")).toBeVisible();
    expect(screen.getByText("Due Jul 1, 2026")).toHaveAttribute(
      "datetime",
      "2026-07-01",
    );
  });

  it("shows classification tags only as selected edit controls", async () => {
    const user = userEvent.setup();
    const { unmount } = renderChainNode(
      { nodeType: "Action", actionType: "Immediate" },
      true,
    );
    const actionType = screen.getByRole("button", {
      name: "Action type: Immediate / Containment",
    });
    expect(actionType).toHaveClass("node-tag--classification");
    actionType.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu", { name: "Action type" })).toBeVisible();
    expect(
      screen.getByRole("menuitemradio", { name: "Corrective" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Action type" })).toBeNull();
    unmount();

    renderChainNode(
      { nodeType: "Event", eventPhase: "Detection", readOnly: true },
      false,
    );
    expect(screen.getByLabelText("Event phase: Detection").tagName).toBe(
      "SPAN",
    );
    expect(
      screen.queryByRole("button", { name: /Event phase/ }),
    ).not.toBeInTheDocument();
  });

  it("only offers an unset action type while the action is selected", () => {
    const { unmount } = renderChainNode({ nodeType: "Action" }, false);
    expect(screen.queryByText("Set action type")).not.toBeInTheDocument();
    unmount();
    renderChainNode({ nodeType: "Action" }, true);
    expect(
      screen.getByRole("button", { name: "Action type: Set action type" }),
    ).toBeVisible();
  });

  it("keeps the Control status dominant over its muted role", () => {
    renderBarrierNode({ status: "Failed", controlRole: "Detective" });
    expect(screen.getByText("Failed")).toHaveClass("font-semibold");
    expect(screen.getByLabelText("Control role: Detective")).toHaveClass(
      "node-tag--classification",
      "node-tag--readonly",
    );
  });

  it("uses Control terminology and maps failure reason without compact details", () => {
    act(() => useAppStore.getState().actions.setShowDetails(false));
    renderBarrierNode({
      status: "Failed",
      failureReason: "InadequateDesign",
      failureDetails: "Long diagnostic explanation",
    });
    expect(screen.getByText("CONTROL")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("Failure reason: Inadequate Design")).toBeVisible();
    expect(
      screen.queryByText("Long diagnostic explanation"),
    ).not.toBeInTheDocument();
  });
});
