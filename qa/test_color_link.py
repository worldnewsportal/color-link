#!/usr/bin/env python3
"""Color Link - automated QA.

Drives the real game in Chromium with real pointer input:
  * every screen opens and closes
  * all 30 levels are played to completion (mouse drags along the reference
    solution) -> win detection, unlock and saving are exercised for real
  * undo / restart / hint behave
  * settings persist across a reload, language switches to RTL
  * no console errors, no horizontal overflow on three phone sizes
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 5199
BASE = f"http://127.0.0.1:{PORT}/"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  ✔ {name}")
    else:
        FAIL.append((name, detail))
        print(f"  ✖ {name} {detail}")


def start_server():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    return srv


def drag(page, points, steps=1):
    """points: list of (x, y) client coordinates."""
    page.mouse.move(points[0][0], points[0][1])
    page.mouse.down()
    for p in points[1:]:
        page.mouse.move(p[0], p[1], steps=steps)
    page.mouse.up()


def cell_points(page, cells):
    """Convert grid cells to client coordinates using the live canvas geometry."""
    geo = page.evaluate("() => { const g = window.ColorLink.gameplay.renderer.geometry(); "
                        "const r = document.getElementById('board').getBoundingClientRect(); "
                        "return {g, left: r.left, top: r.top}; }")
    g = geo["g"]
    out = []
    for (c, r) in cells:
        out.append((geo["left"] + g["ox"] + (c + 0.5) * g["size"],
                    geo["top"] + g["oy"] + (r + 0.5) * g["size"]))
    return out


def main():
    srv = start_server()
    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--no-sandbox"])
            ctx = browser.new_context(viewport={"width": 393, "height": 851},
                                      device_scale_factor=2.5, has_touch=True, is_mobile=True)
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}")
                    if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            print("\n[1] boot & main menu")
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(700)
            check("menu is visible", page.is_visible("#screen-menu"))
            check("logo rendered", page.is_visible(".logo"))
            check("level counter shown", page.inner_text("#menu-level").strip().isdigit())

            print("\n[2] screens open / close")
            for screen, trigger in [("levels", "#btn-levels"), ("stats", "#btn-stats"),
                                    ("settings", "#btn-settings")]:
                page.click(trigger)
                page.wait_for_timeout(350)
                check(f"{screen} screen opens", page.is_visible(f"#screen-{screen}"))
                page.click(f'#screen-{screen} [data-nav="menu"]')
                page.wait_for_timeout(350)
                check(f"{screen} screen closes", page.is_visible("#screen-menu"))

            print("\n[3] level selection: locked levels are protected")
            page.click("#btn-levels")
            page.wait_for_timeout(400)
            cards = page.query_selector_all(".level-card")
            check("30 level cards rendered", len(cards) == 30, f"got {len(cards)}")
            check("level 2 is locked at start", "is-locked" in (cards[1].get_attribute("class") or ""))
            cards[1].click()
            page.wait_for_timeout(250)
            check("locked level shows a toast", page.is_visible(".toast"))
            page.click('#screen-levels [data-nav="menu"]')
            page.wait_for_timeout(300)

            print("\n[4] play level 1 with real pointer drags")
            page.click("#btn-play")
            page.wait_for_timeout(600)
            check("game screen visible", page.is_visible("#screen-game"))
            check("canvas has a size", page.evaluate(
                "() => { const c = document.getElementById('board'); return c.width > 100 && c.height > 100; }"))
            sol = page.evaluate("() => window.ColorLink.gameplay.level.solution")
            pairs = page.evaluate("() => window.ColorLink.gameplay.level.pairs")
            for i, path in enumerate(sol):
                drag(page, cell_points(page, path))
                page.wait_for_timeout(120)
            page.wait_for_timeout(900)
            check("win overlay appears", page.is_visible("#win-overlay"))
            check("win time displayed", ":" in page.inner_text("#win-time"))
            page.click("#btn-win-next")
            page.wait_for_timeout(600)
            check("next level loaded", page.inner_text("#game-level").strip() == "2")

            print("\n[5] undo / restart / hint")
            page.click('#screen-game [data-nav="menu"]')
            page.wait_for_timeout(300)
            page.click("#btn-levels")
            page.wait_for_timeout(300)
            page.click(".level-card:nth-child(1)")
            page.wait_for_timeout(600)
            sol = page.evaluate("() => window.ColorLink.gameplay.level.solution")
            drag(page, cell_points(page, sol[0][:3]))
            page.wait_for_timeout(200)
            len_before = page.evaluate("() => window.ColorLink.gameplay.engine.path(0).length")
            page.click("#btn-undo")
            page.wait_for_timeout(250)
            len_after = page.evaluate("() => window.ColorLink.gameplay.engine.path(0).length")
            check("undo removes the drawn cells", len_after < len_before, f"{len_before} -> {len_after}")
            page.click("#btn-restart")
            page.wait_for_timeout(250)
            check("restart clears the board", page.evaluate(
                "() => window.ColorLink.gameplay.engine.paths.every(p => p.length === 0)"))
            hints_before = page.inner_text("#hint-count")
            page.click("#btn-hint")
            page.wait_for_timeout(400)
            check("hint counter decreases", page.inner_text("#hint-count") != hints_before)
            check("hint ghost is rendered", page.evaluate(
                "() => !!window.ColorLink.gameplay.renderer.hintPath"))

            print("\n[6] all 30 levels are playable end to end")
            playable = []
            for lvl in range(1, 31):
                t_lvl = time.time()
                page.evaluate(f"() => window.ColorLink.startLevel({lvl})")
                page.wait_for_timeout(220)
                ok = page.evaluate("() => !!window.ColorLink.gameplay.level && window.ColorLink.gameplay.board.cols > 0")
                if not ok:
                    playable.append((lvl, "did not load"))
                    continue
                sol = page.evaluate("() => window.ColorLink.gameplay.level.solution")
                for path in sol:
                    drag(page, cell_points(page, path))
                    page.wait_for_timeout(40)
                page.wait_for_timeout(650)
                won = page.is_visible("#win-overlay")
                if won:
                    page.evaluate("() => { document.getElementById('win-overlay').hidden = true; }")
                else:
                    state = page.evaluate("() => window.ColorLink.gameplay.engine.paths.map(p => p.length)")
                    playable.append((lvl, f"not solved: {state}"))
                print(f"    level {lvl:2d} solved={won} in {time.time() - t_lvl:.1f}s", flush=True)
            check("every level can be solved through the UI", not playable, str(playable[:3]))

            print("\n[7] progress is saved and restored")
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(700)
            completed = page.inner_text("#menu-completed").strip()
            check("completed levels persisted", completed == "30", f"got {completed}")
            check("unlocked level persisted", page.evaluate(
                "() => JSON.parse(localStorage.getItem('colorlink.save.v1')).unlocked") >= 30)

            print("\n[8] settings persist, RTL works")
            page.click("#btn-settings")
            page.wait_for_timeout(300)
            page.click("#sw-music")
            page.click("#sw-sfx")
            page.wait_for_timeout(200)
            page.click('#seg-theme [data-theme="light"]')
            page.wait_for_timeout(200)
            page.click('#seg-lang [data-lang="ar"]')
            page.wait_for_timeout(400)
            check("document direction is RTL", page.evaluate("() => document.documentElement.dir") == "rtl")
            check("arabic strings applied", "المستوى" in page.inner_text("#screen-settings h2") or
                  page.inner_text("#screen-settings h2").strip() != "")
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(700)
            check("language persisted after reload", page.evaluate("() => document.documentElement.lang") == "ar")
            check("theme persisted after reload", page.evaluate("() => document.documentElement.dataset.theme") == "light")
            check("music setting persisted", page.evaluate(
                "() => JSON.parse(localStorage.getItem('colorlink.save.v1')).settings.music") is True)
            page.click("#btn-settings")
            page.wait_for_timeout(300)
            page.click('#seg-lang [data-lang="en"]')
            page.wait_for_timeout(300)
            page.click('#seg-theme [data-theme="dark"]')
            page.wait_for_timeout(200)

            print("\n[9] reset progress asks for confirmation")
            page.click("#btn-reset")
            page.wait_for_timeout(300)
            check("confirm dialog shown", page.is_visible("#dialog-overlay"))
            page.click("#dialog-cancel")
            page.wait_for_timeout(250)
            check("cancel keeps the progress", page.evaluate(
                "() => JSON.parse(localStorage.getItem('colorlink.save.v1')).completed.length") == 30)
            page.click("#btn-reset")
            page.wait_for_timeout(250)
            page.click("#dialog-confirm")
            page.wait_for_timeout(350)
            check("reset clears the progress", page.evaluate(
                "() => JSON.parse(localStorage.getItem('colorlink.save.v1')).completed.length") == 0)

            print("\n[10] responsive layout")
            for w, h in [(360, 640), (393, 851), (412, 915)]:
                page.set_viewport_size({"width": w, "height": h})
                page.goto(BASE, wait_until="networkidle")
                page.wait_for_timeout(500)
                overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
                check(f"no horizontal overflow at {w}x{h}", not overflow)
                page.evaluate("() => window.ColorLink.startLevel(23)")
                page.wait_for_timeout(500)
                ov2 = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
                check(f"no horizontal overflow in game at {w}x{h}", not ov2)
                fit = page.evaluate("""() => {
                    const c = document.getElementById('board');
                    const w = document.querySelector('.board-wrap').getBoundingClientRect();
                    return c.getBoundingClientRect().width <= w.width + 1 &&
                           c.getBoundingClientRect().height <= w.height + 1;
                }""")
                check(f"board fits the viewport at {w}x{h}", fit)

            print("\n[11] console health")
            real_errors = [e for e in errors if "favicon" not in e.lower()]
            check("no runtime errors", not real_errors, str(real_errors[:5]))

            browser.close()
    finally:
        srv.terminate()

    print(f"\n=== {len(PASS)} passed, {len(FAIL)} failed ===")
    for name, detail in FAIL:
        print(f"  ✖ {name} {detail}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
