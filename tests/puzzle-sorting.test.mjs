import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server/index.mjs";
import { solve } from "../server/math.mjs";
import { gridFor } from "../server/puzzle.mjs";
import {
  pieceSides,
  shapeGroup,
  pixelColor,
  dominantColor,
  defaultSorting,
  validateSorting,
  MAX_GROUPS,
} from "../shared/puzzle-sorting.mjs";
test("sortare: contururi complementare, colțuri și culori dominante fără a folosi pozițiile ca indiciu", () => {
  for (const count of [10, 100, 200, 500])
    for (const aspect of [0.65, 1, 1.8]) {
      const { rows, cols } = gridFor(count, aspect);
      let corners = 0,
        edges = 0;
      for (let i = 0; i < count; i++) {
        const s = pieceSides(i, rows, cols),
          group = shapeGroup(i, rows, cols);
        if (group === "corners") corners++;
        if (group === "edges") edges++;
        if (i % cols < cols - 1)
          assert.equal(s[1] + pieceSides(i + 1, rows, cols)[3], 0);
        if (i < count - cols)
          assert.equal(s[2] + pieceSides(i + cols, rows, cols)[0], 0);
      }
      assert.equal(corners, 4);
      assert.equal(edges, 2 * (rows + cols) - 8);
    }
  assert.equal(pixelColor(255, 40, 100), "red");
  assert.equal(pixelColor(240, 170, 40), "yellow");
  assert.equal(pixelColor(30, 190, 70), "green");
  assert.equal(pixelColor(20, 90, 240), "blue");
  assert.equal(pixelColor(160, 40, 190), "purple");
  assert.equal(pixelColor(245, 245, 240), "light");
  assert.equal(pixelColor(12, 10, 15), "dark");
  assert.equal(
    dominantColor(
      new Uint8ClampedArray([255, 20, 40, 255, 245, 10, 40, 255, 0, 0, 0, 0]),
    ),
    "red",
  );
  assert.equal(
    dominantColor(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    ),
    "mixed",
  );
  assert.equal(dominantColor(new Uint8ClampedArray(8)), "mixed");
});
test("sortare: validarea limitează categoriile și respinge identificatori, piese și asocieri invalide", () => {
  const initial = defaultSorting(),
    valid = { ...initial, assignments: { 0: "corners", 9: "edges" } };
  assert.deepEqual(validateSorting(valid, 10), valid);
  const invalid = [
    null,
    [],
    { ...initial, groups: initial.groups.concat(initial.groups[0]) },
    { ...initial, groups: [{ id: "all", name: "Toate", color: "#ffffff" }] },
    {
      ...initial,
      groups: [{ id: "unsorted", name: "Rest", color: "#ffffff" }],
    },
    { ...initial, groups: [{ id: "custom", name: " ", color: "#ffffff" }] },
    { ...initial, groups: [{ id: "custom", name: "Text", color: "red" }] },
    { ...initial, groups: [{ id: "../file", name: "Text", color: "#ffffff" }] },
    {
      ...initial,
      groups: initial.groups.map((g) => ({ ...g, name: "La fel" })),
    },
    {
      ...initial,
      groups: Array.from({ length: MAX_GROUPS + 1 }, (_, i) => ({
        id: "x" + i,
        name: "N" + i,
        color: "#ffffff",
      })),
    },
    ...["-1", "01", "1.5", "10", "Infinity", "__proto__"].map((i) => ({
      ...initial,
      assignments: { [i]: "corners" },
    })),
    { ...initial, assignments: { 0: "missing" } },
    { ...initial, assignments: [] },
  ];
  for (const value of invalid)
    assert.throws(
      () => validateSorting(value, 10),
      (e) => e.status === 400,
    );
});
test("sortare API: ambele roluri, deblocare, conturi separate, revizii, versiuni și persistență", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-sort-")),
    accountsPath = join(dir, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        displayName: "Admin",
        password: "sort-admin-password",
      },
      {
        id: "birthday",
        role: "player",
        username: "player",
        displayName: "Luna",
        password: "sort-player-password",
      },
    ]),
  );
  let app, base;
  async function start() {
    app = createApp({
      dataDir: dir,
      accountsPath,
      voiceEnv: {},
      voiceSecretsPath: join(dir, "voice.json"),
    });
    await new Promise((r) => app.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + app.address().port;
  }
  await start();
  t.after(async () => {
    await new Promise((r) => app.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  async function req(
    path,
    { cookie, body, method = body ? "POST" : "GET", headers = {} } = {},
  ) {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const a = (
      await req("/login", {
        body: { username: "admin", password: "sort-admin-password" },
      })
    ).cookie,
    p = (
      await req("/login", {
        body: { username: "player", password: "sort-player-password" },
      })
    ).cookie;
  const puzzle = (await req("/puzzle", { cookie: a })).data,
    sorting = {
      ...puzzle.sorting,
      groups: [
        ...puzzle.sorting.groups,
        { id: "custom-fur", name: "Blăniță aurie", color: "#ffcd50" },
      ],
      assignments: { 0: "custom-fur", 1: "corners", 9: "edges" },
    },
    body = { version: puzzle.version, sorting, revision: 0 };
  assert.equal(
    (await req("/puzzle/sorting", { body, method: "PUT" })).status,
    401,
  );
  assert.equal(
    (await req("/puzzle/sorting", { cookie: p, body, method: "PUT" })).status,
    403,
  );
  assert.equal(
    (
      await req("/puzzle/sorting", {
        cookie: a,
        body,
        method: "PUT",
        headers: { Origin: "https://outside.example" },
      })
    ).status,
    403,
  );
  const saved = await req("/puzzle/sorting", {
    cookie: a,
    body,
    method: "PUT",
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, 1);
  assert.equal(
    (await req("/puzzle/sorting", { cookie: a, body, method: "PUT" })).status,
    409,
    "stale window cannot overwrite",
  );
  const run = (await req("/math", { cookie: p })).data;
  for (const e of run.exercises)
    await req("/math/" + e.id + "/check", {
      cookie: p,
      body: { runId: run.id, answer: solve(e) },
    });
  assert.deepEqual(
    (await req("/puzzle", { cookie: p })).data.sorting.assignments,
    {},
  );
  assert.equal(
    (
      await req("/puzzle/sorting", {
        cookie: p,
        body: {
          ...body,
          sorting: { ...puzzle.sorting, assignments: { 2: "edges" } },
        },
        method: "PUT",
      })
    ).status,
    200,
  );
  assert.deepEqual((await req("/puzzle", { cookie: a })).data.sorting, sorting);
  for (const [change, status] of [
    [{ revision: -1 }, 400],
    [{ version: "old" }, 409],
    [{ sorting: { ...sorting, assignments: { 10: "edges" } } }, 400],
    [{ sorting: { ...sorting, assignments: { 0: "unknown" } } }, 400],
  ])
    assert.equal(
      (
        await req("/puzzle/sorting", {
          cookie: a,
          body: { ...body, revision: 1, ...change },
          method: "PUT",
        })
      ).status,
      status,
    );
  await req("/puzzle/progress", {
    cookie: a,
    body: { version: puzzle.version, placed: [0] },
    method: "PUT",
  });
  assert.equal(
    (await req("/puzzle", { cookie: a })).data.sorting.assignments[0],
    "custom-fur",
  );
  await req("/puzzle/restart", {
    cookie: a,
    body: { version: puzzle.version },
  });
  assert.deepEqual((await req("/puzzle", { cookie: a })).data.placed, []);
  assert.deepEqual(
    (await req("/puzzle", { cookie: a })).data.sorting,
    sorting,
    "restart keeps organization",
  );
  await new Promise((r) => app.close(r));
  await start();
  assert.deepEqual((await req("/puzzle", { cookie: a })).data.sorting, sorting);
  assert.deepEqual(
    (await req("/puzzle", { cookie: p })).data.sorting.assignments,
    { 2: "edges" },
  );
  await req("/admin/settings", {
    cookie: a,
    method: "PATCH",
    body: {
      recipient: "Luna",
      message: "La mulți ani!",
      difficulty: "easy",
      pieceCount: 100,
    },
  });
  assert.notEqual(
    (await req("/puzzle", { cookie: a })).data.version,
    puzzle.version,
  );
  assert.deepEqual(
    (await req("/puzzle", { cookie: a })).data.sorting.assignments,
    {},
  );
  assert.deepEqual(
    (await req("/puzzle", { cookie: p })).data.sorting.assignments,
    {},
  );
  assert.equal(
    (
      await req("/puzzle/sorting", {
        cookie: a,
        body: { ...body, revision: 1 },
        method: "PUT",
      })
    ).status,
    409,
  );
});
