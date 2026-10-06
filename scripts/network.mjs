import {
  readNetwork,
  saveNetwork,
  networkFile,
  tailscaleStatus,
  localAddresses,
  addressUrl,
} from "../server/network.mjs";
import { isIP } from "node:net";
const [command, ...args] = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Lipsește valoarea pentru ${name}.`);
  return args[index + 1];
}
function show() {
  const config = readNetwork(),
    local = localAddresses(),
    ts = tailscaleStatus();
  console.log(
    `\nKitty Party · adresele acestui calculator\nServer configurat: ${config.host}:${config.port}\nFișier: ${networkFile()}\n`,
  );
  const rows = [
    { tip: "Localhost", adresa: addressUrl("localhost", config.port) },
  ];
  for (const item of local.filter((a) => a.family === "IPv4"))
    rows.push({
      tip: item.name,
      adresa: addressUrl(item.address, config.port),
    });
  for (const ip of ts.addresses)
    if (!rows.some((r) => r.adresa === addressUrl(ip, config.port)))
      rows.push({ tip: "Tailscale", adresa: addressUrl(ip, config.port) });
  if (ts.dnsName)
    rows.push({
      tip: "Tailscale · MagicDNS",
      adresa: addressUrl(ts.dnsName, config.port),
    });
  console.table(rows);
  console.log(
    "Pentru npm run dev, folosește aceeași adresă cu portul 5174. Schimbarea configurației necesită repornirea ambelor servere.",
  );
  console.log(
    `Tailscale: ${ts.running ? "conectat" : ts.state === "Unavailable" ? "nu este disponibil" : ts.state}.`,
  );
  console.log(
    config.host === "0.0.0.0"
      ? "La pornire, aplicația ascultă pe toate interfețele IPv4, inclusiv LAN și Tailscale."
      : `La pornire, aplicația ascultă doar pe ${config.host}. Celelalte URL-uri sunt adrese ale calculatorului, nu porturi deschise automat.`,
  );
  console.log(
    "Pe celălalt dispozitiv: conectează Tailscale în aceeași rețea și deschide URL-ul Tailscale. Calculatorul gazdă și aplicația trebuie să rămână pornite.",
  );
}
try {
  if (command === "addresses") show();
  else if (command === "configure") {
    const allowed = new Set(["--tailscale", "--local", "--host", "--port"]);
    for (let i = 0; i < args.length; i++) {
      if (!allowed.has(args[i]))
        throw new Error(`Opțiune necunoscută: ${args[i]}`);
      if (["--host", "--port"].includes(args[i])) i++;
    }
    const modes = [
      args.includes("--tailscale"),
      args.includes("--local"),
      args.includes("--host"),
    ].filter(Boolean).length;
    if (modes !== 1)
      throw new Error(
        "Alege o singură variantă: --tailscale, --local sau --host ADRESĂ.",
      );
    const current = readNetwork(networkFile(), {});
    let host;
    if (args.includes("--tailscale")) {
      const ts = tailscaleStatus();
      if (!ts.running)
        throw new Error(
          "Pornește Tailscale și conectează acest calculator, apoi rulează din nou comanda.",
        );
      host = ts.addresses.find((a) => isIP(a) === 4);
      if (!host) throw new Error("Tailscale nu a returnat o adresă IPv4.");
    } else host = args.includes("--local") ? "127.0.0.1" : option("--host");
    if (host === "localhost") host = "127.0.0.1";
    if (
      !["127.0.0.1", "::1", "0.0.0.0", "::"].includes(host) &&
      !localAddresses().some((a) => a.address === host) &&
      !tailscaleStatus().addresses.includes(host)
    )
      throw new Error(
        "Adresa aleasă nu aparține acestui calculator. Folosește npm run addresses.",
      );
    const config = saveNetwork({
      host,
      port: option("--port") ?? current.port,
    });
    console.log(
      `Configurație salvată: ${addressUrl(config.host, config.port)}\nRepornește aplicația cu npm start (sau scripts/start-app.ps1). Nu schimb parola, progresul sau fotografiile.`,
    );
    if (process.env.HOST || process.env.PORT)
      console.log(
        "HOST/PORT din mediul procesului au prioritate față de acest fișier; elimină-le pentru a folosi configurația salvată.",
      );
    show();
  } else
    throw new Error(
      "Utilizare: npm run addresses | npm run configure:network -- --tailscale | --local | --host ADRESĂ [--port 3001]",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
