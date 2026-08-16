import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1280]) {
  test(`commands remain reachable without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Create a new map" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Below" })).toBeVisible();
    await page.getByLabel("File menu").click();
    await expect(
      page.getByRole("button", { name: "Open an existing map" }),
    ).toBeVisible();
    await page.getByLabel("More menu").click();
    await expect(
      page.getByRole("button", { name: "Organize all nodes" }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    for (const selector of ["Create a new map", "Add Below"]) {
      const box = await page
        .getByRole("button", { name: selector })
        .boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test(`presentation legend stays in the viewport at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Present map" }).click();

    const legend = page.getByRole("complementary", {
      name: "Presentation legend",
    });
    await expect(legend).toBeVisible();
    await expect(legend.getByRole("heading", { name: "Nodes" })).toBeVisible();
    await expect(
      legend.getByRole("heading", { name: "Analysis" }),
    ).toBeVisible();
    await expect(
      legend.getByRole("heading", { name: "Controls" }),
    ).toBeVisible();
    await expect(legend).toContainText("Root Cause");
    await expect(legend).toContainText("Failed");

    const [legendBox, exitBox] = await Promise.all([
      legend.boundingBox(),
      page.getByRole("button", { name: /Exit Presentation/ }).boundingBox(),
    ]);
    expect(legendBox!.x).toBeGreaterThanOrEqual(0);
    expect(legendBox!.x + legendBox!.width).toBeLessThanOrEqual(width);
    expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(800);
    expect(exitBox!.x + exitBox!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("mobile inspector closes and reopens when a node is tapped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector).toBeVisible();
  const canvas = await page.locator(".react-flow").boundingBox();
  const sheet = await inspector.boundingBox();
  expect(sheet!.height).toBeLessThanOrEqual(canvas!.height * 0.6);
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(inspector).toHaveCount(0);
  await page.locator(".react-flow__node").first().click();
  await expect(inspector).toBeVisible();
});

test("mobile canvas overlays remain usable with a long title at 200% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });

  const titleButton = page.getByTitle("Edit map title");
  await titleButton.click();
  await page
    .getByLabel("Map title")
    .fill("A very long incident map title that must not cover canvas actions");
  await page.getByLabel("Map title").press("Enter");

  const info = page.getByRole("button", { name: "How to read this map" });
  const fit = page.getByRole("button", { name: "Fit map" });
  await expect(info).toBeVisible();
  await expect(fit).toBeVisible();
  await expect(page.locator(".react-flow__minimap")).toBeHidden();
  const [titleBox, infoBox] = await Promise.all([
    titleButton.boundingBox(),
    info.boundingBox(),
  ]);
  expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(infoBox!.x);

  await page.getByLabel("File menu").click();
  await expect(
    page.getByRole("button", { name: "Open an existing map" }),
  ).toBeVisible();
  await info.click();
  await expect(
    page.getByRole("complementary", { name: "How to read this map" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss map guide" }).click();
  await page.reload();
  await expect(
    page.getByRole("complementary", { name: "How to read this map" }),
  ).toHaveCount(0);
});
