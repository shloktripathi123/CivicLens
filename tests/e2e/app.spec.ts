import { expect, test } from "@playwright/test";

const official = "11111111-1111-4111-8111-111111111111";
const candidate = "22222222-2222-4222-8222-222222222222";

test("main navigation and representative detail pages render", async ({ page }) => {
  const pages = [
    ["/", "Who represents you"],
    ["/people", "People"],
    ["/races", "Races"],
    ["/elections", "Elections and voting"],
    ["/places", "Browse by state"],
    ["/bills", "Bills"],
    ["/rubric", "How sources are graded"],
    ["/coverage", "Coverage"],
    ["/exclusions", "What Civic Lens never shows"],
    [`/people/${official}`, "Taylor Example"],
    [`/candidates/${candidate}`, "Jordan Example"],
    ["/races/state-race", "State Senator"],
    ["/bills/example-bill", "HB 1000"],
    ["/places/state%3AOR", "Oregon"],
    ["/places/county%3A41001", "Example County"],
    ["/government/example-gov", "Example County"],
    ["/sources/congress-legislators", "Test records"],
  ];
  for (const [url, heading] of pages) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
    await expect(page.getByRole("heading", { name: heading, level: 1 }), url).toBeVisible();
    await expect(page.getByText("Application error: a client-side exception")).toHaveCount(0);
  }
  for (const url of ["/people/not-an-id", "/candidates/not-an-id", "/races/missing", "/bills/missing", "/places/missing", "/government/missing", "/sources/missing"]) {
    expect((await page.goto(url))?.status(), url).toBe(404);
  }
});

test("search, state filters and candidate links reflect real records", async ({ page, request }) => {
  const response = await request.get("http://127.0.0.1:41941/v1/search?q=Example&level=state");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.results.map((person: { name: string }) => person.name).sort()).toEqual(["Jordan Example", "Taylor Example"]);

  await page.goto("/people");
  await page.getByLabel("Search for a person by name").fill("Example");
  await expect(page.getByRole("link", { name: /Jordan Example/ })).toBeVisible();
  await page.getByLabel("Level").selectOption("state");
  await expect(page.getByRole("link", { name: /Morgan Example/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Jordan Example/ })).toBeVisible();
  await page.getByLabel("Status").selectOption("candidate");
  await expect(page.getByRole("link", { name: /Taylor Example/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Jordan Example/ }).click();
  await expect(page.getByRole("heading", { name: "Jordan Example", level: 1 })).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Search by name or place").fill("Oregon");
  await expect(page.getByRole("link", { name: /Oregon.*State/ })).toBeVisible();
});

test("race, bill, election and place navigation", async ({ page }) => {
  await page.goto("/races");
  await page.getByLabel("State (e.g. OR)").fill("OR");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("link", { name: /State Senator/ }).click();
  await page.getByRole("link", { name: /Jordan Example/ }).click();
  await expect(page.getByRole("heading", { name: "Jordan Example" })).toBeVisible();

  await page.goto("/bills");
  await page.getByLabel("Search bills").fill("Example");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("link", { name: /HB 1000/ }).click();
  await expect(page.getByText("A test bill.")).toBeVisible();

  await page.goto("/elections");
  await page.getByLabel("State (e.g. OR)").fill("OR");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByRole("link", { name: /State Senator/ })).toBeVisible();

  await page.goto("/places");
  await page.getByRole("link", { name: "Oregon", exact: true }).click();
  await page.getByRole("link", { name: "Example County", exact: true }).click();
  await page.getByRole("link", { name: /Example County/ }).last().click();
  await expect(page.getByText("Alex Example")).toBeVisible();
});

test("coverage links only to sources present in the database", async ({ page }) => {
  await page.goto("/rubric");
  await page.getByRole("link", { name: "Coverage and available sources" }).click();
  await expect(page.getByRole("link", { name: "Test records" })).toBeVisible();
  await expect(page.locator('a[href="/sources/census-geography"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Test records" }).click();
  await expect(page.getByRole("heading", { name: "Test records" })).toBeVisible();
});

test("credibility dialog handles success and service errors", async ({ page }) => {
  await page.goto(`/people/${official}`);
  const badge = page.getByRole("button", { name: /Source credibility/ }).first();
  await page.route("**/v1/sources/congress-legislators", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await badge.click();
  await expect(page.getByRole("dialog").getByText("Could not load the grading details.")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.unrouteAll();
  await badge.click();
  await expect(page.getByRole("dialog").getByText("Test records")).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Source details" }).click();
  await expect(page.getByRole("heading", { name: "Test records" })).toBeVisible();
});

test("correction reports succeed and network failures are shown", async ({ page }) => {
  await page.goto("/exclusions");
  await page.getByLabel("Page or item ID or address").fill("test-target");
  await page.getByRole("combobox", { name: "Type" }).selectOption("factual-error");
  await page.getByLabel("What is wrong").fill("A test correction.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toContainText("received");
  await page.route("**/v1/reports", (route) => route.abort());
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toContainText("unavailable");
});

test("search reports an unavailable place service rather than no matches", async ({ page }) => {
  await page.goto("/");
  await page.route("**/v1/places/search?*", (route) => route.abort());
  await page.getByLabel("Search by name or place").fill("Oregon");
  await expect(page.getByText("Place search is temporarily unavailable")).toBeVisible();
  await expect(page.getByText("Nothing matches")).toHaveCount(0);
});

test("an excluded-information report hides the submitted page address", async ({ page, request }) => {
  await page.goto("/exclusions");
  await page.getByLabel("Page or item ID or address").fill(`/candidates/${candidate}`);
  await page.getByLabel("What is wrong").fill("Please review this test record.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toContainText("hidden until reviewed");
  const detail = await request.get(`http://127.0.0.1:41941/v1/candidates/${candidate}`);
  expect(detail.status()).toBe(451);
  const search = await request.get("http://127.0.0.1:41941/v1/search?q=Jordan");
  expect((await search.json()).results).toEqual([]);
});
