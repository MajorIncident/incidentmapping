import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { sampleMap } from "../../src/features/maps/fixtures";
import type { MapData } from "../../src/features/maps/schema";
import { useAppStore } from "../../src/state/useAppStore";

const actionMap: MapData = {
  ...sampleMap,
  nodes: [
    ...sampleMap.nodes,
    {
      id: "action",
      kind: "ChainNode",
      referenceId: "N-003",
      nodeType: "Action",
      title: "Prevent recurrence",
      actionStatus: "Planned",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceIds: [],
      contextItems: [],
      position: { x: 260, y: 160 },
    },
  ],
  edges: [
    ...sampleMap.edges,
    {
      id: "edge-child-action",
      kind: "ActionEdge",
      fromId: "child",
      toId: "action",
    },
  ],
  barriers: [],
};

const detailedMap: MapData = {
  ...actionMap,
  nodes: actionMap.nodes.map((node) =>
    node.id === "root"
      ? {
          ...node,
          description: "A detailed event description",
          timestamp: "2024-01-02T12:30",
          evidenceIds: ["EV-1"],
          negativeConsequenceBulletPoints: ["Detailed consequence"],
        }
      : node.id === "action"
        ? {
            ...node,
            owner: "Safety team",
            actionDueDate: "2025-03-04",
            evidenceIds: ["EV-2"],
          }
        : node,
  ),
  barriers: [
    {
      id: "barrier-root-child",
      kind: "Barrier",
      upstreamNodeId: "root",
      downstreamNodeId: "child",
      description: "Control purpose details",
      status: "Failed",
      failureReason: "NotFollowed",
      failureDetails: "Control failure details",
      evidenceIds: [],
    },
  ],
  evidence: [
    { id: "EV-1", type: "Note", title: "Detailed evidence line" },
    { id: "EV-2", type: "Note", title: "Action evidence line" },
  ],
};

describe("presentation mode", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class {
        m22 = 1;
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element): void {
          this.callback(
            [
              {
                target,
                contentRect: target.getBoundingClientRect(),
              } as ResizeObserverEntry,
            ],
            this as unknown as ResizeObserver,
          );
        }
        disconnect(): void {}
        unobserve(): void {}
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const isNode = this.classList.contains("react-flow__node");
        const width = isNode ? 220 : 1000;
        const height = isNode ? 100 : 800;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          width,
          height,
          toJSON: () => ({}),
        };
      },
    );
    Object.defineProperties(HTMLElement.prototype, {
      offsetWidth: { configurable: true, get: () => 220 },
      offsetHeight: { configurable: true, get: () => 100 },
    });
  });

  beforeEach(() =>
    act(() => useAppStore.getState().actions.loadMap(sampleMap)),
  );

  it("removes editing chrome while retaining review context", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));

    expect(
      screen.queryByRole("navigation", { name: "Editing commands" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Inspector" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Incident header")).toBeVisible();
    const legend = screen.getByLabelText("Presentation legend");
    expect(legend).toBeVisible();
    expect(legend.querySelectorAll("button")).toHaveLength(1);
    expect(legend.querySelectorAll("a, [role], [tabindex]")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Nodes" })).toBeInTheDocument();
    expect(legend).toHaveTextContent("Event");
    expect(legend).toHaveTextContent("Control");
    expect(legend).not.toHaveTextContent("Impact");
    expect(legend).not.toHaveTextContent("Root Cause");
    expect(legend).not.toHaveTextContent("Failed");
    expect(screen.getByRole("button", { name: /Legend/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const handles = document.querySelectorAll(".react-flow__handle");
    expect(handles.length).toBeGreaterThan(0);
    handles.forEach((handle) => {
      expect(handle).toHaveClass("presentation-handle");
      expect(handle).toHaveAttribute("data-presentation-handle", "true");
      expect(handle).toHaveAttribute("aria-hidden", "true");
      expect(handle).toHaveAttribute("tabindex", "-1");
    });

    await waitFor(() =>
      expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(2),
    );
    expect(document.querySelectorAll(".react-flow__edge-path")).toHaveLength(2);
    fireEvent.click(document.querySelector(".react-flow__node-Barrier")!);
    const relatedSegments = document.querySelectorAll(
      ".react-flow__edge.incident-edge--related:not(.incident-edge--action)",
    );
    expect(relatedSegments).toHaveLength(2);
    relatedSegments.forEach((segment) => {
      expect(segment).not.toHaveClass("incident-edge--unrelated");
      expect(segment.querySelector(".react-flow__edge-path")).toHaveStyle({
        stroke: "#475569",
      });
    });
    expect(document.querySelectorAll("marker")).toHaveLength(0);
  });

  it("discloses only classifications present on the map by keyboard", async () => {
    const classifiedMap: MapData = {
      ...actionMap,
      nodes: actionMap.nodes.map((node) =>
        node.id === "root"
          ? { ...node, eventPhase: "Detection" as const }
          : node.id === "action"
            ? { ...node, actionType: "Corrective" as const }
            : node,
      ),
      barriers: [
        {
          id: "classified-control",
          kind: "Barrier",
          upstreamNodeId: "root",
          downstreamNodeId: "child",
          description: "Alarm",
          status: "Failed",
          controlRole: "Detective",
          evidenceIds: [],
        },
      ],
    };
    act(() => useAppStore.getState().actions.loadMap(classifiedMap));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));

    const toggle = screen.getByRole("button", { name: /Legend/ });
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Event Phase" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Control Role and Status" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Action Type" })).toBeVisible();
    const legend = screen.getByLabelText("Presentation legend");
    for (const value of ["Detection", "Detective", "Failed", "Corrective"])
      expect(legend).toHaveTextContent(value);
    for (const unused of ["Recovery", "Effective", "Immediate"])
      expect(legend).not.toHaveTextContent(unused);
    expect(
      legend.querySelectorAll("li button, li a, li [tabindex]"),
    ).toHaveLength(0);

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps both causal edge segments rendered around a Control", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));

    expect(document.querySelectorAll(".react-flow__node-Barrier")).toHaveLength(
      1,
    );
    await waitFor(() =>
      expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(2),
    );
    expect(document.querySelectorAll(".react-flow__edge-path")).toHaveLength(2);
  });

  it("keeps the horizontal ActionEdge rendered", async () => {
    act(() => useAppStore.getState().actions.loadMap(actionMap));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));

    const actionEdge = await waitFor(() => {
      const edge = document.querySelector(
        ".react-flow__edge.incident-edge--action",
      );
      expect(edge).toBeInTheDocument();
      return edge;
    });
    expect(
      actionEdge?.querySelector(".react-flow__edge-path"),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("marker")).toHaveLength(0);
    expect(actionEdge).toHaveClass("incident-edge--action");
    expect(actionEdge?.querySelector(".react-flow__edge-path")).toHaveStyle({
      stroke: "#94a3b8",
      strokeDasharray: "5 5",
    });
  });

  it("dismisses its ephemeral hint and selects review elements without opening the Inspector", async () => {
    act(() => useAppStore.getState().actions.loadMap(actionMap));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    expect(screen.getByText("Review the investigation")).toBeVisible();

    fireEvent.click(screen.getByText("Prevent recurrence"));
    expect(
      screen.queryByText("Review the investigation"),
    ).not.toBeInTheDocument();
    expect(useAppStore.getState().selectionId).toBe("action");
    expect(
      screen.queryByRole("complementary", { name: "Inspector" }),
    ).not.toBeInTheDocument();

    fireEvent.click(document.querySelector(".react-flow__pane")!);
    expect(useAppStore.getState().selectionId).toBeNull();
  });

  it("exits by button and Escape without changing map data or history", async () => {
    render(<App />);
    const beforeMap = useAppStore.getState().actions.toMap();
    const beforeHistory = useAppStore.getState().history;
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Present map" })).toBeVisible();
    expect(useAppStore.getState().actions.toMap()).toEqual(beforeMap);
    expect(useAppStore.getState().history).toEqual(beforeHistory);
    expect(useAppStore.getState().selectionId).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(
      screen.getByRole("button", { name: /Exit Presentation/i }),
    );
    expect(screen.getByRole("button", { name: "Present map" })).toBeVisible();
  });

  it("opens, selects from, and closes Chronology without persistence or history mutations", async () => {
    const chronologyMap: MapData = {
      ...sampleMap,
      nodes: sampleMap.nodes.map((node, index) => ({
        ...node,
        timestamp: `2026-08-16T0${index + 8}:00:00Z`,
        eventPhase: index === 0 ? "Incident" : "Detection",
      })),
    };
    act(() => {
      useAppStore.getState().actions.loadMap(chronologyMap);
      useAppStore.getState().actions.setMapTitle("Airport investigation");
      useAppStore.getState().actions.undo();
    });
    const before = useAppStore.getState();
    const serialized = before.actions.toMap();
    const history = structuredClone(before.history);
    const availability = { canUndo: before.canUndo, canRedo: before.canRedo };
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(screen.getByRole("button", { name: "Chronology" }));
    expect(screen.getByRole("heading", { name: "Incident" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Detection" })).toBeVisible();
    const chronology = screen.getByRole("complementary", {
      name: "Chronology",
    });
    await userEvent.click(
      within(chronology).getByRole("button", { name: /Follow-up Event/ }),
    );
    expect(useAppStore.getState().selectionId).toBe("child");
    await userEvent.click(
      screen.getByRole("button", { name: "Close chronology" }),
    );

    const after = useAppStore.getState();
    expect(after.actions.toMap()).toEqual(serialized);
    expect(after.history).toEqual(history);
    expect({ canUndo: after.canUndo, canRedo: after.canRedo }).toEqual(
      availability,
    );
  });

  it.each([true, false])(
    "starts compact without changing editor detail visibility (%s)",
    async (editorShowDetails) => {
      act(() => {
        useAppStore.getState().actions.loadMap(detailedMap);
        useAppStore.getState().actions.setShowDetails(editorShowDetails);
      });
      render(<App />);

      await userEvent.click(
        screen.getByRole("button", { name: "Present map" }),
      );
      // Presentation mode changes the rendered React Flow node data. Await UI
      // transitions after user events instead of asserting against stale cards.
      const detailsButton = await screen.findByRole("button", {
        name: "Show Details",
      });
      expect(detailsButton).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Detailed evidence line"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Detailed consequence"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Control purpose details"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Control failure details"),
      ).not.toBeInTheDocument();
      expect(screen.getAllByLabelText("1 evidence items")).toHaveLength(2);
      expect(screen.getByText("Safety team")).toBeVisible();
      expect(screen.getByText("Planned")).toBeVisible();
      expect(screen.getByText(/Due Mar 4, 2025/)).toBeVisible();
      expect(screen.getByTestId("control-node")).toHaveTextContent("Failed");

      await userEvent.click(detailsButton);
      expect(
        await screen.findByRole("button", { name: "Hide Details" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(await screen.findByText("Detailed evidence line")).toBeVisible();
      expect(await screen.findByText("Detailed consequence")).toBeVisible();
      expect(await screen.findByText("Control purpose details")).toBeVisible();
      expect(await screen.findByText("Control failure details")).toBeVisible();

      await userEvent.click(
        screen.getByRole("button", { name: /Exit Presentation/i }),
      );
      expect(useAppStore.getState().showDetails).toBe(editorShowDetails);
    },
  );
});
