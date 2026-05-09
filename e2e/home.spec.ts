import { expect, test } from "@playwright/test"

test("home page renders the main heading", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: /to get started, edit the page\.tsx file/i })
  ).toBeVisible()
})

test("home page has Deploy Now and Documentation links", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: /deploy now/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /documentation/i })).toBeVisible()
})
