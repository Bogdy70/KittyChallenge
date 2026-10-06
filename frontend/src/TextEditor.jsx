import React, { useMemo, useState } from "react";
import {
  MESSAGE_FIELDS,
  MESSAGE_GROUPS,
  DEFAULT_MESSAGES,
  renderMessage,
  validateMessages,
} from "../../shared/messages.mjs";
import { useMessages } from "./Messages";
import { api } from "./api";
import { GuideSpeech } from "./Guide";
import { Icon, ErrorBox } from "./Art";
export default function TextEditor({ onSaved, notify }) {
  const { messages } = useMessages();
  const [baseline, setBaseline] = useState(messages),
    [draft, setDraft] = useState(messages),
    [group, setGroup] = useState("guide"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState("guide.name"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const visible = useMemo(
    () =>
      MESSAGE_FIELDS.filter(
        (f) =>
          (!group || f.group === group) &&
          `${f.label} ${f.value} ${draft[f.key] || ""}`
            .toLocaleLowerCase("ro")
            .includes(search.toLocaleLowerCase("ro")),
      ),
    [draft, group, search],
  );
  const dirty = MESSAGE_FIELDS.filter(
    (f) =>
      (draft[f.key]?.trim() ? draft[f.key] : f.value) !==
      (baseline[f.key]?.trim() ? baseline[f.key] : f.value),
  ).length;
  let validation = "";
  try {
    validateMessages(draft);
  } catch (e) {
    validation = e.message;
  }
  const active =
    MESSAGE_FIELDS.find((f) => f.key === selected) ||
    visible[0] ||
    MESSAGE_FIELDS[0];
  const parameters = {
    recipient: "Sărbătorita",
    guide: draft["guide.name"] || DEFAULT_MESSAGES["guide.name"],
    scalar: 2,
    determinant: -1,
    a11: 1,
    a12: 2,
    a21: 1,
    a22: 1,
    row: 2,
    col: 3,
    count: 10,
    remaining: 8,
    attempts: 2,
    error: "Exemplu de mesaj",
    value1: 2,
    value2: 3,
    value3: "",
  };
  async function save(event) {
    event.preventDefault();
    if (validation) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/admin/messages", {
        method: "PUT",
        body: { messages: validateMessages(draft) },
      });
      setDraft(result.messages);
      setBaseline(result.messages);
      onSaved(result);
      notify("Textele au fost salvate. Cavalerul și-a învățat replicile noi!");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function reset(key) {
    setDraft((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function exportCopy() {
    try {
      const blob = new Blob(
        [
          JSON.stringify(
            { version: 1, messages: validateMessages(draft) },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "kitty-party-mesaje.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  async function importCopy(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 150000)
        throw new Error("Fișierul de texte poate avea maximum 150 KB.");
      const data = JSON.parse(await file.text());
      const incoming = validateMessages(data.messages ?? data);
      if (
        !confirm(
          "Încarci aceste texte în editor? Modificările nesalvate vor fi înlocuite.",
        )
      )
        return;
      setDraft(incoming);
      setError("");
      setGroup("");
      setSearch("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <form className="text-editor" onSubmit={save}>
      <section className="panel text-intro">
        <span className="eyebrow">REPLICILE VOASTRE, ÎN CUVINTELE TALE</span>
        <h2>Vocea petrecerii.</h2>
        <p>
          Personalizează {MESSAGE_FIELDS.length} texte: saluturi, titluri,
          reacții, butoane, indicii și explicații. Textele sunt păstrate în baza
          de date; nu modifici codul și nu repornești serverul.
        </p>
        <p className="field-help">
          Păstrează variabilele dintre acolade când vrei numerele sau numele
          automat. Câmpurile goale revin la textul implicit. Indiciul scris
          pentru un exercițiu personalizat are prioritate față de indiciul
          general al operației.
        </p>
      </section>
      <div className="text-toolbar">
        <label>
          Caută un text
          <input
            type="search"
            aria-label="Caută un text"
            value={search}
            placeholder="De exemplu: sabie, indiciu, puzzle…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            aria-label="Categoria"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setSearch("");
            }}
          >
            <option value="">Toate categoriile</option>
            {Object.entries(MESSAGE_GROUPS).map(([key, label]) => (
              <option key={key} value={key}>
                {label} · {MESSAGE_FIELDS.filter((f) => f.group === key).length}
              </option>
            ))}
          </select>
        </label>
        <div className="text-save">
          <span role="status">
            {dirty
              ? `${dirty} texte modificate, nesalvate`
              : "Toate textele sunt salvate"}
          </span>
          <button
            className="button rainbow"
            disabled={busy || !dirty || !!validation}
          >
            {busy ? "Salvăm…" : "Salvează textele"}
            <Icon name="check" />
          </button>
        </div>
      </div>
      <ErrorBox>{error || validation}</ErrorBox>
      <div className="text-editor-grid">
        <section className="message-fields" aria-label="Texte editabile">
          <p className="field-help">
            {visible.length} texte în această selecție. Alege un câmp pentru
            previzualizare.
          </p>
          {visible.map((f) => (
            <article
              className={`message-field ${selected === f.key ? "focused" : ""}`}
              key={f.key}
            >
              <div className="message-field-top">
                <span className="eyebrow">{MESSAGE_GROUPS[f.group]}</span>
                <button
                  className="text-button"
                  type="button"
                  disabled={busy || !Object.hasOwn(draft, f.key)}
                  onClick={() => reset(f.key)}
                  aria-label={`Revino la implicit: ${f.label}`}
                >
                  Text implicit
                </button>
              </div>
              <label>
                {f.label}
                <textarea
                  id={`copy-${f.key}`}
                  aria-label={f.label}
                  rows={f.value.length > 140 ? 4 : 2}
                  maxLength={f.maxLength}
                  value={draft[f.key] ?? f.value}
                  onFocus={() => setSelected(f.key)}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      [f.key]: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="message-variables">
                <span>
                  {(draft[f.key] ?? f.value).length}/{f.maxLength}
                </span>
                {f.variables.map((v) => (
                  <code key={v}>{"{" + v + "}"}</code>
                ))}
                <small>
                  {Object.hasOwn(draft, f.key) && draft[f.key] !== f.value
                    ? "Personalizat"
                    : "Implicit"}
                </small>
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="panel">
              <p>Niciun text găsit. Încearcă alt cuvânt sau altă categorie.</p>
            </div>
          )}
        </section>
        <aside className="text-preview">
          <section className="panel">
            <span className="eyebrow">PREVIZUALIZARE · VALORI DE EXEMPLU</span>
            <h3>{active.label}</h3>
            <GuideSpeech
              className="editor-guide"
              title={draft["guide.name"] || DEFAULT_MESSAGES["guide.name"]}
              message={renderMessage(draft, active.key, parameters)}
              speak={false}
            />
            <p className="field-help">
              La salvare, ghidul folosește numerele reale din exercițiu sau
              puzzle. În alte ferestre, textele se actualizează la reîncărcare
              ori când revii în fereastră.
            </p>
          </section>
          <section className="panel text-tools">
            <h3>Păstrează cuvintele.</h3>
            <button
              className="button small"
              type="button"
              onClick={exportCopy}
              disabled={!!validation}
            >
              <Icon name="upload" size={16} />
              Exportă textele
            </button>
            <label className="button small">
              Importă texte JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={importCopy}
                disabled={busy}
                aria-label="Importă texte JSON"
              />
            </label>
            <button
              className="text-button danger-text"
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Revii la toate textele implicite? Modificarea se aplică după salvare.",
                  )
                )
                  setDraft({});
              }}
            >
              Revino la toate textele implicite
            </button>
            <small>
              Exportul include textele personalizate. Nu conține conturi,
              parole, progres sau fotografii.
            </small>
          </section>
        </aside>
      </div>
    </form>
  );
}
