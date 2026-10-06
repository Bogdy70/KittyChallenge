import test from "node:test";
import assert from "node:assert/strict";
import {
  solve,
  det,
  grade,
  generate,
  validateExercise,
  parseAnswer,
  publicExercise,
} from "../server/math.mjs";
import { gridFor, validatePlacement } from "../server/puzzle.mjs";
test("operațiile cunoscute au soluții corecte, inclusiv inverse și fracții", () => {
  assert.deepEqual(
    solve({
      op: "add",
      a: [
        [1, -2],
        [0, 3],
      ],
      b: [
        [2, 1],
        [-1, 2],
      ],
    }),
    [
      ["3", "-1"],
      ["-1", "5"],
    ],
  );
  assert.deepEqual(solve({ op: "subtract", a: [[1, -2]], b: [[-3, 1]] }), [
    ["4", "-3"],
  ]);
  assert.deepEqual(solve({ op: "scale", a: [[-2, 0, 3]], scalar: -2 }), [
    ["4", "0", "-6"],
  ]);
  assert.deepEqual(
    solve({
      op: "transpose",
      a: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    }),
    [
      ["1", "4"],
      ["2", "5"],
      ["3", "6"],
    ],
  );
  assert.deepEqual(
    solve({
      op: "multiply",
      a: [
        [1, 2, 3],
        [-1, 0, 2],
      ],
      b: [
        [2, 0],
        [1, -1],
        [3, 2],
      ],
    }),
    [
      ["13", "4"],
      ["4", "4"],
    ],
  );
  assert.equal(
    det([
      [2, 1, 3],
      [0, -1, 2],
      [1, 0, 1],
    ]),
    3,
  );
  assert.deepEqual(
    solve({
      op: "inverse",
      a: [
        [2, 0],
        [0, -4],
      ],
    }),
    [
      ["1/2", "0"],
      ["0", "-1/4"],
    ],
  );
  assert.deepEqual(
    solve({
      op: "inverse",
      a: [
        [1, 2, 0],
        [0, 1, 3],
        [0, 0, 1],
      ],
    }),
    [
      ["1", "-2", "6"],
      ["0", "1", "-3"],
      ["0", "0", "1"],
    ],
  );
});
test("fracții echivalente și zecimale românești sunt acceptate; input invalid este respins", () => {
  const e = {
    op: "inverse",
    a: [
      [2, 0],
      [0, -4],
    ],
  };
  assert.equal(
    grade(e, [
      ["2/4", "0"],
      ["0", "-0,25"],
    ]).correct,
    true,
  );
  assert.equal(
    grade(e, [
      ["1/0", "0"],
      ["0", "-1/4"],
    ]).correct,
    false,
  );
  for (const x of ["", null, "0x10", "Infinity", "1e3", "alert(1)", "1/2/3"])
    assert.equal(Number.isNaN(parseAnswer(x)), true, String(x));
  assert.equal(
    grade(e, [
      [".5", "0"],
      ["0", "-.25"],
    ]).correct,
    true,
  );
});
test("500 seturi pe fiecare nivel au dimensiuni, valori și inverse valide", () => {
  for (const [level, count] of [
    ["easy", 5],
    ["normal", 7],
    ["spicy", 9],
  ])
    for (let seed = 1; seed <= 500; seed++) {
      const exercises = generate(level, seed);
      assert.equal(exercises.length, count);
      for (const e of exercises) {
        assert.equal(validateExercise(e), true);
        const result = solve(e);
        assert.equal(grade(e, result).correct, true);
        assert.equal("answer" in publicExercise(e), false);
        if (e.op === "inverse") {
          const product = e.a.map((row) =>
            result[0].map((_, j) =>
              row.reduce((s, v, k) => s + v * parseAnswer(result[k][j]), 0),
            ),
          );
          product.forEach((r, i) =>
            r.forEach((v, j) =>
              assert.ok(Math.abs(v - (i === j ? 1 : 0)) < 1e-7),
            ),
          );
          if (level === "easy") assert.equal(Math.abs(det(e.a)), 1);
        }
      }
    }
});
test("regulile de validare previn matrice neregulate, incompatibile sau singulare", () => {
  for (const e of [
    { op: "add", a: [[1, 2]], b: [[1]] },
    { op: "multiply", a: [[1, 2]], b: [[1, 2]] },
    {
      op: "inverse",
      a: [
        [1, 2],
        [2, 4],
      ],
    },
    { op: "transpose", a: [[1], [2, 3]] },
    {
      op: "determinant",
      a: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    },
    { op: "scale", a: [[10]], scalar: 1 },
  ])
    assert.throws(() => validateExercise(e));
});
test("puzzle-ul are exact numărul cerut, în orientare potrivită", () => {
  for (const count of [10, 100, 200, 500])
    for (const aspect of [0.5, 1, 1.5, 2]) {
      const { rows, cols } = gridFor(count, aspect);
      assert.equal(rows * cols, count);
      assert.ok(rows >= 2 && cols >= 2);
    }
  assert.throws(() => gridFor(99));
  assert.deepEqual(validatePlacement([3, 1, 3], 10), [1, 3]);
  assert.throws(() => validatePlacement([10], 10));
  assert.throws(() => validatePlacement([-1], 10));
});
