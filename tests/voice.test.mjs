import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/index.mjs";
import {
  createVoiceService,
  VOICE_DEFAULTS,
  validateVoice,
  audioType,
} from "../server/voice.mjs";
import { wav, audioUpload } from "./audio-fixture.mjs";
import { renderMessage } from "../shared/messages.mjs";
const welcome =
  "home.eu-sunt-cavalerul-miau-paznicul-cadoului-tau-am-o-sabie-mica-si-m";
async function fixture(t, provider) {
  const dir = mkdtempSync(join(tmpdir(), "kitty-voice-")),
    accountsPath = join(dir, "accounts.json"),
    secrets = join(dir, "voice-secrets.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        displayName: "Admin",
        password: "voice-admin-password",
      },
      {
        id: "birthday",
        role: "player",
        username: "birthday",
        displayName: "Invitată",
        password: "voice-player-password",
      },
    ]),
  );
  const options = {
    dataDir: dir,
    accountsPath,
    voiceEnv: {},
    voiceSecretsPath: secrets,
    voiceFetch:
      provider ||
      (() => {
        throw Error("Unexpected provider call");
      }),
  };
  let app, base;
  async function start() {
    app = createApp(options);
    await new Promise((r) => app.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + app.address().port;
  }
  await start();
  t.after(async () => {
    await new Promise((r) => app.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  const raw = (path, { cookie, body, method = "GET", headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body && !Buffer.isBuffer(body)
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body),
    });
  async function req(path, opts) {
    const response = await raw(path, opts);
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const a = (
      await req("/api/login", {
        method: "POST",
        body: { username: "admin", password: "voice-admin-password" },
      })
    ).cookie,
    p = (
      await req("/api/login", {
        method: "POST",
        body: { username: "birthday", password: "voice-player-password" },
      })
    ).cookie;
  return {
    req,
    raw,
    a,
    p,
    secrets,
    restart: async () => {
      await new Promise((r) => app.close(r));
      await start();
    },
  };
}
test("audio privat: roluri, upload, asociere exactă, range, înlocuire, editare și persistență", async (t) => {
  const f = await fixture(t),
    { req, raw, a, p } = f,
    bytes = wav(),
    text = renderMessage({}, welcome),
    metadata = { label: "Salut", text, sourceKey: welcome };
  assert.deepEqual((await req("/api/voice/config")).data, {
    mode: "recordings",
    pitch: 1.2,
    rate: 0.95,
    aiReady: false,
  });
  assert.equal(
    (
      await req("/api/voice/resolve", {
        method: "POST",
        body: { message: text },
      })
    ).status,
    401,
  );
  for (const [path, method, body] of [
    ["/api/admin/voice", "GET"],
    ["/api/admin/voice", "PUT", { settings: VOICE_DEFAULTS }],
    ["/api/admin/voice/clips", "POST", audioUpload(bytes, metadata)],
    ["/api/admin/voice/generate", "POST", metadata],
    ["/api/admin/voice/cache", "DELETE"],
    ["/api/admin/voice/voices", "GET"],
  ])
    assert.equal(
      (await req(path, { cookie: p, method, body })).status,
      403,
      path,
    );
  const resolve = (message = text) =>
    req("/api/voice/resolve", {
      cookie: p,
      method: "POST",
      body: { title: "Miau", message, detail: "Detalii" },
    });
  assert.equal((await resolve()).data.kind, "browser");
  const uploaded = await req("/api/admin/voice/clips", {
    cookie: a,
    method: "POST",
    body: audioUpload(bytes, metadata),
  });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.clips.length, 1);
  const url = uploaded.data.clips[0].url;
  assert.equal((await raw(url)).status, 401);
  assert.equal(
    (await req("/api/journey", { cookie: p })).data.puzzleUnlocked,
    false,
  );
  assert.equal(
    (await resolve(" " + text.replaceAll(" ", "  ") + " ")).data.url,
    url,
    "normalizes whitespace; locked player can hear welcome",
  );
  assert.equal((await resolve("Alt text")).data.kind, "browser");
  const audio = await raw(url, { cookie: p });
  assert.equal(audio.headers.get("content-type"), "audio/wav");
  assert.match(audio.headers.get("cache-control"), /private/);
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), bytes);
  const head = await raw(url, { cookie: p, method: "HEAD" });
  assert.equal(head.headers.get("content-length"), String(bytes.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const range of ["bytes=0-12", "bytes=-13"]) {
    const r = await raw(url, { cookie: p, headers: { Range: range } });
    assert.equal(r.status, 206);
    assert.equal((await r.arrayBuffer()).byteLength, 13);
    assert.match(r.headers.get("content-range"), /^bytes /);
  }
  assert.equal(
    (await raw(url, { cookie: p, headers: { Range: "bytes=900000-" } })).status,
    416,
  );
  assert.equal(
    (
      await raw("/api/voice/files/00000000-0000-0000-0000-000000000000.wav", {
        cookie: p,
      })
    ).status,
    404,
  );
  for (const body of [
    Buffer.from("bad"),
    audioUpload(Buffer.alloc(100), metadata),
    audioUpload(bytes, { ...metadata, text: "Salut {recipient}" }),
    audioUpload(bytes, { ...metadata, sourceKey: "toString" }),
  ])
    assert.equal(
      (await req("/api/admin/voice/clips", { cookie: a, method: "POST", body }))
        .status,
      400,
    );
  await req("/api/admin/messages", {
    cookie: a,
    method: "PUT",
    body: { messages: { [welcome]: "Salut nou!" } },
  });
  assert.equal(
    (await req("/api/admin/voice", { cookie: a })).data.clips[0].stale,
    true,
  );
  assert.equal((await resolve("Salut nou!")).data.kind, "browser");
  const replacement = await req("/api/admin/voice/clips", {
    cookie: a,
    method: "POST",
    body: audioUpload(wav(1), metadata),
  });
  assert.equal(replacement.data.clips.length, 1);
  assert.notEqual(replacement.data.clips[0].url, url);
  assert.equal((await raw(url, { cookie: p })).status, 404);
  const saved = replacement.data.clips[0];
  await f.restart();
  assert.equal((await resolve()).data.url, saved.url);
  assert.equal(
    (
      await req("/api/admin/voice/clips/" + saved.id, {
        cookie: a,
        method: "DELETE",
      })
    ).status,
    200,
  );
  assert.equal((await raw(saved.url, { cookie: p })).status, 404);
});
test("generare: secret local, catalog voci, cache comun, deduplicare, erori și replici păstrate", async (t) => {
  const calls = [],
    fakeKey = "fixture-only-not-a-real-key";
  let failure = 0;
  const provider = async (url, opts) => {
    calls.push({ url, opts });
    assert.equal(opts.headers["xi-api-key"], fakeKey);
    assert.equal(opts.redirect, "error");
    if (url.includes("/v2/voices"))
      return Response.json({
        voices: [
          {
            voice_id: "knight_voice",
            name: "Cavaler",
            category: "cloned",
            preview_url: "https://ignored.example",
          },
        ],
        has_more: true,
        next_page_token: "next-test",
      });
    await new Promise((r) => setTimeout(r, 20));
    return failure
      ? new Response("provider details " + fakeKey, { status: failure })
      : new Response(wav(), { headers: { "Content-Type": "audio/wav" } });
  };
  const f = await fixture(t, provider),
    { req, a, p } = f;
  const settings = { ...VOICE_DEFAULTS, mode: "ai", voiceId: "knight_voice" };
  const config = await req("/api/admin/voice", {
    cookie: a,
    method: "PUT",
    body: { settings, apiKey: fakeKey },
  });
  assert.equal(config.status, 200);
  assert.equal(config.data.keyReady, true);
  assert.equal(JSON.stringify(config.data).includes(fakeKey), false);
  assert.equal(
    JSON.parse(readFileSync(f.secrets, "utf8")).elevenLabsApiKey,
    fakeKey,
  );
  assert.equal((await req("/api/voice/config")).data.aiReady, true);
  assert.equal(
    (await req("/api/admin/voice/voices", { cookie: a })).data.voices[0].id,
    "knight_voice",
  );
  assert.ok(
    !(
      "preview_url" in
      (await req("/api/admin/voice/voices?page=next-test", { cookie: a })).data
        .voices[0]
    ),
  );
  assert.match(calls.at(-1).url, /next_page_token=next-test/);
  const speak = (cookie, message) =>
    req("/api/voice/resolve", {
      cookie,
      method: "POST",
      body: { title: "Sir Miau", message, detail: "Detaliu" },
    });
  const results = await Promise.all([
    speak(a, "Indiciu cu numărul 3."),
    speak(p, "Indiciu cu numărul 3."),
  ]);
  assert.equal(results[0].status, 200);
  assert.equal(results[0].data.url, results[1].data.url);
  assert.equal(calls.filter((c) => c.opts.method === "POST").length, 1);
  assert.equal((await speak(p, "Indiciu cu numărul 3.")).data.cached, true);
  const request = JSON.parse(calls.at(-1).opts.body);
  assert.equal(request.model_id, "eleven_multilingual_v2");
  assert.equal(request.language_code, undefined);
  assert.equal(request.text, "Sir Miau. Indiciu cu numărul 3.. Detaliu");
  assert.match(
    calls.at(-1).url,
    /text-to-speech\/knight_voice\?output_format=mp3_44100_128/,
  );
  await f.restart();
  assert.equal((await speak(p, "Indiciu cu numărul 3.")).data.cached, true);
  failure = 401;
  const err = await speak(p, "Text nou după eroare");
  assert.equal(err.status, 409);
  assert.equal(JSON.stringify(err.data).includes(fakeKey), false);
  failure = 429;
  assert.equal((await speak(p, "Încă o replică")).status, 429);
  failure = 0;
  await req("/api/admin/voice", {
    cookie: a,
    method: "PUT",
    body: { settings: { ...settings, mode: "recordings" } },
  });
  const generated = await req("/api/admin/voice/generate", {
    cookie: a,
    method: "POST",
    body: { label: "Bravo", text: "Bravo, cavalerule!" },
  });
  assert.equal(generated.status, 201);
  const clip = generated.data.clips[0];
  assert.equal((await speak(p, "Bravo, cavalerule!")).data.kind, "recording");
  await req("/api/admin/voice/cache", { cookie: a, method: "DELETE" });
  assert.equal((await f.raw(results[0].data.url, { cookie: p })).status, 404);
  assert.equal((await f.raw(clip.url, { cookie: p })).status, 200);
  assert.equal(
    (
      await req("/api/admin/voice", {
        cookie: a,
        method: "PUT",
        body: { settings, clearKey: true },
      })
    ).data.keyReady,
    false,
  );
  assert.equal((await speak(p, "Fără cheie")).status, 409);
});
test("voce: limită zilnică, cache gratuit, configurare și prioritatea cheii din mediu", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-voice-budget-")),
    db = new DatabaseSync(":memory:");
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  let calls = 0;
  const service = createVoiceService(db, {
    dataDir: dir,
    secretsPath: join(dir, "secret.json"),
    env: { ELEVENLABS_API_KEY: "environment-test" },
    fetchImpl: async () => {
      calls++;
      return new Response(wav(), { headers: { "Content-Type": "audio/wav" } });
    },
  });
  const settings = {
    ...VOICE_DEFAULTS,
    mode: "ai",
    voiceId: "voice_one",
    dailyLimit: 100,
  };
  service.saveConfig({ settings });
  assert.equal(service.adminConfig().keySource, "environment");
  assert.throws(
    () => service.saveConfig({ settings, apiKey: "replacement" }),
    /mediul/,
  );
  const message = "O".repeat(60);
  await service.resolveSpeech({ message }, "admin");
  await service.resolveSpeech({ message }, "birthday");
  assert.equal(calls, 1);
  assert.equal(service.adminConfig().usage.characters, 60);
  await assert.rejects(
    () => service.resolveSpeech({ message: "Z".repeat(60) }, "birthday"),
    (e) => e.status === 429,
  );
  assert.equal(calls, 1);
  assert.equal(service.adminConfig().usage.characters, 60);
  for (const invalid of [
    { mode: "bad" },
    { voiceId: "../../evil" },
    { modelId: "wrong" },
    { rate: 4 },
    { pitch: NaN },
    { dailyLimit: 100.5 },
    { style: -1 },
  ])
    assert.throws(
      () => validateVoice({ ...VOICE_DEFAULTS, ...invalid }),
      (e) => e.status === 400,
    );
  assert.deepEqual(audioType(wav()), { ext: "wav", mime: "audio/wav" });
  assert.throws(
    () => audioType(Buffer.alloc(64)),
    (e) => e.status === 400,
  );
});
