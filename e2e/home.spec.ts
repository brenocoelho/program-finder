import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a rep types the full borrower details and sees Fits, then Close for a near miss", async ({ page }) => {
  await page.goto("/");

  // Scenario 1 (docs/UNDERSTANDING.md): Construction, $250,000, Good, 3 years -> 27 Fits.
  await page.getByLabel("Loan amount").fill("250000");
  await page.getByLabel("Business type").selectOption("Construction");
  await page.getByRole("radio", { name: "Good" }).check();
  await page.getByLabel("Full years in business").fill("3");

  await expect(page.getByRole("heading", { name: "Fits (27)" })).toBeVisible();
  await expect(page).toHaveURL(/amount=250000/);
  await expect(page).toHaveURL(/type=Construction/);

  // Scenario 3: Restaurant/Food Service, $260,000, Fair, 2 years -> 16 Close, 1 Fits.
  await page.getByLabel("Loan amount").fill("260000");
  await page.getByLabel("Business type").selectOption("Restaurant/Food Service");
  await page.getByRole("radio", { name: "Fair" }).check();
  await page.getByLabel("Full years in business").fill("2");

  await expect(page.getByRole("heading", { name: "Close (16)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fits (1)" })).toBeVisible();
});

test("the finder screen has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/?amount=250000&type=Construction&tier=Good&years=3");
  await expect(page.getByRole("heading", { name: "Fits (27)" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(seriousOrCritical).toEqual([]);
});
