import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { useAppStore } from "../../src/state/useAppStore";

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
      actions.newMap();
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
});
