/**
 * codebook.js — Math model ported from cube_closed_system.py
 * Codebook, permutations, and state computation for the Cube system.
 */

// Hardcoded 26-axis codebook from the Python source
export const CODEBOOK_26 = {
  1: [1,0,0], 2: [0,1,1], 3: [1,1,1], 4: [2,1,1], 5: [1,2,2],
  6: [2,2,2], 7: [3,1,3], 8: [3,4,1], 9: [3,2,4], 10: [3,5,2],
  11: [3,3,5], 12: [4,4,4], 13: [5,5,3], 14: [5,4,5], 15: [4,5,6],
  16: [6,4,6], 17: [6,7,4], 18: [6,5,7], 19: [6,8,5], 20: [6,6,8],
  21: [7,7,7], 22: [8,7,7], 23: [7,8,8], 24: [8,8,8], 25: [9,8,8],
  26: [8,9,9]
};

// CSV data for display
export const CODEBOOK_CSV = [
  {S:1, abc:"100", p0:1, p1:2, p2:2, d1:1, d2:0, d3:-1},
  {S:2, abc:"011", p0:2, p1:1, p2:1, d1:-1, d2:0, d3:1},
  {S:3, abc:"111", p0:3, p1:3, p2:3, d1:0, d2:0, d3:0},
  {S:4, abc:"211", p0:4, p1:5, p2:5, d1:1, d2:0, d3:-1},
  {S:5, abc:"122", p0:5, p1:4, p2:4, d1:-1, d2:0, d3:1},
  {S:6, abc:"222", p0:6, p1:6, p2:6, d1:0, d2:0, d3:0},
  {S:7, abc:"313", p0:7, p1:9, p2:7, d1:2, d2:-2, d3:0},
  {S:8, abc:"341", p0:8, p1:7, p2:10, d1:-1, d2:3, d3:-2},
  {S:9, abc:"324", p0:9, p1:10, p2:8, d1:1, d2:-2, d3:1},
  {S:10, abc:"352", p0:10, p1:8, p2:11, d1:-2, d2:3, d3:-1},
  {S:11, abc:"335", p0:11, p1:11, p2:9, d1:0, d2:-2, d3:2},
  {S:12, abc:"444", p0:12, p1:12, p2:12, d1:0, d2:0, d3:0},
  {S:13, abc:"553", p0:13, p1:13, p2:15, d1:0, d2:2, d3:-2},
  {S:14, abc:"545", p0:14, p1:15, p2:14, d1:1, d2:-1, d3:0},
  {S:15, abc:"456", p0:15, p1:14, p2:13, d1:-1, d2:-1, d3:2},
  {S:16, abc:"646", p0:16, p1:18, p2:16, d1:2, d2:-2, d3:0},
  {S:17, abc:"674", p0:17, p1:16, p2:19, d1:-1, d2:3, d3:-2},
  {S:18, abc:"657", p0:18, p1:19, p2:17, d1:1, d2:-2, d3:1},
  {S:19, abc:"685", p0:19, p1:17, p2:20, d1:-2, d2:3, d3:-1},
  {S:20, abc:"668", p0:20, p1:20, p2:18, d1:0, d2:-2, d3:2},
  {S:21, abc:"777", p0:21, p1:21, p2:21, d1:0, d2:0, d3:0},
  {S:22, abc:"877", p0:22, p1:23, p2:23, d1:1, d2:0, d3:-1},
  {S:23, abc:"788", p0:23, p1:22, p2:22, d1:-1, d2:0, d3:1},
  {S:24, abc:"888", p0:24, p1:24, p2:24, d1:0, d2:0, d3:0},
  {S:25, abc:"988", p0:25, p1:26, p2:26, d1:1, d2:0, d3:-1},
  {S:26, abc:"899", p0:26, p1:25, p2:25, d1:-1, d2:0, d3:1},
];

/** S = a+b+c, x1 = 2a+c, x2 = 2a+b */
export function positionsFromDigits(a, b, c) {
  return { s: a + b + c, x1: 2*a + c, x2: 2*a + b };
}

/** Invert a permutation object {key: value} -> {value: key} */
export function inversePerm(f) {
  const inv = {};
  for (const [k, v] of Object.entries(f)) {
    inv[v] = Number(k);
  }
  return inv;
}

/** Backtracking codebook solver for arbitrary grid size n */
export function findCodebook(n) {
  const triplesBySum = {};
  for (let S = 1; S <= n; S++) {
    const uniq = {};
    for (let a = 0; a <= 9; a++) {
      for (let b = 0; b <= 9; b++) {
        for (let c = 0; c <= 9; c++) {
          if (a + b + c !== S) continue;
          const x1 = 2*a + c;
          const x2 = 2*a + b;
          if (x1 >= 1 && x1 <= n && x2 >= 1 && x2 <= n) {
            const key = `${x1},${x2}`;
            if (!(key in uniq)) {
              uniq[key] = [x1, x2, a, b, c];
            }
          }
        }
      }
    }
    triplesBySum[S] = Object.values(uniq);
  }

  const used1 = new Set();
  const used2 = new Set();
  const assign = {};

  function bt() {
    if (Object.keys(assign).length === n) return true;
    let bestS = null, bestOpts = null;
    for (let S = 1; S <= n; S++) {
      if (S in assign) continue;
      const opts = triplesBySum[S].filter(o => !used1.has(o[0]) && !used2.has(o[1]));
      if (opts.length === 0) return false;
      if (bestOpts === null || opts.length < bestOpts.length) {
        bestS = S; bestOpts = opts;
      }
    }
    const rem = [];
    for (let s = 1; s <= n; s++) {
      if (!(s in assign) && s !== bestS) rem.push(s);
    }
    bestOpts.sort((a, b) => {
      let impactA = 0, impactB = 0;
      for (const s of rem) {
        for (const p of triplesBySum[s]) {
          if (p[0] === a[0] || p[1] === a[1]) impactA++;
          if (p[0] === b[0] || p[1] === b[1]) impactB++;
        }
      }
      return impactA - impactB;
    });
    for (const [x1, x2, a, b, c] of bestOpts) {
      assign[bestS] = [a, b, c];
      used1.add(x1); used2.add(x2);
      if (bt()) return true;
      used1.delete(x1); used2.delete(x2);
      delete assign[bestS];
    }
    return false;
  }

  if (!bt()) throw new Error(`No codebook found for n=${n}`);
  const sorted = {};
  for (let s = 1; s <= n; s++) sorted[s] = assign[s];
  return sorted;
}

/** Build three phase-transition permutations from a codebook */
export function buildPermutations(codebook) {
  const f1 = {}, f2 = {};
  for (const [sStr, abc] of Object.entries(codebook)) {
    const s = Number(sStr);
    const { x1, x2 } = positionsFromDigits(abc[0], abc[1], abc[2]);
    f1[s] = x1;
    f2[s] = x2;
  }
  const invF1 = inversePerm(f1);
  const invF2 = inversePerm(f2);

  // P01 = f1 (maps S -> x1)
  const P01 = { ...f1 };
  // P12 = f2 ∘ f1^-1
  const P12 = {};
  for (const x of Object.values(f1)) {
    P12[x] = f2[invF1[x]];
  }
  // P20 = f2^-1
  const P20 = {};
  for (const x of Object.values(f2)) {
    P20[x] = invF2[x];
  }
  return { P01, P12, P20 };
}

/** Apply single-axis permutation to a list of [x,y,z] positions */
export function applyStage(positions, perm, axis) {
  return positions.map(([x, y, z]) => {
    if (axis === 0) return [perm[x], y, z];
    if (axis === 1) return [x, perm[y], z];
    return [x, y, perm[z]];
  });
}

/**
 * Build all 10 animation states for a given grid size.
 * Returns { states, titles, trackedInitial, P01, P12, P20, codebook }
 */
export function buildStates(n = 8) {
  let codebook;
  if (n <= 26) {
    codebook = findCodebook(n);
  } else {
    codebook = CODEBOOK_26;
    n = 26;
  }
  const { P01, P12, P20 } = buildPermutations(codebook);

  // Tracked rooms: match Python's [1, n//2, n] pattern
  const levels = [1, Math.max(1, Math.floor(n / 2)), n];
  const uniqueLevels = [...new Set(levels)].sort((a, b) => a - b);
  // For n<=3, track all rooms instead of corners only
  if (n <= 3) {
    const allInitial = [];
    for (let x = 1; x <= n; x++)
      for (let y = 1; y <= n; y++)
        for (let z = 1; z <= n; z++)
          allInitial.push([x, y, z]);

    const states = [allInitial.map(p => [...p])];
    const titles = ["Phase 0（初始停靠）"];
    let cur = allInitial.map(p => [...p]);
    const permsArr = [[P01, "0→1"], [P12, "1→2"], [P20, "2→0"]];
    for (const [perm, label] of permsArr) {
      cur = applyStage(cur, perm, 0);
      states.push(cur.map(p => [...p]));
      titles.push(`${label}：X 轴重排`);
      cur = applyStage(cur, perm, 1);
      states.push(cur.map(p => [...p]));
      titles.push(`${label}：X+Y 轴重排`);
      cur = applyStage(cur, perm, 2);
      states.push(cur.map(p => [...p]));
      if (label === "0→1") titles.push("Phase 1");
      else if (label === "1→2") titles.push("Phase 2");
      else titles.push("回到 Phase 0");
    }
    return { states, titles, trackedInitial: allInitial, P01, P12, P20, codebook, n };
  }
  const trackedInitial = [];
  for (const x of uniqueLevels) {
    for (const y of uniqueLevels) {
      for (const z of uniqueLevels) {
        trackedInitial.push([x, y, z]);
      }
    }
  }

  const states = [trackedInitial.map(p => [...p])];
  const titles = ["Phase 0（初始停靠）"];
  let cur = trackedInitial.map(p => [...p]);

  const perms = [
    [P01, "0→1"],
    [P12, "1→2"],
    [P20, "2→0"]
  ];

  for (const [perm, label] of perms) {
    cur = applyStage(cur, perm, 0);
    states.push(cur.map(p => [...p]));
    titles.push(`${label}：X 轴重排`);

    cur = applyStage(cur, perm, 1);
    states.push(cur.map(p => [...p]));
    titles.push(`${label}：X+Y 轴重排`);

    cur = applyStage(cur, perm, 2);
    states.push(cur.map(p => [...p]));
    if (label === "0→1") titles.push("Phase 1");
    else if (label === "1→2") titles.push("Phase 2");
    else titles.push("回到 Phase 0");
  }

  return { states, titles, trackedInitial, P01, P12, P20, codebook, n };
}

/**
 * Build all room positions for full grid (n^3 rooms).
 * Returns same structure but tracks ALL rooms.
 */
export function buildFullStates(n = 8) {
  const codebook = findCodebook(n);
  const { P01, P12, P20 } = buildPermutations(codebook);

  const allInitial = [];
  for (let x = 1; x <= n; x++) {
    for (let y = 1; y <= n; y++) {
      for (let z = 1; z <= n; z++) {
        allInitial.push([x, y, z]);
      }
    }
  }

  const states = [allInitial.map(p => [...p])];
  const titles = ["Phase 0（初始停靠）"];
  let cur = allInitial.map(p => [...p]);

  const perms = [
    [P01, "0→1"],
    [P12, "1→2"],
    [P20, "2→0"]
  ];

  for (const [perm, label] of perms) {
    cur = applyStage(cur, perm, 0);
    states.push(cur.map(p => [...p]));
    titles.push(`${label}：X 轴重排`);

    cur = applyStage(cur, perm, 1);
    states.push(cur.map(p => [...p]));
    titles.push(`${label}：X+Y 轴重排`);

    cur = applyStage(cur, perm, 2);
    states.push(cur.map(p => [...p]));
    if (label === "0→1") titles.push("Phase 1");
    else if (label === "1→2") titles.push("Phase 2");
    else titles.push("回到 Phase 0");
  }

  return { states, titles, allInitial, P01, P12, P20, codebook, n };
}

/** Get permutation cycle decomposition for display */
export function permCycles(perm) {
  const seen = new Set();
  const cycles = [];
  const keys = Object.keys(perm).map(Number).sort((a,b) => a - b);
  for (const s of keys) {
    if (seen.has(s)) continue;
    const cyc = [];
    let x = s;
    while (!seen.has(x)) {
      seen.add(x);
      cyc.push(x);
      x = perm[x];
    }
    cycles.push(cyc);
  }
  return cycles;
}

export function formatCycles(perm) {
  const cycles = permCycles(perm);
  return cycles.map(c => c.length === 1 ? `(${c[0]})` : `(${c.join(' ')})`).join(' ');
}
