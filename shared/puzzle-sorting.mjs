const invalid = () =>
  Object.assign(new Error("Sortarea pieselor nu este validă."), {
    status: 400,
  });
export const MAX_GROUPS = 24;
export const SHAPE_GROUPS = [
  { id: "corners", key: "sort.corners", name: "Colțuri", color: "#f4c548" },
  { id: "edges", key: "sort.edges", name: "Margini", color: "#7ecb92" },
  { id: "middle", key: "sort.middle", name: "Interior", color: "#9fbded" },
  {
    id: "vertical",
    key: "sort.vertical",
    name: "Proeminențe sus/jos",
    color: "#e79bd1",
  },
  {
    id: "horizontal",
    key: "sort.horizontal",
    name: "Proeminențe stânga/dreapta",
    color: "#bba0ec",
  },
];
export const COLOR_GROUPS = [
  { id: "red", key: "sort.red", name: "Roșu și roz", color: "#ee77a6" },
  {
    id: "yellow",
    key: "sort.yellow",
    name: "Galben și portocaliu",
    color: "#f4cb62",
  },
  { id: "green", key: "sort.green", name: "Verde", color: "#7fce9c" },
  { id: "blue", key: "sort.blue", name: "Albastru", color: "#73b9ef" },
  { id: "purple", key: "sort.purple", name: "Mov", color: "#b99ce5" },
  { id: "light", key: "sort.light", name: "Culori deschise", color: "#e2decf" },
  { id: "dark", key: "sort.dark", name: "Culori închise", color: "#87758e" },
  { id: "mixed", key: "sort.mixed", name: "Culori mixte", color: "#cba884" },
];
export function makeGroup(spec, t) {
  return { id: spec.id, name: t ? t(spec.key) : spec.name, color: spec.color };
}
export function defaultSorting(t) {
  const names = new Set();
  const groups = SHAPE_GROUPS.slice(0, 3).map((spec) => {
    const group = makeGroup(spec, t);
    group.name = group.name.trim().slice(0, 40) || spec.name;
    if (names.has(group.name.toLocaleLowerCase("ro"))) group.name = spec.name;
    if (names.has(group.name.toLocaleLowerCase("ro")))
      group.name = spec.name + " · " + spec.id;
    names.add(group.name.toLocaleLowerCase("ro"));
    return group;
  });
  return { groups, assignments: {} };
}
export function validateSorting(value, count) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray(value.groups) ||
    value.groups.length > MAX_GROUPS ||
    !value.assignments ||
    typeof value.assignments !== "object" ||
    Array.isArray(value.assignments)
  )
    throw invalid();
  const ids = new Set(),
    names = new Set();
  const groups = value.groups.map((g) => {
    if (
      !g ||
      typeof g.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(g.id) ||
      ids.has(g.id) ||
      ["all", "unsorted"].includes(g.id) ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 40 ||
      /[\u0000-\u001f]/.test(g.name) ||
      !/^#[0-9a-f]{6}$/i.test(g.color)
    )
      throw invalid();
    const name = g.name.trim().replace(/\s+/g, " "),
      normal = name.toLocaleLowerCase("ro");
    if (names.has(normal)) throw invalid();
    ids.add(g.id);
    names.add(normal);
    return { id: g.id, name, color: g.color };
  });
  const entries = Object.entries(value.assignments);
  if (entries.length > count) throw invalid();
  for (const [piece, id] of entries)
    if (!/^(0|[1-9]\d*)$/.test(piece) || Number(piece) >= count || !ids.has(id))
      throw invalid();
  return { groups, assignments: Object.fromEntries(entries) };
}
export function pieceSides(index, rows, cols) {
  const r = Math.floor(index / cols),
    c = index % cols;
  const polarity = (r, c, type) => ((r * 17 + c * 13 + type * 7) % 2 ? 1 : -1);
  return [
    r === 0 ? 0 : -polarity(r - 1, c, 0),
    c === cols - 1 ? 0 : polarity(r, c, 1),
    r === rows - 1 ? 0 : polarity(r, c, 0),
    c === 0 ? 0 : -polarity(r, c - 1, 1),
  ];
}
export function shapeGroup(index, rows, cols) {
  const sides = pieceSides(index, rows, cols),
    flats = sides.filter((s) => s === 0).length;
  return flats >= 2
    ? "corners"
    : flats === 1
      ? "edges"
      : sides[0] === 1 && sides[2] === 1
        ? "vertical"
        : sides[1] === 1 && sides[3] === 1
          ? "horizontal"
          : "middle";
}
export function pixelColor(r, g, b) {
  const high = Math.max(r, g, b),
    low = Math.min(r, g, b),
    diff = high - low,
    value = high / 255,
    saturation = high ? diff / high : 0;
  if (value < 0.22) return "dark";
  if (saturation < 0.18)
    return value > 0.72 ? "light" : value < 0.42 ? "dark" : "mixed";
  let hue =
    (high === r
      ? (g - b) / diff
      : high === g
        ? (b - r) / diff + 2
        : (r - g) / diff + 4) * 60;
  hue = (hue + 360) % 360;
  return hue < 18 || hue >= 325
    ? "red"
    : hue < 75
      ? "yellow"
      : hue < 170
        ? "green"
        : hue < 255
          ? "blue"
          : "purple";
}
export function dominantColor(pixels) {
  const counts = {};
  let visible = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const id = pixelColor(pixels[i], pixels[i + 1], pixels[i + 2]);
    counts[id] = (counts[id] || 0) + 1;
    visible++;
  }
  const [id, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [
    "mixed",
    0,
  ];
  return visible && n / visible >= 0.45 ? id : "mixed";
}
