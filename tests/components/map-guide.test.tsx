import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuideContent } from "../../src/components/Canvas/Canvas";

describe("map guide", () => {
  it("renders its legend chips as static, non-focusable explanations", () => {
    render(<GuideContent />);
    const key = screen.getByLabelText("Map key");
    expect(key.querySelectorAll(".map-guide__key-item")).toHaveLength(7);
    expect(key.querySelectorAll("button, a, [role], [tabindex]")).toHaveLength(
      0,
    );
  });

  it("keeps disclosure controls out of the always-visible map guide", () => {
    render(<GuideContent />);
    expect(screen.getByLabelText("Map key").querySelector("button")).toBeNull();
  });
});
