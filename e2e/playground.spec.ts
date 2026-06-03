import { test, expect } from "@playwright/test";

// Each test gets a fresh browser context → fresh fb_pg cookie → freshly seeded
// per-visitor sandbox (2 starter posts).

test.describe("Playground — live kernel", () => {
  test("renders the seeded posts from a live read", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByText("Hello Fakebase").first()).toBeVisible();
    await expect(page.getByText("Swapping to real Supabase").first()).toBeVisible();
  });

  test("insert persists across the action + a reload (write → revalidate → read)", async ({
    page,
  }) => {
    await page.goto("/playground");

    const title = `E2E Post ${Date.now()}`;
    await page.getByPlaceholder("Post title").fill(title);
    await page.getByPlaceholder("Write something…").fill("created by an e2e test");
    await page.getByRole("button", { name: /insert post/i }).click();

    // Visible after the action's revalidate…
    await expect(page.getByText(title).first()).toBeVisible();

    // …and still there after a fresh request (same cookie → same kernel).
    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("delete removes a row", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByText("Hello Fakebase").first()).toBeVisible();
    // Delete buttons are icon-only with an aria-label.
    await page.getByRole("button", { name: "Delete post" }).first().click();
    await page.reload();
    // The first seeded post (newest) was "Swapping to real Supabase"; deleting
    // the first row removes it, leaving "Hello Fakebase".
    await expect(page.getByText("Swapping to real Supabase")).toHaveCount(0);
  });

  test("sign up establishes a session", async ({ page }) => {
    await page.goto("/playground");
    const email = `e2e+${Date.now()}@test.dev`;

    const signUp = page.locator("form", { hasText: "Sign up" });
    await signUp.getByPlaceholder("you@example.com").fill(email);
    await signUp.getByPlaceholder("password").fill("secret123");
    await signUp.getByRole("button", { name: /auth\.signUp/i }).click();

    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  });
});
