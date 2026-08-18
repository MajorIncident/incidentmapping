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
    expect(
      screen.queryByRole("complementary", { name: "Inspector" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Learning Guide" }),
    ).toBeInTheDocument();

    // jsdom cannot measure a React Flow viewport. Complete the initial fit
    // request so the production focus request can run against the mounted node.
    act(() => {
      const request = useAppStore.getState().viewportRequest;
      if (request) {
        useAppStore.getState().actions.clearViewportRequest(request.id);
      }
    });
    const root = useAppStore.getState().nodes[0];
    expect(root.data).toMatchObject({
      title: "Undesirable outcome",
      nodeType: "Impact",
      referenceId: "N-001",
    });
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

  it("uses the real map session lifecycle for onboarding, but not opened maps", async () => {
    useAppStore.getState().actions.newMap();
    const fresh = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Name the Impact" }),
    ).toBeInTheDocument();
    expect(useAppStore.getState().mapSession).toEqual({
      source: "New",
      fresh: true,
    });
    fresh.unmount();

    useAppStore.getState().actions.loadMap({
      schemaVersion: 5,
      metadata: {
        title: "Opened investigation",
        contextItems: [],
        nodeReferenceHighWaterMark: 1,
        evidenceReferenceHighWaterMark: 0,
        controlReferenceHighWaterMark: 0,
        attachmentReferenceHighWaterMark: 0,
      },
      nodes: [
        {
          id: "opened-impact",
          kind: "ChainNode",
          referenceId: "N-001",
          nodeType: "Impact",
          title: "Known customer impact",
          evidenceIds: [],
          contextItems: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
      barriers: [],
      evidence: [],
      attachments: [],
    });
    render(<App />);

    await waitFor(() =>
      expect(useAppStore.getState().mapSession).toEqual({
        source: "Opened",
        fresh: false,
      }),
    );
    expect(
      screen.queryByRole("heading", { name: "Name the Impact" }),
    ).not.toBeInTheDocument();
  });
});
