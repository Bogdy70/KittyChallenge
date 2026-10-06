import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { createApp } from "../server/index.mjs";

test("proxy-ul de dezvoltare permite login same-origin și respinge origini străine", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kitty-dev-proxy-"));
  const accountsPath = join(directory, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify([
      {
        id: "admin",
        role: "admin",
        username: "admin",
        displayName: "Admin",
        password: "proxy-admin-test-password",
      },
      {
        id: "birthday",
        role: "player",
        username: "sarbatorita",
        displayName: "Luna",
        password: "proxy-player-test-password",
      },
    ]),
  );
  const app = createApp({ dataDir: directory, accountsPath });
  const previousHost = process.env.HOST,
    previousPort = process.env.PORT;
  let vite;
  try {
    await new Promise((r) => app.listen(0, "127.0.0.1", r));
    process.env.HOST = "127.0.0.1";
    process.env.PORT = String(app.address().port);
    vite = await createServer({ server: { port: 0 }, logLevel: "error" });
    await vite.listen();
    const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const login = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        username: "admin",
        password: "proxy-admin-test-password",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await fetch(base + "/api/math", { headers: { cookie } })).status,
      200,
    );
    const foreign = await fetch(base + "/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://foreign.example",
      },
      body: JSON.stringify({
        username: "admin",
        password: "proxy-admin-test-password",
      }),
    });
    assert.equal(foreign.status, 403);
  } finally {
    if (vite) await vite.close();
    await new Promise((r) => app.close(r));
    if (previousHost === undefined) delete process.env.HOST;
    else process.env.HOST = previousHost;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    rmSync(directory, { recursive: true, force: true });
  }
});
