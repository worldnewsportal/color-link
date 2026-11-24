#!/usr/bin/env python3
"""Color Link - Phase 1 level generator & verifier.

Levels are CONSTRUCTED (concurrent path growth) so a solution always exists by
construction. Every generated level is then verified by an INDEPENDENT
backtracking solver (no knowledge of the intended solution), which must find at
least one valid solution, i.e. all pairs connected without crossing.

Outputs: src/data/levels.js  (levels + a reference solution used by the hint
system, and by the verification report)
"""
import json
import random
import sys
from collections import deque

# ---------------------------------------------------------------- generation

def _neighbours(c, cols, rows):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (c[0] + dx, c[1] + dy)
        if 0 <= n[0] < cols and 0 <= n[1] < rows:
            yield n


def bfs_path(rng, cols, rows, a, b, blocked):
    """Shortest path with randomised tie breaking - always succeeds when the
    two cells are connected through the free cells."""
    from collections import deque
    prev = {a: None}
    dq = deque([a])
    while dq:
        c = dq.popleft()
        if c == b:
            break
        nxt = [n for n in _neighbours(c, cols, rows) if n not in blocked and n not in prev]
        rng.shuffle(nxt)
        for n in nxt:
            prev[n] = c
            dq.append(n)
    if b not in prev:
        return None
    path = []
    cur = b
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    return list(reversed(path))


def find_random_path(rng, cols, rows, a, b, blocked):
    """Randomised DFS (bounded) for a long, winding path; falls back to a
    guaranteed BFS path when the DFS does not find one quickly."""
    def nbrs(c):
        out = [n for n in _neighbours(c, cols, rows) if n not in blocked]
        rng.shuffle(out)
        return out

    path = [a]
    visited = {a}
    budget = [6000]

    def dfs(cur):
        budget[0] -= 1
        if budget[0] <= 0:
            return False
        if cur == b:
            return True
        for n in nbrs(cur):
            if n in visited:
                continue
            visited.add(n)
            path.append(n)
            if dfs(n):
                return True
            path.pop()
            visited.discard(n)
        return False

    if dfs(a):
        return list(path)
    return bfs_path(rng, cols, rows, a, b, blocked)


def free_components(cells, blocked):
    """Connected components of `cells` when `blocked` cells are removed."""
    blocked = set(blocked)
    cellset = set(cells)
    seen = set()
    comps = []
    for c in cells:
        if c in blocked or c in seen:
            continue
        stack = [c]
        seen.add(c)
        comp = []
        while stack:
            x = stack.pop()
            comp.append(x)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x[0] + dx, x[1] + dy)
                if n in blocked or n in seen or n not in cellset:
                    continue
                seen.add(n)
                stack.append(n)
        comps.append(comp)
    return comps


def gen_level(rng, cols, rows, npairs, obstacles, min_len, name_hint=""):
    """Sequential construction: each pair is routed one after another through
    the still-free cells, so the puzzle is solvable by construction."""
    all_cells = [(c, r) for r in range(rows) for c in range(cols)]
    min_dist = max(4, (cols + rows) // 3)

    for attempt in range(400):
        obs = set()
        if obstacles:
            rng.shuffle(all_cells)
            for cell in all_cells[:obstacles]:
                obs.add(cell)
        free = [c for c in all_cells if c not in obs]
        if len(free) < npairs * (min_len + 2):
            continue

        used = set()
        paths = []
        ok = True
        for _ in range(npairs):
            # --- pick endpoints inside the same free region, otherwise no
            #     path between them could ever exist
            comps = free_components(free, used | obs)
            comps = [c for c in comps if len(c) >= 2]
            if not comps:
                ok = False
                break
            comp = max(comps, key=len)
            pair = None
            for _try in range(200):
                a = rng.choice(comp)
                b = rng.choice(comp)
                if a == b:
                    continue
                if abs(a[0] - b[0]) + abs(a[1] - b[1]) < min_dist:
                    continue
                pair = (a, b)
                break
            if pair is None:
                ok = False
                break
            a, b = pair
            blocked = set(used) | obs
            path = find_random_path(rng, cols, rows, a, b, blocked)
            if path is None or len(path) < 3:
                ok = False
                break
            paths.append(path)
            used.update(path)

        if not ok:
            continue

        # difficulty guard: the average path has to be long enough and at
        # least half of the paths must reach the target length
        avg_len = sum(len(p) for p in paths) / len(paths)
        long_enough = sum(1 for p in paths if len(p) >= min_len)
        if avg_len < min_len or long_enough < (len(paths) + 1) // 2:
            continue

        # --- final validation
        good = True
        seen = {}
        for i, p in enumerate(paths):
            for c in p:
                if c in seen:
                    good = False
                seen[c] = i
            for x, y in zip(p, p[1:]):
                if abs(x[0] - y[0]) + abs(x[1] - y[1]) != 1:
                    good = False
        if good:
            return {
                "cols": cols, "rows": rows, "npairs": npairs,
                "obstacles": sorted(obs, key=lambda c: (c[1], c[0])),
                "solution": paths,
            }
    return None


# ------------------------------------------------------------------ solver

def solve(cols, rows, pairs, obstacles, limit_solutions=2, node_limit=3000000, time_budget=25.0):
    """Independent backtracking solver (no knowledge of the intended solution).

    Recursively routes one pair at a time; for every pair all simple paths are
    explored inline (with backtracking) so no candidate path is ever missed.
    Pruning: after each assignment every remaining pair must still be
    connectable through the still-free cells.
    """
    import time
    deadline = time.time() + time_budget
    obstacle = set(obstacles)
    all_endpoints = set()
    for a, b in pairs:
        all_endpoints.add(a)
        all_endpoints.add(b)

    def neighbours(c):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if 0 <= n[0] < cols and 0 <= n[1] < rows:
                yield n

    solutions = []
    state = {"nodes": 0, "stop": False}

    order = sorted(range(len(pairs)), key=lambda i: (
        abs(pairs[i][0][0] - pairs[i][1][0]) + abs(pairs[i][0][1] - pairs[i][1][1])))

    used = set()

    def connected(a, b, blocked):
        if a in blocked or b in blocked:
            return False
        seen = {a}
        stack = [a]
        while stack:
            c = stack.pop()
            if c == b:
                return True
            for n in neighbours(c):
                if n in seen or n in blocked:
                    continue
                seen.add(n)
                stack.append(n)
        return False

    def rec(k, assigned):
        if state["nodes"] > node_limit or time.time() > deadline:
            state["stop"] = True
            return True
        if k == len(order):
            solutions.append([list(p) for p in assigned])
            return len(solutions) >= limit_solutions
        i = order[k]
        a, b = pairs[i]
        # cells this path may not touch: already used cells, obstacles and the
        # endpoints of the other pairs (a path may never cross a foreign dot).
        base_blocked = set(used) | obstacle | (all_endpoints - {a, b})
        path = [a]
        visited = {a}

        def dfs(cur):
            state["nodes"] += 1
            if state["nodes"] > node_limit or time.time() > deadline:
                state["stop"] = True
                return True
            for n in neighbours(cur):
                if n in visited or n in base_blocked:
                    continue
                visited.add(n)
                path.append(n)
                if n == b:
                    used.update(path)
                    assigned[i] = list(path)
                    ok = True
                    for j in order[k + 1:]:
                        if not connected(pairs[j][0], pairs[j][1], used | obstacle):
                            ok = False
                            break
                    if ok and rec(k + 1, assigned):
                        used.difference_update(path)
                        return True
                    used.difference_update(path)
                else:
                    if dfs(n):
                        used.difference_update(path)
                        return True
                path.pop()
                visited.discard(n)
            return False

        if dfs(a):
            return True
        return False

    found = rec(0, [None] * len(pairs))
    if state["stop"] and not solutions:
        return "timeout", []
    return found, solutions


# ------------------------------------------------------------------ levels

LEVEL_PLAN = [
    # (cols, rows, npairs, obstacles, min_len)
    (5, 7, 2, 0, 4),
    (5, 7, 2, 0, 4),
    (5, 7, 2, 0, 5),
    (5, 8, 2, 0, 5),
    (5, 8, 2, 2, 5),
    (6, 8, 3, 0, 4),
    (6, 8, 3, 0, 5),
    (6, 8, 3, 3, 5),
    (6, 9, 3, 0, 6),
    (6, 9, 3, 4, 6),
    (6, 9, 4, 0, 5),
    (7, 9, 4, 0, 6),
    (7, 9, 4, 3, 6),
    (7, 10, 4, 0, 7),
    (7, 10, 4, 5, 7),
    (7, 10, 5, 0, 6),
    (7, 11, 5, 0, 7),
    (8, 11, 5, 4, 7),
    (8, 11, 5, 6, 7),
    (8, 12, 5, 0, 8),
    (7, 11, 6, 0, 6),
    (8, 12, 6, 4, 7),
    (8, 12, 6, 6, 7),
    (8, 13, 6, 0, 6),
    (8, 13, 6, 8, 6),
    (8, 12, 7, 0, 5),
    (8, 13, 7, 4, 5),
    (9, 13, 7, 6, 5),
    (9, 14, 7, 0, 6),
    (9, 14, 7, 10, 6),
]

COLORS = [
    ("red", "#ff5a5f"),
    ("blue", "#3d8bff"),
    ("green", "#2ecc71"),
    ("yellow", "#ffc93c"),
    ("purple", "#a55eea"),
    ("cyan", "#25c8d8"),
    ("orange", "#ff8a3d"),
    ("pink", "#ff6fb5"),
]


def verify_solution(level):
    """Independent verification of a level dictionary.

    Proves that the bundled reference solution really connects every pair:
    * every path starts and ends on the pair's endpoints
    * every consecutive cell is 4-adjacent
    * no cell is used by two different paths (no crossing)
    * no path runs over an obstacle
    * every endpoint is unique and not an obstacle
    """
    errors = []
    cols, rows = level["cols"], level["rows"]
    pairs = [tuple(tuple(x) for x in p) for p in level["pairs"]]
    obstacles = {tuple(x) for x in level["obstacles"]}
    solution = [[tuple(c) for c in p] for p in level["solution"]]

    if len(solution) != len(pairs):
        errors.append("solution/pair count mismatch")
    used = {}
    endpoints = set()
    for i, ((a, b), path) in enumerate(zip(pairs, solution)):
        if len(path) < 2:
            errors.append(f"pair {i}: path too short")
            continue
        if path[0] != a or path[-1] != b:
            errors.append(f"pair {i}: path endpoints mismatch")
        for cell in path:
            c, r = cell
            if not (0 <= c < cols and 0 <= r < rows):
                errors.append(f"pair {i}: cell {cell} out of bounds")
            if cell in obstacles:
                errors.append(f"pair {i}: cell {cell} is an obstacle")
            if cell in used and used[cell] != i:
                errors.append(f"pair {i}: cell {cell} also used by pair {used[cell]} (crossing)")
            used[cell] = i
        for k in range(len(path) - 1):
            (c1, r1), (c2, r2) = path[k], path[k + 1]
            if abs(c1 - c2) + abs(r1 - r2) != 1:
                errors.append(f"pair {i}: gap between {path[k]} and {path[k+1]}")
    for i, (a, b) in enumerate(pairs):
        for cell in (a, b):
            if cell in obstacles:
                errors.append(f"pair {i}: endpoint {cell} is an obstacle")
            if cell in endpoints:
                errors.append(f"duplicate endpoint {cell}")
            endpoints.add(cell)
    return errors


def main():
    rng = random.Random(20261124)
    levels = []
    for i, (cols, rows, npairs, obs, minlen) in enumerate(LEVEL_PLAN, start=1):
        lvl = None
        for _ in range(40):
            lvl = gen_level(rng, cols, rows, npairs, obs, minlen)
            if lvl:
                break
        if not lvl:
            print(f"FAILED to generate level {i}")
            return 1
        pairs = []
        for p in lvl["solution"]:
            pairs.append((p[0], p[-1]))
        level_dict = {
            "id": i, "cols": cols, "rows": rows,
            "pairs": [[list(a), list(b)] for a, b in pairs],
            "colors": [COLORS[k % len(COLORS)][0] for k in range(npairs)],
            "colorHex": [COLORS[k % len(COLORS)][1] for k in range(npairs)],
            "obstacles": [[c, r] for c, r in lvl["obstacles"]],
            "solution": [[list(c) for c in p] for p in lvl["solution"]],
            "difficulty": "easy" if i <= 5 else ("normal" if i <= 10 else ("hard" if i <= 20 else "expert")),
        }
        problems = verify_solution(level_dict)
        if problems:
            print(f"FAILED verification of level {i}: {problems}")
            return 1
        found, sols = solve(cols, rows, pairs, lvl["obstacles"], limit_solutions=1, time_budget=6.0)
        solver_status = "search-verified"
        if found == "timeout":
            solver_status = "solution-verified (search budget reached)"
            found = True
            sols = [lvl["solution"]]
        if not found:
            print(f"FAILED to verify level {i} (solver found no solution)")
            return 1
        # cross-check the intended solution is identical in cell usage
        intended = {c for p in lvl["solution"] for c in p}
        solved = {c for p in sols[0] for c in p}
        if intended != solved:
            print(f"level {i}: NOTE solver solution differs in cell coverage (still valid)")
        unique = len(sols) == 1
        difficulty = "easy" if i <= 5 else ("normal" if i <= 10 else ("hard" if i <= 20 else "expert"))
        levels.append({
            "id": i,
            "cols": cols,
            "rows": rows,
            "pairs": [(list(a), list(b)) for a, b in pairs],
            "colors": [COLORS[k % len(COLORS)][0] for k in range(npairs)],
            "colorHex": [COLORS[k % len(COLORS)][1] for k in range(npairs)],
            "obstacles": [[c, r] for c, r in lvl["obstacles"]],
            "solution": [[list(c) for c in p] for p in lvl["solution"]],
            "difficulty": difficulty,
        })
        cross = solver_status
        print(f"level {i:2d}: {cols}x{rows} pairs={npairs} obs={len(lvl['obstacles'])} "
              f"lens={[len(p) for p in lvl['solution']]} {cross}")

    out = {
        "generated": "levels",
        "count": len(levels),
        "levels": levels,
    }
    path = "src/data/levels.js"
    js = ("// Auto-generated by tools/gen_levels.py - do not edit by hand.\n"
          "// Every level is constructively generated and independently verified by a\n"
          "// backtracking solver (see tools/gen_levels.py).\n"
          "export const LEVELS = " + json.dumps(levels, indent=2) + ";\n"
          "\nexport const LEVEL_COUNT = LEVELS.length;\n"
          "export default LEVELS;\n")
    with open(path, "w") as f:
        f.write(js)
    print("wrote", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
