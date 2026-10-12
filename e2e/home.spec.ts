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

test("the main path works with the keyboard only", async ({ page }) => {
  const key = async (name: string, times = 1) => {
    for (let i = 0; i < times; i++) await page.keyboard.press(name);
  };

  // Scenario 1: Construction, $250,000, Good, 3 years -> 27 Fits.
  await page.goto("/");
  await page.getByLabel("Loan amount").focus();
  await page.keyboard.type("250000");
  await key("Tab");
  await page.keyboard.type("Construction"); // a focused select picks the option by typing
  await key("Tab"); // the tier group starts on "Not sure"
  await key("ArrowRight", 2); // Fair, then Good
  await key("Tab");
  await page.keyboard.type("3");

  await expect(page.getByRole("heading", { name: "Fits (27)" })).toBeVisible();
  const firstFit = page.getByRole("region", { name: "Fits (27)" }).getByRole("listitem").first();
  await expect(firstFit).toContainText("Meets:");
  await expect(firstFit).toContainText("Borrower:");

  // Scenario 3: Restaurant/Food Service, $260,000, Fair, 2 years -> 1 Fits, 16 Close.
  await page.goto("/");
  await page.getByLabel("Loan amount").focus();
  await page.keyboard.type("260000");
  await key("Tab");
  await page.keyboard.type("Restaurant");
  await key("Tab");
  await key("ArrowRight"); // Fair
  await key("Tab");
  await page.keyboard.type("2");

  await expect(page.getByRole("heading", { name: "Close (16)" })).toBeVisible();
  const close = page.getByRole("region", { name: "Close (16)" });
  await expect(close).toContainText("$10,000 over this lender's max ($250,000)");
  await expect(close).toContainText("Needs Good credit or better");
});

test("a score typo shows an error and no results, never Fits (D20)", async ({ page }) => {
  await page.goto("/?amount=150000&type=Healthcare&tier=Good&years=2");
  await expect(page.getByRole("heading", { name: "Fits (17)" })).toBeVisible();

  // A letter O instead of a zero: the field must send it as typed, not as "no score".
  await page.getByLabel("Credit score (optional)").fill("64O");

  await expect(page.getByText("Enter a whole number, 300 to 850")).toBeVisible();
  await expect(page).toHaveURL(/score=64O/);
  await expect(page.getByRole("heading", { name: /^Fits/ })).toHaveCount(0);
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

test("the data health page has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/data-health");
  await expect(page.getByRole("heading", { name: "Data health" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(seriousOrCritical).toEqual([]);
});
