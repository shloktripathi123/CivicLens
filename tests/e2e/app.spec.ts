import { expect, test } from "@playwright/test";

const official = "11111111-1111-4111-8111-111111111111";
const candidate = "22222222-2222-4222-8222-222222222222";

test("state voting page links to state-specific resources and marks unavailable dates", async ({ page }) => {
  await page.goto("/elections?state=CA");
  await expect(page.getByRole("link", { name: "Voter registration information (Vote.gov)" })).toHaveAttribute("href", "https://vote.gov/register/california");
  await expect(page.getByRole("link", { name: "State voting guide (U.S. Election Assistance Commission)" })).toHaveAttribute("href", /field_state_target_id=18176$/);
  await expect(page.getByText(/Registration deadlines except any listed below: not in our data/)).toBeVisible();
  await page.goto("/elections?state=ND");
  await expect(page.getByRole("link", { name: "Voter registration information (Vote.gov)" })).toHaveAttribute("href", "https://vote.gov/register/north-dakota");
  await page.goto("/elections?state=XX");
  await expect(page.getByRole("alert").filter({ hasText: "valid 2-letter state or territory code" })).toBeVisible();
});

test("Oregon voting dates distinguish the mailing range from unknown drop-site openings", async ({ page }) => {
  await page.goto("/elections?state=OR");
  const mailing = page.locator("ul.windows > li").filter({ has: page.getByText("Ballots mailed to voters:", { exact: true }) });
  await expect(mailing).toContainText("2099-10-14 to 2099-10-20");
  await expect(mailing).toContainText("Different timelines apply");
  const dropSite = page.locator("ul.windows > li").filter({ has: page.getByText("Drop boxes open:", { exact: true }) });
  await expect(dropSite).toContainText("Date not available");
  await expect(dropSite).not.toContainText("No request needed");
  const request = page.locator("ul.windows > li").filter({ has: page.getByText("Mail-in ballot request window:", { exact: true }) });
  await expect(request).toContainText("No request needed");
});

test("bills without cleared titles link to their source without duplicating the number", async ({ page }) => {
  await page.goto("/bills?state=CA&q=AB%2099");
  await expect(page.getByRole("link", { name: /AB 99 — AB 99/ })).toHaveCount(0);
  await page.getByRole("link", { name: /AB 99/ }).click();
  await expect(page.getByText("Title not available here; see the source.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View the bill at its source" })).toHaveAttribute("href", "https://example.test/source-bill");
});

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
});

test("missing records show a useful not-found page", async ({ page }) => {
  for (const url of ["/people/not-an-id", "/candidates/not-an-id", "/races/missing", "/bills/missing", "/places/missing", "/government/missing", "/sources/missing"]) {
    expect((await page.goto(url))?.status(), url).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" }), url).toBeVisible();
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

test("office type and body filters include candidates and state officials", async ({ page }) => {
  await page.goto("/people");
  await page.getByLabel("Search for a person by name").fill("Example");
  await page.getByLabel("Office type").selectOption("senate");
  await expect(page.getByRole("status")).toHaveText("3 results");
  await expect(page.getByRole("link", { name: /Taylor Example/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Jordan Example/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Morgan Example/ })).toBeVisible();
  await page.getByLabel("Office type").selectOption("governor");
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search for a person by name")).toHaveValue("Example");
  await expect(page.getByRole("link", { name: /Taylor Example/ })).toBeVisible();
});

test("clearing a search removes its pagination and results", async ({ page }) => {
  await page.route("**/v1/search?*", (route) => route.fulfill({
    json: { results: [], total: 25, nextCursor: "MjA" },
  }));
  await page.goto("/people");
  const search = page.getByLabel("Search for a person by name");
  await search.fill("Example");
  await expect(page.getByRole("button", { name: "Show more" })).toBeVisible();
  await search.clear();
  await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);
  await expect(page.getByRole("status")).toBeEmpty();
});

test("a delayed earlier search cannot replace newer results", async ({ page }) => {
  let releaseOld!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  let oldStarted!: () => void;
  const started = new Promise<void>((resolve) => { oldStarted = resolve; });
  await page.route("**/v1/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "old") {
      oldStarted();
      await oldResponse;
    }
    await route.fulfill({ json: { results: [], total: query === "old" ? 7 : 0, nextCursor: null } });
  });
  await page.goto("/people");
  const search = page.getByLabel("Search for a person by name");
  await search.fill("old");
  await started;
  await search.fill("new");
  await expect(page.getByText("Nothing matches “new”")).toBeVisible();
  const oldFinished = page.waitForResponse((response) => new URL(response.url()).searchParams.get("q") === "old");
  releaseOld();
  await oldFinished;
  await expect(page.getByText("Nothing matches “new”")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("0 results");
});

test("invalid race filters explain the input rather than suggesting an outage", async ({ page }) => {
  await page.goto("/races?year=not-a-year");
  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid" })).toBeVisible();
});

test("service errors give recovery options without reporting zero bills", async ({ page }) => {
  await page.goto("/bills?q=service-unavailable");
  await expect(page.getByRole("alert").filter({ hasText: "Bills are temporarily unavailable" })).toBeVisible();
  await expect(page.getByText("0 bills.")).toHaveCount(0);

  await page.goto("/races/service-unavailable");
  await expect(page.getByRole("heading", { name: "Page temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("link", { name: "Return to search" }).click();
  await expect(page.getByRole("heading", { name: "Who represents you" })).toBeVisible();
});

test("race, bill, election and place navigation", async ({ page }) => {
  await page.goto("/races");
  await page.getByLabel("State (e.g. OR)").fill("OR");
  await page.getByLabel("Office").fill("State Senator");
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
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await page.getByLabel("Filter OR 2099-11-03 offices").fill("State Senator");
  await expect(page.getByRole("link", { name: /State Senator/ })).toBeVisible();

  await page.goto("/places");
  await page.getByRole("link", { name: "Oregon", exact: true }).click();
  await page.getByRole("link", { name: "Example County", exact: true }).click();
  await expect(page.getByText("Estimated population: 12,345", { exact: false })).toBeVisible();
  await expect(page.getByText("Land: 100.5 square miles", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Example County/ }).last().click();
  await expect(page.getByText("Alex Example")).toBeVisible();
});

test("bills can be filtered outside Oregon without claiming an unverified law status", async ({ page }) => {
  await page.goto("/bills");
  await page.getByLabel("State (e.g. OR)").fill("CA");
  await page.getByLabel("Search bills").fill("California example");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByRole("link", { name: /HB 1000/ })).toHaveCount(0);
  await page.getByRole("link", { name: /AB 20/ }).click();
  await expect(page.getByRole("heading", { name: "AB 20" })).toBeVisible();
  await expect(page.getByText("Law status not verified")).toBeVisible();
  await expect(page.getByText("Check the source to determine whether this measure became law.")).toBeVisible();
});

test("state profiles show when the source did not provide a term start", async ({ page }) => {
  await page.goto("/people/44444444-4444-4444-8444-444444444444");
  await expect(page.getByText("Start not provided")).toBeVisible();
});

test("coverage links only to sources present in the database", async ({ page }) => {
  await page.goto("/rubric");
  await page.getByRole("link", { name: "Coverage and available sources" }).click();
  await expect(page.getByRole("link", { name: "Test records" })).toBeVisible();
  await expect(page.locator('a[href="/sources/census-geography"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Test records" }).click();
  await expect(page.getByRole("heading", { name: "Test records" })).toBeVisible();
});

test("profiles explain gaps when voting records are unavailable", async ({ page }) => {
  await page.goto(`/people/${official}`);
  await page.locator("summary").filter({ hasText: "Floor votes" }).click();
  await expect(page.getByText(/No recorded history in our data for recorded floor votes/)).toBeVisible();
});

test("candidate and bill pages show sourced records without inventing votes or impacts", async ({ page, request }) => {
  const response = await request.get(`http://127.0.0.1:41941/v1/candidates/${candidate}`);
  const profile = await response.json();
  expect(profile.deep.sections.bills.items[0].title).toContain("HB 1000");
  expect(profile.deep.sections.bills.items[0].billId).toBe("example-bill");
  expect(profile.deep.sections.votes.status).toBe("none_recorded");
  await page.goto(`/candidates/${candidate}`);
  await expect(page.getByRole("link", { name: "HB 1000: Example public records bill" })).toHaveAttribute("href", "/bills/example-bill");
  await expect(page.getByText("Bills: partial")).toBeVisible();
  await expect(page.getByText(/Sponsorship does not by itself mean a bill passed/)).toBeVisible();
  await page.locator("summary").filter({ hasText: "Floor votes" }).click();
  await expect(page.getByText(/No recorded history in our data for recorded floor votes/)).toBeVisible();
  await page.goto("/bills/example-bill");
  await expect(page.getByRole("link", { name: "Jordan Example" })).toHaveAttribute("href", `/people/${candidate}`);
  await expect(page.getByText("Unmatched Sponsor")).toBeVisible();
  await expect(page.getByText(/do not necessarily|not necessarily its final effects/)).toBeVisible();
});

test("long lists can be filtered and expanded without losing results", async ({ page }) => {
  await page.goto("/places");
  await page.getByLabel("Filter states and territories").fill("Oregon");
  await expect(page.getByRole("link", { name: "Oregon", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "California", exact: true })).toHaveCount(0);

  await page.goto("/places/state%3AOR");
  await expect(page.getByRole("link", { name: "Research County 35" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show more counties" }).click();
  await expect(page.getByRole("link", { name: "Research County 35" })).toBeVisible();
  await page.getByLabel("Filter counties").fill("Research County 35");
  await expect(page.getByRole("link", { name: "Research County 35" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Research County 01" })).toHaveCount(0);
  await page.getByLabel("Filter counties").fill("no such county");
  await expect(page.getByText("No counties match this filter.")).toBeVisible();

  await page.goto("/places/county%3A41001");
  await page.getByLabel("Filter overlapping places").fill("97065");
  await expect(page.getByRole("link", { name: "ZIP 97065" })).toBeVisible();

  await page.goto("/races?state=OR&office=Research");
  await expect(page.getByRole("link", { name: /Research office 32/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Show more races" }).click();
  await expect(page.getByRole("link", { name: /Research office 32/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/races");

  await page.goto("/elections?state=OR");
  await page.getByLabel("Filter OR 2099-11-03 offices").fill("Research office 32");
  await expect(page.getByRole("link", { name: /Research office 32/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear state" })).toHaveAttribute("href", "/elections");

  await page.goto(`/candidates/${candidate}`);
  await page.getByLabel("Filter sponsored legislation records").fill("Research bill 12");
  await expect(page.getByRole("link", { name: "Research bill 12" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Research bill 01" })).toHaveCount(0);
});

test("long lists remain accessible without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/places/state%3AOR");
  await expect(page.getByRole("link", { name: "Research County 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Research County 35" })).toBeVisible();
  await context.close();
});

test("bill pagination preserves filters in both directions", async ({ page }) => {
  await page.goto("/bills?state=CA&q=Research");
  await expect(page.getByText("Showing 1–25 of 32 bills.")).toBeVisible();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByText("Showing 26–32 of 32 bills.")).toBeVisible();
  await expect(page.getByLabel("State (e.g. OR)")).toHaveValue("CA");
  await expect(page.getByLabel("Search bills")).toHaveValue("Research");
  await page.getByRole("link", { name: "Previous page" }).click();
  await expect(page.getByText("Showing 1–25 of 32 bills.")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByLabel("State (e.g. OR)")).toHaveValue("");
  await page.goto("/bills?offset=not-a-number");
  await expect(page.getByRole("alert").filter({ hasText: "Invalid page offset" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Invalid page offset" })).toHaveCount(0);
});

test("location filters work by keyboard on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/places/state%3AOR");
  await page.getByLabel("Filter counties").focus();
  await page.keyboard.type("Research County 35");
  await expect(page.getByRole("link", { name: "Research County 35" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Research County 01" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
