import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
          contextItems: [
            ...node.contextItems,
            {
              id: "context-detailed-consequence",
              label: "Aggravating context",
              value: "Detailed consequence",
              effect: "Aggravating" as const,
              displayMode: "Text" as const,
              showOnCard: false,
            },
          ],
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
      referenceId: "C-001",
      failureReason: "NotFollowed",
      failureDetails: "Control failure details",
      evidenceIds: [],
    },
  ],
  evidence: [
    {
      id: "EV-1",
      type: "Note",
      title: "Detailed evidence line",
      attachmentIds: [],
    },
    {
      id: "EV-2",
      type: "Note",
      title: "Action evidence line",
      attachmentIds: [],
    },
  ],
};

describe("presentation mode 2.0", () => {
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
        const node = this.classList.contains("react-flow__node");
        const width = node ? 220 : 1000;
        const height = node ? 100 : 800;
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
    act(() => useAppStore.getState().actions.loadMap(detailedMap)),
  );

  it("enters Guided Briefing with minimal chrome and no lens toolbar", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    expect(screen.getByLabelText("Guided Briefing")).toBeVisible();
    expect(screen.getByText("GUIDED BRIEFING")).toBeVisible();
    expect(screen.getByText("THE BRIEF")).toBeVisible();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeVisible();
    expect(
      screen.queryByRole("tablist", { name: /lens/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Chronology" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show Details" }),
    ).not.toBeInTheDocument();
  });

  it("advances with Next and arrow keys and opens chronology automatically", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(
      within(screen.getByLabelText("Guided Briefing")).getByRole("button", {
        name: /Next/,
      }),
    );
    expect(await screen.findByText("WHAT HAPPENED?")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Chronology" })).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("WHAT HAPPENED?")).toBeVisible();
    expect(screen.getByText("· 2 of 2")).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("WHY DID IT HAPPEN?")).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByText("WHAT HAPPENED?")).toBeVisible();
    expect(screen.getByText("· 2 of 2")).toBeVisible();
  });

  it("moves advanced lenses into Explore and resumes the briefing", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(screen.getByRole("button", { name: "Explore Map" }));
    const view = screen.getByRole("combobox", { name: "Presentation view" });
    expect(within(view).getAllByRole("option")).toHaveLength(6);
    await userEvent.selectOptions(view, "Controls");
    expect(view).toHaveValue("Controls");
    await userEvent.click(
      screen.getByRole("button", { name: /Return to Briefing/ }),
    );
    expect(screen.getByLabelText("Guided Briefing")).toBeVisible();
  });

  it("keeps presentation ephemeral when exiting", async () => {
    const before = useAppStore.getState().nodes.map((node) => node.data.title);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(screen.queryByLabelText("Guided Briefing")).not.toBeInTheDocument();
    expect(useAppStore.getState().nodes.map((node) => node.data.title)).toEqual(
      before,
    );
  });
});
