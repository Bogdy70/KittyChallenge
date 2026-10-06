import { useMessages } from "./Messages";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useId,
} from "react";
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
    [focusMode, setFocusMode] = useState(false),
    [showGuide, setShowGuide] = useState(false),
    [fitWidth, setFitWidth] = useState(620),
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
  const workspaceRef = useRef(null),
    viewportRef = useRef(null),
    nativeFullscreen = useRef(false),
    focusActive = useRef(false),
    orientationOwned = useRef(false),
    boardRef = useRef(null),
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
  const boardRatio = puzzle
    ? ((puzzle.cols * 100 + 56) / (puzzle.rows * 100 + 56)) *
      (((puzzle.width / puzzle.height) * puzzle.rows) / puzzle.cols)
    : 1;
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const fit = () =>
      setFitWidth(
        Math.max(
          80,
          Math.min(
            viewport.clientWidth - 32,
            (viewport.clientHeight - 32) * boardRatio,
          ),
        ),
      );
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    fit();
    return () => observer.disconnect();
  }, [puzzle?.version, boardRatio]);
  function revealSelected() {
    const viewport = viewportRef.current;
    const target = boardRef.current?.querySelectorAll(".puzzle-slot")[selected];
    if (!viewport || !target) return;
    const frame = viewport.getBoundingClientRect(),
      cell = target.getBoundingClientRect();
    if (
      cell.left >= frame.left + 8 &&
      cell.right <= frame.right - 8 &&
      cell.top >= frame.top + 8 &&
      cell.bottom <= frame.bottom - 8
    )
      return;
    viewport.scrollTo({
      left:
        viewport.scrollLeft +
        cell.left +
        cell.width / 2 -
        frame.left -
        viewport.clientWidth / 2,
      top:
        viewport.scrollTop +
        cell.top +
        cell.height / 2 -
        frame.top -
        viewport.clientHeight / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function unlockOrientation() {
    if (orientationOwned.current) {
      try {
        screen.orientation?.unlock?.();
      } catch {}
      orientationOwned.current = false;
    }
  }
  async function exitFocus() {
    focusActive.current = false;
    setFocusMode(false);
    unlockOrientation();
    if (document.fullscreenElement === workspaceRef.current) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
  }
  function enterFocus() {
    focusActive.current = true;
    setFocusMode(true);
    setShowGuide(false);
    setZoom(1);
    viewportRef.current?.scrollTo(0, 0);
    const element = workspaceRef.current;
    // Request during the click, while the browser still has user activation.
    try {
      element
        .requestFullscreen?.({ navigationUI: "hide" })
        .then(async () => {
          if (!focusActive.current) {
            if (document.fullscreenElement === element)
              await document.exitFullscreen().catch(() => {});
            return;
          }
          if (
            matchMedia("(pointer: coarse)").matches &&
            screen.orientation?.lock
          ) {
            try {
              await screen.orientation.lock("landscape");
              orientationOwned.current = true;
              if (!focusActive.current) unlockOrientation();
            } catch {
              /* Portrait layout remains usable when orientation lock is unavailable. */
            }
          }
        })
        .catch(() => {});
    } catch {
      /* CSS focus mode works without the Fullscreen API. */
    }
  }
  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === workspaceRef.current)
        nativeFullscreen.current = true;
      else if (nativeFullscreen.current) {
        nativeFullscreen.current = false;
        focusActive.current = false;
        setFocusMode(false);
        unlockOrientation();
      }
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      focusActive.current = false;
      unlockOrientation();
      if (document.fullscreenElement === workspaceRef.current)
        document.exitFullscreen().catch(() => {});
      document.removeEventListener("fullscreenchange", changed);
    };
  }, []);
  useEffect(() => {
    if (!focusMode) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const background = [
      ...document.querySelectorAll(
        ".app-header, .app-footer, .page-heading, .completion-banner",
      ),
    ].map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });
    workspaceRef.current?.focus({ preventScroll: true });
    function keys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        exitFocus();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...workspaceRef.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === workspaceRef.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === workspaceRef.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      document.removeEventListener("keydown", keys);
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [focusMode]);
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
      <section
        ref={workspaceRef}
        className={`puzzle-workspace puzzle-studio ${focusMode ? "puzzle-focus" : ""}`}
        tabIndex={-1}
        role={focusMode ? "dialog" : "region"}
        aria-modal={focusMode || undefined}
        aria-label={t("puzzle.tabla-puzzle-ului")}
      >
        <div className="puzzle-toolbar">
          <Progress
            value={puzzle.placed.length}
            max={puzzle.count}
            label={t("puzzle.imaginea-prinde-viata")}
          />
          <div className="toolbar-actions">
            <button
              className={`button small ${preview ? "lavender" : ""}`}
              aria-label={
                preview ? t("puzzle.ascunde-modelul") : t("puzzle.vezi-modelul")
              }
              onClick={() => setPreview(!preview)}
              aria-pressed={preview}
            >
              <Icon name="eye" size={17} />
              <span className="tool-label">
                {preview
                  ? t("puzzle.ascunde-modelul")
                  : t("puzzle.vezi-modelul")}
              </span>
            </button>
            <button
              className="button small soft-yellow"
              aria-label={t("puzzle.indiciu")}
              disabled={selected === null}
              onClick={() => {
                if (!hint) revealSelected();
                setHint(!hint);
                setGuide({
                  title: t("puzzle.hint.title"),
                  message: !hint
                    ? t("puzzle.hint.message", {
                        row: Math.floor(selected / puzzle.cols) + 1,
                        col: (selected % puzzle.cols) + 1,
                      })
                    : t("puzzle.hint.hidden"),
                  mood: "thinking",
                });
              }}
              aria-pressed={hint}
            >
              <Icon name="bulb" size={17} />
              <span className="tool-label">{t("puzzle.indiciu")}</span>
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
            <button
              className="button small"
              aria-label={t("puzzle.fit")}
              title={t("puzzle.fit")}
              onClick={() => {
                setZoom(1);
                viewportRef.current?.scrollTo(0, 0);
              }}
            >
              <Icon name="fit" size={17} />
              <span className="tool-label">{t("puzzle.fit")}</span>
            </button>
            <button
              className="button small guide-toggle"
              aria-label={
                showGuide ? t("puzzle.guide.hide") : t("puzzle.guide.show")
              }
              aria-pressed={showGuide}
              onClick={() => setShowGuide((v) => !v)}
            >
              <Icon name="paw" size={17} />
              <span className="tool-label">
                {showGuide ? t("puzzle.guide.hide") : t("puzzle.guide.show")}
              </span>
            </button>
            <button
              className="button small rainbow fullscreen-toggle"
              aria-label={
                focusMode
                  ? t("puzzle.fullscreen.exit")
                  : t("puzzle.fullscreen.enter")
              }
              onClick={focusMode ? exitFocus : enterFocus}
            >
              <Icon name={focusMode ? "close" : "expand"} size={17} />
              <span className="tool-label">
                {focusMode
                  ? t("puzzle.fullscreen.exit")
                  : t("puzzle.fullscreen.enter")}
              </span>
            </button>
          </div>
        </div>
        {focusMode && (
          <p className="orientation-tip">{t("puzzle.fullscreen.rotate")}</p>
        )}
        {(!focusMode || showGuide) && (
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
        )}
        <div className="puzzle-area">
          <div
            className="puzzle-scroll"
            ref={viewportRef}
            tabIndex={0}
            aria-label={t("puzzle.board.pan")}
          >
            <div
              className="puzzle-board"
              style={{
                width: `${fitWidth * zoom}px`,
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
          <aside className="piece-tray" aria-label={t("puzzle.cutia-cu-piese")}>
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
                    : t("puzzle.remaining.short", {
                        remaining: remaining.length,
                      })}
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
            <div className="tray-selection" role="status">
              {selected !== null ? (
                <>
                  <div className="selected-mini">
                    <Piece
                      index={selected}
                      puzzle={puzzle}
                      idPrefix={prefix + "-selected"}
                    />
                  </div>
                  <span>
                    {hint
                      ? t("puzzle.hint.position", {
                          row: Math.floor(selected / puzzle.cols) + 1,
                          col: (selected % puzzle.cols) + 1,
                        })
                      : t("puzzle.piesa-aleasa")}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={t("puzzle.selected.clear")}
                    onClick={() => {
                      setSelected(null);
                      setHint(false);
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </>
              ) : (
                <span>{t("puzzle.selected.none")}</span>
              )}
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
                        title: t("puzzle.selected.title"),
                        message: t("puzzle.selected.message"),
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
    </>
  );
}
