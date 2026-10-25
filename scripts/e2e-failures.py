"""Print each failing Playwright test with the first lines of its error.

    python scripts/e2e-failures.py [e2e-results/results.json]
"""
import json
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "e2e-results/results.json"
r = json.load(open(path, encoding="utf-8"))


def walk(s):
    for sp in s.get("suites", []):
        walk(sp)
    for spec in s.get("specs", []):
        for t in spec["tests"]:
            for res in t["results"][:1]:
                if res["status"] != "passed":
                    msg = re.sub(r"\x1b\[[0-9;]*m", "", (res.get("error") or {}).get("message", ""))
                    lines = [l for l in msg.splitlines() if l.strip()][:6]
                    print("##", spec["title"])
                    print("   " + "\n   ".join(lines))


for s in r["suites"]:
    walk(s)
