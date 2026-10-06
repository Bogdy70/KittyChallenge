import assert from "node:assert/strict";
import { join } from "node:path";
export async function checkPuzzleSorting(browser, base, out, errors) {
  const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
  let page;
  const sorting = async (p) =>
    p.evaluate(() => fetch("/api/puzzle").then((r) => r.json()));
  async function waitSaved(p) {
    await p.waitForFunction(
      () =>
        !document
          .querySelector(".sort-status")
          ?.textContent.includes("Salvăm cutiile tale…"),
    );
  }
  async function bounds(p) {
    const r = await p.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scroll: document.documentElement.scrollWidth,
      grid: (() => {
        const r = document
          .querySelector(".sort-piece-grid")
          .getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      })(),
    }));
    assert.ok(r.scroll <= r.width + 2, JSON.stringify(r));
    assert.ok(r.grid.height > 50, JSON.stringify(r));
    assert.ok(r.grid.bottom <= r.height + 1, JSON.stringify(r));
  }
  try {
    await desktopContext.request.post(base + "/api/login", {
      data: { username: "admin", password: "browser-admin-password" },
    });
    const initial = await (
      await desktopContext.request.get(base + "/api/puzzle")
    ).json();
    await desktopContext.request.post(base + "/api/puzzle/restart", {
      data: { version: initial.version },
    });
    const voice = await (
      await desktopContext.request.get(base + "/api/admin/voice")
    ).json();
    await desktopContext.request.put(base + "/api/admin/voice", {
      data: {
        settings: { ...voice.settings, mode: "ai", voiceId: "knight_test" },
        apiKey: "fixture-only-browser-key",
      },
    });
    page = await desktopContext.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(base + "/#puzzle");
    await page
      .getByRole("button", { name: "Ecran complet", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("button", { name: "Arată ghidul", exact: true })
      .click();
    const guide = page.locator(".puzzle-guide");
    await guide.locator("audio").evaluate((e) => {
      e.muted = true;
    });
    await guide
      .getByRole("button", { name: "Ascultă mesajul cavalerului" })
      .click();
    await page.locator(".puzzle-guide.is-talking").waitFor();
    assert.match(
      await guide.locator("audio").getAttribute("src"),
      /^\/api\/voice\/files\//,
    );
    await guide
      .getByRole("button", { name: "Oprește vocea cavalerului" })
      .click();
    await page.screenshot({
      path: join(out, "20-puzzle-fullscreen-companion.png"),
    });
    await page
      .getByRole("button", { name: "Sortează piesele", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Cutii pentru lăbuțe istețe." })
      .waitFor();
    assert.equal(
      await page.locator(".puzzle-guide").count(),
      0,
      "hidden guide unmounts while arranging",
    );
    await page
      .getByLabel("Numele categoriei", { exact: true })
      .fill("Blăniță aurie");
    await page
      .getByLabel("Culoarea categoriei", { exact: true })
      .fill("#ffcd50");
    await page.getByRole("button", { name: "Adaugă", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Selectează pentru sortare piesa 1",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Selectează pentru sortare piesa 2",
        exact: true,
      })
      .click();
    await page.getByText("2 piese selectate", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: "Mută selecția în Blăniță aurie",
        exact: true,
      })
      .click();
    await waitSaved(page);
    const custom = (await sorting(page)).sorting.groups.find(
      (g) => g.name === "Blăniță aurie",
    );
    assert.ok(custom);
    assert.equal((await sorting(page)).sorting.assignments[0], custom.id);
    assert.equal((await sorting(page)).sorting.assignments[1], custom.id);
    await page
      .getByRole("button", { name: "După contur", exact: true })
      .click();
    await page
      .getByText(
        "Colțurile, marginile și contururile asemănătoare au acum cutii.",
        { exact: true },
      )
      .waitFor();
    await waitSaved(page);
    const shaped = await sorting(page);
    assert.equal(Object.keys(shaped.sorting.assignments).length, shaped.count);
    assert.equal(
      Object.values(shaped.sorting.assignments).filter((id) => id === "corners")
        .length,
      4,
    );
    assert.deepEqual(shaped.placed, []);
    await page
      .getByRole("button", { name: "Anulează ultima sortare", exact: true })
      .click();
    await waitSaved(page);
    assert.equal(
      Object.keys((await sorting(page)).sorting.assignments).length,
      2,
    );
    const source = await page
        .getByRole("button", {
          name: "Selectează pentru sortare piesa 3",
          exact: true,
        })
        .boundingBox(),
      target = await page.locator("[data-sort-target=corners]").boundingBox();
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
    await page
      .getByText("1 piese mutate în „Colțuri”.", { exact: true })
      .waitFor();
    await waitSaved(page);
    assert.equal((await sorting(page)).sorting.assignments[2], "corners");
    await page
      .getByRole("button", {
        name: "Editează categoria Blăniță aurie",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Numele categoriei", { exact: true })
      .fill("Blăniță și lumină");
    await page.getByRole("button", { name: "Salvează", exact: true }).click();
    await waitSaved(page);
    assert.equal(
      (await sorting(page)).sorting.groups.find((g) => g.id === custom.id).name,
      "Blăniță și lumină",
    );
    await page
      .getByRole("button", {
        name: "Vezi categoria Blăniță și lumină",
        exact: true,
      })
      .click();
    assert.equal(await page.locator(".sort-piece").count(), 2);
    await page
      .getByRole("button", { name: "Selectează pagina", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mută selecția în Nesortate", exact: true })
      .click();
    await waitSaved(page);
    assert.equal((await sorting(page)).sorting.assignments[0], undefined);
    await page
      .getByRole("button", {
        name: "Șterge categoria Blăniță și lumină",
        exact: true,
      })
      .click();
    await waitSaved(page);
    assert.equal(
      (await sorting(page)).sorting.groups.some((g) => g.id === custom.id),
      false,
    );
    await page
      .getByRole("button", { name: "După culoare", exact: true })
      .click();
    await page
      .getByText(
        "Am grupat piesele după culoarea dominantă. Poți ajusta manual orice cutie.",
        { exact: true },
      )
      .waitFor();
    await waitSaved(page);
    const colored = await sorting(page);
    assert.equal(
      Object.keys(colored.sorting.assignments).length,
      colored.count,
    );
    assert.deepEqual(colored.placed, []);
    await bounds(page);
    await page.screenshot({ path: join(out, "21-puzzle-sorting-desktop.png") });
    await page
      .getByRole("button", { name: "Înapoi la puzzle", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ieși din ecran complet", exact: true })
      .click();
    await page.reload();
    await page.locator(".piece-tray h3").waitFor();
    assert.deepEqual((await sorting(page)).sorting, colored.sorting);
    const colorId = Object.values(colored.sorting.assignments)[0];
    await page
      .getByLabel("Categoria pieselor din cutie", { exact: true })
      .selectOption(colorId);
    assert.ok(await page.locator(".tray-piece").count());
    // A second window must not silently overwrite a category layout changed elsewhere.
    await page
      .getByRole("button", { name: "Sortează piesele", exact: true })
      .click();
    const latest = await sorting(page);
    await desktopContext.request.put(base + "/api/puzzle/sorting", {
      data: {
        version: latest.version,
        revision: latest.sortingRevision,
        sorting: latest.sorting,
      },
    });
    await page
      .getByLabel("Numele categoriei", { exact: true })
      .fill("Din altă fereastră");
    await page.getByRole("button", { name: "Adaugă", exact: true }).click();
    await page
      .getByRole("button", { name: "Reîncarcă sortarea", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Reîncarcă sortarea", exact: true })
      .click();
    await waitSaved(page);
    assert.equal(
      (await sorting(page)).sorting.groups.some(
        (g) => g.name === "Din altă fereastră",
      ),
      false,
    );
    // Both accounts can arrange, but the birthday account starts with its own empty boxes.
    await phoneContext.request.post(base + "/api/login", {
      data: { username: "sarbatorita", password: "browser-player-password" },
    });
    const p = await (
      await phoneContext.request.get(base + "/api/puzzle")
    ).json();
    assert.deepEqual(p.sorting.assignments, {});
    await phoneContext.request.post(base + "/api/puzzle/restart", {
      data: { version: p.version },
    });
    page = await phoneContext.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(base + "/#puzzle");
    await page
      .getByRole("button", { name: "Ecran complet", exact: true })
      .tap();
    await page.getByRole("button", { name: "Arată ghidul", exact: true }).tap();
    const mobileGuide = page.locator(".puzzle-guide");
    await mobileGuide.locator("audio").evaluate((e) => {
      e.muted = true;
    });
    await mobileGuide
      .getByRole("button", { name: "Ascultă mesajul cavalerului" })
      .tap();
    await page.locator(".puzzle-guide.is-talking").waitFor();
    await mobileGuide
      .getByRole("button", { name: "Oprește vocea cavalerului" })
      .tap();
    await page
      .getByRole("button", { name: "Sortează piesele", exact: true })
      .tap();
    await page
      .getByRole("button", {
        name: "Selectează pentru sortare piesa 1",
        exact: true,
      })
      .tap();
    await page
      .getByRole("button", {
        name: "Selectează pentru sortare piesa 2",
        exact: true,
      })
      .tap();
    await page
      .getByRole("button", { name: "Mută selecția în Colțuri", exact: true })
      .tap();
    await waitSaved(page);
    assert.equal((await sorting(page)).sorting.assignments[0], "corners");
    assert.notDeepEqual(
      (await sorting(page)).sorting.assignments,
      colored.sorting.assignments,
    );
    await page.getByRole("button", { name: "După contur", exact: true }).tap();
    await waitSaved(page);
    await page
      .getByRole("button", { name: "Vezi categoria Colțuri", exact: true })
      .tap();
    assert.equal(await page.locator(".sort-piece").count(), 4);
    await bounds(page);
    await page.screenshot({ path: join(out, "22-puzzle-sorting-phone.png") });
    await page.setViewportSize({ width: 844, height: 390 });
    await bounds(page);
    await page.screenshot({
      path: join(out, "23-puzzle-sorting-landscape.png"),
    });
    await page
      .getByRole("button", { name: "Înapoi la puzzle", exact: true })
      .tap();
    await page
      .getByLabel("Categoria pieselor din cutie", { exact: true })
      .selectOption("corners");
    assert.equal(await page.locator(".tray-piece").count(), 4);
    await page
      .getByRole("button", { name: "Alege piesa 1", exact: true })
      .tap();
    await page.getByRole("button", { name: "Locul 1, 1", exact: true }).tap();
    await page
      .getByRole("button", { name: "Locul 1, 1, completat", exact: true })
      .waitFor();
    assert.equal(await page.locator(".tray-piece").count(), 3);
    await page
      .getByRole("button", { name: "Ieși din ecran complet", exact: true })
      .tap();
    await page.reload();
    await page.locator(".piece-tray h3").waitFor();
    assert.equal((await sorting(page)).sorting.assignments[0], "corners");
    assert.ok((await sorting(page)).placed.includes(0));
  } catch (e) {
    if (page)
      await page
        .screenshot({ path: join(out, "sorting-failure.png"), fullPage: true })
        .catch(() => {});
    throw e;
  } finally {
    await phoneContext.close();
    await desktopContext.close();
  }
}
