import { describe, expect, it } from "vitest";
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
