import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SecondarySection } from "../../src/components/Sidebar/Inspector";
import { contextEffectDefinitions } from "../../src/features/maps/schema";

describe("Inspector Context semantics", () => {
  it("provides concise shared copy and accessible quick-add labels", () => {
    expect(
      Object.values(contextEffectDefinitions).map((item) => item.heading),
    ).toEqual(["Context", "Aggravating Context", "Mitigating Context"]);
    expect(contextEffectDefinitions.Neutral.help).toContain(
      "Causal conditions should usually be Factors",
    );
    expect(contextEffectDefinitions.Aggravating.addLabel).toBe(
      "Add aggravating context",
    );
  });
});

describe("SecondarySection", () => {
  it("is uncontrolled and defaults to open", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      createElement(SecondarySection, {
        title: "Details",
        children: "Contents",
      }),
    );
    const summary = screen.getByText("Details");
    const details = summary.closest("details")!;
    expect(details).toHaveAttribute("open");

    await user.click(summary);
    expect(details).not.toHaveAttribute("open");
    rerender(
      createElement(SecondarySection, {
        title: "Details",
        children: "Edited contents",
      }),
    );
    expect(details).not.toHaveAttribute("open");
  });

  it("honors defaultOpen=false and opens only when requested", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      createElement(SecondarySection, {
        title: "Details",
        defaultOpen: false,
        children: "Contents",
      }),
    );
    const details = screen.getByText("Details").closest("details")!;
    expect(details).not.toHaveAttribute("open");

    rerender(
      createElement(SecondarySection, {
        title: "Details",
        defaultOpen: false,
        openOnRequest: true,
        children: "Contents",
      }),
    );
    expect(details).toHaveAttribute("open");
    await user.click(screen.getByText("Details"));
    rerender(
      createElement(SecondarySection, {
        title: "Details",
        defaultOpen: false,
        openOnRequest: true,
        children: "Updated",
      }),
    );
    expect(details).not.toHaveAttribute("open");
  });

  it.each(["{Enter}", " "])("toggles natively with %s", async (key) => {
    const user = userEvent.setup();
    render(
      createElement(SecondarySection, {
        title: "Details",
        children: "Contents",
      }),
    );
    const summary = screen.getByText("Details");
    const details = summary.closest("details")!;
    summary.focus();
    await user.keyboard(key);
    expect(details).not.toHaveAttribute("open");
    await user.keyboard(key);
    expect(details).toHaveAttribute("open");
  });
});
