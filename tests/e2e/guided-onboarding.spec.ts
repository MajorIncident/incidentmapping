import { test, expect, type Locator } from "@playwright/test";

const guideAction = (guide: Locator, name: string) =>
  guide.getByRole("button", { name, exact: true });

test("builds an investigation through the real onboarding guide", async ({
  page,
}) => {
  await page.goto("/");

  const guide = page.getByRole("complementary", { name: "Learning Guide" });
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const title = page.getByRole("textbox", { name: "Node title" });

  await expect(guide).toContainText("Name the Impact");
  await expect(guide).not.toContainText(
    /missing|Evidence|Root Cause|Controls/i,
  );
  await expect(inspector).toHaveCount(0);
  await expect(title).toBeFocused();

  await title.fill("Customer delivery failed");
  await title.press("Enter");
  await expect(guide).toContainText("What happened?");

  await guideAction(guide, "+ Add Event").click();
  await expect(page.getByTestId("chain-node")).toHaveCount(2);
  await expect(inspector).toBeVisible();
  await expect(page.getByLabel("Type")).toHaveValue("Event");
  await title.fill("Shipment missed dispatch");
  await title.press("Enter");

  await expect(guideAction(guide, "+ Event")).toBeVisible();
  await expect(guideAction(guide, "+ Factor")).toBeVisible();
  await guideAction(guide, "+ Factor").click();
  await title.fill("Handover was incomplete");
  await title.press("Enter");
  await expect(guide).toContainText("ASK WHY");
  await expect(guide).toContainText("Why did this condition exist?");

  await guideAction(guide, "+ Factor").click();
  await title.fill("Checklist was unavailable");
  await title.press("Enter");
  await expect(page.getByTestId("chain-node")).toHaveCount(4);

  const firstEvent = page
    .locator(".react-flow__node")
    .filter({ hasText: "Shipment missed dispatch" });
  await firstEvent.click();
  await expect(
    page.getByRole("button", {
      name: "Add Control: Shipment missed dispatch → Handover was incomplete",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add Control: Shipment missed dispatch → Handover was incomplete",
    })
    .click();
  await expect(page.getByTestId("control-node")).toHaveCount(1);
  await expect(
    inspector.getByRole("heading", { name: /Control between/ }),
  ).toBeVisible();

  await guideAction(guide, "Add Evidence").click();
  const evidenceEditor = inspector.locator("form").filter({
    has: page.getByLabel("Title", { exact: true }),
  });
  await expect(evidenceEditor).toBeVisible();
  await expect(evidenceEditor.getByLabel("Description")).toBeVisible();
  await expect(inspector.getByText(/E-\d+ ·/)).toHaveCount(0);

  await firstEvent.click();
  await page.getByRole("button", { name: "Add menu" }).click();
  await page
    .getByRole("menuitem", { name: "Action — Address this event" })
    .click();
  await expect(page.getByLabel("Type")).toHaveValue("Action");
  await expect(inspector.getByLabel("Status")).toBeVisible();

  await firstEvent.click();
  await inspector.getByText("Context", { exact: true }).click();
  const neutralContext = inspector.getByRole("region", { name: "Context" });
  await neutralContext.getByLabel("New label").focus();
  await expect(guide).toContainText("Does this belong in the causal chain?");
  await expect(guide).toContainText(/Factor when it contributed causally/);
  await neutralContext.getByLabel("New label").fill("Location");
  await neutralContext.getByLabel("New value").fill("Loading bay");
  await neutralContext.getByRole("button", { name: "Add Context" }).click();
  await expect(neutralContext.getByTestId("context-row")).toHaveCount(1);

  await expect(
    page.getByRole("dialog", { name: "Investigation Check" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Investigation Check" }).click();
  const check = page.getByRole("dialog", { name: "Investigation Check" });
  await expect(check).toContainText("advisory orientation");
  await expect(check).toContainText("Evidence");
  await expect(check).toContainText("Root Cause");
});
