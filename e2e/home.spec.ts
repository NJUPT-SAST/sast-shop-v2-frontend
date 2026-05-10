import { expect, test } from "@playwright/test"

test("home renders the SAST Shop hero", async ({ page }) => {
  await page.goto("/")
  // Either greeting (logged in) or generic title is the first H1.
  await expect(page.getByRole("heading", { name: /好物在校园里流转|欢迎回来/ })).toBeVisible()
})

test("home shows quick category chips", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "二手集市" })).toBeVisible()
  await expect(page.getByRole("link", { name: "投票众筹" })).toBeVisible()
  await expect(page.getByRole("link", { name: "预售周边" })).toBeVisible()
})

test("home links navigate to /secondhand and /crowdfund", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "二手集市" }).click()
  await expect(page).toHaveURL(/\/secondhand/)
  await page.goBack()
  await page.getByRole("link", { name: "投票众筹" }).click()
  await expect(page).toHaveURL(/\/crowdfund/)
})
