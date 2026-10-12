#!/usr/bin/env python3
"""Baut eine einzelne, komplett offline spielbare HTML-Datei (Einzelspieler).

Alle Skripte, Styles und Bilder werden direkt in die Datei eingebettet.
Aufruf:  python3 tools/build_offline.py [ausgabe.html]
"""
import pathlib
import re
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "zeitstrahl-offline.html"


def svg_data_uri(match):
    svg = (ROOT / match.group(1)).read_text(encoding="utf-8").strip()
    return '"data:image/svg+xml;charset=utf-8,' + urllib.parse.quote(svg, safe=" =:/;,'") + '"'


html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "style.css").read_text(encoding="utf-8")
events = re.sub(r'"(img/[\w-]+\.svg)"', svg_data_uri, (ROOT / "events.js").read_text(encoding="utf-8"))
scripts = [events] + [(ROOT / f).read_text(encoding="utf-8") for f in ("common.js", "game.js")]

html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")
# Mehrspieler braucht Internet – Link in der Offline-Version entfernen
html = re.sub(r'\s*<a class="navlink accent" href="multiplayer.html">.*?</a>', "", html)
html = re.sub(r'\s*<script src="(events|common|game)\.js"></script>', "", html)
# App-/Icon-Verweise würden in der Einzeldatei ins Leere zeigen
html = re.sub(r'\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', "", html)
html = html.replace("</body>", "".join(f"<script>\n{s}\n</script>\n" for s in scripts) + "</body>")

out.write_text(html, encoding="utf-8")
print(f"{out} ({out.stat().st_size / 1024 / 1024:.1f} MB)")
