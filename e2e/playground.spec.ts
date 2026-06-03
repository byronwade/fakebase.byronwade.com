import { test, expect } from "@playwright/test";

// Each test gets a fresh browser context → fresh fb_pg cookie → freshly seeded
// per-visitor sandbox. The playground is a tabbed studio: Browse is the default
// tab; mutations and auth live behind their own tabs.

test.describe("Playground — live kernel", () => {
  test("renders the seeded posts from a live read", async ({ page }) => {
    await page.goto("/playground");
    // Browse is the default tab — the posts table renders during SSR.
    await expect(page.getByText("Hello Fakebase").first()).toBeVisible();
    await expect(page.getByText("Swapping to real Supabase").first()).toBeVisible();
  });

  test("insert persists across the action + a reload (write → revalidate → read)", async ({
    page,
  }) => {
    await page.goto("/playground");
    await page.getByRole("tab", { name: "Mutate" }).click();

    const title = `E2E Post ${Date.now()}`;
    await page.getByPlaceholder("Post title").fill(title);
    await page.getByPlaceholder("Write something…").fill("created by an e2e test");
    await page.getByRole("button", { name: /insert post/i }).click();

    // Visible after the action's revalidate (the Mutate tab's post list updates)…
    await expect(page.getByText(title).first()).toBeVisible();

    // …and still there after a fresh request (same cookie → same kernel). The
    // reload resets to the Browse tab, where the posts table includes it.
    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("delete removes a row", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("tab", { name: "Mutate" }).click();

    const deleteButtons = page.getByRole("button", { name: "Delete post" });
    const before = await deleteButtons.count();
    expect(before).toBeGreaterThan(0);

    await deleteButtons.first().click();

    await page.reload();
    await page.getByRole("tab", { name: "Mutate" }).click();
    await expect(page.getByRole("button", { name: "Delete post" })).toHaveCount(
      before - 1,
    );
  });

  test("sign up establishes a session", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("tab", { name: "Auth" }).click();

    const email = `e2e+${Date.now()}@test.dev`;
    const signUp = page.locator("form", { hasText: "Sign up" });
    await signUp.getByPlaceholder("you@example.com").fill(email);
    await signUp.getByPlaceholder("password").fill("secret123");
    await signUp.getByRole("button", { name: /auth\.signUp/i }).click();

    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  });
});
