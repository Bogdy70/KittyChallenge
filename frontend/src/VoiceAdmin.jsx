import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useVoice } from "./Voice";
import { useMessages } from "./Messages";
import {
  MESSAGE_FIELDS,
  MESSAGE_GROUPS,
  renderMessage,
} from "../../shared/messages.mjs";
import { GuideSpeech } from "./Guide";
import { ErrorBox, Icon, Loading } from "./Art";
const welcome =
  "home.eu-sunt-cavalerul-miau-paznicul-cadoului-tau-am-o-sabie-mica-si-m";
export default function VoiceAdmin({ notify }) {
  const { setConfig } = useVoice(),
    { messages, t } = useMessages();
  const [data, setData] = useState(null),
    [draft, setDraft] = useState(null),
    [apiKey, setApiKey] = useState(""),
    [clearKey, setClearKey] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [voices, setVoices] = useState([]),
    [next, setNext] = useState(""),
    [sourceKey, setSourceKey] = useState(welcome),
    [text, setText] = useState(renderMessage(messages, welcome)),
    [label, setLabel] = useState("Salutul cavalerului"),
    [search, setSearch] = useState("");
  async function load() {
    try {
      const result = await api("/admin/voice");
      setData(result);
      setDraft(result.settings);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const choices = useMemo(
    () =>
      MESSAGE_FIELDS.filter(
        (f) =>
          ["home", "math", "puzzle", "hints", "explanations"].includes(
            f.group,
          ) &&
          `${f.label} ${renderMessage(messages, f.key)}`
            .toLocaleLowerCase("ro")
            .includes(search.toLocaleLowerCase("ro")),
      ),
    [search, messages],
  );
  function adopt(result, resetDraft = false) {
    setData(result);
    if (resetDraft) setDraft(result.settings);
    setConfig(result.publicConfig);
  }
  async function action(fn, message, resetDraft = false) {
    setBusy(true);
    setError("");
    try {
      adopt(await fn(), resetDraft);
      if (message) notify(message);
      return true;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    const saved = await action(
      () =>
        api("/admin/voice", {
          method: "PUT",
          body: {
            settings: draft,
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            clearKey,
          },
        }),
      "Vocea cavalerului a fost configurată.",
      true,
    );
    if (saved) {
      setApiKey("");
      setClearKey(false);
    }
  }
  async function listVoices(append = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        "/admin/voice/voices" +
          (append ? "?page=" + encodeURIComponent(next) : ""),
      );
      setVoices((old) => (append ? [...old, ...result.voices] : result.voices));
      setNext(result.next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function selectKey(key) {
    setSourceKey(key);
    if (key) {
      const field = MESSAGE_FIELDS.find((f) => f.key === key);
      setText(renderMessage(messages, key));
      setLabel(field.label.slice(0, 120));
    }
  }
  const metadata = () => ({
    label,
    text,
    sourceKey:
      sourceKey && renderMessage(messages, sourceKey) === text
        ? sourceKey
        : null,
  });
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("Fișierul audio poate avea maximum 15 MB.");
      return;
    }
    if (!text.trim() || /\{\w+\}/.test(text)) {
      setError(
        "Scrie textul exact al înregistrării, fără variabile între acolade.",
      );
      return;
    }
    const json = new TextEncoder().encode(JSON.stringify(metadata())),
      length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, json.length);
    await action(
      () =>
        api("/admin/voice/clips", {
          method: "POST",
          body: new Blob([length, json, file], {
            type: "application/octet-stream",
          }),
        }),
      "Înregistrarea a fost adăugată. Cavalerul o poate reda și pe telefon.",
    );
  }
  if (!data || !draft)
    return (
      <>
        <ErrorBox>{error}</ErrorBox>
        {error ? (
          <button className="button" onClick={load}>
            Încearcă din nou
          </button>
        ) : (
          <Loading />
        )}
      </>
    );
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(data.settings) ||
    !!apiKey ||
    clearKey;
  return (
    <div className="voice-studio">
      <section className="panel voice-intro">
        <span className="eyebrow">O VOCE PENTRU CAVALERUL VOSTRU</span>
        <h2>Un miau care se aude.</h2>
        <p>
          Încarcă o replică înregistrată sau alege o voce care citește textele
          noi. Audio-ul încărcat și generat se redă pe calculator și telefon,
          fără instalarea unei voci pe fiecare dispozitiv.
        </p>
        <p className="field-help">
          Un fișier audio redă ce este înregistrat în el. Pentru aceeași voce la
          texte noi, creează sau adaugă vocea în contul ElevenLabs și
          selecteaz-o aici.
        </p>
      </section>
      <ErrorBox>{error}</ErrorBox>
      <div className="voice-admin-grid">
        <form className="panel voice-settings" onSubmit={save}>
          <h3>Cum vorbește cavalerul?</h3>
          <label>
            Modul vocii
            <select
              aria-label="Modul vocii"
              value={draft.mode}
              onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
            >
              <option value="recordings">
                Înregistrări + vocea browserului
              </option>
              <option value="ai">Înregistrări + generare ElevenLabs</option>
              <option value="browser">Doar vocea browserului</option>
            </select>
          </label>
          <p className="field-help">
            Înregistrarea potrivită are prioritate. Fără înregistrare, modul
            ElevenLabs generează replica la apăsarea „Ascultă”, iar primul mod
            încearcă vocea română a dispozitivului.
          </p>
          <div className="voice-provider-fields">
            <span className="eyebrow">GENERARE OPȚIONALĂ · ELEVENLABS</span>
            <label>
              Cheia API ElevenLabs
              <input
                type="password"
                aria-label="Cheia API ElevenLabs"
                autoComplete="off"
                value={apiKey}
                disabled={data.keySource === "environment"}
                placeholder={
                  data.keyReady
                    ? "Cheie configurată; lasă gol pentru a o păstra"
                    : "Adaugă cheia API"
                }
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
            <p className="field-help">
              {data.keySource === "environment"
                ? "Cheia vine din mediul serverului."
                : data.keyReady
                  ? "Cheia este salvată local și nu este returnată în browser."
                  : "Poți folosi înregistrările fără cheie API."}
            </p>
            {data.keySource === "file" && (
              <label className="voice-checkbox">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => setClearKey(e.target.checked)}
                />
                Șterge cheia salvată la următoarea salvare
              </label>
            )}
            <p className="field-help">
              Salvează întâi cheia, încarcă vocile din cont, alege una și
              salvează din nou. Poți copia și Voice ID pentru o voce creată de
              tine.
            </p>
            <div className="voice-list-action">
              <button
                className="button small"
                type="button"
                disabled={busy || !data.keyReady || dirty}
                onClick={() => listVoices()}
              >
                Încarcă vocile din cont
              </button>
              {next && (
                <button
                  className="button small"
                  type="button"
                  disabled={busy}
                  onClick={() => listVoices(true)}
                >
                  Mai multe voci
                </button>
              )}
            </div>
            {!!voices.length && (
              <label>
                Alege o voce
                <select
                  aria-label="Alege o voce"
                  value={draft.voiceId}
                  onChange={(e) =>
                    setDraft({ ...draft, voiceId: e.target.value })
                  }
                >
                  <option value="">Selectează…</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.category}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Voice ID
              <input
                aria-label="Voice ID"
                value={draft.voiceId}
                maxLength={100}
                placeholder="Din contul ElevenLabs"
                onChange={(e) =>
                  setDraft({ ...draft, voiceId: e.target.value.trim() })
                }
              />
            </label>
            <label>
              Model
              <select
                aria-label="Model audio"
                value={draft.modelId}
                onChange={(e) =>
                  setDraft({ ...draft, modelId: e.target.value })
                }
              >
                <option value="eleven_multilingual_v2">
                  Multilingual v2 · expresiv
                </option>
                <option value="eleven_flash_v2_5">Flash v2.5 · rapid</option>
              </select>
            </label>
            <label>
              Stabilitate · {Math.round(draft.stability * 100)}%
              <input
                aria-label="Stabilitate"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={draft.stability}
                onChange={(e) =>
                  setDraft({ ...draft, stability: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Expresivitate · {Math.round(draft.style * 100)}%
              <input
                aria-label="Expresivitate"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={draft.style}
                onChange={(e) =>
                  setDraft({ ...draft, style: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Limită zilnică de caractere
              <input
                aria-label="Limită zilnică de caractere"
                type="number"
                min="100"
                max="100000"
                step="100"
                value={draft.dailyLimit}
                onChange={(e) =>
                  setDraft({ ...draft, dailyLimit: Number(e.target.value) })
                }
              />
            </label>
            <p className="field-help">
              Astăzi (UTC): {data.usage.characters} caractere trimise pentru
              generare. Replicile identice sunt refolosite din cache. Generarea
              folosește creditele contului tău ElevenLabs; textul replicii este
              trimis serviciului.
            </p>
          </div>
          <div className="voice-provider-fields">
            <span className="eyebrow">
              EFECT DISCRET · DOAR VOCEA BROWSERULUI
            </span>
            <label>
              Tonalitate · {draft.pitch.toFixed(2)}
              <input
                aria-label="Tonalitate"
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={draft.pitch}
                onChange={(e) =>
                  setDraft({ ...draft, pitch: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Viteză · {draft.rate.toFixed(2)}
              <input
                aria-label="Viteză"
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={draft.rate}
                onChange={(e) =>
                  setDraft({ ...draft, rate: Number(e.target.value) })
                }
              />
            </label>
            <p className="field-help">
              O tonalitate puțin mai înaltă poate face vocea jucăușă.
              Înregistrările și vocea ElevenLabs își păstrează timbrul original.
            </p>
          </div>
          <button className="button rainbow" disabled={busy || !dirty}>
            {busy ? "Salvăm…" : "Salvează vocea"}
            <Icon name="check" />
          </button>
        </form>
        <div className="voice-recordings">
          <section className="panel voice-clip-form">
            <h3>Adaugă o replică audio.</h3>
            <label>
              Caută o replică
              <input
                aria-label="Caută o replică"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Replica
              <select
                aria-label="Replica audio"
                value={sourceKey}
                onChange={(e) => selectKey(e.target.value)}
              >
                <option value="">Text exact, scris de mine</option>
                {!choices.some((f) => f.key === sourceKey) && sourceKey && (
                  <option value={sourceKey}>
                    {MESSAGE_FIELDS.find((f) => f.key === sourceKey)?.label}
                  </option>
                )}
                {choices.map((f) => (
                  <option key={f.key} value={f.key}>
                    {MESSAGE_GROUPS[f.group]} · {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Numele înregistrării
              <input
                aria-label="Numele înregistrării"
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label>
              Textul exact al replicii
              <textarea
                aria-label="Textul exact al replicii"
                rows={5}
                maxLength={6000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <p className="field-help">
              Fișierul trebuie să conțină replica selectată. Asocierea se face
              cu textul principal din bula cavalerului. Dacă modifici textul,
              înregistrarea veche nu se mai folosește. Pentru numere și nume
              care variază, folosește generarea AI sau o înregistrare pentru
              textul exact afișat.
            </p>
            <div className="voice-clip-actions">
              <label
                className={`button rainbow voice-upload ${busy ? "disabled" : ""}`}
              >
                Încarcă audio
                <input
                  aria-label="Încarcă audio"
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
                  disabled={busy || !text.trim() || !label.trim()}
                  onChange={upload}
                />
              </label>
              <button
                className="button"
                disabled={
                  busy ||
                  dirty ||
                  !data.keyReady ||
                  !data.settings.voiceId ||
                  !text.trim()
                }
                onClick={() =>
                  action(
                    () =>
                      api("/admin/voice/generate", {
                        method: "POST",
                        body: metadata(),
                      }),
                    "Replica generată a fost păstrată ca înregistrare.",
                  )
                }
              >
                Generează și păstrează replica
              </button>
            </div>
            <small>
              MP3, WAV, OGG sau M4A · maximum 15 MB. Poți încărca vocea ta, o
              înregistrare pregătită sau un audio generat în altă aplicație.
            </small>
          </section>
          <section className="panel voice-preview">
            <span className="eyebrow">PROBĂ · CONFIGURAȚIA SALVATĂ</span>
            <GuideSpeech
              title={t("guide.name")}
              message={text}
              speak={!/\{\w+\}/.test(text)}
            />
            <p className="field-help">
              Apasă „Ascultă”. Înregistrările salvate sunt căutate după acest
              text. Pentru testarea generării dinamice, salvează modul
              ElevenLabs. Pe unele telefoane poate apărea un player cu buton de
              redare.
            </p>
          </section>
          <section className="panel voice-library">
            <h3>Replicile păstrate · {data.clips.length}</h3>
            {!data.clips.length && (
              <p className="field-help">
                Prima înregistrare își așteaptă locul aici.
              </p>
            )}
            {data.clips.map((c) => (
              <article className="voice-clip" key={c.id}>
                <div>
                  <strong>{c.label}</strong>
                  {c.stale && (
                    <span className="pill soft-yellow">Text modificat</span>
                  )}
                </div>
                <p>{c.text}</p>
                <audio
                  controls
                  preload="none"
                  src={c.url}
                  aria-label={"Ascultă înregistrarea: " + c.label}
                />
                <button
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Ștergi această înregistrare?"))
                      action(
                        () =>
                          api("/admin/voice/clips/" + c.id, {
                            method: "DELETE",
                          }),
                        "Înregistrarea a fost eliminată.",
                      );
                  }}
                >
                  Șterge înregistrarea
                </button>
              </article>
            ))}
          </section>
          <section className="panel voice-cache">
            <h3>Replici generate în cache · {data.cacheCount}</h3>
            <p className="field-help">
              Aceeași replică și aceeași voce reutilizează fișierul audio.
              Schimbarea vocii sau textului generează alt fișier. Golirea
              cache-ului păstrează înregistrările; la ascultarea următoare,
              replicile AI vor fi generate din nou.
            </p>
            <button
              className="button small"
              disabled={busy || !data.cacheCount}
              onClick={() => {
                if (
                  confirm(
                    "Golești cache-ul? Generările următoare pot consuma credite din nou.",
                  )
                )
                  action(
                    () => api("/admin/voice/cache", { method: "DELETE" }),
                    "Cache-ul audio a fost golit.",
                  );
              }}
            >
              Golește cache-ul audio
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
