import assert from "node:assert/strict";
import { join } from "node:path";
import { wav } from "../tests/audio-fixture.mjs";
export async function checkVoiceAdmin(page, out, overflow) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Vocea", exact: true }).click();
  await page.getByRole("heading", { name: "Un miau care se aude." }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Generează și păstrează replica" })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Numele înregistrării", { exact: true })
    .fill("Salutul nostru");
  await page.getByLabel("Încarcă audio", { exact: true }).setInputFiles({
    name: "salut.wav",
    mimeType: "audio/wav",
    buffer: wav(5),
  });
  await page.getByRole("heading", { name: "Replicile păstrate · 1" }).waitFor();
  const preview = page.locator(".voice-preview");
  await preview.locator("audio").evaluate((e) => {
    e.muted = true;
  });
  await preview
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .click();
  await preview.locator(".is-talking").waitFor();
  assert.match(
    await preview.locator("audio").getAttribute("src"),
    /^\/api\/voice\/files\/.*\.wav$/,
  );
  await preview
    .getByRole("button", { name: "Oprește vocea cavalerului" })
    .click();
  assert.equal(await preview.locator("audio").evaluate((e) => e.paused), true);
  // A mobile browser may refuse playback after an asynchronous generation request.
  await page.evaluate(() => {
    window.__realAudioPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(
        new DOMException("User gesture required", "NotAllowedError"),
      );
    };
  });
  await preview
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .click();
  await preview
    .getByText("Audio-ul este pregătit. Apasă redare în player.")
    .waitFor();
  await preview.locator("audio[controls]").waitFor();
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = window.__realAudioPlay;
  });
  await preview.locator("audio").evaluate((e) => e.play());
  await preview.locator(".is-talking").waitFor();
  await preview
    .getByRole("button", { name: "Oprește vocea cavalerului" })
    .click();
  // Bad settings retain the key draft so the administrator can fix the mistake.
  await page
    .getByLabel("Cheia API ElevenLabs", { exact: true })
    .fill("fixture-only-browser-key");
  await page.getByLabel("Voice ID", { exact: true }).fill("../../invalid");
  await page
    .getByRole("button", { name: "Salvează vocea", exact: true })
    .click();
  await page
    .getByText("Verifică modul, identificatorul vocii și modelul.")
    .waitFor();
  assert.equal(
    await page.getByLabel("Cheia API ElevenLabs", { exact: true }).inputValue(),
    "fixture-only-browser-key",
  );
  await page.getByLabel("Voice ID", { exact: true }).fill("knight_test");
  await page.getByLabel("Modul vocii", { exact: true }).selectOption("ai");
  await page
    .getByRole("button", { name: "Salvează vocea", exact: true })
    .click();
  await page
    .getByText("Cheia este salvată local și nu este returnată în browser.")
    .waitFor();
  assert.equal(
    await page.getByLabel("Cheia API ElevenLabs", { exact: true }).inputValue(),
    "",
  );
  const adminData = await page.evaluate(() =>
    fetch("/api/admin/voice").then((r) => r.json()),
  );
  assert.equal(
    JSON.stringify(adminData).includes("fixture-only-browser-key"),
    false,
  );
  await page.getByRole("button", { name: "Încarcă vocile din cont" }).click();
  await page.getByLabel("Alege o voce", { exact: true }).waitFor();
  await page.getByLabel("Replica audio", { exact: true }).selectOption("");
  await page
    .getByLabel("Numele înregistrării", { exact: true })
    .fill("Vocea pentru indicii");
  await page
    .getByLabel("Textul exact al replicii", { exact: true })
    .fill("Indiciul nou: numărul este 3.");
  await preview.locator("audio").evaluate((e) => {
    e.muted = true;
  });
  await preview
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .click();
  await preview.locator(".is-talking").waitFor();
  await preview.getByText("Voce generată cu AI", { exact: true }).waitFor();
  await preview
    .getByRole("button", { name: "Oprește vocea cavalerului" })
    .click();
  const cached = await page.evaluate(() =>
    fetch("/api/admin/voice").then((r) => r.json()),
  );
  assert.ok(cached.cacheCount >= 1);
  await preview
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .click();
  await preview.locator(".is-talking").waitFor();
  await preview
    .getByRole("button", { name: "Oprește vocea cavalerului" })
    .click();
  assert.equal(
    (await page.evaluate(() => fetch("/api/admin/voice").then((r) => r.json())))
      .usage.characters,
    cached.usage.characters,
  );
  await page
    .getByRole("button", { name: "Generează și păstrează replica" })
    .click();
  await page.getByRole("heading", { name: "Replicile păstrate · 2" }).waitFor();
  await page.getByRole("button", { name: "Golește cache-ul audio" }).click();
  await page
    .getByRole("heading", { name: "Replici generate în cache · 0" })
    .waitFor();
  // Persist local recordings and restore free playback for the birthday account.
  await page
    .getByLabel("Modul vocii", { exact: true })
    .selectOption("recordings");
  await page.getByLabel("Tonalitate", { exact: true }).fill("1.25");
  await page.getByLabel("Viteză", { exact: true }).fill("1");
  await page.getByLabel("Șterge cheia salvată la următoarea salvare").check();
  await page
    .getByRole("button", { name: "Salvează vocea", exact: true })
    .click();
  await page
    .getByText("Poți folosi înregistrările fără cheie API.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Replica audio", { exact: true })
    .selectOption(
      "home.eu-sunt-cavalerul-miau-paznicul-cadoului-tau-am-o-sabie-mica-si-m",
    );
  await page.locator(".toast-guide").waitFor({ state: "hidden" });
  await page.screenshot({
    path: join(out, "18-voice-admin-desktop.png"),
    fullPage: true,
  });
  await overflow();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(out, "19-voice-admin-mobile.png"),
    fullPage: true,
  });
  await overflow();
  await page.reload();
  await page.getByRole("button", { name: "Atelier", exact: true }).click();
  await page.getByRole("tab", { name: "Vocea", exact: true }).click();
  await page.getByRole("heading", { name: "Replicile păstrate · 2" }).waitFor();
  assert.equal(
    await page.getByLabel("Modul vocii", { exact: true }).inputValue(),
    "recordings",
  );
}
export async function checkVoicePlayer(page) {
  const guide = page.locator(".welcome-guide");
  // Uploaded audio works without a Romanian OS voice or the Web Speech API.
  await page.evaluate(() => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });
  await guide.locator("audio").evaluate((e) => {
    e.muted = true;
  });
  await guide
    .getByRole("button", { name: "Ascultă mesajul cavalerului" })
    .click();
  await page.locator(".welcome-guide.is-talking").waitFor();
  assert.match(
    await guide.locator("audio").getAttribute("src"),
    /^\/api\/voice\/files\//,
  );
  await page.getByRole("button", { name: "Matrici", exact: true }).click();
  assert.equal(
    await page.locator("audio").evaluateAll((es) => es.every((e) => e.paused)),
    true,
    "navigation stops guide playback",
  );
}
