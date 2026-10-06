import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  validateNetwork,
  readNetwork,
  saveNetwork,
  addressUrl,
  tailscaleStatus,
  localAddresses,
} from "../server/network.mjs";
test("configurația de adresă persistă, poate reveni la local și respectă mediul procesului", () => {
  const dir = mkdtempSync(join(tmpdir(), "kitty-network-")),
    path = join(dir, "config/network.json");
  try {
    assert.deepEqual(readNetwork(path, {}), { host: "127.0.0.1", port: 3001 });
    saveNetwork({ host: "100.70.80.90", port: 3210 }, path);
    assert.deepEqual(readNetwork(path, {}), {
      host: "100.70.80.90",
      port: 3210,
    });
    assert.deepEqual(readNetwork(path, { HOST: "0.0.0.0", PORT: "3200" }), {
      host: "0.0.0.0",
      port: 3200,
    });
    saveNetwork({ host: "localhost", port: 3001 }, path);
    assert.deepEqual(readNetwork(path, {}), { host: "127.0.0.1", port: 3001 });
    for (const bad of [
      { host: "https://example.com", port: 3001 },
      { host: "1.2.3.999", port: 3001 },
      { host: "127.0.0.1", port: 0 },
      { host: "::1", port: 65536 },
    ])
      assert.throws(() => validateNetwork(bad));
    assert.equal(addressUrl("fd7a::12", 3001), "http://[fd7a::12]:3001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Tailscale folosește doar identitatea locală și raportează disponibilitatea", () => {
  const result = tailscaleStatus((args) => {
    assert.deepEqual(args, ["status", "--json"]);
    return JSON.stringify({
      BackendState: "Running",
      TailscaleIPs: ["100.70.80.90"],
      Self: { DNSName: "kitty.tail-example.ts.net." },
      Peer: { private: "not returned" },
    });
  });
  assert.deepEqual(result, {
    running: true,
    state: "Running",
    addresses: ["100.70.80.90"],
    dnsName: "kitty.tail-example.ts.net",
  });
  assert.equal(
    tailscaleStatus(() => {
      throw new Error("not installed");
    }).state,
    "Unavailable",
  );
  assert.deepEqual(
    localAddresses({
      lo: [{ internal: true, address: "127.0.0.1", family: "IPv4" }],
      Tailscale: [{ internal: false, address: "100.70.80.90", family: "IPv4" }],
    }),
    [{ name: "Tailscale", address: "100.70.80.90", family: "IPv4" }],
  );
});
