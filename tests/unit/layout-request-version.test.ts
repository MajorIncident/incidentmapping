import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutResult } from "../../src/features/layout/layoutModel";

const { pending, layoutWithElk } = vi.hoisted(() => {
  const resolvers: Array<(result: LayoutResult) => void> = [];
  return {
    pending: resolvers,
    layoutWithElk: vi.fn(
      () =>
        new Promise<LayoutResult>((resolve) => {
          resolvers.push(resolve);
        }),
    ),
  };
});

vi.mock("../../src/features/layout/elk/elkAdapter", () => ({ layoutWithElk }));

import { useAppStore } from "../../src/state/useAppStore";
import { emptyMap } from "../../src/features/maps/fixtures";

const resultAt = (ids: string[], x: number): LayoutResult => ({
  nodes: ids.map((id, index) => ({
    id,
    role: "Semantic",
    rectangle: { x: x + index * 300, y: index * 300, width: 240, height: 144 },
  })),
  relationships: [],
  sharedSegments: [],
  bounds: { x, y: 0, width: 600, height: 600 },
  causalBounds: { x, y: 0, width: 600, height: 600 },
});

describe("Arrange request version and dependency key", () => {
  beforeEach(() => {
    pending.length = 0;
    layoutWithElk.mockClear();
    useAppStore.getState().actions.loadMap(emptyMap);
  });

  it("does not start complete layout for selection or ordinary text edits", () => {
    const actions = useAppStore.getState().actions;
    const id = actions.addChild() as string;
    actions.select(id);
    actions.renameNode(id, "Edited without arranging");
    expect(layoutWithElk).not.toHaveBeenCalled();
  });

  it("discards stale asynchronous geometry after a structural dependency changes", async () => {
    const actions = useAppStore.getState().actions;
    const first = actions.addChild() as string;
    const second = actions.addChild(first) as string;
    actions.organizeNodes();
    expect(layoutWithElk).toHaveBeenCalledTimes(1);

    actions.addSemanticNode("Factor", first);
    pending[0](resultAt([first, second], 1200));
    await Promise.resolve();
    await Promise.resolve();

    expect(
      useAppStore.getState().nodes.find((node) => node.id === first)?.position
        .x,
    ).not.toBe(1200);
  });

  it("records measurements without moving semantic nodes", () => {
    const actions = useAppStore.getState().actions;
    const parent = actions.addChild() as string;
    const child = actions.addChild(parent) as string;
    const measurements = {
      [parent]: { width: 251, height: 145 },
      [child]: { width: 318, height: 173 },
    };

    const positions = Object.fromEntries(
      useAppStore.getState().nodes.map((node) => [node.id, node.position]),
    );
    actions.applyMeasuredLayout(measurements);
    const once = useAppStore.getState().nodes;
    expect(
      Object.fromEntries(once.map((node) => [node.id, node.position])),
    ).toEqual(positions);
    expect(once.find((node) => node.id === parent)).toMatchObject(
      measurements[parent],
    );
    expect(once.find((node) => node.id === child)).toMatchObject(
      measurements[child],
    );

    actions.applyMeasuredLayout(measurements);
    expect(useAppStore.getState().nodes).toEqual(once);
  });
});
