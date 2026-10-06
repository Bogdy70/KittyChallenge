import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "./Messages";
import { Icon, ErrorBox } from "./Art";
import {
  MAX_GROUPS,
  SHAPE_GROUPS,
  COLOR_GROUPS,
  makeGroup,
  shapeGroup,
  dominantColor,
} from "../../shared/puzzle-sorting.mjs";
const PAGE_SIZE = 40;
export async function photoColors(puzzle) {
  const image = new Image();
  image.src = puzzle.url;
  await image.decode();
  const sample = 12,
    canvas = document.createElement("canvas");
  canvas.width = puzzle.cols * sample;
  canvas.height = puzzle.rows * sample;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return Array.from({ length: puzzle.count }, (_, i) =>
    dominantColor(
      context.getImageData(
        (i % puzzle.cols) * sample,
        Math.floor(i / puzzle.cols) * sample,
        sample,
        sample,
      ).data,
    ),
  );
}
export default function PuzzleSorter({
  puzzle,
  onChange,
  onClose,
  renderPiece,
  saving,
  error,
  conflict,
  onRetry,
  onReload,
  onUndo,
  canUndo,
}) {
  const { t } = useMessages(),
    sorting = puzzle.sorting;
  const [selection, setSelection] = useState(new Set()),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(0),
    [name, setName] = useState(""),
    [color, setColor] = useState("#e99bd1"),
    [editing, setEditing] = useState(null),
    [localError, setLocalError] = useState(""),
    [analyzing, setAnalyzing] = useState(false),
    [drag, setDrag] = useState(null),
    [notice, setNotice] = useState("");
  const heading = useRef(null),
    active = useRef(true),
    dragRef = useRef(null);
  useEffect(() => {
    active.current = true;
    heading.current?.focus();
    return () => {
      active.current = false;
    };
  }, []);
  const placed = useMemo(() => new Set(puzzle.placed), [puzzle.placed]);
  const remaining = useMemo(
    () =>
      Array.from({ length: puzzle.count }, (_, i) => i).filter(
        (i) => !placed.has(i),
      ),
    [puzzle.count, placed],
  );
  const counts = useMemo(() => {
    const values = { all: remaining.length, unsorted: 0 };
    for (const i of remaining) {
      const id = sorting.assignments[i] || "unsorted";
      values[id] = (values[id] || 0) + 1;
    }
    return values;
  }, [remaining, sorting]);
  const filtered = remaining.filter(
      (i) =>
        category === "all" ||
        (sorting.assignments[i] || "unsorted") === category,
    ),
    pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    currentPage = Math.min(page, pages - 1),
    visible = filtered.slice(
      currentPage * PAGE_SIZE,
      (currentPage + 1) * PAGE_SIZE,
    );
  useEffect(() => {
    if (
      category !== "all" &&
      category !== "unsorted" &&
      !sorting.groups.some((g) => g.id === category)
    )
      setCategory("all");
    setSelection((old) => new Set([...old].filter((i) => !placed.has(i))));
  }, [sorting.groups, placed]);
  function change(next, message) {
    onChange(next);
    setLocalError("");
    if (message) setNotice(message);
  }
  function move(id, pieces = [...selection]) {
    const assignments = { ...sorting.assignments };
    for (const i of pieces) {
      if (placed.has(i)) continue;
      if (id === "unsorted") delete assignments[i];
      else assignments[i] = id;
    }
    change(
      { ...sorting, assignments },
      t("sort.moved", {
        count: pieces.length,
        category:
          id === "unsorted"
            ? t("sort.unsorted")
            : sorting.groups.find((g) => g.id === id)?.name,
      }),
    );
    setSelection(new Set());
  }
  function toggle(i) {
    setSelection((old) => {
      const next = new Set(old);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  async function automatic(mode) {
    if (
      Object.keys(sorting.assignments).some((i) => !placed.has(Number(i))) &&
      !confirm(t("sort.auto.confirm"))
    )
      return;
    setLocalError("");
    setAnalyzing(true);
    try {
      const palette = mode === "color" ? COLOR_GROUPS : SHAPE_GROUPS,
        colors = mode === "color" ? await photoColors(puzzle) : null;
      if (!active.current) return;
      const kinds = new Set(
          remaining.map((i) =>
            colors ? colors[i] : shapeGroup(i, puzzle.rows, puzzle.cols),
          ),
        ),
        groups = [...sorting.groups],
        remap = {};
      for (const spec of palette.filter((s) => kinds.has(s.id))) {
        const existing =
          groups.find((g) => g.id === spec.id) ||
          groups.find((g) => g.name === t(spec.key));
        if (existing) {
          remap[spec.id] = existing.id;
          continue;
        }
        if (groups.length >= MAX_GROUPS)
          throw Object.assign(new Error(t("sort.limit", { max: MAX_GROUPS })), {
            local: true,
          });
        const group = makeGroup(spec, t);
        groups.push(group);
        remap[spec.id] = group.id;
      }
      const assignments = { ...sorting.assignments };
      for (const i of remaining)
        assignments[i] =
          remap[colors ? colors[i] : shapeGroup(i, puzzle.rows, puzzle.cols)];
      change(
        { groups, assignments },
        t(mode === "color" ? "sort.colors.done" : "sort.shapes.done"),
      );
      setSelection(new Set());
      setCategory("all");
      setPage(0);
    } catch (e) {
      if (active.current)
        setLocalError(e.local ? e.message : t("sort.colors.failed"));
    } finally {
      if (active.current) setAnalyzing(false);
    }
  }
  function saveGroup(e) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (
      sorting.groups.some(
        (g) =>
          g.id !== editing &&
          g.name.toLocaleLowerCase("ro") === clean.toLocaleLowerCase("ro"),
      )
    ) {
      setLocalError(t("sort.duplicate"));
      return;
    }
    if (!editing && sorting.groups.length >= MAX_GROUPS) {
      setLocalError(t("sort.limit", { max: MAX_GROUPS }));
      return;
    }
    const group = {
      id:
        editing ||
        "custom-" + crypto.getRandomValues(new Uint32Array(3)).join("-"),
      name: clean,
      color,
    };
    change(
      {
        ...sorting,
        groups: editing
          ? sorting.groups.map((g) => (g.id === editing ? group : g))
          : [...sorting.groups, group],
      },
      t("sort.category.saved"),
    );
    setName("");
    setEditing(null);
  }
  function removeGroup(group) {
    if (!confirm(t("sort.delete.confirm", { category: group.name }))) return;
    change(
      {
        groups: sorting.groups.filter((g) => g.id !== group.id),
        assignments: Object.fromEntries(
          Object.entries(sorting.assignments).filter(
            ([, id]) => id !== group.id,
          ),
        ),
      },
      t("sort.category.deleted"),
    );
    if (editing === group.id) {
      setEditing(null);
      setName("");
    }
  }
  function startDrag(e, i) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    dragRef.current = {
      index: i,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      pieces: selection.has(i) ? [...selection] : [i],
      moved: false,
    };
  }
  useEffect(() => {
    function moving(e) {
      const d = dragRef.current;
      if (!d) return;
      const next = {
        ...d,
        x: e.clientX,
        y: e.clientY,
        moved:
          d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6,
      };
      dragRef.current = next;
      if (next.moved) {
        setDrag(next);
      }
    }
    function finish(e) {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d?.moved) return;
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-sort-target]");
      if (target) move(target.dataset.sortTarget, d.pieces);
    }
    const cancel = () => {
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", moving);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", moving);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [sorting, selection, placed]);
  const buckets = [
    { id: "unsorted", name: t("sort.unsorted"), color: "#ddd1ef" },
    ...sorting.groups,
  ];
  return (
    <section
      className="puzzle-sorter"
      aria-label={t("sort.title")}
      aria-busy={analyzing || undefined}
    >
      <header className="sort-heading">
        <div>
          <span className="eyebrow">{t("sort.eyebrow")}</span>
          <h2 ref={heading} tabIndex={-1}>
            {t("sort.title")}
          </h2>
          <p>{t("sort.help")}</p>
        </div>
        <button className="button small rainbow" onClick={onClose}>
          <Icon name="close" size={17} />
          {t("sort.close")}
        </button>
      </header>
      <div className="sort-tools">
        <button
          className="button small"
          disabled={analyzing || !remaining.length}
          onClick={() => automatic("shape")}
        >
          <Icon name="puzzle" size={16} />
          {t("sort.auto.shape")}
        </button>
        <button
          className="button small"
          disabled={analyzing || !remaining.length}
          onClick={() => automatic("color")}
        >
          <Icon name="spark" size={16} />
          {analyzing ? t("sort.analyzing") : t("sort.auto.color")}
        </button>
        <button
          className="button small"
          disabled={!canUndo || analyzing}
          onClick={onUndo}
        >
          {t("sort.undo")}
        </button>
        <button
          className="text-button"
          disabled={!Object.keys(sorting.assignments).length || analyzing}
          onClick={() => {
            if (confirm(t("sort.clear.confirm")))
              change({ ...sorting, assignments: {} }, t("sort.cleared"));
          }}
        >
          {t("sort.clear")}
        </button>
      </div>
      <div className="sort-body">
        <aside className="sort-sidebar" aria-label={t("sort.categories")}>
          <h3>{t("sort.categories")}</h3>
          <button
            className={`sort-all ${category === "all" ? "active" : ""}`}
            aria-pressed={category === "all"}
            onClick={() => {
              setCategory("all");
              setPage(0);
            }}
          >
            {t("sort.all")} <strong>{counts.all}</strong>
          </button>
          <div className="sort-buckets">
            {buckets.map((g) => (
              <article
                className={`sort-bucket ${category === g.id ? "active" : ""} ${drag ? "drop-ready" : ""}`}
                key={g.id}
                data-sort-target={g.id}
                style={{ "--bucket-color": g.color }}
              >
                <button
                  className="bucket-view"
                  aria-label={t("sort.view", { category: g.name })}
                  aria-pressed={category === g.id}
                  onClick={() => {
                    setCategory(g.id);
                    setPage(0);
                  }}
                >
                  <span className="bucket-swatch" />
                  <span>{g.name}</span>
                  <strong>{counts[g.id] || 0}</strong>
                </button>
                <div className="bucket-actions">
                  <button
                    disabled={!selection.size || analyzing}
                    aria-label={t("sort.move.to", { category: g.name })}
                    onClick={() => move(g.id)}
                  >
                    {t("sort.move.here")}
                  </button>
                  {g.id !== "unsorted" && (
                    <>
                      <button
                        aria-label={t("sort.edit", { category: g.name })}
                        onClick={() => {
                          setEditing(g.id);
                          setName(g.name);
                          setColor(g.color);
                        }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        disabled={analyzing}
                        aria-label={t("sort.delete", { category: g.name })}
                        onClick={() => removeGroup(g)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <form className="sort-new-category" onSubmit={saveGroup}>
            <label htmlFor="sort-category-name">
              {t(editing ? "sort.edit.title" : "sort.new")}
            </label>
            <div>
              <input
                id="sort-category-name"
                aria-label={t("sort.name")}
                value={name}
                maxLength={40}
                placeholder={t("sort.name.placeholder")}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="color"
                aria-label={t("sort.category.color")}
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <div>
              <button
                className="button small"
                disabled={!name.trim() || analyzing}
              >
                {t(editing ? "sort.save.category" : "sort.add")}
              </button>
              {editing && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditing(null);
                    setName("");
                  }}
                >
                  {t("sort.cancel")}
                </button>
              )}
            </div>
          </form>
        </aside>
        <div className="sort-pieces">
          <div className="sort-selection">
            <span role="status">
              {t("sort.selection", { count: selection.size })}
            </span>
            <button
              className="text-button"
              disabled={!visible.length}
              onClick={() =>
                setSelection((old) => new Set([...old, ...visible]))
              }
            >
              {t("sort.select.page")}
            </button>
            <button
              className="text-button"
              disabled={!selection.size}
              onClick={() => setSelection(new Set())}
            >
              {t("sort.unselect")}
            </button>
          </div>
          <div className="sort-piece-grid">
            {visible.map((i) => (
              <button
                key={i}
                className={`sort-piece ${selection.has(i) ? "selected" : ""}`}
                aria-label={t("sort.select.piece", { number: i + 1 })}
                aria-pressed={selection.has(i)}
                onClick={() => {
                  if (!dragRef.current?.moved) toggle(i);
                }}
                onPointerDown={(e) => startDrag(e, i)}
              >
                <span className="sort-piece-check">
                  <Icon name={selection.has(i) ? "check" : "plus"} size={13} />
                </span>
                {renderPiece(i, "sort-grid")}
                <span className="sort-piece-category">
                  {sorting.groups.find((g) => g.id === sorting.assignments[i])
                    ?.name || t("sort.unsorted")}
                </span>
              </button>
            ))}
            {!visible.length && (
              <div className="sort-empty">
                <Icon name="paw" size={32} />
                <p>{t("sort.empty")}</p>
              </div>
            )}
          </div>
          {pages > 1 && (
            <nav className="sort-pagination" aria-label={t("sort.pages")}>
              <button
                className="button small"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("puzzle.inapoi")}
              </button>
              <span>
                {t("sort.page", { page: currentPage + 1, total: pages })}
              </span>
              <button
                className="button small"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("puzzle.mai-multe-piese")}
              </button>
            </nav>
          )}
        </div>
      </div>
      <footer className="sort-status">
        <span role="status">
          {saving ? t("sort.saving") : notice || t("sort.personal")}
        </span>
        <ErrorBox>{error || localError}</ErrorBox>
        {error && (
          <button
            className="button small"
            disabled={saving}
            onClick={conflict ? onReload : onRetry}
          >
            {t(conflict ? "sort.reload" : "sort.retry")}
          </button>
        )}
      </footer>
      {drag?.moved && (
        <div
          className="sort-drag"
          style={{ left: drag.x - 40, top: drag.y - 40 }}
        >
          {renderPiece(drag.index, "sort-drag")}
          <span>{drag.pieces.length}</span>
        </div>
      )}
    </section>
  );
}
