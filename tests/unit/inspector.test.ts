import { describe, expect, it } from "vitest";
import { validateTitle } from "../../src/components/Sidebar/Inspector";

describe("Inspector validation", () => {
  it("rejects empty titles", () => {
    expect(validateTitle("")).toBe("Title is required.");
    expect(validateTitle("   ")).toBe("Title is required.");
  });

  it("accepts non-empty titles", () => {
    expect(validateTitle("Incident")).toBeNull();
  });
});
