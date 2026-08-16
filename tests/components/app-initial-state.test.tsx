import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider, type NodeProps } from "reactflow";
import { App } from "../../src/app/App";
import { nodeTypes } from "../../src/components/Canvas/NodeTypes";
import { useAppStore, type ChainNodeData } from "../../src/state/useAppStore";

describe("App initial canvas", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  it("starts with only an editable root ready for immediate typing", async () => {
    const user = userEvent.setup();
    const app = render(<App />);

    expect(await screen.findAllByTestId("chain-node")).toHaveLength(1);
    expect(screen.queryByTestId("barrier-node")).not.toBeInTheDocument();

    // jsdom cannot measure a React Flow viewport. Complete the initial fit
    // request so the production focus request can run against the mounted node.
    act(() => {
      const request = useAppStore.getState().viewportRequest;
      if (request) {
        useAppStore.getState().actions.clearViewportRequest(request.id);
      }
    });
    const root = useAppStore.getState().nodes[0];
    app.unmount();
    const RootNode = nodeTypes.ChainNode;
    render(
      <ReactFlowProvider>
        <RootNode
          {...({
            id: root.id,
            data: {
              ...root.data,
              graphRole: {
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

    const titleInput = await screen.findByRole("textbox", {
      name: /node title/i,
    });
    await waitFor(() => expect(titleInput).toHaveFocus());
    await user.clear(titleInput);
    await user.type(titleInput, "Immediate incident{enter}");

    expect(useAppStore.getState().nodes[0].data.title).toBe(
      "Immediate incident",
    );
  });
});
