import { describe, expect, it } from "vitest";
import {
  selectAvailableCreationOptions,
  type CreationContext,
} from "../../src/state/selectors";

const types = (context: CreationContext, controls = 0) =>
  selectAvailableCreationOptions(context, 1, controls).map(
    (option) => option.type,
  );

describe("canonical creation options", () => {
  it.each([
    [{ kind: "Canvas" }, ["Impact"]],
    [
      { kind: "Impact", id: "i", title: "Impact" },
      ["Impact", "Event", "Action"],
    ],
    [{ kind: "Event", id: "e", title: "Event" }, ["Event", "Factor", "Action"]],
    [{ kind: "Factor", id: "f", title: "Factor" }, ["Factor", "Action"]],
    [{ kind: "Control", id: "c", title: "Control" }, []],
    [{ kind: "Action", id: "a", title: "Action" }, []],
  ] as const)("returns the exact matrix for %o", (context, expected) => {
    expect(types(context as CreationContext)).toEqual(expected);
  });

  it.each(["Impact", "Event", "Factor"] as const)(
    "adds Control only for eligible %s relationships",
    (kind) => {
      const context = { kind, id: kind, title: kind } as CreationContext;
      expect(types(context, 1)).toContain("Control");
      expect(types(context, 0)).not.toContain("Control");
    },
  );
});
