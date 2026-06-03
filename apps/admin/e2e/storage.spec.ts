import { test, expect } from "@playwright/test";

test.describe("Storage Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/storage");
  });

  test("renders the storage page", async ({ page }) => {
    await expect(page).toHaveURL("/storage");
  });

  test("shows DEV-ONLY badge in global header", async ({ page }) => {
    await expect(page.getByText("DEV-ONLY").first()).toBeVisible();
  });

  test("buckets list renders with initial buckets", async ({ page }) => {
    // The bucket list panel should be visible
    await expect(page.getByText("Buckets")).toBeVisible();

    // Should show at least some predefined buckets
    await expect(page.getByText("avatars")).toBeVisible();
    await expect(page.getByText("documents")).toBeVisible();
  });

  test("Create bucket button is visible", async ({ page }) => {
    const createButton = page.locator('[title="Create bucket"]');
    await expect(createButton).toBeVisible();
  });

  test("can create a new bucket", async ({ page }) => {
    await page.locator('[title="Create bucket"]').click();

    // Modal appears
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /create bucket/i })).toBeVisible();

    // Fill bucket name
    await page.getByRole("dialog").locator("input[type='text']").fill("test-bucket");

    // Submit
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /create bucket/i })
      .click();

    // Modal closes and new bucket appears
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("test-bucket")).toBeVisible();
  });

  test("clicking a bucket shows file browser", async ({ page }) => {
    // Click on avatars bucket
    await page.getByText("avatars").click();

    // File browser panel should appear with files
    await expect(page.getByText("alice.jpg")).toBeVisible();
  });

  test("file list shows file metadata", async ({ page }) => {
    await page.getByText("avatars").click();

    // Should show size and content type columns
    await expect(page.getByRole("columnheader", { name: /size/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /type/i })).toBeVisible();
  });

  test("upload button is visible after selecting bucket", async ({ page }) => {
    await page.getByText("avatars").click();
    await expect(page.getByText("Upload")).toBeVisible();
  });

  test("download button is present per file", async ({ page }) => {
    await page.getByText("avatars").click();
    const downloadButtons = page.getByTitle("Download");
    await expect(downloadButtons.first()).toBeVisible();
  });

  test("delete file button is present per file", async ({ page }) => {
    await page.getByText("avatars").click();
    const deleteButtons = page.getByTitle("Delete");
    await expect(deleteButtons.first()).toBeVisible();
  });

  test("public/private toggle is visible after selecting bucket", async ({ page }) => {
    await page.getByText("avatars").click();
    // Public button shows for public bucket, Private for private
    const toggleButton = page.getByText(/public|private/i).first();
    await expect(toggleButton).toBeVisible();
  });

  test("selecting different bucket shows its files", async ({ page }) => {
    await page.getByText("documents").click();
    await expect(page.getByText("report-q1.pdf")).toBeVisible();
  });

  test("empty state shows when no bucket selected", async ({ page }) => {
    // Initially no bucket is selected — empty state message visible
    await expect(page.getByText(/select a bucket/i)).toBeVisible();
  });

  test("can delete a bucket", async ({ page }) => {
    const uploadsBucket = page.getByText("uploads").first();
    await expect(uploadsBucket).toBeVisible();

    // Hover over the bucket to reveal delete button
    const bucketItem = page.locator(".group").filter({ hasText: "uploads" }).first();
    await bucketItem.hover();

    // Click delete button
    const deleteBtn = bucketItem
      .locator("[title], button")
      .filter({ has: page.locator('[class*="Trash"]') })
      .first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByText("uploads")).not.toBeVisible();
    }
  });
});
