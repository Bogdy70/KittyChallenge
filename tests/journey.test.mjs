import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/index.mjs";
import { solve } from "../server/math.mjs";

test("deblocarea cere toate exercițiile, inclusiv cele personalizate, și recunoaște seturile terminate înainte de actualizare", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "kitty-journey-")),
    accountsPath = join(directory, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        displayName: "Admin",
        password: "journey-admin-test-password",
      },
      {
        id: "birthday",
        role: "player",
        username: "player",
        displayName: "Luna",
        password: "journey-player-test-password",
      },
    ]),
  );
  let app = createApp({ dataDir: directory, accountsPath }),
    base;
  async function listen() {
    await new Promise((r) => app.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${app.address().port}`;
  }
  await listen();
  t.after(async () => {
    await new Promise((r) => app.close(r));
    rmSync(directory, { recursive: true, force: true });
  });
  async function request(path, cookie, body) {
    const response = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const admin = (
    await request("/login", null, {
      username: "admin",
      password: "journey-admin-test-password",
    })
  ).cookie;
  const player = (
    await request("/login", null, {
      username: "player",
      password: "journey-player-test-password",
    })
  ).cookie;
  await request("/admin/exercises", admin, {
    title: "Ultima poartă",
    op: "transpose",
    a: [[1, 2]],
    hint: "",
  });
  const run = (await request("/math", player)).data;
  for (const e of run.exercises.slice(0, -1))
    await request("/math/" + e.id + "/check", player, {
      runId: run.id,
      answer: solve(e),
    });
  assert.equal((await request("/journey", player)).data.puzzleUnlocked, false);
  const last = run.exercises.at(-1);
  await request("/math/" + last.id + "/solution", player, { runId: run.id });
  assert.equal(
    (await request("/journey", player)).data.puzzleUnlocked,
    false,
    "reading the solution does not unlock the puzzle",
  );
  await request("/math/" + last.id + "/check", player, {
    runId: run.id,
    answer: solve(last),
  });
  assert.equal((await request("/journey", player)).data.puzzleUnlocked, true);
  await new Promise((r) => app.close(r));
  // Model the previous release: completed runs exist, but the achievement table does not.
  const db = new DatabaseSync(join(directory, "kitty.sqlite"));
  db.exec("DROP TABLE challenge_unlocks");
  db.close();
  app = createApp({ dataDir: directory, accountsPath });
  await listen();
  assert.equal(
    (await request("/puzzle", player)).status,
    200,
    "completed legacy run grants access directly",
  );
  await request("/math/restart", player, {});
  assert.equal(
    (await request("/journey", player)).data.puzzleUnlocked,
    true,
    "earned access stays available after restarting matrices",
  );
  assert.equal((await request("/math", player)).data.solved, 0);
});
