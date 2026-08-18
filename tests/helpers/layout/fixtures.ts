import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mapDataSchema, type MapData } from "../../../src/features/maps/schema";
import { buildTopology, type LayoutTopology } from "./topology";

export const layoutFixtureNames = [
  "simple-chain",
  "one-to-three-branch",
  "three-to-one-convergence",
  "synthetic-diamond",
  "branch-merge-branch",
  "shared-impact-descendant",
  "multiple-controls",
  "controlled-siblings-with-descendants",
  "multiple-actions",
] as const;
export type LayoutFixtureName = (typeof layoutFixtureNames)[number];

const fixtureDirectory = resolve(process.cwd(), "tests/fixtures/layout");

/** Loads and validates the same fixture file in Vitest and Playwright. */
export const loadLayoutFixture = (name: LayoutFixtureName): MapData => {
  const path = resolve(fixtureDirectory, `${name}.json`);
  return mapDataSchema.parse(JSON.parse(readFileSync(path, "utf8")));
};

export const loadLayoutTopology = (name: LayoutFixtureName): LayoutTopology =>
  buildTopology(loadLayoutFixture(name));
