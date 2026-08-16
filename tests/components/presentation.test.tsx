import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { emptyMap } from "../../src/features/maps/fixtures";
import { useAppStore } from "../../src/state/useAppStore";

describe("presentation mode", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        disconnect(): void {}
        unobserve(): void {}
      },
    );
  });

  beforeEach(() => act(() => useAppStore.getState().actions.loadMap(emptyMap)));

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
    expect(screen.getByLabelText("Presentation legend")).toBeVisible();
    expect(document.querySelectorAll(".react-flow__handle")).toHaveLength(0);
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

    await userEvent.click(screen.getByRole("button", { name: "Present map" }));
    await userEvent.click(
      screen.getByRole("button", { name: /Exit Presentation/i }),
    );
    expect(screen.getByRole("button", { name: "Present map" })).toBeVisible();
  });
});
