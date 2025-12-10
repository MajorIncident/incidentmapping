import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "reactflow";
import { Inspector } from "../../src/components/Sidebar/Inspector";
import { App } from "../../src/app/App";
import { useAppStore } from "../../src/state/useAppStore";

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver;
}

describe("Inspector and keyboard workflows", () => {
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
      actions.newMap();
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
    expect(titleInput).toHaveValue("New ChainNode");

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

    await screen.findByRole("button", { name: "Add a new chain node" });
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
});
