import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  statSync,
  createReadStream,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { renderMessage, MESSAGE_BY_KEY } from "../shared/messages.mjs";

export const VOICE_DEFAULTS = {
  mode: "recordings",
  voiceId: "",
  modelId: "eleven_multilingual_v2",
  stability: 0.45,
  style: 0.25,
  pitch: 1.2,
  rate: 0.95,
  dailyLimit: 10000,
};
export const normalText = (s) => s.normalize("NFC").trim().replace(/\s+/g, " ");
const digest = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const MAX_AUDIO = 15 * 1024 * 1024;
export function audioType(bytes) {
  if (bytes.length < 16)
    throw fail(400, "Fișierul audio este prea scurt sau invalid.");
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WAVE"
  )
    return { ext: "wav", mime: "audio/wav" };
  if (
    bytes.toString("ascii", 0, 3) === "ID3" ||
    (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0)
  )
    return { ext: "mp3", mime: "audio/mpeg" };
  if (bytes.toString("ascii", 0, 4) === "OggS")
    return { ext: "ogg", mime: "audio/ogg" };
  if (
    bytes.toString("ascii", 4, 8) === "ftyp" &&
    ["M4A ", "isom", "mp42", "M4B "].includes(bytes.toString("ascii", 8, 12))
  )
    return { ext: "m4a", mime: "audio/mp4" };
  throw fail(400, "Alege un fișier audio MP3, WAV, OGG sau M4A valid.");
}
export function validateVoice(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw fail(400, "Configurația vocii nu este validă.");
  const v = { ...VOICE_DEFAULTS, ...value };
  if (
    !["browser", "recordings", "ai"].includes(v.mode) ||
    typeof v.voiceId !== "string" ||
    (v.voiceId && !/^[a-zA-Z0-9_-]{1,100}$/.test(v.voiceId)) ||
    !["eleven_multilingual_v2", "eleven_flash_v2_5"].includes(v.modelId)
  )
    throw fail(400, "Verifică modul, identificatorul vocii și modelul.");
  for (const [key, min, max] of [
    ["stability", 0, 1],
    ["style", 0, 1],
    ["pitch", 0.5, 2],
    ["rate", 0.5, 1.5],
    ["dailyLimit", 100, 100000],
  ])
    if (
      typeof v[key] !== "number" ||
      !Number.isFinite(v[key]) ||
      v[key] < min ||
      v[key] > max
    )
      throw fail(400, "Valoare invalidă pentru " + key + ".");
  if (!Number.isInteger(v.dailyLimit))
    throw fail(400, "Limita zilnică trebuie să fie un număr întreg.");
  return Object.fromEntries(Object.keys(VOICE_DEFAULTS).map((k) => [k, v[k]]));
}
export function createVoiceService(
  db,
  {
    dataDir,
    secretsPath = resolve(
      process.env.VOICE_SECRETS_FILE || "config/voice-secrets.json",
    ),
    fetchImpl = fetch,
    env = process.env,
    getMessages = () => ({}),
  },
) {
  const directory = resolve(dataDir, "audio");
  mkdirSync(directory, { recursive: true });
  db.exec(`CREATE TABLE IF NOT EXISTS voice_settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS voice_clips(id TEXT PRIMARY KEY,label TEXT NOT NULL,source_key TEXT,match_text TEXT UNIQUE NOT NULL,filename TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS voice_cache(hash TEXT PRIMARY KEY,filename TEXT NOT NULL,bytes INTEGER NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS voice_usage(day TEXT PRIMARY KEY,characters INTEGER NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO voice_settings VALUES(1,?)").run(
    JSON.stringify(VOICE_DEFAULTS),
  );
  const settings = () => ({
    ...VOICE_DEFAULTS,
    ...JSON.parse(
      db.prepare("SELECT value FROM voice_settings WHERE id=1").get().value,
    ),
  });
  function key() {
    if (env.ELEVENLABS_API_KEY?.trim()) return env.ELEVENLABS_API_KEY.trim();
    if (!existsSync(secretsPath)) return "";
    try {
      const value = JSON.parse(
        readFileSync(secretsPath, "utf8"),
      ).elevenLabsApiKey;
      if (!value) return "";
      if (typeof value !== "string" || value.length > 500 || /\s/.test(value))
        throw new Error();
      return value;
    } catch {
      throw fail(500, "Fișierul local al cheii pentru voce nu este valid.");
    }
  }
  const ready = () => !!(key() && settings().voiceId);
  const publicConfig = () => {
    const s = settings();
    return { mode: s.mode, pitch: s.pitch, rate: s.rate, aiReady: ready() };
  };
  const day = () => new Date().toISOString().slice(0, 10);
  function listClips() {
    return db
      .prepare("SELECT * FROM voice_clips ORDER BY created DESC")
      .all()
      .map((c) => ({
        id: c.id,
        label: c.label,
        sourceKey: c.source_key,
        text: c.match_text,
        url: "/api/voice/files/" + c.filename,
        stale: !!(
          c.source_key &&
          normalText(renderMessage(getMessages(), c.source_key)) !==
            c.match_text
        ),
      }));
  }
  function adminConfig() {
    return {
      settings: settings(),
      publicConfig: publicConfig(),
      keyReady: !!key(),
      keySource: env.ELEVENLABS_API_KEY?.trim()
        ? "environment"
        : key()
          ? "file"
          : "none",
      clips: listClips(),
      usage: {
        day: day(),
        characters:
          db
            .prepare("SELECT characters FROM voice_usage WHERE day=?")
            .get(day())?.characters || 0,
      },
      cacheCount: db.prepare("SELECT count(*) AS count FROM voice_cache").get()
        .count,
    };
  }
  function saveConfig(body) {
    const s = validateVoice(body?.settings);
    if (
      body.apiKey !== undefined &&
      (typeof body.apiKey !== "string" ||
        body.apiKey.length > 500 ||
        /[\r\n\s]/.test(body.apiKey))
    )
      throw fail(400, "Cheia API nu este validă.");
    if ((body.apiKey || body.clearKey) && env.ELEVENLABS_API_KEY?.trim())
      throw fail(
        400,
        "Cheia este configurată în mediul serverului. Modific-o acolo.",
      );
    if (body.apiKey || body.clearKey) {
      mkdirSync(dirname(secretsPath), { recursive: true });
      const tmp = secretsPath + "." + process.pid + ".tmp";
      writeFileSync(
        tmp,
        JSON.stringify({ elevenLabsApiKey: body.clearKey ? "" : body.apiKey }) +
          "\n",
        { mode: 0o600 },
      );
      renameSync(tmp, secretsPath);
    }
    db.prepare("UPDATE voice_settings SET value=? WHERE id=1").run(
      JSON.stringify(s),
    );
    return adminConfig();
  }
  function clipInfo(body) {
    if (
      !body ||
      typeof body.label !== "string" ||
      !body.label.trim() ||
      body.label.length > 120 ||
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > 6000
    )
      throw fail(400, "Completează numele și textul exact al replicii.");
    if (
      body.sourceKey &&
      (!Object.hasOwn(MESSAGE_BY_KEY, body.sourceKey) ||
        typeof body.sourceKey !== "string")
    )
      throw fail(400, "Replica aleasă nu există.");
    if (/\{\w+\}/.test(body.text))
      throw fail(
        400,
        "Înlocuiește variabilele cu numerele reale sau folosește generarea AI pentru replicile dinamice.",
      );
    return {
      label: body.label.trim(),
      text: normalText(body.text),
      sourceKey: body.sourceKey || null,
    };
  }
  function upload(bytes, body) {
    const info = clipInfo(body);
    if (bytes.length > MAX_AUDIO)
      throw fail(413, "Fișierul audio poate avea maximum 15 MB.");
    const type = audioType(bytes),
      filename = randomUUID() + "." + type.ext,
      id = randomUUID();
    // Replacing a recording only removes that recording's own file.
    const old = db
      .prepare("SELECT filename FROM voice_clips WHERE match_text=?")
      .get(info.text);
    writeFileSync(resolve(directory, filename), bytes, { flag: "wx" });
    db.prepare(
      "INSERT INTO voice_clips VALUES(?,?,?,?,?,?) ON CONFLICT(match_text) DO UPDATE SET label=excluded.label,source_key=excluded.source_key,filename=excluded.filename,created=excluded.created",
    ).run(id, info.label, info.sourceKey, info.text, filename, Date.now());
    if (old) removeFile(old.filename);
    return adminConfig();
  }
  function removeFile(filename) {
    if (
      /^[a-f0-9-]+\.(mp3|wav|ogg|m4a)$/.test(filename) &&
      existsSync(resolve(directory, filename))
    )
      unlinkSync(resolve(directory, filename));
  }
  function removeClip(id) {
    const old = db
      .prepare("SELECT filename FROM voice_clips WHERE id=?")
      .get(id);
    if (!old) throw fail(404, "Înregistrare inexistentă.");
    db.prepare("DELETE FROM voice_clips WHERE id=?").run(id);
    removeFile(old.filename);
    return adminConfig();
  }
  async function requestProvider(url, options = {}) {
    if (!key()) throw fail(409, "Adaugă cheia ElevenLabs în Atelier → Vocea.");
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: { ...options.headers, "xi-api-key": key() },
        signal: AbortSignal.timeout(45000),
        redirect: "error",
      });
    } catch {
      throw fail(
        502,
        "Serviciul de voce nu răspunde momentan. Poți folosi înregistrările sau vocea browserului.",
      );
    }
    if (!response.ok) {
      const status =
        response.status === 401 || response.status === 403
          ? 409
          : response.status === 429
            ? 429
            : 502;
      throw fail(
        status,
        response.status === 401 || response.status === 403
          ? "Verifică cheia API, permisiunile și accesul la voce în ElevenLabs."
          : response.status === 429
            ? "ElevenLabs a limitat cererile. Verifică limita contului și încearcă mai târziu."
            : "ElevenLabs nu a putut genera vocea. Verifică vocea și creditele contului.",
      );
    }
    return response;
  }
  async function voices(token = "") {
    if (typeof token !== "string" || token.length > 500)
      throw fail(400, "Pagina de voci nu este validă.");
    const url = new URL("https://api.elevenlabs.io/v2/voices");
    url.searchParams.set("page_size", "100");
    if (token) url.searchParams.set("next_page_token", token);
    const response = await requestProvider(url.href),
      data = await response.json();
    return {
      voices: (data.voices || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
      })),
      next: data.has_more ? data.next_page_token || "" : "",
    };
  }
  const pending = new Map(),
    rates = new Map();
  function trimCache() {
    const rows = db
      .prepare("SELECT * FROM voice_cache ORDER BY created DESC")
      .all();
    let total = 0;
    rows.forEach((r, i) => {
      total += r.bytes;
      if (i >= 500 || total > 100 * 1024 * 1024) {
        db.prepare("DELETE FROM voice_cache WHERE hash=?").run(r.hash);
        removeFile(r.filename);
      }
    });
  }
  async function synthesize(text, userId) {
    const s = settings();
    if (!ready())
      throw fail(409, "Adaugă cheia și alege vocea în Atelier → Vocea.");
    const hash = digest(
      JSON.stringify({
        text,
        voiceId: s.voiceId,
        model: s.modelId,
        stability: s.stability,
        style: s.style,
      }),
    );
    const cached = db
      .prepare("SELECT filename FROM voice_cache WHERE hash=?")
      .get(hash);
    if (cached && existsSync(resolve(directory, cached.filename)))
      return {
        url: "/api/voice/files/" + cached.filename,
        kind: "generated",
        cached: true,
      };
    if (pending.has(hash)) return pending.get(hash);
    if (pending.size >= 2)
      throw fail(
        429,
        "Cavalerul pregătește deja două replici. Încearcă peste câteva secunde.",
      );
    const now = Date.now(),
      old = rates.get(userId),
      rate = old && old.until > now ? old : { count: 0, until: now + 60000 };
    if (rate.count >= 20)
      throw fail(429, "Prea multe replici noi. Așteaptă un minut.");
    rate.count++;
    rates.set(userId, rate);
    const used =
      db.prepare("SELECT characters FROM voice_usage WHERE day=?").get(day())
        ?.characters || 0;
    if (used + text.length > s.dailyLimit)
      throw fail(
        429,
        "Limita zilnică de generare a fost atinsă. Înregistrările salvate rămân disponibile.",
      );
    db.prepare(
      "INSERT INTO voice_usage VALUES(?,?) ON CONFLICT(day) DO UPDATE SET characters=characters+excluded.characters",
    ).run(day(), text.length);
    const work = (async () => {
      const response = await requestProvider(
        "https://api.elevenlabs.io/v1/text-to-speech/" +
          s.voiceId +
          "?output_format=mp3_44100_128",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: s.modelId,
            voice_settings: {
              stability: s.stability,
              similarity_boost: 0.75,
              style: s.style,
              use_speaker_boost: true,
            },
          }),
        },
      );
      if (!(response.headers.get("content-type") || "").startsWith("audio/"))
        throw fail(502, "Serviciul nu a returnat un fișier audio.");
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_AUDIO)
          throw fail(502, "Răspunsul audio este prea mare.");
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      let type;
      try {
        type = audioType(bytes);
      } catch {
        throw fail(502, "Serviciul nu a returnat un fișier audio valid.");
      }
      const filename = randomUUID() + "." + type.ext;
      writeFileSync(resolve(directory, filename), bytes, { flag: "wx" });
      db.prepare(
        "INSERT INTO voice_cache VALUES(?,?,?,?) ON CONFLICT(hash) DO UPDATE SET filename=excluded.filename,bytes=excluded.bytes,created=excluded.created",
      ).run(hash, filename, bytes.length, Date.now());
      trimCache();
      return {
        url: "/api/voice/files/" + filename,
        kind: "generated",
        cached: false,
      };
    })();
    pending.set(hash, work);
    try {
      return await work;
    } finally {
      pending.delete(hash);
    }
  }
  function speechText(body) {
    if (
      !body ||
      typeof body.message !== "string" ||
      typeof (body.title ?? "") !== "string" ||
      typeof (body.detail ?? "") !== "string"
    )
      throw fail(400, "Replica nu este validă.");
    const main = normalText(body.message || body.title || ""),
      text = normalText(
        [body.title, body.message, body.detail].filter(Boolean).join(". "),
      );
    if (!text || text.length > 8000)
      throw fail(400, "Replica poate avea maximum 8.000 de caractere.");
    return { main, text };
  }
  async function resolveSpeech(body, userId) {
    const { main, text } = speechText(body),
      s = settings();
    if (s.mode === "browser") return { url: null, kind: "browser" };
    const clip = db
      .prepare("SELECT filename FROM voice_clips WHERE match_text=?")
      .get(main);
    if (clip && existsSync(resolve(directory, clip.filename)))
      return { url: "/api/voice/files/" + clip.filename, kind: "recording" };
    if (s.mode === "ai") return synthesize(text, userId);
    return { url: null, kind: "browser" };
  }
  async function generateClip(body, userId) {
    const info = clipInfo(body);
    const speech = await synthesize(info.text, userId);
    return upload(
      readFileSync(resolve(directory, speech.url.split("/").at(-1))),
      body,
    );
  }
  function clearCache() {
    if (pending.size)
      throw fail(
        409,
        "Așteaptă terminarea generării înainte de golirea cache-ului.",
      );
    for (const r of db.prepare("SELECT filename FROM voice_cache").all())
      removeFile(r.filename);
    db.prepare("DELETE FROM voice_cache").run();
    return adminConfig();
  }
  function serve(req, res, filename) {
    if (
      !/^[a-f0-9-]+\.(mp3|wav|ogg|m4a)$/.test(filename) ||
      !db
        .prepare(
          "SELECT filename FROM voice_clips WHERE filename=? UNION SELECT filename FROM voice_cache WHERE filename=?",
        )
        .get(filename, filename)
    )
      throw fail(404, "Fișier audio inexistent.");
    const path = resolve(directory, filename);
    if (!existsSync(path)) throw fail(404, "Fișier audio inexistent.");
    const size = statSync(path).size,
      mime = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
      }[filename.split(".").at(-1)];
    const headers = {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    };
    let start = 0,
      end = size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { "Content-Range": "bytes */" + size });
        res.end();
        return;
      }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start > end ||
        start >= size
      ) {
        res.writeHead(416, { "Content-Range": "bytes */" + size });
        res.end();
        return;
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(req.headers.range ? 206 : 200, headers);
    if (req.method === "HEAD") res.end();
    else
      createReadStream(path, { start, end })
        .on("error", () => res.destroy())
        .pipe(res);
  }
  return {
    publicConfig,
    adminConfig,
    saveConfig,
    upload,
    removeClip,
    voices,
    resolveSpeech,
    generateClip,
    clearCache,
    serve,
  };
}
