import { act, render, screen, within } from "@testing-library/react";
import type { NodeProps } from "reactflow";
import { ReactFlowProvider } from "reactflow";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeTypes } from "../../src/components/Canvas/NodeTypes";
import { useAppStore, type ChainNodeData } from "../../src/state/useAppStore";

const defaultData: ChainNodeData = {
  title: "Incident",
  description: "",
  positiveConsequenceBulletPoints: [],
  negativeConsequenceBulletPoints: [],
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
    expect(screen.getByText("Top Event")).toBeInTheDocument();
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
});
