import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider, type NodeProps } from "reactflow";
import { App } from "../../src/app/App";
import { useAppStore, type ChainNodeData } from "../../src/state/useAppStore";
import { emptyMap } from "../../src/features/maps/fixtures";
import { nodeTypes } from "../../src/components/Canvas/NodeTypes";
import { viewportAnimationDuration } from "../../src/components/Canvas/Canvas";

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

  const titleControl = () =>
    screen.getByRole("button", { name: /untitled map.*edit map title/i });

  it("keeps primary actions visible and exposes lower-frequency menus", () => {
    render(<App />);

    const toolbar = screen.getByRole("banner");
    expect(toolbar).toContainElement(
      screen.getByRole("button", { name: "Create a new map" }),
    );
    expect(toolbar).toContainElement(
      screen.getByRole("button", { name: "Add Event" }),
    );
    expect(screen.getByLabelText("File menu")).toHaveAttribute(
      "title",
      "File menu",
    );
    expect(screen.getByLabelText("More menu")).toHaveAttribute(
      "title",
      "More menu",
    );
    fireEvent.click(screen.getByRole("button", { name: "More menu" }));
    expect(
      screen.getByRole("menuitem", { name: /arrange map/i }),
    ).toBeDisabled();
  });

  it("edits the canvas title with a double-click and commits on Enter", async () => {
    const user = userEvent.setup();
    render(<App />);

    fireEvent.doubleClick(titleControl());
    const input = screen.getByRole("textbox", { name: /map title/i });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("Untitled Map");
    expect(input).toHaveProperty("selectionStart", 0);
    expect(input).toHaveProperty("selectionEnd", "Untitled Map".length);

    await user.clear(input);
    await user.type(input, "  Postmortem Draft  {enter}");

    expect(useAppStore.getState().metadata?.title).toBe("Postmortem Draft");
    expect(
      screen.getByLabelText("Postmortem Draft incident map"),
    ).toBeVisible();
  });

  it.each(["Enter", " "])(
    "activates title editing from the keyboard with %s",
    async (key) => {
      render(<App />);
      fireEvent.keyDown(titleControl(), { key });
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /map title/i }),
        ).toHaveFocus(),
      );
    },
  );

  it("offers a single-click editing action and commits on blur", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(titleControl());
    const input = screen.getByRole("textbox", { name: /map title/i });
    await user.clear(input);
    await user.type(input, "Touch-friendly title");
    await user.click(screen.getByRole("button", { name: "File menu" }));
    await user.click(
      screen.getByRole("menuitem", { name: /save .*current map/i }),
    );

    expect(useAppStore.getState().metadata?.title).toBe("Touch-friendly title");
  });

  it("cancels with Escape and restores the previous title", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(titleControl());
    const input = screen.getByRole("textbox", { name: /map title/i });
    await user.clear(input);
    await user.type(input, "Discard me{Escape}");

    expect(useAppStore.getState().metadata?.title).toBe("Untitled Map");
    expect(titleControl()).toBeVisible();
  });

  it("keeps an empty invalid title selected and exposes an inline error", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(titleControl());
    const input = screen.getByRole("textbox", { name: /map title/i });
    await user.clear(input);
    await user.type(input, "   {enter}");

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a map title.");
    expect(useAppStore.getState().metadata?.title).toBe("Untitled Map");
  });

  it("makes a canvas title edit undoable", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(titleControl());
    const input = screen.getByRole("textbox", { name: /map title/i });
    await user.clear(input);
    await user.type(input, "Renamed map{enter}");
    await user.click(screen.getByRole("button", { name: "More menu" }));
    await user.click(
      screen.getByRole("menuitem", { name: /undo .*last action/i }),
    );

    expect(useAppStore.getState().metadata?.title).toBe("Untitled Map");
    expect(titleControl()).toBeVisible();
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
    fireEvent.click(screen.getByRole("button", { name: "More menu" }));
    const organize = screen.getByRole("menuitem", {
      name: /arrange map/i,
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
    fireEvent.click(screen.getByRole("button", { name: "More menu" }));
    expect(
      screen.getByRole("menuitem", { name: /arrange map/i }),
    ).toBeDisabled();
  });

  it("uses accessible command names and returns focus when a menu closes", async () => {
    const user = userEvent.setup();
    act(() => useAppStore.getState().actions.addChild());
    render(<App />);
    expect(screen.getByRole("button", { name: "Add Event" })).toHaveAttribute(
      "title",
      "Add Event (Enter)",
    );
    const more = screen.getByRole("button", { name: "More menu" });
    await user.click(more);
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: /undo the last action/i }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(more).toHaveFocus());
    expect(screen.queryByRole("menu", { name: "More actions" })).toBeNull();
  });

  it("confirms before deleting an event with a descendant subtree", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    act(() => {
      const actions = useAppStore.getState().actions;
      const parent = actions.addChild()!;
      actions.addChild(parent);
      actions.select(parent);
      actions.deleteSelection();
    });
    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/descendant.*entire branch/i),
    );
    expect(useAppStore.getState().nodes).toHaveLength(2);
    confirm.mockRestore();
  });

  it("disables viewport animation when reduced motion is preferred", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(viewportAnimationDuration(400)).toBe(0);
    window.matchMedia = original;
  });
});
