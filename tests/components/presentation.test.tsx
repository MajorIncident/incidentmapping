import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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
      evidenceItems: [],
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
    for (const heading of ["Nodes", "Analysis", "Controls"]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
    for (const label of [
      "Impact",
      "Event",
      "Factor",
      "Action",
      "Key Factor",
      "Root Cause",
      "Effective",
      "Degraded",
      "Failed",
      "Missing",
    ]) {
      expect(legend).toHaveTextContent(label);
    }
    expect(legend).not.toHaveTextContent("Top Event");
    expect(legend).not.toHaveTextContent("Root Cause / failed control");
    expect(legend.querySelectorAll('[aria-hidden="true"]')).toHaveLength(10);
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
    expect(document.querySelectorAll("marker")).toHaveLength(0);
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
});
