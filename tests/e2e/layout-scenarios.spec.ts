import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const fixture = (name: string) =>
  path.resolve(process.cwd(), "tests/fixtures", name);

const prepare = async (page: Page, file: string) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent =
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
    document.documentElement.append(style);
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /Open/ }).click();
  await (await chooser).setFiles(file);
  await expect(
    page.locator('[data-testid="chain-node"]').first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

const arrange = async (page: Page) => {
  await page.getByRole("button", { name: "Arrange Map" }).click();
  await page.waitForTimeout(100);
};

const capture = async (page: Page, name: string) => {
  await test.info().attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
};

const geometry = (page: Page) =>
  page
    .locator(
      '[data-testid="chain-node"], [data-testid="control-node"], .react-flow__edge path',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          text: element.textContent,
          path: element.getAttribute("d"),
          box: [box.x, box.y, box.width, box.height].map(
            (value) => Math.round(value * 100) / 100,
          ),
        };
      }),
    );

for (const detail of ["Compact", "Expanded"] as const) {
  test(`MU566 ${detail.toLowerCase()}`, async ({ page }) => {
    await prepare(page, fixture("mu566.json"));
    await page
      .getByRole("button", { name: `Use ${detail} canvas detail` })
      .click();
    await arrange(page);
    await capture(page, `mu566-${detail.toLowerCase()}.png`);
  });
}

test("MU566 selected Factor", async ({ page }) => {
  await prepare(page, fixture("mu566.json"));
  await page
    .getByText("Inspection omitted photo-eye test", { exact: true })
    .click();
  await expect(
    page.locator('[data-testid="chain-node"].selected'),
  ).toBeVisible();
  await capture(page, "mu566-selected-factor.png");
});

test("MU566 selected Control", async ({ page }) => {
  await prepare(page, fixture("mu566.json"));
  await page.getByTestId("control-node").click();
  await expect(page.getByTestId("control-node")).toHaveClass(/selected/);
  await capture(page, "mu566-selected-control.png");
});

for (const scenario of [
  [
    "synthetic diamond",
    "layout/synthetic-diamond.json",
    "synthetic-diamond.png",
  ],
  [
    "three-way convergence",
    "layout/three-to-one-convergence.json",
    "three-way-convergence.png",
  ],
  ["multiple Actions", "layout/multiple-actions.json", "multiple-actions.png"],
] as const) {
  test(scenario[0], async ({ page }) => {
    await prepare(page, fixture(scenario[1]));
    await arrange(page);
    await capture(page, scenario[2]);
  });
}

test("MU566 Arrange is byte-stable", async ({ page }) => {
  await prepare(page, fixture("mu566.json"));
  await arrange(page);
  const first = JSON.stringify(await geometry(page));
  await arrange(page);
  expect(JSON.stringify(await geometry(page))).toBe(first);
});
