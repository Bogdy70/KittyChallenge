import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
export const accountFile = resolve(
  process.env.ACCOUNTS_FILE || "config/accounts.json",
);
export function loadAccounts(file = accountFile) {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        [
          {
            id: "admin",
            role: "admin",
            username: "admin",
            displayName: "Organizatorul",
            password: randomBytes(12).toString("base64url"),
          },
          {
            id: "birthday",
            role: "player",
            username: "sarbatorita",
            displayName: "Sărbătorita",
            password: randomBytes(12).toString("base64url"),
          },
        ],
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  }
  const accounts = JSON.parse(readFileSync(file, "utf8"));
  if (
    !Array.isArray(accounts) ||
    accounts.length !== 2 ||
    accounts.filter((a) => a.role === "admin").length !== 1 ||
    accounts.filter((a) => a.role === "player").length !== 1 ||
    new Set(accounts.map((a) => a.id)).size !== 2 ||
    new Set(accounts.map((a) => a.username)).size !== 2 ||
    accounts.some(
      (a) =>
        !["admin", "birthday"].includes(a.id) ||
        typeof a.username !== "string" ||
        !/^[a-zA-Z0-9._-]{3,40}$/.test(a.username) ||
        typeof a.password !== "string" ||
        a.password.length < 10 ||
        a.password.length > 128 ||
        typeof a.displayName !== "string" ||
        !a.displayName.trim() ||
        a.displayName.length > 60,
    )
  )
    throw new Error(
      "config/accounts.json trebuie să conțină exact conturile admin și birthday, un admin și un player, nume unice și parole de 10–128 de caractere.",
    );
  return accounts;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const accounts = loadAccounts();
  console.log(
    `Conturi pregătite în ${accountFile}. Utilizatori: ${accounts.map((a) => a.username).join(", ")}. Citește și schimbă parolele în fișier; apoi repornește serverul.`,
  );
}
