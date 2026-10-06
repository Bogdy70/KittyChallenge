import { checkPuzzleSorting } from "./puzzle-sorting-browser-check.mjs";
import { checkVoiceAdmin, checkVoicePlayer } from "./voice-browser-check.mjs";
import { wav } from "../tests/audio-fixture.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../server/index.mjs";
import { solve } from "../server/math.mjs";
const dir = mkdtempSync(join(tmpdir(), "kitty-browser-"));
const accountsPath = join(dir, "accounts.json");
writeFileSync(
  accountsPath,
  JSON.stringify([
    {
      id: "admin",
      role: "admin",
      username: "admin",
      displayName: "Organizatorul",
      password: "browser-admin-password",
    },
    {
      id: "birthday",
      role: "player",
      username: "sarbatorita",
      displayName: "Sărbătorita",
      password: "browser-player-password",
    },
  ]),
);
const server = createApp({
  dataDir: dir,
  accountsPath,
  voiceSecretsPath: join(dir, "voice-secrets.json"),
  voiceEnv: {},
  voiceFetch: async (url) =>
    url.includes("/v2/voices")
      ? Response.json({
          voices: [
            { voice_id: "knight_test", name: "Cavaler test", category: "test" },
          ],
          has_more: false,
        })
      : new Response(wav(5), { headers: { "Content-Type": "audio/wav" } }),
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
});
const out = resolve("artifacts");
mkdirSync(out, { recursive: true });
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const overflow = async () => {
    const details = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      items: [...document.querySelectorAll("main *")]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 2)
        .map((e) => ({
          tag: e.tagName,
          cls: typeof e.className === "string" ? e.className : "svg",
          right: Math.round(e.getBoundingClientRect().right),
        }))
        .slice(0, 15),
    }));
    assert.ok(details.scroll <= details.width + 2, JSON.stringify(details));
  };
  await page.goto(base);
  await page.getByRole("heading", { name: "Hei, sărbătorito!" }).waitFor();
  await page.screenshot({
    path: join(out, "01-login-desktop.png"),
    fullPage: true,
  });
  await overflow();
  await page.getByLabel("Nume de utilizator").fill("sarbatorita");
  await page
    .getByLabel("Parolă", { exact: true })
    .fill("browser-player-password");
  await page.getByRole("button", { name: "Să înceapă surpriza" }).click();
  await page
    .getByRole("heading", { name: "Două provocări. O zi specială." })
    .waitFor();
  await page.screenshot({
    path: join(out, "02-home-desktop.png"),
    fullPage: true,
  });
  await overflow();
  assert.equal(
    await page.getByRole("button", { name: "Atelier", exact: true }).count(),
    0,
  );
  // Exercise both voice paths without depending on installed voices or playing audio.
  await page.evaluate(() => {
    window.__realSpeech = Object.getOwnPropertyDescriptor(
      window,
      "speechSynthesis",
    );
    window.__realUtterance = Object.getOwnPropertyDescriptor(
      window,
      "SpeechSynthesisUtterance",
    );
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel() {},
        speak() {
          throw new Error("Should not speak without a Romanian voice");
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .first()
    .click();
  await page.getByText(/Vocea română nu este instalată/).waitFor();
  await page.evaluate(() => {
    window.__voiceCalls = [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(text) {
          this.text = text;
        }
      },
    });
    window.speechSynthesis.getVoices = () => [{ lang: "ro-RO" }];
    window.speechSynthesis.speak = (line) => {
      window.__voiceCalls.push({ text: line.text, lang: line.lang });
      line.onstart();
    };
    window.speechSynthesis.cancel = () =>
      window.__voiceCalls.push({ cancel: true });
  });
  await page
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .first()
    .click();
  await page.getByRole("button", { name: "Oprește vocea cavalerului" }).click();
  const voiceCalls = await page.evaluate(() => window.__voiceCalls);
  assert.ok(
    voiceCalls.some((x) => x.lang === "ro-RO" && x.text.includes("sabie mică")),
  );
  assert.equal(voiceCalls.at(-1).cancel, true);
  await page.evaluate(() => {
    Object.defineProperty(window, "speechSynthesis", window.__realSpeech);
    Object.defineProperty(
      window,
      "SpeechSynthesisUtterance",
      window.__realUtterance,
    );
  });
  await page.getByRole("link", { name: "Sari la conținut" }).focus();
  await page.getByRole("link", { name: "Sari la conținut" }).press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "main-content",
  );
  assert.equal(new URL(page.url()).hash, "#home");
  await page.getByRole("button", { name: "Puzzle", exact: true }).click();
  await page
    .getByText("Puzzle-ul își păstrează încă secretul.", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".puzzle-board").count(), 0);
  assert.equal(
    await page.evaluate(() => fetch("/api/puzzle").then((r) => r.status)),
    403,
  );
  await page
    .getByRole("button", { name: "Mai întâi, matricile", exact: true })
    .click();
  await page.getByRole("heading", { name: "Încălzirea mustăților" }).waitFor();
  await page.getByRole("button", { name: "Un indiciu", exact: true }).click();
  await page.getByText("O șoaptă de la pisicuță").waitFor();
  await page.screenshot({
    path: join(out, "03-math-desktop.png"),
    fullPage: true,
  });
  await overflow();
  const run = await page.evaluate(() =>
    fetch("/api/math").then((r) => r.json()),
  );
  for (const cell of await page.locator(".answer-section input").all())
    await cell.fill("999");
  await page.getByRole("button", { name: "Verifică răspunsul" }).click();
  await page.getByText("Nu-i nimic, curajoaso!", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Arată soluția" }).click();
  await page.getByText("Desfacem misterul împreună.").waitFor();
  assert.ok(await page.locator(".solution-box").isVisible());
  for (let n = 0; n < run.exercises.length; n++) {
    const e = run.exercises[n];
    await page.locator(".exercise-nav").nth(n).click();
    await page.getByRole("heading", { name: e.title, exact: true }).waitFor();
    const result = solve(e);
    for (let i = 0; i < result.length; i++)
      for (let j = 0; j < result[i].length; j++)
        await page
          .getByLabel(`Rezultat, rândul ${i + 1}, coloana ${j + 1}`, {
            exact: true,
          })
          .fill(result[i][j]);
    await page.getByRole("button", { name: "Verifică răspunsul" }).click();
    await page.getByText("Purrfect! Ai găsit răspunsul.").waitFor();
  }
  await page
    .getByRole("heading", { name: "Minte sclipitoare, misiune îndeplinită!" })
    .waitFor();
  await page.getByRole("button", { name: "Spre puzzle", exact: true }).click();
  await page.locator(".piece-tray h3").waitFor();
  await page
    .getByRole("button", { name: "Alege piesa 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Locul 1, 2", exact: true }).click();
  await page.getByText("Încă puțin, mica mea aventurieră!").waitFor();
  await page.getByRole("button", { name: "Indiciu", exact: true }).click();
  await page.getByText(/Piesa aleasă merge pe rândul 1, coloana 1/).waitFor();
  await page.getByRole("button", { name: "Locul 1, 1", exact: true }).click();
  await page.getByText("Progres salvat. Pisicuța are grijă de el.").waitFor();
  await page.locator(".toast-guide").waitFor({ state: "hidden" });
  await page.screenshot({
    path: join(out, "04-puzzle-desktop.png"),
    fullPage: true,
  });
  await overflow();
  await page.reload();
  await page
    .getByRole("button", { name: "Locul 1, 1, completat", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Ecran complet", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Tabla puzzle-ului" }).waitFor();
  const fullscreenLayout = await page.evaluate(() => {
    const w = document.querySelector(".puzzle-focus"),
      tray = w.querySelector(".piece-tray").getBoundingClientRect(),
      board = w.querySelector(".puzzle-scroll").getBoundingClientRect();
    return {
      native: document.fullscreenElement === w,
      width: innerWidth,
      height: innerHeight,
      tray: {
        left: tray.left,
        right: tray.right,
        top: tray.top,
        bottom: tray.bottom,
      },
      board: {
        left: board.left,
        right: board.right,
        top: board.top,
        bottom: board.bottom,
      },
    };
  });
  assert.equal(fullscreenLayout.native, true, "desktop uses native fullscreen");
  assert.ok(fullscreenLayout.tray.left >= fullscreenLayout.board.right - 1);
  assert.ok(fullscreenLayout.tray.bottom <= fullscreenLayout.height + 1);
  await page.screenshot({
    path: join(out, "14-puzzle-fullscreen-desktop.png"),
  });
  for (let z = 0; z < 8; z++)
    await page.getByRole("button", { name: "Mărește puzzle-ul" }).click();
  const dockBefore = await page.locator(".piece-tray").boundingBox();
  await page.locator(".puzzle-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.scrollLeft = el.scrollWidth;
  });
  assert.deepEqual(
    await page.locator(".piece-tray").boundingBox(),
    dockBefore,
    "dock stays reachable while board pans",
  );
  await page.getByRole("button", { name: "Potrivește pe ecran" }).click();
  const source = await page
    .getByRole("button", { name: "Alege piesa 2", exact: true })
    .boundingBox();
  const target = await page
    .getByRole("button", { name: "Locul 1, 2", exact: true })
    .boundingBox();
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Locul 1, 2, completat", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".puzzle-focus").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  assert.equal(
    await page.evaluate(() => document.querySelector(".app-header").inert),
    false,
  );
  const puzzleData = await page.evaluate(() =>
    fetch("/api/puzzle").then((r) => r.json()),
  );
  for (let i = 2; i < 10; i++) {
    const piece = page.getByRole("button", {
      name: `Alege piesa ${i + 1}`,
      exact: true,
    });
    await piece.focus();
    await piece.press("Enter");
    const slot = page.getByRole("button", {
      name: `Locul ${Math.floor(i / puzzleData.cols) + 1}, ${(i % puzzleData.cols) + 1}`,
      exact: true,
    });
    await slot.focus();
    await slot.press("Enter");
  }
  await page
    .getByRole("heading", { name: "Ce frumos se leagă lucrurile!" })
    .waitFor();
  await page.getByText("Progres salvat. Pisicuța are grijă de el.").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Acasă", exact: true }).click();
  await page
    .getByRole("heading", { name: "Două provocări. O zi specială." })
    .waitFor();
  await page.locator(".toast-guide").waitFor({ state: "hidden" });
  await page.screenshot({
    path: join(out, "05-home-mobile.png"),
    fullPage: true,
  });
  await overflow();
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
  await page.getByRole("heading", { name: "Încălzirea mustăților" }).waitFor();
  await page.screenshot({
    path: join(out, "06-math-mobile.png"),
    fullPage: true,
  });
  await overflow();
  await page.getByRole("button", { name: "Puzzle", exact: true }).click();
  await page.locator(".piece-tray h3").waitFor();
  await page.screenshot({
    path: join(out, "07-puzzle-mobile.png"),
    fullPage: true,
  });
  await overflow();
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    storageState: await context.storageState(),
  });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  phone.on("dialog", (d) => d.accept());
  await phone.addInitScript(() => {
    let element = null;
    window.__rotationAttempts = 0;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => element,
    });
    Element.prototype.requestFullscreen = async function () {
      element = this;
      document.dispatchEvent(new Event("fullscreenchange"));
    };
    document.exitFullscreen = async () => {
      element = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    };
    screen.orientation.lock = async () => {
      window.__rotationAttempts++;
      throw new Error("Device denied orientation lock");
    };
    screen.orientation.unlock = () => {};
  });
  await phone.goto(base + "/#puzzle");
  await phone
    .getByRole("button", { name: "De la început", exact: true })
    .click();
  await phone
    .getByRole("button", { name: "Alege piesa 1", exact: true })
    .waitFor();
  await phone.getByRole("button", { name: "Ecran complet", exact: true }).tap();
  await phone.getByRole("dialog").waitFor();
  assert.equal(
    await phone.evaluate(() => window.__rotationAttempts),
    1,
    "phone tries landscape when browser permits fullscreen",
  );
  await phone.getByRole("button", { name: "Alege piesa 1", exact: true }).tap();
  await phone.getByRole("button", { name: "Indiciu", exact: true }).tap();
  await phone.getByText("Rândul 1 · Coloana 1", { exact: true }).waitFor();
  await phone.getByRole("button", { name: "Locul 1, 1", exact: true }).tap();
  await phone
    .getByRole("button", { name: "Locul 1, 1, completat", exact: true })
    .waitFor();
  await phone.screenshot({ path: join(out, "15-puzzle-fullscreen-phone.png") });
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await phone.screenshot({
    path: join(out, "16-puzzle-fullscreen-landscape.png"),
  });
  const landscape = await phone.evaluate(() => {
    const tray = document.querySelector(".piece-tray").getBoundingClientRect(),
      board = document.querySelector(".puzzle-scroll").getBoundingClientRect();
    return {
      right: tray.right,
      bottom: tray.bottom,
      left: tray.left,
      boardRight: board.right,
      w: innerWidth,
      h: innerHeight,
    };
  });
  assert.ok(
    landscape.left >= landscape.boardRight - 1 &&
      landscape.right <= landscape.w + 1 &&
      landscape.bottom <= landscape.h + 1,
    JSON.stringify(landscape),
  );
  await phone
    .getByRole("button", { name: "Ieși din ecran complet", exact: true })
    .tap();
  await phone.locator(".puzzle-focus").waitFor({ state: "detached" });
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.evaluate(() => {
    Element.prototype.requestFullscreen = undefined;
  });
  await phone.getByRole("button", { name: "Ecran complet", exact: true }).tap();
  await phone.getByRole("dialog").waitFor();
  assert.equal(
    await phone.evaluate(() => document.fullscreenElement),
    null,
    "CSS focus mode survives absent fullscreen API",
  );
  await phone
    .getByRole("button", { name: "Ieși din ecran complet", exact: true })
    .tap();
  await phone.locator(".puzzle-focus").waitFor({ state: "detached" });
  assert.equal(await phone.evaluate(() => document.body.style.overflow), "");
  await phoneContext.close();
  await page.getByRole("button", { name: "Ieși din cont" }).click();
  await page.getByRole("heading", { name: "Hei, sărbătorito!" }).waitFor();
  await page.screenshot({
    path: join(out, "08-login-mobile.png"),
    fullPage: true,
  });
  await overflow();
  await page.getByLabel("Nume de utilizator").fill("admin");
  await page
    .getByLabel("Parolă", { exact: true })
    .fill("browser-admin-password");
  await page.getByRole("button", { name: "Să înceapă surpriza" }).click();
  await page.getByRole("button", { name: "Atelier", exact: true }).click();
  await page
    .getByRole("heading", { name: "O petrecere pe numele ei." })
    .waitFor();
  await overflow();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: join(out, "09-admin-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Nivelul de dificultate").selectOption("spicy");
  await page.getByRole("radio", { name: /500/ }).check();
  await page.getByRole("button", { name: "Salvează surpriza" }).click();
  await page.getByText("Surpriza a fost actualizată.").waitFor();
  const picture = await page.locator(".admin-photo img").screenshot();
  await page.locator("input[type=file]").setInputFiles({
    name: "amintire.png",
    mimeType: "image/png",
    buffer: picture,
  });
  await page.getByText("Fotografia a devenit un puzzle!").waitFor();
  await page.getByRole("tab", { name: "Exercițiile" }).click();
  await page.getByLabel("Titlul exercițiului").fill("Exercițiul nostru");
  await page.getByRole("button", { name: "Adaugă exercițiul" }).click();
  await page.getByText("Exercițiul nostru", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
  await page.getByRole("button", { name: "Vreau un set nou" }).click();
  await page.getByText("Super pisică", { exact: true }).waitFor();
  assert.equal(await page.locator(".exercise-nav").count(), 10);
  await page.getByRole("button", { name: "Puzzle", exact: true }).click();
  await page.locator(".piece-tray h3").waitFor();
  assert.equal(await page.locator(".puzzle-slot").count(), 500);
  assert.equal(await page.locator(".tray-piece").count(), 24);
  await overflow();
  await page.getByRole("button", { name: "Mai multe piese" }).click();
  await page.getByText("Cutia 2 din 21").waitFor();
  const largePhoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    storageState: await context.storageState(),
  });
  const largePhone = await largePhoneContext.newPage();
  largePhone.on("pageerror", (e) => errors.push(e.message));
  await largePhone.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined;
  });
  await largePhone.goto(base + "/#puzzle");
  await largePhone
    .getByRole("button", { name: "Ecran complet", exact: true })
    .tap();
  await largePhone.getByRole("dialog").waitFor();
  await largePhone
    .getByRole("button", { name: "Mai multe piese", exact: true })
    .tap();
  await largePhone.getByText("Cutia 2 din 21").waitFor();
  const lastVisible = largePhone.locator(".tray-piece").last();
  await lastVisible.scrollIntoViewIfNeeded();
  await lastVisible.tap();
  for (let z = 0; z < 8; z++)
    await largePhone.getByRole("button", { name: "Mărește puzzle-ul" }).tap();
  await largePhone.getByRole("button", { name: "Indiciu", exact: true }).tap();
  const reachable = await largePhone.evaluate(() => {
    const dock = document.querySelector(".piece-tray").getBoundingClientRect(),
      grid = document.querySelector(".tray-grid"),
      slot = document.querySelector(".hint-slot").getBoundingClientRect(),
      view = document.querySelector(".puzzle-scroll").getBoundingClientRect();
    return {
      dockBottom: dock.bottom,
      h: innerHeight,
      gridH: grid.clientHeight,
      gridScrollH: grid.scrollHeight,
      visible:
        slot.left >= view.left - 1 &&
        slot.right <= view.right + 1 &&
        slot.top >= view.top - 1 &&
        slot.bottom <= view.bottom + 1,
    };
  });
  assert.ok(
    reachable.dockBottom <= reachable.h + 1 &&
      reachable.gridH >= reachable.gridScrollH - 2 &&
      reachable.visible,
    JSON.stringify(reachable),
  );
  await largePhone.screenshot({ path: join(out, "17-puzzle-500-phone.png") });
  await largePhone
    .getByRole("button", { name: "Ieși din ecran complet", exact: true })
    .tap();
  await largePhoneContext.close();
  await page.locator(".toast-guide").waitFor({ state: "hidden" });
  await page.screenshot({
    path: join(out, "10-puzzle-500.png"),
    fullPage: true,
  });
  // Preview with motion enabled, and verify the reduced-motion preference still works.
  await page.getByRole("button", { name: "Acasă", exact: true }).click();
  await page
    .getByRole("heading", { name: "Două provocări. O zi specială." })
    .waitFor();
  assert.equal(
    await page
      .locator(".aurora-pink")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.notEqual(
    await page
      .locator(".aurora-pink")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.screenshot({
    path: join(out, "11-home-animated.png"),
    fullPage: true,
  });
  await overflow();
  // Admin copy editing, import/export, literal HTML, and persisted player-facing copy.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Atelier", exact: true }).click();
  await page.getByRole("tab", { name: "Exercițiile" }).click();
  await page
    .getByRole("button", { name: "Editează textele: Exercițiul nostru" })
    .click();
  await page
    .getByLabel("Indiciul acestei provocări")
    .fill("Un indiciu nou, doar pentru noi.");
  await page
    .getByRole("button", { name: "Salvează titlul și indiciul" })
    .click();
  await page
    .getByText("Un indiciu nou, doar pentru noi.", { exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Textele", exact: true }).click();
  await page.getByRole("heading", { name: "Vocea petrecerii." }).waitFor();
  await page
    .getByLabel("Numele ghidului", { exact: true })
    .fill("Sir Mustăcilă");
  await page.getByLabel("Categoria", { exact: true }).selectOption("hints");
  await page
    .locator('[id="copy-hint.add"]')
    .fill("Două lăbuțe adună fiecare pereche de căsuțe.");
  await page.getByLabel("Categoria", { exact: true }).selectOption("math");
  await page
    .locator('[id="copy-math.correct"]')
    .fill("Victorie! {guide} e mândru de tine. <b>Bravo!</b>");
  assert.equal(
    await page.locator(".editor-guide .guide-dialogue b").count(),
    0,
    "message HTML is rendered as text",
  );
  await page.getByLabel("Categoria", { exact: true }).selectOption("login");
  await page.locator('[id="copy-login.hei-sarbatorito"]').fill("Hei, Luna");
  await page
    .getByRole("button", { name: "Salvează textele", exact: true })
    .click();
  await page
    .getByText("Textele au fost salvate. Cavalerul și-a învățat replicile noi!")
    .waitFor();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportă textele" }).click();
  const download = await downloadWait,
    stream = await download.createReadStream(),
    parts = [];
  for await (const chunk of stream) parts.push(chunk);
  const exported = JSON.parse(Buffer.concat(parts).toString());
  assert.equal(exported.messages["guide.name"], "Sir Mustăcilă");
  exported.messages["exercise.title.0"] = "Prima misiune a Lunei";
  await page.getByLabel("Importă texte JSON", { exact: true }).setInputFiles({
    name: "mesaje.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.getByLabel("Categoria", { exact: true }).selectOption("guide");
  await page
    .getByRole("button", { name: "Salvează textele", exact: true })
    .click();
  await page.getByText("Toate textele sunt salvate", { exact: true }).waitFor();
  await page.locator(".toast-guide").waitFor({ state: "hidden" });
  await page.screenshot({
    path: join(out, "12-text-editor-desktop.png"),
    fullPage: true,
  });
  await overflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(out, "13-text-editor-mobile.png"),
    fullPage: true,
  });
  await overflow();
  await page.getByLabel("Caută un text", { exact: true }).fill("Vocea română");
  assert.equal(await page.locator(".message-field").count(), 1);
  await checkVoiceAdmin(page, out, overflow);
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
  await page.getByRole("heading", { name: "Prima misiune a Lunei" }).waitFor();
  await page.getByRole("button", { name: "Un indiciu", exact: true }).click();
  await page
    .getByText("Două lăbuțe adună fiecare pereche de căsuțe.", { exact: true })
    .waitFor();
  const updatedRun = await page.evaluate(() =>
    fetch("/api/math").then((r) => r.json()),
  );
  const expected = solve(updatedRun.exercises[0]);
  for (let i = 0; i < expected.length; i++)
    for (let j = 0; j < expected[i].length; j++)
      await page
        .getByLabel("Rezultat, rândul " + (i + 1) + ", coloana " + (j + 1), {
          exact: true,
        })
        .fill(expected[i][j]);
  await page.getByRole("button", { name: "Verifică răspunsul" }).click();
  await page
    .getByText("Victorie! Sir Mustăcilă e mândru de tine. <b>Bravo!</b>", {
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
  await page.locator(".exercise-nav").first().waitFor();
  const persistedCopyRun = await page.evaluate(() =>
    fetch("/api/math").then((r) => r.json()),
  );
  assert.equal(persistedCopyRun.exercises[0].solved, true);
  await page.locator(".exercise-nav").first().click();
  await page.getByRole("heading", { name: "Prima misiune a Lunei" }).waitFor();
  await page.getByRole("button", { name: "Ieși din cont" }).click();
  await page.getByRole("heading", { name: "Hei, Luna!" }).waitFor();
  await page.getByLabel("Nume de utilizator").fill("sarbatorita");
  await page
    .getByLabel("Parolă", { exact: true })
    .fill("browser-player-password");
  await page.getByRole("button", { name: "Să înceapă surpriza" }).click();
  await page
    .locator(".welcome-guide")
    .getByText(/Eu sunt Sir Mustăcilă/)
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Atelier", exact: true }).count(),
    0,
  );
  await checkVoicePlayer(page);
  await checkPuzzleSorting(browser, base, out, errors);
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "Browser checks passed: login, matrix completion, hints, puzzle placement/persistence, mobile layouts, admin settings/photo/exercise, 500 pieces, editable messages and JSON import/export, gated journey, native fullscreen, mobile touch and landscape/fallback, recorded/generated voice, cache and mobile audio fallback, fullscreen guide audio, persistent per-account sorting, shapes/colors, custom boxes, mouse drag and touch.",
  );
} catch (e) {
  if (page)
    await page
      .screenshot({ path: join(out, "failure.png"), fullPage: true })
      .catch(() => {});
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
}
