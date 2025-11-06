import { test, expect } from "@playwright/test";

const modifier = process.platform === "darwin" ? "Meta" : "Control";

const parseTransform = (transform: string | null): { x: number; y: number } => {
  if (!transform) {
    throw new Error("Missing transform style");
  }
  const match = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/.exec(
    transform,
  );
  if (!match) {
    throw new Error(`Unexpected transform: ${transform}`);
  }
  return { x: Number(match[1]), y: Number(match[2]) };
};

test("keyboard workflow and sidebar edits", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("button", { name: "Add ChainNode" }).click();

  const rootTitle = page.getByText("New ChainNode").first();
  await rootTitle.dblclick();
  const titleInput = page.getByRole("textbox", { name: "Node title" });
  await titleInput.fill("Primary Event");
  await titleInput.press("Enter");

  await page.keyboard.press("Enter");
  const childEditor = page.getByRole("textbox", { name: "Node title" });
  await childEditor.fill("Known Cause");
  await childEditor.press("Enter");

  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  const siblingEditor = page.getByRole("textbox", { name: "Node title" });
  await siblingEditor.fill("Effect A");
  await siblingEditor.press("Enter");

  const effectNode = page
    .locator(".react-flow__node")
    .filter({ hasText: "Effect A" })
    .first();
  await expect(effectNode).toBeVisible();

  const initialPosition = parseTransform(
    await effectNode.getAttribute("style"),
  );
  await page.keyboard.press("ArrowRight");
  const nudgedPosition = parseTransform(await effectNode.getAttribute("style"));
  expect((nudgedPosition.x - initialPosition.x) % 8).toBe(0);

  await page.keyboard.press(`${modifier}+Z`);
  const undoPosition = parseTransform(await effectNode.getAttribute("style"));
  expect(undoPosition.x).toBe(initialPosition.x);

  await page.keyboard.press(`${modifier}+Shift+Z`);
  let redoPosition = parseTransform(await effectNode.getAttribute("style"));
  expect(redoPosition.x).toBe(nudgedPosition.x);

  await page.keyboard.press(`${modifier}+Z`);
  const restoredPosition = parseTransform(
    await effectNode.getAttribute("style"),
  );
  expect(restoredPosition.x).toBe(initialPosition.x);

  await page.keyboard.press(`${modifier}+Y`);
  redoPosition = parseTransform(await effectNode.getAttribute("style"));
  expect(redoPosition.x).toBe(nudgedPosition.x);

  await page.keyboard.press("Delete");
  await expect(effectNode).toHaveCount(0);

  await page.keyboard.press(`${modifier}+Z`);
  await expect(effectNode).toHaveCount(1);

  const ownerInput = page.getByLabel("Owner");
  await ownerInput.fill("Ops Team");
  const timestampInput = page.getByLabel("Timestamp");
  await timestampInput.fill("2024-07-01T08:30:00Z");

  await page.locator(".react-flow__pane").click();
  await effectNode.click();
  await expect(page.getByLabel("Owner")).toHaveValue("Ops Team");
  await expect(page.getByLabel("Timestamp")).toHaveValue(
    "2024-07-01T08:30:00Z",
  );
});
