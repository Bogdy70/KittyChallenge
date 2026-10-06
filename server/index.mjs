import { defaultSorting, validateSorting } from "../shared/puzzle-sorting.mjs";
import { createVoiceService } from "./voice.mjs";
import { renderMessage, validateMessages } from "../shared/messages.mjs";
import { readNetwork, addressUrl } from "./network.mjs";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  createReadStream,
} from "node:fs";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadAccounts, accountFile } from "./accounts.mjs";
import {
  generate,
  publicExercise,
  grade,
  solve,
  hint,
  explanation,
  validateExercise,
  LEVELS,
} from "./math.mjs";
import { PIECE_COUNTS, gridFor, validatePlacement } from "./puzzle.mjs";

const hash = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const safeUser = (u) => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  role: u.role,
});
function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
async function readBody(req, limit = 300_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit)
      throw fail(413, "Datele trimise depășesc limita permisă.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  try {
    return JSON.parse((await readBody(req)).toString() || "{}");
  } catch (e) {
    if (e.status) throw e;
    throw fail(400, "Datele trimise nu sunt valide.");
  }
}
export function createApp({
  dataDir = resolve(process.env.DATA_DIR || "data"),
  accountsPath = accountFile,
  staticDir = resolve("dist"),
  voiceFetch = fetch,
  voiceEnv = process.env,
  voiceSecretsPath = resolve(
    process.env.VOICE_SECRETS_FILE || "config/voice-secrets.json",
  ),
} = {}) {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(resolve(dataDir, "uploads"), { recursive: true });
  const db = new DatabaseSync(resolve(dataDir, "kitty.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,display_name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS exercises(id TEXT PRIMARY KEY,value TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS runs(user_id TEXT PRIMARY KEY REFERENCES users(id),value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS challenge_unlocks(user_id TEXT PRIMARY KEY REFERENCES users(id),unlocked INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS puzzle_progress(user_id TEXT NOT NULL REFERENCES users(id),version TEXT NOT NULL,placed TEXT NOT NULL,PRIMARY KEY(user_id,version));
 CREATE TABLE IF NOT EXISTS puzzle_sorting(user_id TEXT NOT NULL REFERENCES users(id),version TEXT NOT NULL,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,version));`);
  const accounts = loadAccounts(accountsPath);
  db.exec("BEGIN");
  try {
    for (const a of accounts) {
      const old = db.prepare("SELECT * FROM users WHERE id=?").get(a.id);
      const changed =
        !old ||
        !passwordMatches(a.password, old.password_hash) ||
        old.username !== a.username ||
        old.role !== a.role;
      db.prepare(
        "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,display_name=excluded.display_name,role=excluded.role,password_hash=excluded.password_hash",
      ).run(
        a.id,
        a.username,
        a.displayName,
        a.role,
        changed ? passwordHash(a.password) : old.password_hash,
      );
      if (changed) db.prepare("DELETE FROM sessions WHERE user_id=?").run(a.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const defaults = {
    recipient: "Sărbătorita",
    message:
      "20 de ani. O lume întreagă de descoperit. Și câteva pisicuțe care te încurajează la fiecare pas.",
    difficulty: "easy",
    puzzle: {
      count: 10,
      url: "/demo-photo.svg",
      width: 1400,
      height: 1000,
      version: "demo-10",
    },
  };
  db.prepare("INSERT OR IGNORE INTO settings VALUES(1,?)").run(
    JSON.stringify(defaults),
  );
  const settings = () => {
    const s = JSON.parse(
      db.prepare("SELECT value FROM settings WHERE id=1").get().value,
    );
    return { ...s, messages: s.messages || {} };
  };
  const saveSettings = (value) =>
    db
      .prepare("UPDATE settings SET value=? WHERE id=1")
      .run(JSON.stringify(value));
  const saveRun = (id, run) =>
    db
      .prepare(
        "INSERT INTO runs VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value",
      )
      .run(id, JSON.stringify(run));
  const custom = () =>
    db
      .prepare("SELECT * FROM exercises ORDER BY created")
      .all()
      .map((x) => ({ ...JSON.parse(x.value), id: x.id }));
  function currentExerciseCopy(e) {
    if (e.id.startsWith("g-")) return e;
    const latest = db
      .prepare("SELECT value FROM exercises WHERE id=?")
      .get(e.id);
    if (!latest) return e;
    const copy = JSON.parse(latest.value);
    return { ...e, title: copy.title, hint: copy.hint };
  }
  function newRun(id) {
    const level = settings().difficulty;
    const exercises = [
      ...generate(level, randomBytes(4).readUInt32LE()),
      ...custom(),
    ];
    const run = {
      id: randomUUID(),
      level,
      exercises,
      state: {},
      created: Date.now(),
    };
    saveRun(id, run);
    return run;
  }
  function getRun(id) {
    const row = db.prepare("SELECT value FROM runs WHERE user_id=?").get(id);
    return row ? JSON.parse(row.value) : newRun(id);
  }
  const exposedRun = (r) => ({
    id: r.id,
    level: r.level,
    exercises: r.exercises.map((e) =>
      publicExercise(
        currentExerciseCopy(e),
        r.state[e.id],
        settings().messages,
      ),
    ),
    solved: Object.values(r.state).filter((s) => s.solved).length,
  });
  function unlockPuzzle(id) {
    db.prepare("INSERT OR IGNORE INTO challenge_unlocks VALUES(?,?)").run(
      id,
      Date.now(),
    );
  }
  function puzzleAccess(user) {
    if (user.role === "admin") return true;
    if (
      db
        .prepare("SELECT user_id FROM challenge_unlocks WHERE user_id=?")
        .get(user.id)
    )
      return true;
    const run = getRun(user.id);
    if (
      run.exercises.length &&
      run.exercises.every((e) => run.state[e.id]?.solved)
    ) {
      unlockPuzzle(user.id);
      return true;
    }
    return false;
  }
  function readSorting(userId, version) {
    const row = db
      .prepare(
        "SELECT value,revision FROM puzzle_sorting WHERE user_id=? AND version=?",
      )
      .get(userId, version);
    return {
      sorting: row
        ? JSON.parse(row.value)
        : defaultSorting((key) => renderMessage(settings().messages, key)),
      sortingRevision: row?.revision || 0,
    };
  }
  const voice = createVoiceService(db, {
    dataDir,
    secretsPath: voiceSecretsPath,
    fetchImpl: voiceFetch,
    env: voiceEnv,
    getMessages: () => settings().messages,
  });
  const rates = new Map();
  const dummy = passwordHash(randomBytes(16).toString("hex"));
  const cleanup = setInterval(() => {
    const now = Date.now();
    db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
    for (const [k, v] of rates) if (v.until < now) rates.delete(k);
  }, 60_000);
  cleanup.unref();
  const json = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const method = req.method;
      if (
        ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
        req.headers.origin
      ) {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw fail(403, "Cerere dintr-o origine nepermisă.");
      }
      if (path === "/api/health") return json(res, 200, { ok: true });
      if (path === "/api/voice/config" && method === "GET")
        return json(res, 200, voice.publicConfig());
      if (path === "/api/content" && method === "GET")
        return json(res, 200, { messages: settings().messages });
      if (path === "/api/login" && method === "POST") {
        const key = req.socket.remoteAddress;
        const now = Date.now();
        const rate = rates.get(key);
        if (rate && rate.until > now && rate.count >= 20)
          throw fail(429, "Prea multe încercări. Revino în 15 minute.");
        rates.set(key, {
          count: rate && rate.until > now ? rate.count + 1 : 1,
          until: rate && rate.until > now ? rate.until : now + 15 * 60_000,
        });
        const body = await jsonBody(req);
        if (
          typeof body.username !== "string" ||
          typeof body.password !== "string" ||
          body.password.length > 128
        )
          throw fail(400, "Completează utilizatorul și parola.");
        const user = db
          .prepare("SELECT * FROM users WHERE username=?")
          .get(body.username.trim());
        const valid = passwordMatches(
          body.password,
          user?.password_hash || dummy,
        );
        if (!user || !valid)
          throw fail(401, renderMessage(settings().messages, "login.invalid"));
        const token = randomBytes(32).toString("hex");
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          hash(token),
          user.id,
          now + 7 * 86400_000,
        );
        rates.delete(key);
        res.setHeader(
          "Set-Cookie",
          `kitty_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
        );
        return json(res, 200, safeUser(user));
      }
      const token = req.headers.cookie?.match(
        /(?:^|;\s*)kitty_session=([a-f0-9]{64})(?:;|$)/,
      )?.[1];
      const user = token
        ? db
            .prepare(
              "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
            )
            .get(hash(token), Date.now())
        : null;
      if (path.startsWith("/api/") || path.startsWith("/uploads/"))
        if (!user) throw fail(401, "Intră în cont ca să înceapă petrecerea.");
      if (path.startsWith("/api/admin/") && user?.role !== "admin")
        throw fail(403, "Doar organizatorul poate modifica provocările.");
      if (
        (path === "/api/puzzle" ||
          path.startsWith("/api/puzzle/") ||
          path.startsWith("/uploads/")) &&
        !puzzleAccess(user)
      )
        throw fail(
          403,
          renderMessage(settings().messages, "puzzle.locked.message"),
        );
      if (path === "/api/voice/resolve" && method === "POST")
        return json(
          res,
          200,
          await voice.resolveSpeech(await jsonBody(req), user.id),
        );
      const audioRoute = path.match(
        /^\/api\/voice\/files\/([a-f0-9-]+\.(?:mp3|wav|ogg|m4a))$/,
      );
      if (audioRoute && ["GET", "HEAD"].includes(method))
        return voice.serve(req, res, audioRoute[1]);
      if (path === "/api/admin/voice" && method === "GET")
        return json(res, 200, voice.adminConfig());
      if (path === "/api/admin/voice" && method === "PUT")
        return json(res, 200, voice.saveConfig(await jsonBody(req)));
      if (path === "/api/admin/voice/voices" && method === "GET")
        return json(
          res,
          200,
          await voice.voices(url.searchParams.get("page") || ""),
        );
      if (path === "/api/admin/voice/generate" && method === "POST")
        return json(
          res,
          201,
          await voice.generateClip(await jsonBody(req), user.id),
        );
      if (path === "/api/admin/voice/cache" && method === "DELETE")
        return json(res, 200, voice.clearCache());
      const clipRoute = path.match(
        /^\/api\/admin\/voice\/clips\/([a-f0-9-]+)$/,
      );
      if (clipRoute && method === "DELETE")
        return json(res, 200, voice.removeClip(clipRoute[1]));
      if (path === "/api/admin/voice/clips" && method === "POST") {
        const payload = await readBody(req, 15 * 1024 * 1024 + 25004);
        if (payload.length < 5) throw fail(400, "Înregistrare invalidă.");
        const length = payload.readUInt32BE(0);
        if (length < 2 || length > 25000 || length + 4 >= payload.length)
          throw fail(400, "Datele înregistrării nu sunt valide.");
        let metadata;
        try {
          metadata = JSON.parse(payload.toString("utf8", 4, 4 + length));
        } catch {
          throw fail(400, "Datele înregistrării nu sunt valide.");
        }
        return json(
          res,
          201,
          voice.upload(payload.subarray(4 + length), metadata),
        );
      }
      if (path === "/api/journey" && method === "GET")
        return json(res, 200, { puzzleUnlocked: puzzleAccess(user) });
      if (path === "/api/logout" && method === "POST") {
        if (token)
          db.prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
        res.setHeader(
          "Set-Cookie",
          "kitty_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return json(res, 200, { ok: true });
      }
      if (path === "/api/me") return json(res, 200, safeUser(user));
      if (path === "/api/settings" && method === "GET") {
        const s = settings();
        if (!puzzleAccess(user))
          s.puzzle = { count: s.puzzle.count, locked: true };
        return json(res, 200, s);
      }
      if (path === "/api/math" && method === "GET")
        return json(res, 200, exposedRun(getRun(user.id)));
      if (path === "/api/math/restart" && method === "POST") {
        puzzleAccess(user);
        return json(res, 200, exposedRun(newRun(user.id)));
      }
      const exerciseRoute = path.match(
        /^\/api\/math\/([^/]+)\/(check|hint|solution)$/,
      );
      if (exerciseRoute && method === "POST") {
        const run = getRun(user.id);
        const original = run.exercises.find((e) => e.id === exerciseRoute[1]);
        const e = original ? currentExerciseCopy(original) : null;
        if (!e) throw fail(404, "Exercițiul nu mai este în acest set.");
        const body = await jsonBody(req);
        if (body.runId !== run.id)
          throw fail(
            409,
            "Setul s-a schimbat într-o altă fereastră. Reîncarcă pagina.",
          );
        const state = run.state[e.id] || {};
        let result;
        if (exerciseRoute[2] === "hint") {
          state.hintUsed = true;
          result = { hint: hint(e, settings().messages) };
        } else if (exerciseRoute[2] === "solution") {
          state.revealed = true;
          result = {
            answer: solve(e),
            explanation: explanation(e, settings().messages),
          };
        } else {
          result = grade(e, body.answer);
          state.attempts = (state.attempts || 0) + 1;
          state.solved = state.solved || result.correct;
          result.message = result.correct
            ? renderMessage(settings().messages, "math.correct")
            : renderMessage(settings().messages, "math.incorrect");
          if (result.correct)
            result.explanation = explanation(e, settings().messages);
        }
        run.state[e.id] = state;
        saveRun(user.id, run);
        if (
          run.exercises.length &&
          run.exercises.every((e) => run.state[e.id]?.solved)
        )
          unlockPuzzle(user.id);
        return json(res, 200, {
          ...result,
          exercise: publicExercise(e, state, settings().messages),
          solved: Object.values(run.state).filter((s) => s.solved).length,
        });
      }
      if (path === "/api/puzzle" && method === "GET") {
        const p = settings().puzzle;
        const row = db
          .prepare(
            "SELECT placed FROM puzzle_progress WHERE user_id=? AND version=?",
          )
          .get(user.id, p.version);
        return json(res, 200, {
          ...p,
          ...gridFor(p.count, p.width / p.height),
          placed: row ? JSON.parse(row.placed) : [],
          ...readSorting(user.id, p.version),
        });
      }
      if (path === "/api/puzzle/sorting" && method === "PUT") {
        const body = await jsonBody(req),
          p = settings().puzzle;
        if (body.version !== p.version)
          throw fail(
            409,
            "Puzzle-ul a fost schimbat. Reîncarcă pentru fotografia nouă.",
          );
        const sorting = validateSorting(body.sorting, p.count);
        if (!Number.isSafeInteger(body.revision) || body.revision < 0)
          throw fail(400, "Revizia sortării nu este validă.");
        const current = readSorting(user.id, p.version);
        if (body.revision !== current.sortingRevision)
          throw fail(
            409,
            "Sortarea a fost modificată într-o altă fereastră. Reîncarcă sortarea înainte de a continua.",
          );
        const revision = body.revision + 1;
        db.prepare(
          "INSERT INTO puzzle_sorting VALUES(?,?,?,?) ON CONFLICT(user_id,version) DO UPDATE SET value=excluded.value,revision=excluded.revision",
        ).run(user.id, p.version, JSON.stringify(sorting), revision);
        return json(res, 200, { sorting, revision });
      }
      if (path === "/api/puzzle/progress" && method === "PUT") {
        const body = await jsonBody(req);
        const p = settings().puzzle;
        if (body.version !== p.version)
          throw fail(
            409,
            "Puzzle-ul a fost schimbat. Reîncarcă pentru fotografia nouă.",
          );
        const placed = validatePlacement(body.placed, p.count);
        const previous = db
          .prepare(
            "SELECT placed FROM puzzle_progress WHERE user_id=? AND version=?",
          )
          .get(user.id, p.version);
        const merged = [
          ...new Set([
            ...(previous ? JSON.parse(previous.placed) : []),
            ...placed,
          ]),
        ].sort((a, b) => a - b);
        db.prepare(
          "INSERT INTO puzzle_progress VALUES(?,?,?) ON CONFLICT(user_id,version) DO UPDATE SET placed=excluded.placed",
        ).run(user.id, p.version, JSON.stringify(merged));
        return json(res, 200, {
          placed: merged,
          complete: merged.length === p.count,
        });
      }
      if (path === "/api/puzzle/restart" && method === "POST") {
        const body = await jsonBody(req);
        const p = settings().puzzle;
        if (body.version !== p.version)
          throw fail(409, "Puzzle-ul s-a schimbat. Reîncarcă pagina.");
        db.prepare(
          "DELETE FROM puzzle_progress WHERE user_id=? AND version=?",
        ).run(user.id, p.version);
        return json(res, 200, { ok: true });
      }
      if (path === "/api/admin/messages" && method === "GET")
        return json(res, 200, { messages: settings().messages });
      if (path === "/api/admin/messages" && method === "PUT") {
        const body = await jsonBody(req),
          s = settings();
        s.messages = validateMessages(body.messages);
        saveSettings(s);
        return json(res, 200, s);
      }
      if (path === "/api/admin/settings" && method === "PATCH") {
        const body = await jsonBody(req);
        const s = settings();
        if (
          typeof body.recipient !== "string" ||
          !body.recipient.trim() ||
          body.recipient.length > 60 ||
          typeof body.message !== "string" ||
          body.message.length > 500 ||
          !LEVELS[body.difficulty]
        )
          throw fail(400, "Verifică numele, mesajul și dificultatea.");
        if (!PIECE_COUNTS.includes(body.pieceCount))
          throw fail(400, "Număr de piese invalid.");
        s.recipient = body.recipient.trim();
        s.message = body.message;
        s.difficulty = body.difficulty;
        if (s.puzzle.count !== body.pieceCount)
          s.puzzle = {
            ...s.puzzle,
            count: body.pieceCount,
            version: randomUUID(),
          };
        saveSettings(s);
        return json(res, 200, s);
      }
      if (path === "/api/admin/photo" && method === "POST") {
        const contentType = req.headers["content-type"];
        const types = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        if (!types[contentType])
          throw fail(400, "Alege o imagine JPEG, PNG sau WebP.");
        const bytes = await readBody(req, 8 * 1024 * 1024);
        const valid =
          contentType === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : contentType === "image/png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : bytes.toString("ascii", 0, 4) === "RIFF" &&
                bytes.toString("ascii", 8, 12) === "WEBP";
        if (!valid) throw fail(400, "Fișierul nu este o imagine validă.");
        const width = Number(url.searchParams.get("width")),
          height = Number(url.searchParams.get("height"));
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 10 ||
          height < 10 ||
          width > 10000 ||
          height > 10000
        )
          throw fail(400, "Dimensiunile imaginii nu sunt valide.");
        const s = settings(),
          filename = `${randomUUID()}.${types[contentType]}`;
        writeFileSync(resolve(dataDir, "uploads", filename), bytes, {
          flag: "wx",
        });
        s.puzzle = {
          ...s.puzzle,
          url: `/uploads/${filename}`,
          width,
          height,
          version: randomUUID(),
        };
        saveSettings(s);
        return json(res, 201, s);
      }
      if (path === "/api/admin/exercises" && method === "GET")
        return json(res, 200, custom());
      if (path === "/api/admin/exercises" && method === "POST") {
        if (custom().length >= 20)
          throw fail(400, "Poți adăuga maximum 20 de exerciții suplimentare.");
        const body = await jsonBody(req);
        validateExercise(body);
        if (
          typeof body.title !== "string" ||
          !body.title.trim() ||
          body.title.length > 100 ||
          typeof (body.hint || "") !== "string" ||
          (body.hint || "").length > 500
        )
          throw fail(400, "Verifică titlul și indiciul.");
        const e = {
          id: randomUUID(),
          op: body.op,
          a: body.a,
          b: ["add", "subtract", "multiply"].includes(body.op)
            ? body.b
            : undefined,
          scalar: body.op === "scale" ? body.scalar : undefined,
          title: body.title.trim(),
          hint: body.hint || "",
        };
        db.prepare("INSERT INTO exercises VALUES(?,?,?)").run(
          e.id,
          JSON.stringify(e),
          Date.now(),
        );
        return json(res, 201, { ...e, answer: solve(e) });
      }
      const deleteRoute = path.match(
        /^\/api\/admin\/exercises\/([a-zA-Z0-9-]+)$/,
      );
      if (deleteRoute && method === "PATCH") {
        const row = db
          .prepare("SELECT value FROM exercises WHERE id=?")
          .get(deleteRoute[1]);
        if (!row) throw fail(404, "Exercițiu inexistent.");
        const body = await jsonBody(req);
        if (
          typeof body.title !== "string" ||
          !body.title.trim() ||
          body.title.length > 100 ||
          typeof body.hint !== "string" ||
          body.hint.length > 500 ||
          Object.keys(body).some((k) => !["title", "hint"].includes(k))
        )
          throw fail(
            400,
            "Poți modifica titlul și indiciul, cu maximum 100 și 500 de caractere.",
          );
        const e = {
          ...JSON.parse(row.value),
          title: body.title.trim(),
          hint: body.hint,
        };
        db.prepare("UPDATE exercises SET value=? WHERE id=?").run(
          JSON.stringify(e),
          e.id,
        );
        return json(res, 200, e);
      }
      if (deleteRoute && method === "DELETE") {
        db.prepare("DELETE FROM exercises WHERE id=?").run(deleteRoute[1]);
        return json(res, 200, { ok: true });
      }
      if (path === "/api/admin/progress" && method === "GET") {
        return json(
          res,
          200,
          db
            .prepare("SELECT id,username,display_name,role FROM users")
            .all()
            .map((u) => {
              const row = db
                .prepare("SELECT value FROM runs WHERE user_id=?")
                .get(u.id);
              const run = row ? JSON.parse(row.value) : null;
              const p = settings().puzzle;
              const progress = db
                .prepare(
                  "SELECT placed FROM puzzle_progress WHERE user_id=? AND version=?",
                )
                .get(u.id, p.version);
              return {
                ...safeUser(u),
                mathSolved: run
                  ? Object.values(run.state).filter((s) => s.solved).length
                  : 0,
                mathTotal: run?.exercises.length || 0,
                mathRevealed: run
                  ? Object.values(run.state).filter((s) => s.revealed).length
                  : 0,
                puzzlePlaced: progress ? JSON.parse(progress.placed).length : 0,
                puzzleTotal: p.count,
              };
            }),
        );
      }
      if (path.startsWith("/api/")) throw fail(404, "Pagina cerută nu există.");
      if (method !== "GET" && method !== "HEAD")
        throw fail(405, "Metodă nepermisă.");
      let file;
      if (path.startsWith("/uploads/")) {
        if (!/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))
          throw fail(404, "Imagine inexistentă.");
        file = resolve(dataDir, "." + path);
      } else {
        const decoded = decodeURIComponent(path);
        file = resolve(staticDir, "." + decoded);
        if (!file.startsWith(staticDir + sep) && file !== staticDir)
          throw fail(404, "Pagina nu există.");
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (extname(path)) throw fail(404, "Fișier inexistent.");
          file = resolve(staticDir, "index.html");
        }
      }
      if (!existsSync(file))
        throw fail(
          404,
          "Rulează npm run build sau deschide serverul de dezvoltare pe portul 5174.",
        );
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": path.startsWith("/uploads/")
          ? "private, max-age=3600"
          : path.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
      });
      if (method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status =
        error.status ||
        (/matrice|Matrice|Scalar|scalar|Progres|piese|Dimensi|Determinant|operație|Operație|Coloanele|determinant/.test(
          error.message,
        )
          ? 400
          : 500);
      if (status === 500) console.error("Eroare server:", error.message);
      json(res, status, {
        message:
          status === 500
            ? "Ups, ceva nu a mers. Încearcă din nou."
            : error.message,
      });
    }
  });
  server.on("close", () => {
    clearInterval(cleanup);
    db.close();
  });
  return server;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const server = createApp();
  const { host, port } = readNetwork();
  server.on("error", (error) => {
    console.error(
      `Nu pot porni pe ${host}:${port}: ${error.message}. Rulează npm run addresses sau npm run configure:network -- --local.`,
    );
    process.exitCode = 1;
    server.close();
  });
  server.listen(port, host, () =>
    console.log(
      `Kitty Party: ${addressUrl(host, server.address().port)}\nConturile și parolele sunt în ${accountFile}.\nAdrese disponibile: npm run addresses`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
