"""Generate tokens.css (CSS custom properties + Tailwind v4 @theme mapping)
from tokens.json. Re-run after every palette change:

    python replica/design/gen_tokens_css.py

Writes replica/design/tokens.css and copies it to src/styles/tokens.css.
"""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def main():
    t = json.loads((HERE / "tokens.json").read_text(encoding="utf-8"))
    out = ["/* Generated from replica/design/tokens.json by gen_tokens_css.py. Do not edit. */", ""]

    out.append(":root {")
    for name, value in t["color"].items():
        out.append(f"  --tk-color-{name}: {value};")
    out.append(f"  --tk-font-sans: {t['font']['sans']};")
    out.append(f"  --tk-font-mono: {t['font']['mono']};")
    for name, s in t["type"].items():
        out.append(f"  --tk-type-{name}-size: {s['size']}px;")
        out.append(f"  --tk-type-{name}-line: {s['line']}px;")
        out.append(f"  --tk-type-{name}-weight: {s['weight']};")
    for i, v in enumerate(t["space"]):
        out.append(f"  --tk-space-{i}: {v}px;")
    for name, v in t["radius"].items():
        out.append(f"  --tk-radius-{name}: {v}px;")
    for name, v in t["shadow"].items():
        out.append(f"  --tk-shadow-{name}: {v};")
    for name, v in t["motion"].items():
        out.append(f"  --tk-motion-{name}: {v};")
    lay = t["layout"]
    for key in ("toolbar-height", "window-title-height", "window-min-width",
                "window-min-height", "hud-item-min-width"):
        out.append(f"  --tk-layout-{key}: {lay[key]}px;")
    out.append("}")
    out.append("")

    # Tailwind v4: map the custom properties into the theme so components
    # write bg-surface / text-muted / rounded-md, never raw hex.
    out.append("@theme inline {")
    for name in t["color"]:
        out.append(f"  --color-{name}: var(--tk-color-{name});")
    # short aliases so text roles read as text-fg / text-muted / text-faint
    out.append("  --color-fg: var(--tk-color-text);")
    out.append("  --color-muted: var(--tk-color-text-muted);")
    out.append("  --color-faint: var(--tk-color-text-faint);")
    out.append("  --font-sans: var(--tk-font-sans);")
    out.append("  --font-mono: var(--tk-font-mono);")
    for name in t["type"]:
        out.append(f"  --text-{name}: var(--tk-type-{name}-size);")
        out.append(f"  --text-{name}--line-height: var(--tk-type-{name}-line);")
    for name in t["radius"]:
        out.append(f"  --radius-{name}: var(--tk-radius-{name});")
    for name in t["shadow"]:
        out.append(f"  --shadow-{name}: var(--tk-shadow-{name});")
    out.append("  --spacing: 4px;")
    for name, px in lay["breakpoints"].items():
        out.append(f"  --breakpoint-{name}: {px}px;")
    out.append("  --ease-game: var(--tk-motion-ease);")
    out.append("  --ease-bounce: var(--tk-motion-bounce);")
    out.append("}")
    out.append("")

    css = "\n".join(out)
    (HERE / "tokens.css").write_text(css, encoding="utf-8")
    dest = ROOT / "src" / "styles"
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(HERE / "tokens.css", dest / "tokens.css")
    print(f"wrote {HERE / 'tokens.css'} and {dest / 'tokens.css'}")


if __name__ == "__main__":
    main()
