import { useMessages } from "./Messages";
import React, { useEffect, useRef, useState, useMemo, useId } from "react";
import { api } from "./api";
import { GuideSpeech } from "./Guide";
import { Icon, Progress, ErrorBox, Loading } from "./Art";
const PAGE_SIZE = 24;
export function piecePath(index, rows, cols) {
  const r = Math.floor(index / cols),
    c = index % cols;
  const polarity = (r, c, type) => ((r * 17 + c * 13 + type * 7) % 2 ? 1 : -1);
  const sides = [
    r === 0 ? 0 : -polarity(r - 1, c, 0),
    c === cols - 1 ? 0 : polarity(r, c, 1),
    r === rows - 1 ? 0 : polarity(r, c, 0),
    c === 0 ? 0 : -polarity(r, c - 1, 1),
  ];
  const starts = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    directions = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
  let path = "M0 0";
  for (let i = 0; i < 4; i++) {
    const [x, y] = starts[i],
      [dx, dy] = directions[i],
      sign = sides[i];
    const point = (u, v) =>
      `${x + dx * u + dy * v * sign} ${y + dy * u - dx * v * sign}`;
    if (!sign) {
      path += ` L${point(100, 0)}`;
      continue;
    }
    path += ` L${point(35, 0)} C${point(44, 0)} ${point(44, 4)} ${point(40, 9)} C${point(24, 31)} ${point(76, 31)} ${point(60, 9)} C${point(56, 4)} ${point(56, 0)} ${point(65, 0)} L${point(100, 0)}`;
  }
  return path + " Z";
}
function Piece({ index, puzzle, idPrefix }) {
  const id = `${idPrefix}-${index}`;
  const x = index % puzzle.cols,
    y = Math.floor(index / puzzle.cols);
  const ratio = ((puzzle.width / puzzle.height) * puzzle.rows) / puzzle.cols;
  return (
    <div className="piece-graphic">
      <svg
        viewBox="-28 -28 156 156"
        preserveAspectRatio="none"
        style={{
          width: `${ratio >= 1 ? 100 : ratio * 100}%`,
          height: `${ratio >= 1 ? 100 / ratio : 100}%`,
        }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={id}>
            <path d={piecePath(index, puzzle.rows, puzzle.cols)} />
          </clipPath>
        </defs>
        <image
          href={puzzle.url}
          x={-x * 100}
          y={-y * 100}
          width={puzzle.cols * 100}
          height={puzzle.rows * 100}
          preserveAspectRatio="none"
          clipPath={`url(#${id})`}
        />
        <path
          d={piecePath(index, puzzle.rows, puzzle.cols)}
          fill="none"
          stroke="#392747"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
export default function PuzzleChallenge({ celebrate, onProgress }) {
  const { t } = useMessages();
  const [puzzle, setPuzzle] = useState(null),
    [selected, setSelected] = useState(null),
    [page, setPage] = useState(0),
    [zoom, setZoom] = useState(1),
    [preview, setPreview] = useState(false),
    [hint, setHint] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [guide, setGuide] = useState({
      title: t("puzzle.o-amintire-de-aparat-piesa-cu-piesa"),
      message: t(
        "puzzle.alege-o-piesa-din-cutie-apoi-trage-o-pe-tabla-sau-apasa-pe-locul-",
      ),
      mood: "welcome",
    }),
    [saving, setSaving] = useState(false),
    [drag, setDrag] = useState(null),
    [shuffle, setShuffle] = useState(0),
    [busy, setBusy] = useState(false);
  const boardRef = useRef(null),
    puzzleRef = useRef(null),
    queue = useRef(Promise.resolve()),
    mounted = useRef(true),
    saveSequence = useRef(0),
    announced = useRef(false);
  const prefix = useId().replaceAll(":", "");
  async function load() {
    try {
      setError("");
      const p = await api("/puzzle");
      setPuzzle(p);
      puzzleRef.current = p;
      announced.current = p.placed.length === p.count;
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, []);
  const placed = useMemo(() => new Set(puzzle?.placed || []), [puzzle?.placed]);
  const remaining = useMemo(
    () =>
      puzzle
        ? Array.from(
            {
              length: puzzle.count,
            },
            (_, i) => i,
          )
            .filter((i) => !placed.has(i))
            .sort(
              (a, b) =>
                ((a * 7919 + shuffle * 127) % 1009) -
                ((b * 7919 + shuffle * 127) % 1009),
            )
        : [],
    [puzzle?.count, placed, shuffle],
  );
  const pages = Math.max(1, Math.ceil(remaining.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  function persist(next) {
    const seq = ++saveSequence.current;
    setSaving(true);
    setError("");
    queue.current = queue.current
      .catch(() => {})
      .then(() =>
        api("/puzzle/progress", {
          method: "PUT",
          body: {
            version: next.version,
            placed: next.placed,
          },
        }),
      )
      .then((data) => {
        if (!mounted.current) return;
        if (seq === saveSequence.current) {
          setSaving(false);
          setNote(t("puzzle.progres-salvat-pisicuta-are-grija-de-el"));
          onProgress();
        }
        if (data.complete && !announced.current) {
          announced.current = true;
          celebrate(t("puzzle.fiecare-piesa-si-a-gasit-locul-la-multi-ani"));
        }
      })
      .catch((e) => {
        if (mounted.current) {
          setError(
            t(
              "puzzle.value1-piesele-sunt-inca-aici-apasa-reincearca-salvarea",
              {
                value1: e.message,
              },
            ),
          );
          setSaving(false);
        }
      });
  }
  function place(piece, target) {
    if (piece === null || piece === undefined) return;
    if (piece !== target) {
      setNote(t("puzzle.mai-cautam-locul-acestei-piese"));
      setGuide({
        title: t("puzzle.inca-putin-mica-mea-aventuriera"),
        message: t(
          "puzzle.piesa-aceasta-isi-cauta-alt-loc-priveste-culorile-si-marginile-sa",
        ),
        mood: "encourage",
      });
      return;
    }
    const p = puzzleRef.current;
    if (!p || p.placed.includes(piece)) return;
    const next = {
      ...p,
      placed: [...p.placed, piece],
    };
    puzzleRef.current = next;
    setPuzzle(next);
    setSelected(null);
    setHint(false);
    setNote(t("puzzle.se-potriveste-perfect"));
    setGuide({
      title: t("puzzle.purrfect-inca-o-piesa-acasa"),
      message: t(
        "puzzle.iti-dau-un-high-five-cu-labuta-imaginea-noastra-prinde-viata",
      ),
      mood: "celebrate",
    });
    persist(next);
  }
  useEffect(() => {
    if (!drag) return;
    function move(e) {
      setDrag((d) =>
        d
          ? {
              ...d,
              x: e.clientX,
              y: e.clientY,
              moved:
                d.moved ||
                Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6,
            }
          : d,
      );
    }
    function up(e) {
      const rect = boardRef.current?.getBoundingClientRect();
      const p = puzzleRef.current;
      if (rect && p) {
        const x =
            ((e.clientX - rect.left) / rect.width) * (p.cols * 100 + 56) - 28,
          y = ((e.clientY - rect.top) / rect.height) * (p.rows * 100 + 56) - 28;
        if (x >= 0 && y >= 0 && x < p.cols * 100 && y < p.rows * 100)
          place(drag.index, Math.floor(y / 100) * p.cols + Math.floor(x / 100));
      }
      setDrag(null);
    }
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [drag?.index]);
  async function restart() {
    if (
      !confirm(
        t(
          "puzzle.incepi-puzzle-ul-de-la-zero-piesele-puse-in-acest-puzzle-vor-reve",
        ),
      )
    )
      return;
    setBusy(true);
    try {
      await queue.current;
      await api("/puzzle/restart", {
        method: "POST",
        body: {
          version: puzzle.version,
        },
      });
      setSelected(null);
      setHint(false);
      setPage(0);
      announced.current = false;
      await load();
      onProgress();
      setNote(t("puzzle.o-noua-runda-de-bucurie"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!puzzle)
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
  const complete = puzzle.placed.length === puzzle.count;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("puzzle.provocarea-02-bucatele-de-bucurie")}
          </span>
          <h1>
            {t("puzzle.piese-de") + " "}
            <span className="green-text">{t("puzzle.fericire")}</span>
          </h1>
          <p>
            {t(
              "puzzle.o-amintire-se-construieste-cu-rabdare-si-cu-putin-ajutor-de-la-o-",
            )}
          </p>
        </div>
        <span className="tag mint">
          <Icon name="puzzle" />
          {puzzle.count}
          {" " + t("home.piese")}
        </span>
      </div>
      <section className="puzzle-workspace">
        <div className="puzzle-toolbar">
          <Progress
            value={puzzle.placed.length}
            max={puzzle.count}
            label={t("puzzle.imaginea-prinde-viata")}
          />
          <div className="toolbar-actions">
            <button
              className={`button small ${preview ? "lavender" : ""}`}
              onClick={() => setPreview(!preview)}
              aria-pressed={preview}
            >
              <Icon name="eye" size={17} />
              {preview ? t("puzzle.ascunde-modelul") : t("puzzle.vezi-modelul")}
            </button>
            <button
              className="button small soft-yellow"
              disabled={selected === null}
              onClick={() => {
                setHint(!hint);
                setGuide({
                  title: "Un secret de cavaler…",
                  message: !hint
                    ? `Piesa aleasă merge pe rândul ${Math.floor(selected / puzzle.cols) + 1}, coloana ${(selected % puzzle.cols) + 1}. Am luminat și locul pe tablă pentru tine.`
                    : "Am ascuns indiciul. Te las să descoperi singură, dar rămân aproape!",
                  mood: "thinking",
                });
              }}
              aria-pressed={hint}
            >
              <Icon name="bulb" size={17} />
              {" " + t("puzzle.indiciu")}
            </button>
            <div className="zoom-controls">
              <button
                className="icon-button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                disabled={zoom <= 0.5}
                aria-label={t("puzzle.micsoreaza-puzzle-ul")}
              >
                <Icon name="minus" size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                className="icon-button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                disabled={zoom >= 3}
                aria-label={t("puzzle.mareste-puzzle-ul")}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        </div>
        <GuideSpeech
          className="puzzle-guide"
          mood={complete ? "celebrate" : guide.mood}
          title={
            complete ? t("puzzle.misiune-indeplinita-sabia-sus") : guide.title
          }
          message={
            complete
              ? t(
                  "puzzle.ai-pus-ultima-piesa-aceasta-poveste-este-doar-pentru-tine-la-mult",
                )
              : guide.message
          }
        />
        <div className="puzzle-area">
          <div className="puzzle-scroll">
            <div
              className="puzzle-board"
              style={{
                width: `${Math.max(360, Math.min(1000, Math.max(620, puzzle.cols * 44))) * zoom}px`,
              }}
            >
              <svg
                ref={boardRef}
                preserveAspectRatio="none"
                style={{
                  aspectRatio:
                    ((puzzle.cols * 100 + 56) / (puzzle.rows * 100 + 56)) *
                    (((puzzle.width / puzzle.height) * puzzle.rows) /
                      puzzle.cols),
                }}
                viewBox={`-28 -28 ${puzzle.cols * 100 + 56} ${puzzle.rows * 100 + 56}`}
                aria-label={t("puzzle.tabla-puzzle-ului")}
                role="group"
              >
                <defs>
                  {Array.from(
                    {
                      length: puzzle.count,
                    },
                    (_, i) => (
                      <clipPath id={`${prefix}-board-${i}`} key={i}>
                        <path d={piecePath(i, puzzle.rows, puzzle.cols)} />
                      </clipPath>
                    ),
                  )}
                </defs>
                <rect
                  width={puzzle.cols * 100}
                  height={puzzle.rows * 100}
                  fill="#c8bde6"
                  rx="4"
                />
                {preview && (
                  <image
                    href={puzzle.url}
                    width={puzzle.cols * 100}
                    height={puzzle.rows * 100}
                    preserveAspectRatio="none"
                    opacity=".28"
                  />
                )}
                {Array.from(
                  {
                    length: puzzle.count,
                  },
                  (_, i) => {
                    const x = (i % puzzle.cols) * 100,
                      y = Math.floor(i / puzzle.cols) * 100;
                    return (
                      <g
                        key={i}
                        transform={`translate(${x} ${y})`}
                        role="button"
                        tabIndex={placed.has(i) ? -1 : 0}
                        aria-label={t("puzzle.locul-row-col-value3", {
                          row: Math.floor(i / puzzle.cols) + 1,
                          col: (i % puzzle.cols) + 1,
                          value3: placed.has(i) ? t("puzzle.completat") : "",
                        })}
                        onClick={() => place(selected, i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            place(selected, i);
                          }
                        }}
                        className={`puzzle-slot ${hint && selected === i ? "hint-slot" : ""} ${placed.has(i) ? "placed" : ""}`}
                      >
                        <path
                          d={piecePath(i, puzzle.rows, puzzle.cols)}
                          fill={
                            hint && selected === i
                              ? "#fff080"
                              : placed.has(i)
                                ? "transparent"
                                : preview
                                  ? "transparent"
                                  : "#e7dafa"
                          }
                          stroke="#d6cfe0"
                          strokeWidth="1.3"
                        />
                        {placed.has(i) && (
                          <>
                            <image
                              href={puzzle.url}
                              x={-x}
                              y={-y}
                              width={puzzle.cols * 100}
                              height={puzzle.rows * 100}
                              preserveAspectRatio="none"
                              clipPath={`url(#${prefix}-board-${i})`}
                            />
                            <path
                              d={piecePath(i, puzzle.rows, puzzle.cols)}
                              fill="none"
                              stroke="#fff"
                              strokeOpacity=".4"
                              strokeWidth=".8"
                            />
                          </>
                        )}
                        {!placed.has(i) && hint && selected === i && (
                          <text
                            x="50"
                            y="58"
                            textAnchor="middle"
                            fill="#685325"
                            fontSize="26"
                          >
                            ♡
                          </text>
                        )}
                      </g>
                    );
                  },
                )}
              </svg>
            </div>
          </div>
          <aside className="puzzle-side">
            <div className="mini-preview">
              <img
                src={puzzle.url}
                alt={t("puzzle.imaginea-pe-care-o-vei-reconstitui")}
              />
            </div>
            <span className="eyebrow">{t("puzzle.ghid-de-buzunar")}</span>
            <h3>{t("puzzle.gaseste-i-locul")}</h3>
            <ol>
              <li>{t("puzzle.alege-o-piesa-din-cutie")}</li>
              <li>{t("puzzle.trage-o-pe-tabla-sau-apasa-pe-locul-ei")}</li>
              <li>{t("puzzle.foloseste-zoom-pentru-detalii")}</li>
            </ol>
            <p className="muted small-text">
              {t(
                "puzzle.cu-tastatura-tab-selecteaza-enter-alege-piesa-sau-locul-piesele-s",
              )}
            </p>
            {selected !== null ? (
              <div className="selected-preview">
                <Piece
                  index={selected}
                  puzzle={puzzle}
                  idPrefix={`${prefix}-selected`}
                />
                <span>{t("puzzle.piesa-aleasa")}</span>
              </div>
            ) : (
              <div className="puzzle-side-note">
                {t("puzzle.cavalerul-miau-vegheaza-deasupra-tablei")}
              </div>
            )}
          </aside>
        </div>
        <div className="puzzle-status" role="status">
          <span>
            <span className={`live-dot ${saving ? "saving" : ""}`} />
            {saving
              ? t("puzzle.salvam-progresul")
              : note || t("puzzle.alege-o-piesa-povestea-incepe-aici")}
          </span>
          <button
            className="text-button"
            onClick={restart}
            disabled={busy || saving}
          >
            <Icon name="refresh" size={15} />
            {" " + t("puzzle.de-la-inceput")}
          </button>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {error && (
          <button
            className="button"
            disabled={saving}
            onClick={() => persist(puzzleRef.current)}
          >
            {t("puzzle.reincearca-salvarea")}
          </button>
        )}
        <div className="piece-tray">
          <div className="section-title">
            <div>
              <h3>
                {complete
                  ? t("puzzle.toate-piesele-sunt-acasa")
                  : t("puzzle.cutia-cu-piese")}
              </h3>
              <p>
                {complete
                  ? t("puzzle.si-imaginea-este-la-fel-de-speciala-ca-tine")
                  : t(
                      "puzzle.remaining-piese-isi-cauta-locul-selecteaza-sau-trage-o-piesa",
                      {
                        remaining: remaining.length,
                      },
                    )}
              </p>
            </div>
            <button
              className="button small"
              onClick={() => {
                setShuffle((s) => s + 1);
                setPage(0);
              }}
              disabled={complete}
            >
              <Icon name="refresh" size={16} />
              {" " + t("puzzle.amesteca")}
            </button>
          </div>
          <div className="tray-grid">
            {remaining
              .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
              .map((i) => (
                <button
                  key={i}
                  className={`tray-piece ${selected === i ? "selected" : ""}`}
                  aria-label={t("puzzle.alege-piesa-value1", {
                    value1: i + 1,
                  })}
                  aria-pressed={selected === i}
                  onClick={() => {
                    setSelected(i);
                    setHint(false);
                    setGuide({
                      title: "Am luat o piesă în expediție!",
                      message:
                        "Acum caută-i locul pe tablă. Poți folosi modelul sau un indiciu — și cavalerii primesc ajutor!",
                      mood: "thinking",
                    });
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    setSelected(i);
                    setHint(false);
                    setDrag({
                      index: i,
                      x: e.clientX,
                      y: e.clientY,
                      startX: e.clientX,
                      startY: e.clientY,
                      moved: false,
                    });
                  }}
                >
                  <Piece
                    index={i}
                    puzzle={puzzle}
                    idPrefix={`${prefix}-tray`}
                  />
                </button>
              ))}
          </div>
          {pages > 1 && (
            <div className="tray-pagination">
              <button
                className="button small"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("puzzle.inapoi")}
              </button>
              <span>
                {t("puzzle.cutia") + " "}
                {currentPage + 1}
                {" " + t("puzzle.din") + " "}
                {pages}
              </span>
              <button
                className="button small"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("puzzle.mai-multe-piese") + " "}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
        </div>
      </section>
      {complete && (
        <section className="completion-banner">
          <Icon name="heart" size={36} />
          <div>
            <h2>{t("puzzle.ce-frumos-se-leaga-lucrurile")}</h2>
            <p>
              {t(
                "puzzle.ai-pus-ultima-piesa-aceasta-mica-poveste-este-doar-pentru-tine-la",
              )}
            </p>
          </div>
        </section>
      )}
      {drag?.moved && (
        <div
          className="drag-piece"
          style={{
            left: drag.x - 45,
            top: drag.y - 45,
          }}
        >
          <Piece
            index={drag.index}
            puzzle={puzzle}
            idPrefix={`${prefix}-drag`}
          />
        </div>
      )}
    </>
  );
}
