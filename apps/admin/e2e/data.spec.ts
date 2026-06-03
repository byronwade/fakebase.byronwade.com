import { test, expect } from "@playwright/test";

test.describe("Data Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/data");
  });

  test("renders the data browser page", async ({ page }) => {
    await expect(page).toHaveURL("/data");
    await expect(page.getByRole("heading", { name: "Data Browser" })).toBeVisible();
  });

  test("shows DEV-ONLY badge", async ({ page }) => {
    await expect(page.getByText("DEV-ONLY").first()).toBeVisible();
  });

  test("table selector is visible and contains tables", async ({ page }) => {
    const select = page.locator("select").first();
    await expect(select).toBeVisible();

    // Verify at least one table option exists
    const options = select.locator("option");
    expect(await options.count()).toBeGreaterThan(0);
  });

  test("data grid renders rows", async ({ page }) => {
    // The data table should render a table element
    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // There should be at least one data row (tbody tr)
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("Add Row button opens modal", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add row/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Modal should appear
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /add row/i })).toBeVisible();
  });

  test("can add a row via the modal", async ({ page }) => {
    const initialRowCount = await page.locator("table tbody tr").count();

    const addButton = page.getByRole("button", { name: /add row/i });
    await addButton.click();

    // Fill in the first input field in the modal
    const inputs = page.locator('[role="dialog"] input[type="text"]');
    const count = await inputs.count();
    if (count > 0) {
      await inputs.first().fill("test-value");
    }

    // Submit the form
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /add row/i })
      .click();

    // Modal should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Row count should have increased
    const newRowCount = await page.locator("table tbody tr").count();
    expect(newRowCount).toBeGreaterThan(initialRowCount);
  });

  test("can switch between tables", async ({ page }) => {
    const select = page.locator("select").first();

    // Get all table options
    const options = await select.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);

    // Switch to the second table
    if (options[1]) {
      await select.selectOption(options[1]);
      await expect(select).toHaveValue(options[1]);
    }
  });

  test("shows row count", async ({ page }) => {
    // Row count text should be visible somewhere on the page
    await expect(page.getByText(/row/i).first()).toBeVisible();
  });

  test("Import and Export buttons are visible", async ({ page }) => {
    await expect(page.getByText(/import/i).first()).toBeVisible();
    await expect(page.getByText(/export/i).first()).toBeVisible();
  });

  test("filter bar is present", async ({ page }) => {
    // The filter controls (Apply button + column select) should be present
    await expect(page.getByRole("button", { name: /apply/i })).toBeVisible();
  });

  test("delete row button is visible per row", async ({ page }) => {
    // Find delete buttons in the table
    const deleteButtons = page.locator("table tbody").getByTitle("Delete row");
    await expect(deleteButtons.first()).toBeVisible();
  });
});
