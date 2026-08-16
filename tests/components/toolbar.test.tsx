import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider, type NodeProps } from "reactflow";
import { App } from "../../src/app/App";
import { useAppStore, type ChainNodeData } from "../../src/state/useAppStore";
import { emptyMap } from "../../src/features/maps/fixtures";
import { nodeTypes } from "../../src/components/Canvas/NodeTypes";

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver;
}

describe("Toolbar map title", () => {
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

  it("lets users edit the map title", async () => {
    await act(async () => {
      render(<App />);
    });

    const titleInput = await screen.findByRole("textbox", {
      name: /map title/i,
    });
    expect(titleInput).toHaveValue("Untitled Map");

    await act(async () => {
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, "Postmortem Draft{enter}");
    });

    expect(useAppStore.getState().metadata?.title).toBe("Postmortem Draft");
  });

  it("focuses the new root title so its incident name can be typed immediately", async () => {
    const user = userEvent.setup();
    const app = render(<App />);

    await user.click(screen.getByRole("button", { name: /create a new map/i }));
    const newMapState = useAppStore.getState();
    expect(newMapState.editorFocusRequest).toMatchObject({
      entityId: newMapState.nodes[0].id,
      field: "title",
    });
    // Re-mount around jsdom's inability to measure a dynamically inserted
    // React Flow node, then complete the requested viewport fit.
    app.unmount();
    // jsdom cannot measure a React Flow viewport, so complete the requested fit.
    act(() => {
      const state = useAppStore.getState();
      if (state.viewportRequest) {
        state.actions.clearViewportRequest(state.viewportRequest.id);
      }
    });
    const root = useAppStore.getState().nodes[0];
    const RootNode = nodeTypes.ChainNode;
    render(
      <ReactFlowProvider>
        <RootNode
          {...({
            id: root.id,
            data: {
              ...root.data,
              presentation: {
                isRoot: true,
                isLeaf: true,
                isOnSelectedPath: true,
                isUnrelated: false,
              },
            },
            selected: true,
            type: "ChainNode",
            xPos: 0,
            yPos: 0,
            zIndex: 0,
            isConnectable: true,
            dragging: false,
          } as NodeProps<ChainNodeData>)}
        />
      </ReactFlowProvider>,
    );
    const rootTitle = await screen.findByRole("textbox", {
      name: /node title/i,
    });
    await waitFor(() => expect(rootTitle).toHaveFocus());
    expect(screen.getByTestId("chain-node")).toHaveAttribute(
      "data-root",
      "true",
    );

    await user.clear(rootTitle);
    await user.type(rootTitle, "Database outage{enter}");

    expect(useAppStore.getState().nodes).toHaveLength(1);
    expect(useAppStore.getState().nodes[0].data.title).toBe("Database outage");
  });

  it("exposes an accessible organize action with a calculated disabled state", async () => {
    render(<App />);
    const organize = screen.getByRole("button", {
      name: /organize all nodes/i,
    });
    expect(organize).toBeDisabled();

    act(() => {
      const actions = useAppStore.getState().actions;
      const parent = actions.addChild() as string;
      const child = actions.addChild(parent) as string;
      actions.moveNode(child, { x: 800, y: 800 });
    });
    expect(organize).toBeEnabled();
    await userEvent.click(organize);
    expect(useAppStore.getState().canUndo).toBe(true);
    const [parent, child] = useAppStore.getState().nodes;
    expect(child.position.x).toBe(parent.position.x);
    expect(organize).toBeDisabled();
  });
});
