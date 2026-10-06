import { renderMessage } from "../shared/messages.mjs";
export const OPERATIONS = {
  add: "Adunare",
  subtract: "Scădere",
  scale: "Înmulțire cu un număr",
  transpose: "Transpusă",
  multiply: "Produs de matrice",
  determinant: "Determinant",
  inverse: "Inversă",
};
export const LEVELS = {
  easy: { label: "Pui de pisică", count: 5 },
  normal: { label: "Pisică isteață", count: 7 },
  spicy: { label: "Super pisică", count: 9 },
};
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export function fraction(a, b = 1) {
  if (!b) throw new Error("Împărțirea la zero nu este definită.");
  const g = gcd(a, b);
  return b / g === 1
    ? String(a / g)
    : b / g === -1
      ? String(-a / g)
      : `${(Math.sign(b) * a) / g}/${Math.abs(b) / g}`;
}
export function parseAnswer(value) {
  if (typeof value !== "string" && typeof value !== "number") return NaN;
  const v = String(value).trim().replace(",", ".");
  if (
    v.length > 30 ||
    !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*[+-]?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(
      v,
    )
  )
    return NaN;
  const parts = v.split("/").map(Number);
  const n = parts[0] / (parts[1] ?? 1);
  return Number.isFinite(n) && Math.abs(n) <= 1e8 ? n : NaN;
}
export function det(a) {
  if (a.length === 1) return a[0][0];
  if (a.length === 2) return a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return a[0].reduce(
    (s, x, j) =>
      s +
      (-1) ** j * x * det(a.slice(1).map((r) => r.filter((_, k) => k !== j))),
    0,
  );
}
export const transpose = (a) => a[0].map((_, j) => a.map((r) => r[j]));
export function solve(e) {
  const { a, b, op, scalar } = e;
  switch (op) {
    case "add":
      return a.map((r, i) => r.map((v, j) => String(v + b[i][j])));
    case "subtract":
      return a.map((r, i) => r.map((v, j) => String(v - b[i][j])));
    case "scale":
      return a.map((r) => r.map((v) => String(v * scalar)));
    case "transpose":
      return transpose(a).map((r) => r.map(String));
    case "multiply":
      return a.map((r) =>
        b[0].map((_, j) => String(r.reduce((s, v, k) => s + v * b[k][j], 0))),
      );
    case "determinant":
      return [[String(det(a))]];
    case "inverse": {
      const d = det(a);
      if (!d)
        throw new Error("Matricea nu are inversă: determinantul este zero.");
      return transpose(
        a.map((r, i) =>
          r.map((_, j) =>
            fraction(
              (-1) ** (i + j) *
                det(
                  a
                    .filter((_, k) => k !== i)
                    .map((row) => row.filter((_, k) => k !== j)),
                ),
              d,
            ),
          ),
        ),
      );
    }
    default:
      throw new Error("Operație necunoscută.");
  }
}
export function validateExercise(e) {
  if (!e || !OPERATIONS[e.op]) throw new Error("Alege o operație validă.");
  for (const m of [
    e.a,
    ...(["add", "subtract", "multiply"].includes(e.op) ? [e.b] : []),
  ]) {
    if (
      !Array.isArray(m) ||
      m.length < 1 ||
      m.length > 3 ||
      !Array.isArray(m[0]) ||
      m[0].length < 1 ||
      m[0].length > 3 ||
      m.some(
        (r) =>
          !Array.isArray(r) ||
          r.length !== m[0].length ||
          r.some((v) => !Number.isInteger(v) || Math.abs(v) > 9),
      )
    )
      throw new Error(
        "Folosește matrice dreptunghiulare de maximum 3 × 3, cu întregi între −9 și 9.",
      );
  }
  if (
    ["add", "subtract"].includes(e.op) &&
    (e.a.length !== e.b.length || e.a[0].length !== e.b[0].length)
  )
    throw new Error("Matricele trebuie să aibă aceleași dimensiuni.");
  if (e.op === "multiply" && e.a[0].length !== e.b.length)
    throw new Error("Coloanele lui A trebuie să fie egale cu rândurile lui B.");
  if (
    ["inverse", "determinant"].includes(e.op) &&
    (e.a.length !== e.a[0].length || e.a.length < 2)
  )
    throw new Error("Alege o matrice pătratică de 2 × 2 sau 3 × 3.");
  if (e.op === "inverse" && !det(e.a))
    throw new Error(
      "Determinantul trebuie să fie diferit de zero pentru inversă.",
    );
  if (
    e.op === "scale" &&
    (!Number.isInteger(e.scalar) || Math.abs(e.scalar) > 9)
  )
    throw new Error("Scalarul trebuie să fie un întreg între −9 și 9.");
  return true;
}
function exerciseCopy(e, kind, messages) {
  const operation = ["determinant", "inverse"].includes(e.op)
    ? e.op + e.a.length
    : e.op;
  return renderMessage(messages, kind + "." + operation, {
    scalar: e.scalar,
    determinant: det(e.a),
    a11: e.a[0]?.[0],
    a12: e.a[0]?.[1],
    a21: e.a[1]?.[0],
    a22: e.a[1]?.[1],
  });
}
export function explanation(e, messages = {}) {
  return exerciseCopy(e, "explanation", messages);
}
export function hint(e, messages = {}) {
  return e.hint || exerciseCopy(e, "hint", messages);
}
export function grade(e, answer) {
  const expected = solve(e);
  const cells = expected.map((r, i) =>
    r.map(
      (v, j) =>
        Number.isFinite(parseAnswer(answer?.[i]?.[j])) &&
        Math.abs(parseAnswer(answer[i][j]) - parseAnswer(v)) < 1e-8,
    ),
  );
  return { correct: cells.every((r) => r.every(Boolean)), cells };
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generate(level = "easy", seed = Date.now()) {
  if (!LEVELS[level]) throw new Error("Dificultate invalidă.");
  const random = rng(seed);
  const n = (max = 3) => Math.floor(random() * (max * 2 + 1)) - max;
  const mat = (r = 2, c = r) =>
    Array.from({ length: r }, () =>
      Array.from({ length: c }, () => n(level === "easy" ? 2 : 3)),
    );
  const ops =
    level === "easy"
      ? ["add", "scale", "transpose", "determinant", "inverse"]
      : level === "normal"
        ? [
            "add",
            "subtract",
            "scale",
            "transpose",
            "multiply",
            "determinant",
            "inverse",
          ]
        : [
            "add",
            "subtract",
            "scale",
            "transpose",
            "multiply",
            "determinant",
            "inverse",
            "determinant",
            "inverse",
          ];
  return ops.map((op, i) => {
    const size = level === "spicy" && i >= 7 ? 3 : 2;
    let a = mat(size, op === "transpose" ? 3 : size);
    if (op === "inverse") {
      let tries = 0;
      do {
        a = mat(size);
        tries++;
      } while (
        (!det(a) ||
          (level === "easy" && Math.abs(det(a)) !== 1) ||
          Math.abs(det(a)) > 8) &&
        tries < 500
      );
      if (!det(a) || (level === "easy" && Math.abs(det(a)) !== 1))
        a = Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => (r === c ? 1 : r < c ? 1 : 0)),
        );
    }
    const e = {
      id: `g-${i}`,
      op,
      a,
      b: ["add", "subtract", "multiply"].includes(op)
        ? mat(a[0].length)
        : undefined,
      scalar: 2,
      title: [
        "Încălzirea mustăților",
        "Un pas de felină",
        "Schimbăm perspectiva",
        "Micul detectiv",
        "Magie cu numere",
        "Determinare de pisică",
        "Misiunea inversă",
        "Un nivel mai sus",
        "Ultimul miau",
      ][i],
    };
    validateExercise(e);
    return e;
  });
}
export function publicExercise(e, state = {}, messages = {}) {
  const answer = solve(e);
  return {
    id: e.id,
    title: /^g-\d+$/.test(e.id)
      ? renderMessage(messages, "exercise.title." + e.id.slice(2))
      : e.title,
    op: e.op,
    a: e.a,
    b: e.b,
    scalar: e.scalar,
    rows: answer.length,
    cols: answer[0].length,
    solved: !!state.solved,
    revealed: !!state.revealed,
    attempts: state.attempts || 0,
    hintUsed: !!state.hintUsed,
  };
}
