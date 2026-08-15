import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const TEMP_FILENAME = path.join(os.tmpdir(), "incident-map-smoke.json");

test("creates, saves, and reopens a simple map", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("button", { name: "Add ChainNode" }).click();

  const titleLocator = page.getByText("New ChainNode").first();
  await titleLocator.dblclick();
  const input = page.getByRole("textbox", { name: "Node title" });
  await input.fill("Primary Event");
  await input.press("Enter");

  await page.getByRole("button", { name: "Add ChainNode" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const download = await downloadPromise;
  await download.saveAs(TEMP_FILENAME);

  await page.reload();
  await page.getByRole("button", { name: "New" }).click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open/ }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(TEMP_FILENAME);

  await expect(page.getByText("Primary Event")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});

test("creating another child focuses the parent and complete sibling group", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");

  const parent = page.locator(".react-flow__node").first();
  await parent.click();
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await parent.click();
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.waitForTimeout(500);
  const viewportBox = await page.locator(".react-flow").boundingBox();
  expect(viewportBox).not.toBeNull();
  const nodeBoxes = await page
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
    );
  for (const box of nodeBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(viewportBox!.x);
    expect(box.right).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width);
    expect(box.top).toBeGreaterThanOrEqual(viewportBox!.y);
    expect(box.bottom).toBeLessThanOrEqual(
      viewportBox!.y + viewportBox!.height,
    );
  }
});
