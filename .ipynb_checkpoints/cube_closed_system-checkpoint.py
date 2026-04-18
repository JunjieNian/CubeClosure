#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
闭合版《心慌方》机械系统原型与可视化
--------------------------------
1) 内置一个经过验证的 26 轴精确 codebook；
2) 导出完整 axis codebook CSV；
3) 生成一个 8×8×8 原型动画 GIF，演示三阶段 X/Y/Z 重排。

运行：
    python cube_closed_system.py
"""
from pathlib import Path
import csv, itertools
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import animation, font_manager

OUTDIR = Path(__file__).resolve().parent

FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_PROP = font_manager.FontProperties(fname=FONT_PATH)
plt.rcParams["font.family"] = FONT_PROP.get_name()
plt.rcParams["axes.unicode_minus"] = False


CODEBOOK26 = {1: (1, 0, 0), 2: (0, 1, 1), 3: (1, 1, 1), 4: (2, 1, 1), 5: (1, 2, 2), 6: (2, 2, 2), 7: (3, 1, 3), 8: (3, 4, 1), 9: (3, 2, 4), 10: (3, 5, 2), 11: (3, 3, 5), 12: (4, 4, 4), 13: (5, 5, 3), 14: (5, 4, 5), 15: (4, 5, 6), 16: (6, 4, 6), 17: (6, 7, 4), 18: (6, 5, 7), 19: (6, 8, 5), 20: (6, 6, 8), 21: (7, 7, 7), 22: (8, 7, 7), 23: (7, 8, 8), 24: (8, 8, 8), 25: (9, 8, 8), 26: (8, 9, 9)}

def positions_from_digits(abc):
    a, b, c = abc
    s = a + b + c
    x1 = 2*a + c
    x2 = 2*a + b
    return s, x1, x2

def inverse_perm(f):
    return {v: k for k, v in f.items()}

def perm_cycles(f):
    seen = set()
    cycles = []
    for s in sorted(f):
        if s in seen:
            continue
        cyc = []
        x = s
        while x not in seen:
            seen.add(x)
            cyc.append(x)
            x = f[x]
        cycles.append(cyc)
    return cycles

def export_full_codebook_csv(path: Path):
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "coordinate_S", "serial_abc", "phase0_position", "phase1_position",
            "phase2_position", "delta1_a_minus_b", "delta2_b_minus_c",
            "delta3_c_minus_a"
        ])
        for s in range(1, 27):
            a, b, c = CODEBOOK26[s]
            s0, x1, x2 = positions_from_digits((a, b, c))
            writer.writerow([s, f"{a}{b}{c}", s0, x1, x2, a-b, b-c, c-a])

def find_codebook(n: int):
    triples_by_sum = {}
    for S in range(1, n+1):
        uniq = {}
        for a, b, c in itertools.product(range(10), repeat=3):
            if a + b + c != S:
                continue
            x1 = 2*a + c
            x2 = 2*a + b
            if 1 <= x1 <= n and 1 <= x2 <= n:
                uniq.setdefault((x1, x2), (a, b, c))
        triples_by_sum[S] = [(x1, x2, *abc) for (x1, x2), abc in uniq.items()]
    used1, used2, assign = set(), set(), {}
    def bt():
        if len(assign) == n:
            return True
        bestS, bestopts = None, None
        for S in range(1, n+1):
            if S in assign:
                continue
            opts = [opt for opt in triples_by_sum[S] if opt[0] not in used1 and opt[1] not in used2]
            if not opts:
                return False
            if bestopts is None or len(opts) < len(bestopts):
                bestS, bestopts = S, opts
        rem = [s for s in range(1, n+1) if s not in assign and s != bestS]
        def score(opt):
            x1, x2, *_ = opt
            impact = 0
            for s in rem:
                for p in triples_by_sum[s]:
                    if p[0] == x1 or p[1] == x2:
                        impact += 1
            return impact
        bestopts.sort(key=score)
        for x1, x2, a, b, c in bestopts:
            assign[bestS] = (a, b, c)
            used1.add(x1); used2.add(x2)
            if bt():
                return True
            used1.remove(x1); used2.remove(x2)
            del assign[bestS]
        return False
    if not bt():
        raise RuntimeError(f"No codebook found for n={n}")
    return dict(sorted(assign.items()))

def cube_edges(minc, maxc):
    pts = [
        (minc,minc,minc),(maxc,minc,minc),(maxc,maxc,minc),(minc,maxc,minc),
        (minc,minc,maxc),(maxc,minc,maxc),(maxc,maxc,maxc),(minc,maxc,maxc)
    ]
    edges = [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
    return pts, edges

def draw_cube(ax, pts, edges, linewidth=0.8, alpha=0.6):
    for i, j in edges:
        ax.plot([pts[i][0], pts[j][0]],
                [pts[i][1], pts[j][1]],
                [pts[i][2], pts[j][2]],
                linewidth=linewidth, alpha=alpha)

def apply_stage(points, perm, axis):
    out = []
    for x, y, z in points:
        if axis == 0:
            out.append((perm[x], y, z))
        elif axis == 1:
            out.append((x, perm[y], z))
        else:
            out.append((x, y, perm[z]))
    return out

def build_states_for_toy(n=8):
    codebook = find_codebook(n)
    f1 = {s: positions_from_digits(abc)[1] for s, abc in codebook.items()}
    f2 = {s: positions_from_digits(abc)[2] for s, abc in codebook.items()}
    inv_f1 = inverse_perm(f1)
    inv_f2 = inverse_perm(f2)
    P01 = f1
    P12 = {x: f2[inv_f1[x]] for x in sorted(f1.values())}
    P20 = {x: inv_f2[x] for x in sorted(f2.values())}

    levels = [1, 4, n]
    tracked_initial = [(x, y, z) for x in levels for y in levels for z in levels]
    states = [list(tracked_initial)]
    titles = ["Phase 0 (初始停靠)"]
    cur = list(tracked_initial)

    for perm, label in [(P01, "0→1"), (P12, "1→2"), (P20, "2→0")]:
        cur = apply_stage(cur, perm, 0); states.append(cur); titles.append(f"{label}：X 轴重排")
        cur = apply_stage(cur, perm, 1); states.append(cur); titles.append(f"{label}：X+Y 轴重排")
        cur = apply_stage(cur, perm, 2); states.append(cur)
        titles.append("Phase 1" if label=="0→1" else ("Phase 2" if label=="1→2" else "回到 Phase 0"))
    return states, titles, tracked_initial, P01, P12, P20

def render_gif(path: Path, n=8):
    states, titles, order, P01, P12, P20 = build_states_for_toy(n)
    prop_cycle = plt.rcParams['axes.prop_cycle'].by_key().get('color', ['C0'])
    colors = [prop_cycle[i % len(prop_cycle)] for i in range(len(order))]
    color_map = {room: colors[i] for i, room in enumerate(order)}
    pos_dicts = [{room: pos for room, pos in zip(order, state)} for state in states]

    feat_room = (n, 4, 1)
    feat_states = [feat_room]
    cur = feat_room
    for perm, axis in [(P01,0),(P01,1),(P01,2),(P12,0),(P12,1),(P12,2),(P20,0),(P20,1),(P20,2)]:
        if axis == 0:
            cur = (perm[cur[0]], cur[1], cur[2])
        elif axis == 1:
            cur = (cur[0], perm[cur[1]], cur[2])
        else:
            cur = (cur[0], cur[1], perm[cur[2]])
        feat_states.append(cur)

    fig = plt.figure(figsize=(7.5, 7.5))
    ax = fig.add_subplot(111, projection="3d")
    inner_pts, inner_edges = cube_edges(1, n)
    outer_pts, outer_edges = cube_edges(1, n+1)

    def update(frame):
        ax.clear()
        ax.set_title(
            "《心慌方》闭合机械原型（8×8×8 核心 + 1 层服务皮层）\n"
            + titles[frame] + "\n"
            + "只显示 27 个标记房间；完整模型可扩展到 26×26×26",
            pad=18
        )
        draw_cube(ax, inner_pts, inner_edges, linewidth=1.0, alpha=0.7)
        draw_cube(ax, outer_pts, outer_edges, linewidth=0.6, alpha=0.35)
        ax.text(n+1.15, 1, 1, "x=服务层", fontsize=8)
        ax.text(1, n+1.15, 1, "y=服务层", fontsize=8)
        ax.text(1, 1, n+1.15, "z=服务层", fontsize=8)

        posd = pos_dicts[frame]
        xs = [posd[r][0] for r in order]
        ys = [posd[r][1] for r in order]
        zs = [posd[r][2] for r in order]
        cs = [color_map[r] for r in order]
        ax.scatter(xs, ys, zs, s=40, depthshade=False, c=cs)

        fx, fy, fz = feat_states[frame]
        ax.scatter([fx], [fy], [fz], s=180, marker="*", depthshade=False, c=[prop_cycle[0]])
        path = feat_states[:frame+1]
        ax.plot([p[0] for p in path], [p[1] for p in path], [p[2] for p in path], linewidth=1.5)
        ax.text(fx+0.1, fy+0.1, fz+0.1, "示例房间", fontsize=9)

        ax.set_xlim(1, n+1)
        ax.set_ylim(1, n+1)
        ax.set_zlim(1, n+1)
        ax.set_xlabel("X"); ax.set_ylabel("Y"); ax.set_zlabel("Z")
        ax.set_box_aspect((1,1,1))
        ax.view_init(elev=20, azim=35)
        ax.set_xticks(range(1, n+2))
        ax.set_yticks(range(1, n+2))
        ax.set_zticks(range(1, n+2))

    ani = animation.FuncAnimation(fig, update, frames=len(states), interval=900, repeat=True)
    ani.save(path, writer=animation.PillowWriter(fps=1.1))
    plt.close(fig)

def main():
    export_full_codebook_csv(OUTDIR / "cube_axis_codebook_26.csv")
    render_gif(OUTDIR / "cube_prototype_visualization.gif", n=8)
    print("Wrote:", OUTDIR / "cube_axis_codebook_26.csv")
    print("Wrote:", OUTDIR / "cube_prototype_visualization.gif")

if __name__ == "__main__":
    main()
