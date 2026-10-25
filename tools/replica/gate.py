"""Release gate: the checks that must pass before Byte Acres goes public.

    python tools/replica/gate.py            # exit 1 if anything blocks a public release

parity.py reports the must-haves but exits 0 either way, so the gate reads
features.csv itself. Also: no open bugs, and the pages a public site needs.
"""
import csv
import re
import sys
from pathlib import Path

problems = []

rows = list(csv.DictReader(open("replica/features.csv", encoding="utf-8")))
musts = [r for r in rows if r["priority"] == "must" and r["original"] == "yes" and r["clone"] != "skip"]
done = [r for r in musts if r["clone"] == "yes"]
if len(done) < len(musts):
    missing = ", ".join(r["feature"] for r in musts if r["clone"] != "yes")
    problems.append(f"parity: {len(done)} of {len(musts)} must-haves done (missing: {missing})")

bugs = Path("replica/bugs.md").read_text(encoding="utf-8")
open_bugs = re.findall(r"### (BUG-\d+)[^\n]*\n(?:(?!### ).)*?Status: open", bugs, re.S)
if open_bugs:
    problems.append("open bugs: " + ", ".join(open_bugs))

for path, what in [("public/privacy.html", "privacy policy"), ("public/terms.html", "terms"), ("public/og.png", "social preview image (og.png)")]:
    if not Path(path).exists():
        problems.append(f"missing {what}: {path}")
    elif path.endswith(".html"):
        holes = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", Path(path).read_text(encoding="utf-8"))))
        if holes:
            problems.append(f"{what} still has placeholders to fill in: {', '.join(holes)} ({path})")

if problems:
    print("Release gate: BLOCKED")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("Release gate: clear")
