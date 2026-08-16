import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const fixture = path.resolve("tests/fixtures/baggage-incident-v2.json");
const savedInvestigation = path.join(
  os.tmpdir(),
  "baggage-visual-investigation.json",
);

const openMap = async (page: import("@playwright/test").Page, file: string) => {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /Open/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
};

const expectInvestigationOnCanvas = async (
  page: import("@playwright/test").Page,
) => {
  const canvas = page.getByLabel(
    "Delayed baggage delivery at North Terminal incident map",
  );
  await expect(canvas).toBeVisible();
  await expect(
    canvas.getByText("Passengers separated from baggage"),
  ).toBeVisible();
  await expect(
    canvas.getByText("Arrival belt stopped during unloading"),
  ).toBeVisible();
  await expect(canvas.getByText("Fault alarm was not escalated")).toBeVisible();
  await expect(
    canvas.getByText("Inspection omitted photo-eye test"),
  ).toBeVisible();
  await expect(
    canvas.getByText("Add functional photo-eye check"),
  ).toBeVisible();
  await expect(canvas.getByText("Impact", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Event", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Root Cause", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Procedure", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Planned", { exact: true })).toBeVisible();
  await expect(canvas.getByText("Pre-opening belt inspection")).toBeVisible();
  await expect(canvas.getByText("Failed", { exact: true })).toBeVisible();
};

test("complete baggage investigation remains understandable after save and reopen", async ({
  page,
}) => {
  await page.goto("/");
  await openMap(page, fixture);

  await expect(page.getByLabel("Incident metadata summary")).toContainText(
    "BAG-2026-0142",
  );
  await expect(page.getByLabel("Incident metadata summary")).toContainText(
    "North Terminal — Belt 4",
  );
  await expectInvestigationOnCanvas(page);

  await page.getByRole("button", { name: "More menu" }).click();
  await page.getByRole("menuitem", { name: "Hide details" }).click();
  await expect(
    page.getByText("Approved checklist revision 7 has no photo-eye step"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Present map" }).click();
  await expect(
    page.getByRole("button", { name: /Exit Presentation/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Below" })).toHaveCount(0);
  await expect(page.locator(".react-flow__controls")).toHaveCount(0);
  const edgePath = page.locator(".react-flow__edge-path").first();
  await expect(edgePath).toBeVisible();
  await expect(edgePath).toHaveAttribute("d", /\S+/);
  await expect(page.locator(".react-flow__handle:visible")).toHaveCount(0);
  await expectInvestigationOnCanvas(page);
  await page.getByRole("button", { name: /Exit Presentation/ }).click();
  await expect(page.getByRole("button", { name: "Add Below" })).toBeVisible();
  await expect(
    page.locator(".react-flow__handle:visible").first(),
  ).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("menuitem", { name: /Save/ }).click();
  const download = await downloadPromise;
  await download.saveAs(savedInvestigation);

  await page.reload();
  await openMap(page, savedInvestigation);

  // The regression contract is the reviewer's canvas, not merely downloaded JSON.
  await expectInvestigationOnCanvas(page);
  await page.getByText("Inspection omitted photo-eye test").click();
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(
    page.locator(
      'input[value="Approved checklist revision 7 has no photo-eye step"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      'input[value="Technician interview confirms visual-only check"]',
    ),
  ).toBeVisible();

  await page.getByText("Pre-opening belt inspection").click();
  await expect(page.getByLabel("Why Did It Fail?")).toHaveValue("Inadequate");
  await expect(page.getByLabel("Failure Details")).toHaveValue(
    "Checklist covered visible damage but not functional sensor response.",
  );
});
