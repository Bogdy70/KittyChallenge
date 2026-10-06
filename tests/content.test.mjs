import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MESSAGE_FIELDS,
  DEFAULT_MESSAGES,
  validateMessages,
  renderMessage,
} from "../shared/messages.mjs";
import { createApp } from "../server/index.mjs";
import { solve } from "../server/math.mjs";

test("catalogul validează variabilele și revine la implicit fără a executa HTML", () => {
  assert.equal(
    new Set(MESSAGE_FIELDS.map((f) => f.key)).size,
    MESSAGE_FIELDS.length,
  );
  assert.deepEqual(validateMessages(DEFAULT_MESSAGES), {});
  assert.equal(
    renderMessage(
      {
        "home.welcome.title": "Hei, {recipient}, te salută {guide}!",
        "guide.name": "Sir Miau",
      },
      "home.welcome.title",
      { recipient: "Luna" },
    ),
    "Hei, Luna, te salută Sir Miau!",
  );
  assert.equal(
    renderMessage({ "hint.add": "  " }, "hint.add"),
    DEFAULT_MESSAGES["hint.add"],
  );
  assert.equal(
    renderMessage(
      { "math.correct": '<img onerror="alert(1)">' },
      "math.correct",
    ),
    '<img onerror="alert(1)">',
  );
  for (const bad of [
    { unknown: "test" },
    { "hint.add": "{password}" },
    { "guide.name": 7 },
    { "guide.name": "x".repeat(81) },
    JSON.parse('{"__proto__":"test"}'),
    [],
  ])
    assert.throws(
      () => validateMessages(bad),
      (e) => e.status === 400,
    );
  const excessive = Object.fromEntries(
    MESSAGE_FIELDS.filter((f) => f.maxLength === 2000).map((f) => [
      f.key,
      "x".repeat(2000),
    ]),
  );
  assert.throws(
    () => validateMessages(excessive),
    (e) => e.status === 400 && e.message.includes("120 KB"),
  );
});

test("numai adminul schimbă textele; indicii, titluri și explicații se actualizează fără pierderea progresului", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-copy-")),
    accountsPath = join(dir, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        password: "test-admin-password",
        displayName: "Admin",
      },
      {
        id: "birthday",
        role: "player",
        username: "player",
        password: "test-player-password",
        displayName: "Player",
      },
    ]),
  );
  let server = createApp({ dataDir: dir, accountsPath });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  async function request(path, { cookie, method = "GET", body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  assert.deepEqual((await request("/api/content")).data, { messages: {} });
  assert.equal((await request("/api/admin/messages")).status, 401);
  const admin = (
    await request("/api/login", {
      method: "POST",
      body: { username: "admin", password: "test-admin-password" },
    })
  ).cookie;
  const player = (
    await request("/api/login", {
      method: "POST",
      body: { username: "player", password: "test-player-password" },
    })
  ).cookie;
  assert.equal(
    (
      await request("/api/admin/messages", {
        cookie: player,
        method: "PUT",
        body: { messages: { "hint.add": "No" } },
      })
    ).status,
    403,
  );
  const personal = (
    await request("/api/admin/exercises", {
      cookie: admin,
      method: "POST",
      body: {
        op: "add",
        title: "Provocare personală",
        hint: "Indiciul inițial",
        a: [
          [1, 2],
          [0, 1],
        ],
        b: [
          [0, 1],
          [1, 0],
        ],
      },
    })
  ).data;
  const run = (await request("/api/math", { cookie: player })).data,
    puzzle = (await request("/api/puzzle", { cookie: player })).data;
  await request("/api/puzzle/progress", {
    cookie: player,
    method: "PUT",
    body: { version: puzzle.version, placed: [0] },
  });
  assert.equal(
    (
      await request("/api/admin/exercises/" + personal.id, {
        cookie: player,
        method: "PATCH",
        body: { title: "Schimbat", hint: "Alt indiciu" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/exercises/" + personal.id, {
        cookie: admin,
        method: "PATCH",
        body: { title: "Schimbat", hint: "Alt indiciu", a: [[9]] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/admin/exercises/" + personal.id, {
        cookie: admin,
        method: "PATCH",
        body: { title: "Provocarea noastră", hint: "Indiciul nostru nou" },
      })
    ).status,
    200,
  );
  const personalRun = (await request("/api/math", { cookie: player })).data;
  assert.equal(personalRun.id, run.id);
  const currentPersonal = personalRun.exercises.find(
    (e) => e.id === personal.id,
  );
  assert.equal(currentPersonal.title, "Provocarea noastră");
  assert.deepEqual(currentPersonal.a, personal.a);
  assert.equal(
    (
      await request("/api/math/" + personal.id + "/hint", {
        cookie: player,
        method: "POST",
        body: { runId: run.id },
      })
    ).data.hint,
    "Indiciul nostru nou",
  );
  const messages = {
    "guide.name": "Sir Miau",
    "hint.add": "Adună fiecare pereche, miau!",
    "explanation.scale": "Înmulțește cu {scalar}.",
    "exercise.title.0": "Misiunea Lunei",
    "math.correct": "Bravo de la {guide}!",
    "login.invalid": "Secretul nu se potrivește.",
  };
  assert.equal(
    (
      await request("/api/admin/messages", {
        cookie: admin,
        method: "PUT",
        body: { messages },
      })
    ).status,
    200,
  );
  const updated = (await request("/api/math", { cookie: player })).data;
  assert.equal(updated.id, run.id);
  assert.equal(updated.exercises[0].title, "Misiunea Lunei");
  const h = await request(`/api/math/${run.exercises[0].id}/hint`, {
    cookie: player,
    method: "POST",
    body: { runId: run.id },
  });
  assert.equal(h.data.hint, messages["hint.add"]);
  const correct = await request(`/api/math/${run.exercises[0].id}/check`, {
    cookie: player,
    method: "POST",
    body: { runId: run.id, answer: solve(run.exercises[0]) },
  });
  assert.equal(correct.data.message, "Bravo de la Sir Miau!");
  assert.equal(correct.data.solved, 1);
  const scale = run.exercises.find((e) => e.op === "scale");
  const solution = await request(`/api/math/${scale.id}/solution`, {
    cookie: player,
    method: "POST",
    body: { runId: run.id },
  });
  assert.equal(solution.data.explanation, `Înmulțește cu ${scale.scalar}.`);
  assert.equal(
    (
      await request("/api/admin/messages", {
        cookie: admin,
        method: "PUT",
        body: { messages: { "hint.add": "{invalid}" } },
      })
    ).status,
    400,
  );
  assert.deepEqual((await request("/api/content")).data.messages, messages);
  await new Promise((r) => server.close(r));
  server = createApp({ dataDir: dir, accountsPath });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual((await request("/api/content")).data.messages, messages);
  assert.equal(
    (
      await request("/api/login", {
        method: "POST",
        body: { username: "player", password: "wrong" },
      })
    ).data.message,
    messages["login.invalid"],
  );
  assert.equal((await request("/api/math", { cookie: player })).data.solved, 1);
  assert.deepEqual(
    (await request("/api/puzzle", { cookie: player })).data.placed,
    [0],
  );
  assert.equal(
    (
      await request("/api/admin/messages", {
        cookie: admin,
        method: "PUT",
        body: { messages: {} },
      })
    ).status,
    200,
  );
  assert.deepEqual((await request("/api/content")).data, { messages: {} });
  assert.equal((await request("/api/math", { cookie: player })).data.solved, 1);
});
