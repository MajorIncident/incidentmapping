import { describe, expect, it } from "vitest";
import { deriveGraphPresentation } from "../../src/components/Canvas/Canvas";

describe("deriveGraphPresentation", () => {
  const ids = ["root", "left", "left-leaf", "right"];
  const edges = [
    { source: "root", target: "left" },
    { source: "left", target: "left-leaf" },
    { source: "root", target: "right" },
  ];

  it("derives roots and leaves from graph connectivity", () => {
    const result = deriveGraphPresentation(ids, edges, null);
    expect([...result.roots]).toEqual(["root"]);
    expect([...result.leaves]).toEqual(["left-leaf", "right"]);
    expect(result.unrelated.size).toBe(0);
  });

  it("separates the selected upstream/downstream path from other branches", () => {
    const result = deriveGraphPresentation(ids, edges, "left");
    expect([...result.upstream]).toEqual(["root"]);
    expect([...result.downstream]).toEqual(["left-leaf"]);
    expect([...result.selectedPath]).toEqual(
      expect.arrayContaining(["root", "left", "left-leaf"]),
    );
    expect([...result.unrelated]).toEqual(["right"]);
  });
});
