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
    await expect(
      page.getByRole("button", { name: "Add a new chain node" }),
    ).toBeVisible();
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
    for (const selector of ["Create a new map", "Add a new chain node"]) {
      const box = await page
        .getByRole("button", { name: selector })
        .boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
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
