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
    await expect(page.getByRole("button", { name: "Add menu" })).toBeVisible();
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
    for (const selector of ["Create a new map", "Add menu"]) {
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
    await expect(legend).not.toContainText("Root Cause");
    const toggle = legend.getByRole("button", { name: /Legend/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      legend.getByRole("heading", { name: "Control Role and Status" }),
    ).toBeVisible();
    await expect(legend).toContainText("Effective");

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

test("expanded presentation legend is contained at mobile 200% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await page.getByRole("button", { name: "Present map" }).click();
  const legend = page.getByRole("complementary", {
    name: "Presentation legend",
  });
  await legend.getByRole("button", { name: /Legend/ }).click();
  const details = legend.locator(".presentation-legend__details");
  const box = await details.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  await page.getByRole("button", { name: "Chronology" }).click();
  const chronology = page.getByRole("dialog", { name: "Chronology" });
  await expect(chronology).toBeVisible();
  await expect(chronology).toContainText("Untimed Events");
  const event = chronology.getByRole("button", { name: /Root Event/ });
  await event.click();
  await expect(event).toHaveAttribute("aria-current", "true");
  const close = chronology.getByRole("button", { name: "Close chronology" });
  const closeBox = await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(22); // 44 CSS px at 200% zoom.
  expect(closeBox!.height).toBeGreaterThanOrEqual(22);
  await close.click();
  await expect(chronology).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chronology" })).toBeFocused();
});

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

  const info = page.getByRole("button", { name: "? Guide" });
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
  const sheet = page.getByRole("dialog", { name: "Learning Guide" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /Impact/i })).toBeVisible();
  await sheet.getByRole("button", { name: "Close Learning Guide" }).click();
  await expect(info).toBeFocused();
  await info.click();
  await sheet.getByRole("button", { name: /Dismiss this tip/i }).click();
  await expect(sheet).toContainText(/Impact|Event|Factor|Control|Evidence/i);
});

test("desktop Guide floats over the canvas and remains keyboard dismissible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const guide = page.getByRole("complementary", { name: "Learning Guide" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Context:");
  await expect(guide.getByText("Why this tip?")).toBeVisible();
  const [guideBox, canvasBox] = await Promise.all([
    guide.boundingBox(),
    page.locator(".react-flow").boundingBox(),
  ]);
  expect(guideBox!.x).toBeGreaterThan(canvasBox!.x + canvasBox!.width / 2);
  expect(guideBox!.y + guideBox!.height).toBeLessThanOrEqual(
    canvasBox!.y + canvasBox!.height,
  );

  await guide.getByRole("button", { name: "Collapse Learning Guide" }).focus();
  await page.keyboard.press("Escape");
  const trigger = page.getByRole("button", { name: "? Guide" });
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("mobile Guide is a labelled bottom sheet and restores keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "? Guide" });
  await trigger.click();
  const guide = page.getByRole("dialog", { name: "Learning Guide" });
  await expect(guide).toHaveAttribute("aria-modal", "true");
  await expect(
    guide.getByRole("button", { name: "Close Learning Guide" }),
  ).toBeFocused();
  const box = await guide.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y + box!.height).toBeLessThanOrEqual(800);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.getByLabel("More menu").click();
  await expect(
    page.getByRole("button", { name: /Learning Guide: On/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Learn the Map" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Present map" }).click();
  await expect(
    page.getByRole("button", { name: /Exit Presentation/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "? Guide" })).toBeVisible();
});
