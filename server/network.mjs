import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { execFileSync } from "node:child_process";

export const networkFile = () =>
  resolve(process.env.NETWORK_FILE || "config/network.json");
export function validateNetwork(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configurație de rețea invalidă.");
  const host = value.host === "localhost" ? "127.0.0.1" : value.host;
  if (typeof host !== "string" || !isIP(host))
    throw new Error(
      "Folosește localhost sau o adresă IP validă pentru server.",
    );
  const port = Number(value.port ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Portul trebuie să fie între 1 și 65535.");
  return { host, port };
}
export function readNetwork(path = networkFile(), env = process.env) {
  const local = existsSync(path)
    ? validateNetwork(JSON.parse(readFileSync(path, "utf8")))
    : { host: "127.0.0.1", port: 3001 };
  return validateNetwork({
    host: env.HOST || local.host,
    port: env.PORT || local.port,
  });
}
export function saveNetwork(value, path = networkFile()) {
  const config = validateNetwork(value);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  renameSync(temporary, path);
  return config;
}
export function localAddresses(interfaces = networkInterfaces()) {
  return Object.entries(interfaces).flatMap(([name, items]) =>
    (items || [])
      .filter((a) => !a.internal)
      .map((a) => ({ name, address: a.address, family: a.family })),
  );
}
export function tailscaleStatus(
  run = (args) => {
    const installed =
      process.platform === "win32"
        ? `${process.env.ProgramFiles || "C:/Program Files"}/Tailscale/tailscale.exe`
        : "tailscale";
    return execFileSync(installed, args, {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  },
) {
  try {
    const state = JSON.parse(run(["status", "--json"]));
    return {
      running: state.BackendState === "Running",
      state: state.BackendState,
      addresses: state.TailscaleIPs || state.Self?.TailscaleIPs || [],
      dnsName: (state.Self?.DNSName || "").replace(/\.$/, ""),
    };
  } catch {
    return { running: false, state: "Unavailable", addresses: [], dnsName: "" };
  }
}
export function addressUrl(host, port) {
  return `http://${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
}
