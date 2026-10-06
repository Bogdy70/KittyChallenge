import { useMessages } from "./Messages";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { api } from "./api";
import { KnightCat, GuideSpeech } from "./Guide";
import { Icon, Progress, ErrorBox, Loading } from "./Art";
import { LEVELS, OPERATIONS } from "../../server/math.mjs";
export function Matrix({
  values,
  editable = false,
  onChange,
  marks,
  label = "Matrice",
  cat = false,
}) {
  return (
    <div className={`matrix-wrap ${cat ? "cat-matrix" : ""}`}>
      <span className="matrix-label">{label}</span>
      {cat && (
        <>
          <div className="matrix-ear left" />
          <div className="matrix-ear right" />
        </>
      )}
      <div className="matrix-brackets">
        <div
          className="matrix-cells"
          style={{
            gridTemplateColumns: `repeat(${values[0]?.length || 1}, minmax(44px, 1fr))`,
          }}
        >
          {values.flatMap((row, i) =>
            row.map((v, j) =>
              editable ? (
                <input
                  key={`${i}-${j}`}
                  aria-label={`${label}, rândul ${i + 1}, coloana ${j + 1}`}
                  className={
                    marks ? (marks[i]?.[j] ? "cell-correct" : "cell-wrong") : ""
                  }
                  value={v}
                  placeholder="?"
                  onChange={(e) => onChange(i, j, e.target.value)}
                  autoComplete="off"
                  maxLength={20}
                />
              ) : (
                <span key={`${i}-${j}`}>{String(v).replaceAll("-", "−")}</span>
              ),
            ),
          )}
        </div>
      </div>
      {cat && <div className="matrix-face">⌣ · ⌣</div>}
    </div>
  );
}
const symbols = {
  add: "+",
  subtract: "−",
  multiply: "×",
};
export default function MathChallenge({ celebrate, onProgress, onPuzzle }) {
  const { t } = useMessages();
  const [run, setRun] = useState(null),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState([]),
    [result, setResult] = useState(null),
    [dialogue, setDialogue] = useState(null),
    [solution, setSolution] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setError("");
      const data = await api("/math");
      setRun(data);
      setIndex(
        Math.max(
          0,
          data.exercises.findIndex((e) => !e.solved),
        ),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const exercise = run?.exercises[index];
  // Reset before paint so a new exercise never briefly reuses the old answer grid.
  useLayoutEffect(() => {
    if (exercise) {
      setAnswer(
        Array.from(
          {
            length: exercise.rows,
          },
          () => Array(exercise.cols).fill(""),
        ),
      );
      setResult(null);
      setDialogue(null);
      setSolution(null);
      setError("");
    }
  }, [exercise?.id, run?.id]);
  async function action(kind) {
    if (!exercise) return;
    setBusy(true);
    setError("");
    try {
      const data = await api(`/math/${exercise.id}/${kind}`, {
        method: "POST",
        body: {
          answer,
          runId: run.id,
        },
      });
      setRun((r) => ({
        ...r,
        solved: data.solved,
        exercises: r.exercises.map((e) =>
          e.id === exercise.id ? data.exercise : e,
        ),
      }));
      if (kind === "hint")
        setDialogue({
          title: t("math.o-soapta-de-la-pisicuta"),
          message: data.hint,
          mood: "thinking",
        });
      if (kind === "solution") {
        setSolution(data);
        setDialogue({
          title: t("math.desfacem-misterul-impreuna"),
          message: data.explanation,
          detail: t(
            "math.solutia-este-mai-jos-poti-incerca-din-nou-fara-penalizari",
          ),
          mood: "thinking",
        });
      }
      if (kind === "check") {
        setResult(data);
        setDialogue({
          title: data.message,
          message: data.correct
            ? t("math.imi-ridic-sabia-pentru-tine-ai-facut-inca-un-pas-inainte")
            : t(
                "math.nu-i-nimic-curajoaso-casutele-colorate-iti-arata-ce-mai-trebuie-r",
              ),
          detail: data.explanation,
          mood: data.correct ? "celebrate" : "encourage",
        });
        if (data.correct) {
          celebrate(
            data.solved === run.exercises.length
              ? t("math.toate-matricile-au-spus-miau-ai-terminat")
              : t("math.purrfect-inca-o-mica-victorie"),
          );
        } else onProgress();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function restart() {
    if (
      !confirm(
        t("math.generezi-un-set-nou-progresul-setului-curent-va-fi-inlocuit"),
      )
    )
      return;
    setBusy(true);
    try {
      setRun(
        await api("/math/restart", {
          method: "POST",
        }),
      );
      setIndex(0);
      onProgress();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!run)
    return (
      <>
        <ErrorBox>{error}</ErrorBox>
        {error ? (
          <button className="button" onClick={load}>
            {t("general.incearca-din-nou")}
          </button>
        ) : (
          <Loading />
        )}
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("math.provocarea-01-mici-victorii")}
          </span>
          <h1>
            {t("general.matrici") + " "}
            <span className="pink">{t("math.mustati")}</span>
          </h1>
          <p>
            {t(
              "math.ia-le-pe-rand-gandeste-cu-voce-tare-pisicuta-nu-te-judeca",
            )}
          </p>
        </div>
        <span className="tag lavender">
          <Icon name="spark" />
          {LEVELS[run.level]?.label}
        </span>
      </div>
      <div className="math-layout">
        <aside className="exercise-sidebar">
          <Progress
            value={run.solved}
            max={run.exercises.length}
            label={t("math.aventura-ta")}
          />
          <nav aria-label="Exerciții">
            {run.exercises.map((e, i) => (
              <button
                key={e.id}
                disabled={busy}
                className={`exercise-nav ${i === index ? "selected" : ""} ${e.solved ? "solved" : ""}`}
                onClick={() => setIndex(i)}
                aria-current={i === index ? "step" : undefined}
              >
                <span className="exercise-num">
                  {e.solved ? (
                    <Icon name="check" size={16} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  {OPERATIONS[e.op]}
                  <small>
                    {e.solved
                      ? t("math.rezolvat-bravo")
                      : e.revealed
                        ? t("math.solutie-consultata")
                        : t("math.un-nou-mic-miau")}
                  </small>
                </span>
                {i === index && <Icon name="arrow" size={17} />}
              </button>
            ))}
          </nav>
          <div className="sidebar-cat">
            <KnightCat mood="thinking" />
            <p>
              {t("math.ai-voie-sa-gresesti")}
              <br />
              {t("math.asa-se-invata-miau")}
            </p>
          </div>
          <button className="text-button" onClick={restart} disabled={busy}>
            <Icon name="refresh" size={16} />
            {" " + t("math.vreau-un-set-nou")}
          </button>
        </aside>
        <section className="exercise-panel" aria-busy={busy}>
          <div className="card-top">
            <span className="number-label">
              {t("math.exercitiul") + " "}
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={`pill ${exercise.solved ? "mint" : ""}`}>
              {exercise.solved
                ? t("math.rezolvat")
                : t("math.value1-din-value2", {
                    value1: index + 1,
                    value2: run.exercises.length,
                  })}
            </span>
          </div>
          <h2>{exercise.title}</h2>
          <p className="exercise-instruction">
            {exercise.op === "transpose"
              ? t(
                  "math.transforma-randurile-in-coloane-care-este-transpusa-lui-a",
                )
              : exercise.op === "determinant"
                ? t("math.un-singur-numar-o-mica-superputere-calculeaza-det-a")
                : exercise.op === "inverse"
                  ? t(
                      "math.gaseste-matricea-inversa-a-poti-scrie-fractii-de-exemplu-1-2",
                    )
                  : exercise.op === "scale"
                    ? t(
                        "math.inmulteste-fiecare-element-al-matricei-a-cu-scalar",
                        {
                          scalar: exercise.scalar,
                        },
                      )
                    : t(
                        "math.calculeaza-a-value1-b-si-completeaza-rezultatul",
                        {
                          value1: symbols[exercise.op],
                        },
                      )}
          </p>
          <div className="matrix-problem">
            {exercise.op === "scale" && (
              <span className="operator">{exercise.scalar} ×</span>
            )}
            <Matrix values={exercise.a} label="A" cat />
            {exercise.b && (
              <>
                <span className="operator">{symbols[exercise.op]}</span>
                <Matrix values={exercise.b} label="B" cat />
              </>
            )}
            {["transpose", "inverse", "determinant"].includes(exercise.op) && (
              <span className="operation-badge">
                {exercise.op === "transpose"
                  ? "Aᵀ"
                  : exercise.op === "inverse"
                    ? "A⁻¹"
                    : "det(A)"}
              </span>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("check");
            }}
          >
            <div className="answer-section">
              <div>
                <h3>{t("math.raspunsul-tau")}</h3>
                <p>
                  {exercise.rows === 1 && exercise.cols === 1
                    ? t("math.o-casuta-un-raspuns")
                    : t("math.cate-o-casuta-cate-un-pas-inainte")}
                  <br />
                  <small>
                    {t("math.acceptam-intregi-zecimale-si-fractii")}
                  </small>
                </p>
              </div>
              <Matrix
                values={answer.length ? answer : [[""]]}
                editable
                label="Rezultat"
                marks={result?.cells}
                onChange={(i, j, v) => {
                  setAnswer((a) =>
                    a.map((r, ri) =>
                      r.map((x, cj) => (ri === i && cj === j ? v : x)),
                    ),
                  );
                  setResult(null);
                }}
              />
            </div>
            <ErrorBox>{error}</ErrorBox>
            <GuideSpeech
              className="math-guide"
              title={dialogue?.title || t("math.sabia-sus-mustatile-pregatite")}
              message={
                dialogue?.message ||
                t(
                  "math.numerele-par-curajoase-dar-le-luam-pe-rand-completeaza-casutele-i",
                )
              }
              detail={
                dialogue?.detail ||
                (!dialogue
                  ? t(
                      "math.ai-nevoie-de-ajutor-apasa-un-indiciu-si-iti-soptesc-primul-pas",
                    )
                  : undefined)
              }
              mood={dialogue?.mood || "welcome"}
            />
            <div className="exercise-actions">
              <button
                className="button dark"
                disabled={
                  busy || answer.some((r) => r.some((v) => !String(v).trim()))
                }
              >
                {busy ? t("math.un-moment") : t("math.verifica-raspunsul")}
                <Icon name="check" />
              </button>
              <button
                className="button soft-yellow"
                type="button"
                disabled={busy}
                onClick={() => action("hint")}
              >
                <Icon name="bulb" />
                {" " + t("math.un-indiciu")}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => action("solution")}
              >
                <Icon name="eye" size={17} />
                {" " + t("math.arata-solutia")}
              </button>
            </div>
          </form>
          {solution && (
            <div className="solution-box">
              <h3>{t("math.hai-sa-intelegem-impreuna")}</h3>
              <Matrix values={solution.answer} label="Soluție" />
              <small>
                {t(
                  "math.poti-completa-raspunsul-si-incerca-din-nou-fara-penalizari",
                )}
              </small>
            </div>
          )}
          <div className="exercise-bottom">
            <span>
              {exercise.attempts
                ? t("math.attempts-value2-fiecare-conteaza", {
                    attempts: exercise.attempts,
                    value2: exercise.attempts === 1 ? "încercare" : "încercări",
                  })
                : t("math.fara-cronometru-fara-presiune")}
            </span>
            <button
              className="text-button"
              disabled={index === run.exercises.length - 1 || busy}
              onClick={() => setIndex(index + 1)}
            >
              {t("math.urmatorul") + " "}
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </section>
      </div>
      {run.solved === run.exercises.length && (
        <section className="completion-banner">
          <Icon name="trophy" size={35} />
          <div>
            <h2>{t("math.minte-sclipitoare-misiune-indeplinita")}</h2>
            <p>
              {t(
                "math.toate-exercitiile-sunt-rezolvate-pisicutele-iti-trimit-o-runda-de",
              )}
            </p>
            <p>{t("puzzle.unlocked")}</p>
            <button className="button rainbow" onClick={onPuzzle}>
              {t("puzzle.unlocked.action")}
              <Icon name="arrow" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
