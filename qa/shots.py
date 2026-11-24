#!/usr/bin/env python3
"""Capture screenshots of every screen (light + dark + RTL) for visual review."""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path("/workspace/color-link/qa/shots")
PORT = 5201
OUT.mkdir(parents=True, exist_ok=True)

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 393, "height": 851}, device_scale_factor=2, has_touch=True, is_mobile=True)
        p = ctx.new_page()
        p.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
        p.wait_for_timeout(900)

        p.screenshot(path=str(OUT / "01-menu-dark.png"))

        # gameplay with a few paths drawn
        p.evaluate("() => window.ColorLink.startLevel(16)")
        p.wait_for_timeout(700)
        sol = p.evaluate("() => window.ColorLink.gameplay.level.solution")
        geo = p.evaluate("() => { const g = window.ColorLink.gameplay.renderer.geometry(); const r = document.getElementById('board').getBoundingClientRect(); return {g, left:r.left, top:r.top}; }")
        g = geo["g"]
        def pt(cell):
            c, r = cell
            return (geo["left"] + g["ox"] + (c + .5) * g["size"], geo["top"] + g["oy"] + (r + .5) * g["size"])
        for path in sol[:3]:
            pts = [pt(c) for c in path]
            p.mouse.move(*pts[0]); p.mouse.down()
            for q in pts[1:]:
                p.mouse.move(*q)
            p.mouse.up()
            p.wait_for_timeout(120)
        p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / "02-game-dark.png"))

        p.click('#screen-game [data-nav="menu"]'); p.wait_for_timeout(400)
        p.click("#btn-levels"); p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / "03-levels-dark.png"))
        p.click('#screen-levels [data-nav="menu"]'); p.wait_for_timeout(300)
        p.click("#btn-settings"); p.wait_for_timeout(400)
        p.screenshot(path=str(OUT / "04-settings-dark.png"))
        p.click('#screen-settings [data-nav="menu"]'); p.wait_for_timeout(300)
        p.click("#btn-stats"); p.wait_for_timeout(400)
        p.screenshot(path=str(OUT / "05-stats-dark.png"))
        p.click('#screen-stats [data-nav="menu"]'); p.wait_for_timeout(300)

        # light theme
        p.click("#btn-theme-toggle"); p.wait_for_timeout(400)
        p.screenshot(path=str(OUT / "06-menu-light.png"))
        p.evaluate("() => window.ColorLink.startLevel(9)")
        p.wait_for_timeout(700)
        p.screenshot(path=str(OUT / "07-game-light.png"))
        p.click('#screen-game [data-nav="menu"]'); p.wait_for_timeout(300)

        # arabic / RTL
        p.click("#btn-lang-toggle"); p.wait_for_timeout(600)
        p.screenshot(path=str(OUT / "08-menu-rtl.png"))
        p.evaluate("() => window.ColorLink.startLevel(11)")
        p.wait_for_timeout(700)
        p.screenshot(path=str(OUT / "09-game-rtl.png"))
        p.click('#screen-game [data-nav="menu"]'); p.wait_for_timeout(300)
        p.click("#btn-levels"); p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / "10-levels-rtl.png"))

        b.close()
finally:
    srv.terminate()
print("screenshots in", OUT)
