import React, { useEffect, useState } from "react";
import { api } from "./api";
import { Icon, ErrorBox, Cat } from "./Art";
import { Matrix } from "./MathChallenge";
import {
  LEVELS,
  OPERATIONS,
  solve,
  validateExercise,
} from "../../server/math.mjs";
function parseMatrix(text) {
  return text
    .trim()
    .split(/\n|;/)
    .map((row) =>
      row
        .trim()
        .split(/[\s,]+/)
        .map(Number),
    );
}
const initial = {
  title: "O provocare cu drag",
  op: "add",
  a: "1 2\n0 -1",
  b: "2 0\n1 3",
  scalar: 2,
  hint: "",
};
export default function Admin({ settings, onSaved, notify }) {
  const [form, setForm] = useState({
      recipient: settings.recipient,
      message: settings.message,
      difficulty: settings.difficulty,
      pieceCount: settings.puzzle.count,
    }),
    [exercise, setExercise] = useState(initial),
    [list, setList] = useState([]),
    [progress, setProgress] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [tab, setTab] = useState("party");
  async function refresh() {
    try {
      const [a, b] = await Promise.all([
        api("/admin/exercises"),
        api("/admin/progress"),
      ]);
      setList(a);
      setProgress(b);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    setForm({
      recipient: settings.recipient,
      message: settings.message,
      difficulty: settings.difficulty,
      pieceCount: settings.puzzle.count,
    });
  }, [settings]);
  async function save(e) {
    e.preventDefault();
    if (
      form.pieceCount !== settings.puzzle.count &&
      !confirm(
        "Schimbarea numărului de piese pornește un puzzle nou pentru ambele conturi. Continui?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const s = await api("/admin/settings", { method: "PATCH", body: form });
      onSaved(s);
      notify("Surpriza a fost actualizată.");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function photo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Alege o fotografie JPEG, PNG sau WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Fotografia originală poate avea maximum 20 MB.");
      return;
    }
    if (
      !confirm(
        "Înlocuiești imaginea? Va începe un puzzle nou pentru ambele conturi.",
      )
    )
      return;
    setUploading(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      if (
        bitmap.width < 10 ||
        bitmap.height < 10 ||
        bitmap.width * bitmap.height > 80_000_000
      ) {
        bitmap.close();
        throw new Error(
          "Alege o imagine între 10 × 10 pixeli și 80 megapixeli.",
        );
      }
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.91),
      );
      if (!blob) throw new Error("Nu am putut pregăti imaginea.");
      const s = await api(
        `/admin/photo?width=${canvas.width}&height=${canvas.height}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        },
      );
      onSaved(s);
      notify("Fotografia a devenit un puzzle!");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  const data = {
    ...exercise,
    a: parseMatrix(exercise.a),
    b: parseMatrix(exercise.b),
    scalar: Number(exercise.scalar),
  };
  let preview = null,
    previewError = "";
  try {
    validateExercise(data);
    preview = solve(data);
  } catch (e) {
    previewError = e.message;
  }
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/exercises", { method: "POST", body: data });
      notify("Exercițiul a fost adăugat la seturile viitoare.");
      setExercise(initial);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!confirm("Elimini exercițiul din seturile viitoare?")) return;
    setBusy(true);
    try {
      await api(`/admin/exercises/${id}`, { method: "DELETE" });
      refresh();
      notify("Exercițiul a fost eliminat.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DOAR PENTRU ORGANIZATOR</span>
          <h1>
            Atelierul <span className="pink">surprizelor.</span>
          </h1>
          <p>Tu pregătești magia. Pisicuțele se ocupă de atmosferă.</p>
        </div>
        <span className="tag soft-yellow">
          <Icon name="settings" /> Administrator
        </span>
      </div>
      <div
        className="admin-tabs"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const ids = ["party", "exercises", "progress"];
          const current = ids.indexOf(tab);
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 2
                : (current + (e.key === "ArrowRight" ? 1 : 2)) % 3;
          setTab(ids[next]);
          document.getElementById(`tab-${ids[next]}`)?.focus();
        }}
        role="tablist"
        aria-label="Secțiuni administrare"
      >
        {[
          ["party", "Petrecerea", "heart"],
          ["exercises", "Exercițiile", "matrix"],
          ["progress", "Progresul", "trophy"],
        ].map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            tabIndex={tab === id ? 0 : -1}
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {tab === "party" ? (
        <div
          className="admin-grid"
          role="tabpanel"
          id="panel-party"
          aria-labelledby="tab-party"
        >
          <form className="panel admin-form" onSubmit={save}>
            <div className="eyebrow">MICILE DETALII CONTEAZĂ</div>
            <h2>O petrecere pe numele ei.</h2>
            <label>
              Cum îi spunem?
              <input
                maxLength={60}
                required
                value={form.recipient}
                onChange={(e) =>
                  setForm({ ...form, recipient: e.target.value })
                }
              />
            </label>
            <label>
              Mesajul de pe prima pagină
              <textarea
                rows={4}
                maxLength={500}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
            <label>
              Nivelul de dificultate
              <select
                value={form.difficulty}
                onChange={(e) =>
                  setForm({ ...form, difficulty: e.target.value })
                }
              >
                {Object.entries(LEVELS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label} · {v.count} exerciții generate
                  </option>
                ))}
              </select>
            </label>
            <p className="field-help">
              Ușor: întregi mici și inversă 2 × 2 simplă. Mediu: adaugă scădere,
              produs și fracții. Avansat: 9 exerciții, inclusiv determinant și
              inversă 3 × 3. Schimbarea se aplică la următorul „Set nou”.
            </p>
            <fieldset>
              <legend>Numărul de piese</legend>
              <div className="piece-options">
                {[10, 100, 200, 500].map((n) => (
                  <label
                    key={n}
                    className={form.pieceCount === n ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="pieces"
                      value={n}
                      checked={form.pieceCount === n}
                      onChange={() => setForm({ ...form, pieceCount: n })}
                    />
                    <strong>{n}</strong>
                    <span>
                      {n === 10
                        ? "O îmbrățișare"
                        : n === 100
                          ? "O mică aventură"
                          : n === 200
                            ? "Multă răbdare"
                            : "Super misiune"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="field-help">
              Schimbarea numărului de piese sau a fotografiei începe un puzzle
              nou. Cel cu 500 de piese are zoom și o cutie paginată, pentru a
              rămâne ușor de folosit.
            </p>
            <button className="button rainbow" disabled={busy || uploading}>
              {busy ? "Salvăm…" : "Salvează surpriza"}
              <Icon name="check" />
            </button>
          </form>
          <section className="panel photo-panel">
            <div className="eyebrow">O AMINTIRE CARE MERITĂ RECONSTRUITĂ</div>
            <h2>Fotografia voastră.</h2>
            <div className="admin-photo">
              <img
                src={settings.puzzle.url}
                alt="Imaginea curentă a puzzle-ului"
              />
              <span>{settings.puzzle.count} piese de fericire</span>
            </div>
            <label className={`upload-zone ${uploading ? "disabled" : ""}`}>
              <Icon name="upload" size={30} />
              <strong>
                {uploading ? "Pregătim piesele…" : "Alege o fotografie"}
              </strong>
              <span>JPEG, PNG sau WebP · până la 20 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={photo}
                disabled={uploading || busy}
              />
            </label>
            <p className="field-help">
              Imaginea este optimizată în browser la maximum 2000 px. Fotografia
              încărcată este disponibilă doar utilizatorilor conectați.
              Ilustrația inițială este un model de probă.
            </p>
            <div className="admin-note">
              <Cat color="#ffbad9" />
              <p>
                O fotografie cu voi?
                <br />O pisicuță preferată?
                <br />
                <strong>Tu știi ce o face să zâmbească.</strong>
              </p>
            </div>
          </section>
        </div>
      ) : tab === "exercises" ? (
        <div
          className="admin-grid"
          role="tabpanel"
          id="panel-exercises"
          aria-labelledby="tab-exercises"
        >
          <form className="panel admin-form" onSubmit={add}>
            <div className="eyebrow">PUȚINĂ MATEMATICĂ, MULT DRAG</div>
            <h2>Adaugă o provocare.</h2>
            <label>
              Titlul exercițiului
              <input
                required
                maxLength={100}
                value={exercise.title}
                onChange={(e) =>
                  setExercise({ ...exercise, title: e.target.value })
                }
              />
            </label>
            <label>
              Operația
              <select
                value={exercise.op}
                onChange={(e) =>
                  setExercise({ ...exercise, op: e.target.value })
                }
              >
                {Object.entries(OPERATIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="matrix-editors">
              <label>
                Matricea A
                <textarea
                  className="matrix-text"
                  rows={3}
                  value={exercise.a}
                  onChange={(e) =>
                    setExercise({ ...exercise, a: e.target.value })
                  }
                />
              </label>
              {["add", "subtract", "multiply"].includes(exercise.op) && (
                <label>
                  Matricea B
                  <textarea
                    className="matrix-text"
                    rows={3}
                    value={exercise.b}
                    onChange={(e) =>
                      setExercise({ ...exercise, b: e.target.value })
                    }
                  />
                </label>
              )}
            </div>
            <p className="field-help">
              Un rând pe linie, numere separate prin spații. Maximum 3 × 3,
              întregi între −9 și 9.
            </p>
            {exercise.op === "scale" && (
              <label>
                Înmulțește cu
                <input
                  type="number"
                  min="-9"
                  max="9"
                  value={exercise.scalar}
                  onChange={(e) =>
                    setExercise({ ...exercise, scalar: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Un indiciu personalizat <span className="muted">(opțional)</span>
              <textarea
                rows={2}
                maxLength={500}
                value={exercise.hint}
                onChange={(e) =>
                  setExercise({ ...exercise, hint: e.target.value })
                }
              />
            </label>
            <ErrorBox>{previewError}</ErrorBox>
            {preview && (
              <div className="answer-preview">
                <span className="eyebrow">SOLUȚIA CALCULATĂ AUTOMAT</span>
                <Matrix values={preview} label="Rezultat" />
              </div>
            )}
            <button className="button dark" disabled={busy || !preview}>
              <Icon name="plus" /> Adaugă exercițiul
            </button>
            <p className="field-help">
              Exercițiile tale se adaugă după cele generate automat. Seturile
              începute își păstrează conținutul și progresul.
            </p>
          </form>
          <section className="panel">
            <h2>
              Colecția ta <span className="count-badge">{list.length}/20</span>
            </h2>
            {list.length === 0 ? (
              <div className="empty-state">
                <Cat sleepy color="#bca5fa" />
                <h3>Loc pentru ideile tale.</h3>
                <p>
                  Cele 5–9 exerciții generate sunt deja pregătite. Aici poți
                  adăuga ceva personal.
                </p>
              </div>
            ) : (
              <div className="custom-list">
                {list.map((e) => (
                  <article key={e.id}>
                    <div>
                      <strong>{e.title}</strong>
                      <p>
                        {OPERATIONS[e.op]} · {e.a.length} × {e.a[0].length}
                      </p>
                    </div>
                    <button
                      className="icon-button danger-text"
                      disabled={busy}
                      onClick={() => remove(e.id)}
                      aria-label={`Elimină ${e.title}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section
          className="panel"
          role="tabpanel"
          id="panel-progress"
          aria-labelledby="tab-progress"
        >
          <div className="section-title">
            <div>
              <h2>Micile victorii, la un loc.</h2>
              <p>
                Progres separat pentru fiecare cont. Testele tale nu schimbă
                aventura ei.
              </p>
            </div>
            <button className="button small" onClick={refresh}>
              <Icon name="refresh" size={16} /> Actualizează
            </button>
          </div>
          <div className="progress-cards">
            {progress.map((p) => (
              <article key={p.id}>
                <span className="avatar">
                  <Icon name={p.role === "admin" ? "star" : "heart"} />
                </span>
                <h3>{p.displayName}</h3>
                <span className="pill">
                  {p.role === "admin" ? "Administrator" : "Invitata de onoare"}
                </span>
                <dl>
                  <div>
                    <dt>Matrici rezolvate</dt>
                    <dd>
                      {p.mathSolved} / {p.mathTotal || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Soluții consultate</dt>
                    <dd>{p.mathRevealed}</dd>
                  </div>
                  <div>
                    <dt>Piese potrivite</dt>
                    <dd>
                      {p.puzzlePlaced} / {p.puzzleTotal}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hint-box">
            <Icon name="lock" />
            <p>
              Conturile și parolele se modifică în{" "}
              <code>config/accounts.json</code>, apoi repornești serverul. Sunt
              exact două conturi; nu există înregistrare publică.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
