import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const TEMP_FILENAME = path.join(os.tmpdir(), "incident-map-smoke.json");

test("creates, saves, and reopens a simple map", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Holding", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("barrier-node")).toHaveCount(0);
  await expect(page.getByText("Follow-up Event", { exact: true })).toHaveCount(
    0,
  );
  const input = page.getByRole("textbox", { name: "Node title" });
  await expect(input).toBeFocused();
  await input.fill("Primary Event");
  await input.press("Enter");
  await expect(page.getByText("Primary Event")).toBeVisible();

  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");

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

test("chooses a non-first downstream branch when adding a barrier", async ({
  page,
}) => {
  await page.goto("/");
  const map = {
    schemaVersion: 1,
    metadata: { title: "Branched incident" },
    nodes: [
      {
        id: "parent",
        kind: "ChainNode",
        title: "Parent",
        position: { x: 0, y: 0 },
        positiveConsequenceBulletPoints: [],
        negativeConsequenceBulletPoints: [],
      },
      {
        id: "first-child",
        kind: "ChainNode",
        title: "First child",
        position: { x: -200, y: 200 },
        positiveConsequenceBulletPoints: [],
        negativeConsequenceBulletPoints: [],
      },
      {
        id: "second-child",
        kind: "ChainNode",
        title: "Second child",
        position: { x: 200, y: 200 },
        positiveConsequenceBulletPoints: [],
        negativeConsequenceBulletPoints: [],
      },
    ],
    edges: [
      {
        id: "first-edge",
        kind: "CauseEffectEdge",
        fromId: "parent",
        toId: "first-child",
      },
      {
        id: "second-edge",
        kind: "CauseEffectEdge",
        fromId: "parent",
        toId: "second-child",
      },
    ],
    barriers: [],
  };
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Open/ }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles({
    name: "branches.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(map)),
  });

  await expect(page.getByText("Add barrier to branch")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add barrier: Parent → First child" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add barrier: Parent → Second child" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Barrier between Parent and Second child",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("barrier-node")).toHaveCount(1);
});

test("creating another child focuses the parent and complete sibling group", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");

  const parent = page.locator(".react-flow__node").first();
  await parent.click();
  const parentBeforeFirstChild = await parent.boundingBox();
  expect(parentBeforeFirstChild).not.toBeNull();
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await page.waitForTimeout(500);
  const parentAfterFirstChild = await parent.boundingBox();
  expect(parentAfterFirstChild).not.toBeNull();
  expect(parentAfterFirstChild!.x).toBeCloseTo(parentBeforeFirstChild!.x, 0);
  expect(parentAfterFirstChild!.y).toBeCloseTo(parentBeforeFirstChild!.y, 0);

  const firstChild = page.locator(".react-flow__node").nth(1);
  const [bottomHandle, topHandle] = await Promise.all([
    parent.locator(".react-flow__handle-bottom").boundingBox(),
    firstChild.locator(".react-flow__handle-top").boundingBox(),
  ]);
  expect(bottomHandle).not.toBeNull();
  expect(topHandle).not.toBeNull();
  expect(bottomHandle!.x + bottomHandle!.width / 2).toBeCloseTo(
    topHandle!.x + topHandle!.width / 2,
    0,
  );
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

test("organizes moved nodes and frames the complete graph", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new map" }).click();
  const organize = page.getByRole("button", { name: "Organize all nodes" });
  await expect(organize).toBeDisabled();
  await page.getByRole("button", { name: "Add Event" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await page.getByRole("button", { name: "Add Event" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await page
    .locator(".react-flow__node")
    .last()
    .dragTo(page.locator(".react-flow__pane"), {
      targetPosition: { x: 50, y: 50 },
    });
  await expect(organize).toBeEnabled();
  await organize.click();
  await page.waitForTimeout(500);
  const flow = await page.locator(".react-flow").boundingBox();
  const boxes = await page
    .locator(".react-flow__node")
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().toJSON()),
    );
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(flow!.x);
    expect(box.right).toBeLessThanOrEqual(flow!.x + flow!.width);
  }
});

test("shows map semantics and highlights only a selected branch", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await page.getByRole("button", { name: "Add ChainNode" }).click();
  await page.getByRole("textbox", { name: "Node title" }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Untitled Map" }),
  ).toBeVisible();
  await expect(page.getByLabel("Incident map legend")).toContainText(
    "top to bottom",
  );
  await expect(page.getByLabel("Incident map overview")).toBeVisible();

  const eventNodes = page.locator('[data-testid="chain-node"]');
  await eventNodes.last().click();
  await expect(eventNodes.first()).toHaveAttribute(
    "data-selected-path",
    "true",
  );
  await expect(eventNodes.last()).toHaveAttribute("data-selected-path", "true");
  await expect(page.locator(".incident-edge--upstream")).toHaveCount(2);
  await expect(
    page.locator(".incident-edge--upstream .react-flow__edge-path").first(),
  ).toHaveCSS("stroke-dasharray", "7px, 4px");
});

test("renames the map title in place instead of in the toolbar", async ({
  page,
}) => {
  await page.goto("/");

  const titleControl = page.getByRole("button", {
    name: /Untitled Map.*Edit map title/i,
  });
  await titleControl.click();
  const titleInput = page.getByRole("textbox", { name: "Map title" });
  await expect(titleInput).toBeFocused();
  await titleInput.fill("Production incident");
  await titleInput.press("Enter");

  await expect(
    page.getByRole("button", { name: /Production incident.*Edit map title/i }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Production incident incident map"),
  ).toBeVisible();
  await expect(page.locator("header").getByRole("textbox")).toHaveCount(0);
});
