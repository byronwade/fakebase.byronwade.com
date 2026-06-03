import { test, expect } from "@playwright/test";

test.describe("Auth Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("renders the auth manager page", async ({ page }) => {
    await expect(page).toHaveURL("/auth");
    await expect(page.getByRole("heading", { name: "Auth Manager" })).toBeVisible();
  });

  test("shows DEV-ONLY badge", async ({ page }) => {
    await expect(page.getByText("DEV-ONLY").first()).toBeVisible();
  });

  test("users table renders with columns", async ({ page }) => {
    // The users table should be visible
    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // Column headers
    await expect(
      page.getByRole("columnheader", { name: /email/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /role/i }).first(),
    ).toBeVisible();
  });

  test("users table has data rows", async ({ page }) => {
    const rows = page.locator("table").first().locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("Create User button is visible", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create user/i });
    await expect(createButton).toBeVisible();
  });

  test("Create User button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /create user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /create user/i })).toBeVisible();
  });

  test("can create a user via the modal", async ({ page }) => {
    const initialRowCount = await page
      .locator("table")
      .first()
      .locator("tbody tr")
      .count();

    await page.getByRole("button", { name: /create user/i }).click();

    // Fill email
    await page
      .getByRole("dialog")
      .getByPlaceholder(/user@example.com/i)
      .fill("newtest@example.com");

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /create user/i })
      .click();

    // Modal closes
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Row count increases
    const newRowCount = await page.locator("table").first().locator("tbody tr").count();
    expect(newRowCount).toBeGreaterThan(initialRowCount);
  });

  test("OTP inbox section exists", async ({ page }) => {
    await expect(page.getByText(/otp inbox/i)).toBeVisible();
  });

  test("OTP inbox section shows token entries", async ({ page }) => {
    // Navigate to OTP section
    await page.evaluate(() => {
      document.querySelector('[data-section="otp"]')?.scrollIntoView();
    });

    // There should be multiple tables (users + OTP + sessions)
    const tables = page.locator("table");
    expect(await tables.count()).toBeGreaterThan(1);
  });

  test("sessions section is visible", async ({ page }) => {
    await expect(page.getByText(/active sessions/i)).toBeVisible();
  });

  test("dev-only warning banner is visible", async ({ page }) => {
    await expect(page.getByText(/dev-only auth/i)).toBeVisible();
  });

  test("ban button is present per user row", async ({ page }) => {
    // Ban buttons are in the actions column
    const banButtons = page
      .locator("table")
      .first()
      .getByTitle(/ban user|unban user/i);
    await expect(banButtons.first()).toBeVisible();
  });

  test("delete button is present per user row", async ({ page }) => {
    const deleteButtons = page.locator("table").first().getByTitle("Delete user");
    await expect(deleteButtons.first()).toBeVisible();
  });
});
