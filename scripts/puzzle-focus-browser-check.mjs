import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkPuzzleFocus(browser, base, out, errors) {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  let page;
  const tab = (p, kind) => p.locator('[data-focus-tab="' + kind + '"]');
  const tray = (p) => p.locator(".piece-tray");
  const tools = (p) => p.locator(".puzzle-toolbar");
  async function frame(p) {
    const r = await p.locator(".puzzle-scroll").boundingBox();
    const size = await p.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      r.x <= 2 &&
        r.y <= 2 &&
        r.width >= size.width - 4 &&
        r.height >= size.height - 4,
      JSON.stringify({ r, size }),
    );
    assert.ok(size.scroll <= size.width + 2, JSON.stringify(size));
    return r;
  }
  async function panelBounds(p, locator) {
    const r = await locator.boundingBox();
    const s = await p.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    assert.ok(
      r.x >= 0 &&
        r.y >= 0 &&
        r.x + r.width <= s.w + 1 &&
        r.y + r.height <= s.h + 1,
      JSON.stringify({ r, s }),
    );
    const grid = (await locator.locator(".tray-grid").count())
      ? await locator.locator(".tray-grid").boundingBox()
      : null;
    if (grid) assert.ok(grid.height > 45, JSON.stringify(grid));
  }
  async function login(context, username, password) {
    const r = await context.request.post(base + "/api/login", {
      data: { username, password },
    });
    assert.equal(r.status(), 200);
    const initial = await (
      await context.request.get(base + "/api/puzzle")
    ).json();
    await context.request.post(base + "/api/puzzle/restart", {
      data: { version: initial.version },
    });
  }
  try {
    await login(desktop, "admin", "browser-admin-password");
    const voice = await (
      await desktop.request.get(base + "/api/admin/voice")
    ).json();
    await desktop.request.put(base + "/api/admin/voice", {
      data: {
        settings: { ...voice.settings, mode: "ai", voiceId: "knight_test" },
        apiKey: "fixture-only-browser-key",
      },
    });
    page = await desktop.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#puzzle");
    await page
      .getByRole("button", { name: "Doar puzzle-ul", exact: true })
      .click();
    await page.locator(".puzzle-immersive").waitFor();
    assert.equal(
      await page.evaluate(() =>
        document.fullscreenElement?.classList.contains("puzzle-immersive"),
      ),
      true,
    );
    const board = await frame(page);
    assert.equal(await tray(page).isVisible(), false);
    assert.equal(await tools(page).isVisible(), false);
    assert.equal(await page.locator(".puzzle-status").isVisible(), false);
    await page.screenshot({ path: join(out, "24-puzzle-focus-desktop.png") });
    await tab(page, "pieces").click();
    await panelBounds(page, tray(page));
    assert.deepEqual(
      await frame(page),
      board,
      "opening tray keeps the board size",
    );
    const firstPiece = tray(page).locator(".tray-piece").first();
    const index =
      Number((await firstPiece.getAttribute("aria-label")).match(/\d+/)[0]) - 1;
    await firstPiece.click();
    assert.equal(await tray(page).isVisible(), false);
    assert.equal(await page.locator(".focus-selected").isVisible(), true);
    await tab(page, "tools").click();
    await panelBounds(page, tools(page));
    await page
      .getByRole("button", { name: "Vezi modelul", exact: true })
      .click();
    await page.getByRole("button", { name: "Indiciu", exact: true }).click();
    await tools(page)
      .getByRole("button", { name: "Retrage panoul", exact: true })
      .click();
    assert.equal(await page.locator(".hint-slot").count(), 1);
    await page.locator(".puzzle-slot").nth(index).click();
    await page.locator(".puzzle-slot.placed").waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".live-dot.saving"),
    );
    await tab(page, "pieces").click();
    const dragPiece = tray(page).locator(".tray-piece").first();
    const dragIndex =
      Number((await dragPiece.getAttribute("aria-label")).match(/\d+/)[0]) - 1;
    const source = await dragPiece.boundingBox();
    const target = await page
      .locator(".puzzle-slot")
      .nth(dragIndex)
      .boundingBox();
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(source.x - 25, source.y + source.height / 2, {
      steps: 3,
    });
    assert.equal(
      await tray(page).isVisible(),
      false,
      "drag frees the board from the tray",
    );
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelectorAll(".puzzle-slot.placed").length === 2,
    );
    await tab(page, "guide").click();
    const guide = page.locator(".puzzle-guide");
    await guide.locator("audio").evaluate((e) => (e.muted = true));
    await guide
      .getByRole("button", { name: "Ascultă mesajul cavalerului" })
      .click();
    await page.locator(".puzzle-guide.is-talking").waitFor();
    await guide
      .getByRole("button", { name: "Oprește vocea cavalerului" })
      .click();
    await tab(page, "guide").click();
    assert.equal(await guide.count(), 0, "closed guide unmounts its audio");
    await tab(page, "pieces").click();
    await tray(page)
      .getByRole("button", { name: "Deschide cutiile de sortare", exact: true })
      .click();
    await page.locator(".puzzle-sorter").waitFor();
    assert.equal(await page.locator(".focus-tabs").count(), 0);
    await page.locator(".sort-heading .button").click();
    assert.equal(await tray(page).isVisible(), true);
    await tray(page)
      .getByLabel("Categoria pieselor din cutie", { exact: true })
      .selectOption("corners");
    assert.ok((await tray(page).locator(".tray-piece").count()) <= 4);
    await tab(page, "tools").click();
    await page
      .getByRole("button", { name: "Fullscreen cu panouri fixe", exact: true })
      .click();
    assert.equal(await page.locator(".puzzle-immersive").count(), 0);
    assert.equal(await page.locator(".puzzle-focus").count(), 1);
    assert.equal(await tray(page).isVisible(), true);
    await page
      .getByRole("button", { name: "Doar puzzle-ul", exact: true })
      .click();
    await page.locator(".focus-exit").click();
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    await page.reload();
    await page.locator(".puzzle-slot.placed").first().waitFor();
    assert.equal(await page.locator(".puzzle-slot.placed").count(), 2);

    await login(phone, "sarbatorita", "browser-player-password");
    await phone.addInitScript(() => {
      Element.prototype.requestFullscreen = undefined;
    });
    page = await phone.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/#puzzle");
    await page
      .getByRole("button", { name: "Doar puzzle-ul", exact: true })
      .tap();
    await page.locator(".puzzle-immersive").waitFor();
    await frame(page);
    await page.screenshot({ path: join(out, "25-puzzle-focus-phone.png") });
    await tab(page, "pieces").tap();
    await panelBounds(page, tray(page));
    await page.screenshot({
      path: join(out, "26-puzzle-focus-phone-tray.png"),
    });
    const mobilePiece = tray(page).locator(".tray-piece").first();
    const mobileIndex =
      Number((await mobilePiece.getAttribute("aria-label")).match(/\d+/)[0]) -
      1;
    await mobilePiece.tap();
    assert.equal(await tray(page).isVisible(), false);
    await page.locator(".puzzle-slot").nth(mobileIndex).tap();
    await page.locator(".puzzle-slot.placed").waitFor();
    await tab(page, "tools").tap();
    await panelBounds(page, tools(page));
    await page.keyboard.press("Escape");
    assert.equal(await tools(page).isVisible(), false);
    assert.equal(
      await page.locator(".puzzle-focus").count(),
      1,
      "first escape only closes a fallback drawer",
    );
    await tab(page, "guide").tap();
    const mobileGuide = page.locator(".puzzle-guide");
    await mobileGuide.locator("audio").evaluate((e) => (e.muted = true));
    await mobileGuide
      .getByRole("button", { name: "Ascultă mesajul cavalerului" })
      .tap();
    await page.locator(".puzzle-guide.is-talking").waitFor();
    await tab(page, "guide").tap();
    assert.equal(await mobileGuide.count(), 0);
    await page.setViewportSize({ width: 844, height: 390 });
    await frame(page);
    await tab(page, "pieces").tap();
    await panelBounds(page, tray(page));
    await page.screenshot({ path: join(out, "27-puzzle-focus-landscape.png") });
    await tab(page, "tools").tap();
    await panelBounds(page, tools(page));
    await tools(page)
      .getByRole("button", { name: "Retrage panoul", exact: true })
      .tap();
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        document
          .querySelector(".puzzle-focus")
          .contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".puzzle-focus").count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.equal(
      await page.evaluate(() => document.querySelector(".app-header").inert),
      false,
    );
    await page.reload();
    await page.locator(".puzzle-slot.placed").first().waitFor();
    assert.equal(await page.locator(".puzzle-slot.placed").count(), 1);
  } catch (e) {
    if (page)
      await page
        .screenshot({ path: join(out, "focus-failure.png") })
        .catch(() => {});
    throw e;
  } finally {
    await desktop.close();
    await phone.close();
  }
}
