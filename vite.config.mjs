import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readNetwork, addressUrl, tailscaleStatus } from "./server/network.mjs";
export default defineConfig(({ command }) => {
  const network = readNetwork(),
    proxyHost =
      network.host === "0.0.0.0"
        ? "127.0.0.1"
        : network.host === "::"
          ? "::1"
          : network.host;
  const dns = command === "serve" ? tailscaleStatus().dnsName : "";
  return {
    plugins: [react()],
    server: {
      host: network.host,
      port: 5174,
      strictPort: true,
      allowedHosts: dns ? [dns] : [],
      proxy: {
        "/api": {
          target: addressUrl(proxyHost, network.port),
          changeOrigin: false,
        },
        "/uploads": {
          target: addressUrl(proxyHost, network.port),
          changeOrigin: false,
        },
      },
    },
    build: { outDir: "dist" },
  };
});
