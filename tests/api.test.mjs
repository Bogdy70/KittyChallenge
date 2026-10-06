import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.mjs";
import { solve } from "../server/math.mjs";
import { loadAccounts } from "../server/accounts.mjs";
test("authentification, permissions, validation et progression persistante", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-api-"));
  const accountsPath = join(dir, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        displayName: "Admin test",
        password: "test-admin-secret-2026",
      },
      {
        id: "birthday",
        role: "player",
        username: "birthday",
        displayName: "Invitată test",
        password: "test-player-secret-2026",
      },
    ]),
  );
  let app = createApp({ dataDir: dir, accountsPath });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  let base = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => {
    await new Promise((r) => app.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  async function req(path, { cookie, body, method = "GET", ...rest } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  assert.equal((await req("/api/settings")).status, 401);
  assert.equal((await req("/api/me")).status, 401);
  assert.equal(
    (
      await req("/api/login", {
        method: "POST",
        body: { username: "admin", password: "wrong" },
      })
    ).status,
    401,
  );
  const admin = await req("/api/login", {
    method: "POST",
    body: { username: "admin", password: "test-admin-secret-2026" },
  });
  assert.equal(admin.status, 200);
  assert.equal(admin.data.role, "admin");
  assert.equal("password" in admin.data, false);
  const player = await req("/api/login", {
    method: "POST",
    body: { username: "birthday", password: "test-player-secret-2026" },
  });
  assert.equal(player.status, 200);
  const a = admin.cookie,
    p = player.cookie;
  assert.equal((await req("/api/admin/progress", { cookie: p })).status, 403);
  assert.equal(
    (await req("/api/admin/settings", { cookie: p, method: "PATCH", body: {} }))
      .status,
    403,
  );
  assert.equal(
    (await req("/api/register", { cookie: p, method: "POST", body: {} }))
      .status,
    404,
  );
  assert.equal(
    (
      await req("/api/logout", {
        cookie: p,
        method: "POST",
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const run = (await req("/api/math", { cookie: p })).data;
  assert.equal(run.exercises.length, 5);
  assert.equal("answer" in run.exercises[0], false);
  const first = run.exercises[0];
  let result = await req(`/api/math/${first.id}/check`, {
    cookie: p,
    method: "POST",
    body: { runId: run.id, answer: solve(first) },
  });
  assert.equal(result.data.correct, true);
  assert.equal(result.data.solved, 1);
  assert.equal((await req("/api/math", { cookie: a })).data.solved, 0);
  assert.equal(
    (
      await req(`/api/math/${first.id}/check`, {
        cookie: p,
        method: "POST",
        body: { runId: "stale", answer: solve(first) },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(`/api/math/${first.id}/hint`, {
        cookie: p,
        method: "POST",
        body: { runId: run.id },
      })
    ).data.exercise.hintUsed,
    true,
  );
  assert.equal(
    (
      await req(`/api/math/${first.id}/solution`, {
        cookie: p,
        method: "POST",
        body: { runId: run.id },
      })
    ).data.exercise.revealed,
    true,
  );
  let puzzle = (await req("/api/puzzle", { cookie: p })).data;
  assert.equal(
    (
      await req("/api/puzzle/progress", {
        cookie: p,
        method: "PUT",
        body: { version: puzzle.version, placed: [-1] },
      })
    ).status,
    400,
  );
  await req("/api/puzzle/progress", {
    cookie: p,
    method: "PUT",
    body: { version: puzzle.version, placed: [0, 1] },
  });
  await req("/api/puzzle/progress", {
    cookie: p,
    method: "PUT",
    body: { version: puzzle.version, placed: [2] },
  });
  assert.deepEqual(
    (await req("/api/puzzle", { cookie: p })).data.placed,
    [0, 1, 2],
  );
  assert.deepEqual((await req("/api/puzzle", { cookie: a })).data.placed, []);
  const settings = (await req("/api/settings", { cookie: a })).data;
  assert.equal(
    (
      await req("/api/admin/exercises", {
        cookie: a,
        method: "POST",
        body: {
          title: "Invalid",
          op: "inverse",
          a: [
            [1, 2],
            [2, 4],
          ],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/admin/exercises", {
        cookie: a,
        method: "POST",
        body: {
          title: "Custom",
          op: "transpose",
          a: [[1, 2, 3]],
          hint: "rândul devine coloană",
        },
      })
    ).status,
    201,
  );
  result = await req("/api/admin/settings", {
    cookie: a,
    method: "PATCH",
    body: { ...settings, difficulty: "spicy", pieceCount: 500 },
  });
  assert.equal(result.status, 200);
  assert.equal(
    (await req("/api/math", { cookie: p })).data.exercises.length,
    5,
    "existing run preserved",
  );
  assert.equal(
    (await req("/api/math/restart", { cookie: p, method: "POST" })).data
      .exercises.length,
    10,
  );
  assert.equal(
    (
      await req("/api/puzzle/progress", {
        cookie: p,
        method: "PUT",
        body: { version: puzzle.version, placed: [0] },
      })
    ).status,
    409,
  );
  puzzle = (await req("/api/puzzle", { cookie: p })).data;
  assert.equal(puzzle.count, 500);
  assert.equal(puzzle.rows * puzzle.cols, 500);
  assert.deepEqual(puzzle.placed, []);
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz8AAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await fetch(base + "/api/admin/photo?width=100&height=100", {
    method: "POST",
    headers: { Cookie: a, "Content-Type": "image/png" },
    body: image,
  });
  assert.equal(upload.status, 201);
  const updated = await upload.json();
  assert.equal((await fetch(base + updated.puzzle.url)).status, 401);
  assert.equal(
    (await fetch(base + updated.puzzle.url, { headers: { Cookie: p } })).status,
    200,
  );
  await new Promise((r) => app.close(r));
  app = createApp({ dataDir: dir, accountsPath });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await req("/api/me", { cookie: p })).status, 200);
  assert.equal(
    (await req("/api/settings", { cookie: a })).data.puzzle.url,
    updated.puzzle.url,
  );
  await new Promise((r) => app.close(r));
  const accounts = JSON.parse(readFileSync(accountsPath));
  accounts[1].password = "changed-test-password";
  writeFileSync(accountsPath, JSON.stringify(accounts));
  app = createApp({ dataDir: dir, accountsPath });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.address().port}`;
  assert.equal(
    (await req("/api/me", { cookie: p })).status,
    401,
    "password change revokes sessions",
  );
  assert.equal((await req("/api/me", { cookie: a })).status, 200);
  await req("/api/logout", { cookie: a, method: "POST" });
  assert.equal((await req("/api/me", { cookie: a })).status, 401);
});
test("accounts file is generated privately with exactly two unique accounts", () => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-accounts-"));
  try {
    const list = loadAccounts(join(dir, "accounts.json"));
    assert.equal(list.length, 2);
    assert.equal(list[0].role, "admin");
    assert.equal(list[1].role, "player");
    assert.notEqual(list[0].password, list[1].password);
    assert.ok(list.every((a) => a.password.length >= 10));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
