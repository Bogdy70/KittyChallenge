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
const server = createApp({ dataDir: dir, accountsPath });
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
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
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
  await page.getByRole("button", { name: "Puzzle", exact: true }).click();
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
  await page.setViewportSize({ width: 1440, height: 1500 });
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
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "Browser checks passed: login, matrix completion, hints, puzzle placement/persistence, mobile layouts, admin settings/photo/exercise, 500 pieces.",
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
