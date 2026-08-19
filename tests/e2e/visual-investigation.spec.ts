import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { MapData } from "../../src/features/maps/schema";

const firstSave = path.join(os.tmpdir(), "visual-investigation-first.json");
const reloadedSave = path.join(
  os.tmpdir(),
  "visual-investigation-reloaded.json",
);

const openMap = async (page: Page, file: string) => {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /Open/ }).click();
  await (await chooserPromise).setFiles(file);
};

const saveMap = async (page: Page, file: string) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /Save/ }).click();
  await (await downloadPromise).saveAs(file);
  return JSON.parse(await readFile(file, "utf8")) as MapData;
};

const title = (page: Page) => page.getByRole("textbox", { name: "Node title" });

const assertUnique = (values: string[], label: string) => {
  expect(new Set(values).size, `${label} must be unique`).toBe(values.length);
};

const assertPersistedIntegrity = (document: MapData) => {
  assertUnique(
    document.nodes.map((node) => node.id),
    "node IDs",
  );
  assertUnique(
    document.nodes.map((node) => node.referenceId),
    "node reference IDs",
  );
  assertUnique(
    document.edges.map((edge) => edge.id),
    "edge IDs",
  );
  assertUnique(
    document.barriers.map((control) => control.id),
    "Control IDs",
  );
  expect(document.schemaVersion).toBe(3);
  assertUnique(
    document.evidence.map((evidence) => evidence.id),
    "evidence IDs",
  );
  const evidenceIds = new Set(document.evidence.map((item) => item.id));
  for (const owner of [...document.nodes, ...document.barriers]) {
    expect(new Set(owner.evidenceIds).size).toBe(owner.evidenceIds.length);
    owner.evidenceIds.forEach((id) => expect(evidenceIds.has(id)).toBe(true));
  }
  assertUnique(
    document.edges
      .filter((edge) => edge.kind === "CauseEffectEdge")
      .map((edge) => `${edge.fromId}\u0000${edge.toId}`),
    "causal pairs",
  );
  assertUnique(
    document.edges
      .filter((edge) => edge.kind === "ActionEdge")
      .map((edge) => `${edge.fromId}\u0000${edge.toId}`),
    "Action pairs",
  );
  for (const edge of document.edges.filter(
    (candidate) => candidate.kind === "ActionEdge",
  )) {
    expect(edge).not.toHaveProperty("status");
    expect(edge).not.toHaveProperty("dueDate");
    expect(edge).not.toHaveProperty("actionStatus");
    expect(edge).not.toHaveProperty("actionDueDate");
  }
};

test("builds a complete visual investigation and preserves it exactly", async ({
  page,
}) => {
  await page.goto("/");

  // Start with the impact, then work down by asking what happened and why.
  await title(page).fill("Airport passengers separated from baggage");
  await title(page).press("Enter");
  await page.getByLabel("Type").selectOption("Impact");
  await page.getByRole("button", { name: "Add menu" }).click();
  await page.getByRole("menuitem", { name: "Event — What happened?" }).click();
  await title(page).fill("Arrival belt stopped during unloading");
  await title(page).press("Enter");
  await expect(page.getByText("Event", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Event Phase").selectOption("Incident");

  // Convert the child to a Factor while its category is deliberately unset,
  // then complete its investigation classification.
  await page.getByRole("button", { name: "Add menu" }).click();
  await page
    .getByRole("menuitem", { name: "Event — Another occurrence" })
    .click();
  await title(page).fill("Inspection omitted photo-eye test");
  await title(page).press("Enter");
  await page.getByLabel("Type").selectOption("Factor");
  await expect(page.getByLabel("Category")).toHaveValue("");
  await page.getByLabel("Category").selectOption("Process");

  // Significance can be changed directly on a selected Factor card rather
  // than requiring a round trip through the Inspector.
  await page
    .getByRole("button", { name: "Factor significance: Set significance" })
    .click();
  await page.getByRole("menuitemradio", { name: /Root Cause/ }).click();
  await expect(page.getByLabel("Significance")).toHaveValue("RootCause");

  // Evidence IDs are allocated globally rather than within one node.
  const evidenceSection = page
    .getByRole("heading", { name: "Evidence" })
    .locator("..");
  await evidenceSection.getByRole("button", { name: "Add" }).click();
  await page
    .getByPlaceholder("Add supporting evidence")
    .fill("Approved checklist revision 7 has no photo-eye step");
  await page.getByPlaceholder("Add supporting evidence").press("Enter");
  await page
    .getByPlaceholder("Add supporting evidence")
    .last()
    .fill("Technician interview confirms visual-only check");
  await page.getByPlaceholder("Add supporting evidence").last().press("Tab");

  // Removing evidence leaves a deliberate gap; neither save/reopen nor later
  // allocation may silently compact identifiers.
  await page.getByRole("button", { name: "Remove EV-001 evidence" }).click();
  await expect(page.getByLabel("EV-002 evidence")).toHaveValue(
    "Technician interview confirms visual-only check",
  );

  // Add a second branch so selecting the Control below proves the precise
  // controlled branch is highlighted rather than every sibling cause.
  await page.getByText("Arrival belt stopped during unloading").click();
  await page.getByRole("button", { name: "Add menu" }).click();
  await page
    .getByRole("menuitem", { name: "Event — Another occurrence" })
    .click();
  await title(page).fill("Fault alarm was not escalated");
  await title(page).press("Enter");
  await page.getByLabel("Type").selectOption("Factor");
  await page.getByText("Inspection omitted photo-eye test").click();

  // Put the failed Control on the causal connection and record why it failed.
  await page.getByText("Arrival belt stopped during unloading").click();
  await page
    .getByRole("button", {
      name: "Add Control: Arrival belt stopped during unloading → Inspection omitted photo-eye test",
    })
    .click();
  await page.getByLabel("Control Purpose").fill("Pre-opening belt inspection");
  await page.getByLabel("Status").selectOption("Failed");
  await page.getByLabel("Control Role").selectOption("Preventive");
  await page.getByLabel("Why Did It Fail?").selectOption("InadequateDesign");
  await page
    .getByLabel("Failure Details")
    .fill(
      "Checklist covered visible damage but not functional sensor response.",
    );

  // Create the corrective Action from the root cause. Its card belongs to the
  // right-hand action lane and owns accountability fields itself.
  await page.getByRole("button", { name: "Select Downstream Node" }).click();
  await page.getByRole("button", { name: "Add menu" }).click();
  await page
    .getByRole("menuitem", { name: "Action — Address this finding" })
    .click();
  await title(page).fill("Add functional photo-eye check");
  await title(page).press("Enter");
  await page.getByLabel("Owner").fill("Maintenance lead");
  await page.getByLabel("Due date").fill("2026-07-01");
  await page.getByLabel("Status").selectOption("Planned");
  await page.getByLabel("Action Type").selectOption("Corrective");

  const rootCauseCard = page
    .locator('[data-testid="chain-node"]')
    .filter({ hasText: "Inspection omitted photo-eye test" });
  const actionCard = page
    .locator('[data-testid="chain-node"]')
    .filter({ hasText: "Add functional photo-eye check" });
  const [rootBox, actionBox] = await Promise.all([
    rootCauseCard.boundingBox(),
    actionCard.boundingBox(),
  ]);
  expect(actionBox!.x).toBeGreaterThan(rootBox!.x + rootBox!.width);

  // Presentation supports deliberate selection of each semantic entity.
  await page.getByRole("button", { name: "Present map" }).click();
  await expect(
    page.getByRole("button", { name: "Show Details" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByText("Technician interview confirms visual-only check"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show Details" }).click();
  await expect(
    page.getByText("Technician interview confirms visual-only check"),
  ).toBeVisible();
  for (const entity of [
    rootCauseCard,
    actionCard,
    page.getByTestId("control-node"),
  ]) {
    await entity.click();
    await expect(entity).toHaveClass(/selected/);
  }
  await page.getByTestId("control-node").click();
  await expect(
    page
      .locator('[data-testid="chain-node"]')
      .filter({ hasText: "Fault alarm was not escalated" }),
  ).toHaveClass(/unrelated/);
  await page.keyboard.press("Escape");

  await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();
  const initiallySaved = await saveMap(page, firstSave);
  assertPersistedIntegrity(initiallySaved);
  expect(initiallySaved.evidence.map((item) => item.id)).toEqual(["EV-002"]);
  expect(initiallySaved.metadata?.evidenceReferenceHighWaterMark).toBe(2);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Reset to a clean canvas before proving the downloaded investigation stands
  // alone. A new map contains only its blank starting item and no relationships.
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /New/ }).click();
  await expect(page.locator('[data-testid="chain-node"]')).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(page.getByText("Inspection omitted photo-eye test")).toHaveCount(
    0,
  );

  await openMap(page, firstSave);
  await expect(
    page.getByText("Airport passengers separated from baggage"),
  ).toBeVisible();
  await expect(
    page.getByText("Inspection omitted photo-eye test"),
  ).toBeVisible();
  await expect(page.getByText("Add functional photo-eye check")).toBeVisible();
  await expect(page.getByText("Pre-opening belt inspection")).toBeVisible();
  await page.getByText("Inspection omitted photo-eye test").click();
  await expect(page.getByLabel("EV-002 evidence")).toHaveValue(
    "Technician interview confirms visual-only check",
  );
  await evidenceSection.getByRole("button", { name: "Add" }).click();
  await page
    .getByLabel("EV-003 evidence")
    .fill("Reopen review confirms the allocation high-water mark");
  await page.getByLabel("EV-003 evidence").press("Tab");
  const savedAgain = await saveMap(page, reloadedSave);
  assertPersistedIntegrity(savedAgain);
  expect(savedAgain.evidence.map((item) => item.id)).toEqual([
    "EV-002",
    "EV-003",
  ]);
  expect(savedAgain.metadata?.evidenceReferenceHighWaterMark).toBe(3);
  expect(savedAgain.nodes.map((node) => node.id)).toEqual(
    initiallySaved.nodes.map((node) => node.id),
  );
});
