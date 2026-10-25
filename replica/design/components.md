# Components: Drone Farm (working title)

Source: the component list in `replica/recon.md`, plus the states it should
have. Tokens: `tokens.json` -> `tokens.css`. Tailwind class names in the
specs use the theme mapping (`bg-surface`, `text-muted`, `rounded-md`), never
raw hex.

## Style direction (ours, not the original's)

"Night workshop": dark, slightly warm, rounded windows that float over a
bright, sunny farm, like a tinkerer's laptop on a field. Chunky rounded
sans (Nunito Sans) for UI, JetBrains Mono for code. Bouncy motion on
rewards (items counting up, unlocks), calm motion on windows. Icons: Lucide
(ISC licence). Art for crops, drone and hats: our own, drawn later; this
system covers the UI around it.

Accessibility baseline for every component: real HTML elements or Radix
primitives, visible `focus-visible` ring (2px `focus`, 2px offset on `bg`),
all actions reachable by keyboard, `prefers-reduced-motion` turns bounces
and count-ups into instant changes.

---

```
Button
  variants  primary (accent), secondary (surface-raised + border), ghost, danger
  sizes     sm 28px, md 36px, lg 44px (menus)
  states    default, hover (surface-hover / accent 90%), active (translateY 1px),
            focus-visible (2px ring focus), disabled (50% opacity, no pointer), loading (spinner, label kept)
  tokens    primary: bg accent, text on-accent; secondary: bg surface-raised, border border, text fg;
            radius md, font sm/700
  a11y      <button>, aria-busy while loading, disabled uses the disabled attribute
  used on   S01 S02 S04 S07 S09 S12
```

```
IconButton
  variants  ghost, toggle (aria-pressed)
  sizes     sm 28px, md 32px
  states    default, hover, pressed, focus-visible, disabled
  tokens    text muted -> fg on hover, bg surface-hover on hover, radius sm
  a11y      required aria-label; Tooltip with the same label + shortcut
  used on   S04 title bar (run, step, minimize, delete), S10, S11
```

```
RunButton (code window)
  variants  run, stop, resume
  states    idle (play icon, accent), running (stop icon, danger), paused (resume icon, warning),
            focus-visible, disabled (compile errors present)
  tokens    as Button sm; running state pulses a 2px ring at 1.2s (no pulse under reduced motion)
  a11y      label changes with state: "Run main", "Stop main", "Resume main"; shortcut F5 / Shift+F5
  used on   S04
```

```
FloatingWindow
  variants  code, output, docs, unlocks, options (modal-ish, centred)
  parts     title bar (36px, bg surface-raised, drag handle, title, actions), body (bg surface or code-bg), resize grip
  states    default, focused (border accent-soft + shadow window), unfocused (border border),
            dragging (cursor grabbing, slight scale 1.01), minimized (to S11 dock), closed
  sizes     min 280x160, defaults from tokens layout
  tokens    radius lg, shadow window, border 1px
  a11y      role="dialog" aria-modal=false aria-labelledby=title; Ctrl+` cycles focus between windows;
            Esc on title bar returns focus to the farm; keyboard move: Alt+arrows 16px
  mobile    below md: windows become full-width bottom sheets with tabs (one visible at a time)
  used on   S04 S05 S06 S07 S09
```

```
CodeEditor (CodeMirror 6)
  states    empty (placeholder comment: "# your drone is waiting..."), editing, read-only while running,
            running line (bg line-active + accent gutter marker), paused line (warning gutter marker),
            error line (wavy danger underline + gutter dot), selection (accent-soft)
  tokens    bg code-bg, text fg, font mono, size code 14/22, gutter text faint,
            syntax-keyword/builtin/string/number/enum/comment/operator
  a11y      CodeMirror's built-in screen reader support; Tab indents (Esc then Tab leaves the editor);
            errors also listed in Output as text
  used on   S04
```

```
Autocomplete popup
  states    open, item highlighted, empty (closed), locked item (hidden, never shown)
  tokens    bg surface-raised, shadow pop, radius md, highlighted bg accent-soft
  a11y      CodeMirror listbox semantics; arrow keys, Enter/Tab accept, Esc closes
  used on   S04
```

```
WarningBadge
  variants  warning (warning), error (danger)
  states    hidden, shown with count, focus-visible
  tokens    xs/600, radius pill
  a11y      button "2 warnings, open output"; aria-live polite when it first appears
  used on   S04 title bar
```

```
OutputLog
  rows      info (fg), print (fg, drone tag), warning (warning, icon), error (danger, icon, clickable line link)
  states    empty ("Nothing printed yet. Try print(...)" in muted), filled, auto-scroll pinned / unpinned
  tokens    bg code-bg, mono 13, row padding 4/8
  a11y      role="log" aria-live="polite"; error rows are links that focus the editor line
  used on   S05
```

```
DocPage
  parts     heading (lg), body (base, max 68ch), inline code (mono, bg code-bg), code sample (CodeEditor read-only + Copy),
            link (accent, underline on hover), "new!" pill for pages revealed by the latest unlock
  states    page, table of contents, locked topic (not rendered), back/forward history
  tokens    bg surface, text fg
  a11y      headings in order; links are <a>/<button>; Copy announces "Copied"
  used on   S06
```

```
UnlockNode
  variants  language, crop, upgrade (levelled), cosmetic
  states    hidden (not reachable yet), locked (visible, cannot afford: muted, cost in danger),
            affordable (border accent, subtle glow), bought (success check), maxed (gold ring "MAX"),
            focus-visible, just-bought (bounce + item pop)
  parts     icon (Lucide placeholder until art), name, level pips, CostBadge list
  tokens    bg surface-raised, radius lg, title sm/700
  a11y      <button> with aria-describedby the cost; disabled when not affordable but still focusable
            via aria-disabled so the tooltip explains why
  used on   S07
```

```
CostBadge
  variants  single item, multi item
  states    affordable (fg), short (danger + missing amount on hover)
  tokens    xs/600, item colour dot, radius pill, bg surface
  a11y      text form "120 wood, 40 carrots (you have 30)"
  used on   S07, docs pages for plant()
```

```
ItemCounter (HUD)
  parts     item colour icon, short number (1.2K, 3.4B), delta pop (+25) on change
  states    zero (hidden until first gain), counting, gaining (pop), power active (glow ring item-power)
  tokens    bg surface/90 + backdrop blur, radius pill, min width 88, number sm/700 tabular-nums
  a11y      full number in title/aria-label; the strip is a <ul> with aria-live off (too chatty),
            milestones announced through Toast instead
  used on   S08
```

```
Toolbar / Dock
  parts     brand mark (placeholder), New file, Docs, Unlocks, minimized-window tabs, Menu
  states    default, tab active, tab has warning (dot)
  tokens    height 48, bg surface/95, border-b border
  a11y      role="toolbar" with roving tabindex; each item IconButton + Tooltip
  used on   S11
```

```
MenuButton (main menu)
  variants  primary, default
  states    default, hover (slide 4px right), focus-visible, disabled
  tokens    Button lg, full width 280
  used on   S01
```

```
SaveSlotCard
  states    empty ("Empty field - start a new farm"), filled (name, played time, farm size, last saved),
            hover, focus-visible, corrupt (danger, "Can't read this save" + export raw)
  tokens    bg surface-raised, radius lg
  a11y      <button>; delete is a separate IconButton with confirm Dialog
  used on   S02
```

```
TextInput
  states    default, hover, focus-visible (border focus), invalid (border danger + message), disabled
  tokens    bg code-bg, border border-input, radius md, height 36
  a11y      <label> always; error via aria-describedby
  used on   S02 (save name), S10 (search)
```

```
Toggle (Radix Switch), Slider (Radix Slider), Select (Radix Select)
  states    default, hover, focus-visible, disabled, checked (accent)
  tokens    track border-input, thumb fg, checked track accent
  a11y      Radix semantics, labelled
  used on   S09
```

```
KeybindRow
  states    default, listening ("Press a key..."), conflict (warning + which action), focus-visible
  a11y      Enter starts listening, Esc cancels
  used on   S09
```

```
SearchBar
  states    empty, matches ("3 of 12"), no match (danger text), toggles (docs / code) pressed
  a11y      role="search"; Enter next, Shift+Enter previous, Esc closes
  used on   S10
```

```
Tooltip (Radix)
  tokens    bg surface-raised, text fg xs, shadow pop, radius sm, 400ms delay
  used on   everywhere
```

```
Toast
  variants  info, success (unlock bought, milestone), warning, achievement
  states    entering, shown (4s), leaving, paused on hover
  tokens    bg surface-raised, left bar in variant colour, shadow pop
  a11y      role="status", polite; never the only place an error is shown
  used on   S03 S07 S14
```

```
Callout (first-run hint)
  states    shown with arrow pointing at a target, dismissed, "don't show again"
  a11y      focus moves to the callout; Esc dismisses
  used on   S14
```

```
Dialog (confirm)
  variants  default, danger (delete file, delete save, reset)
  tokens    overlay at 60%, bg surface, radius lg
  a11y      Radix Dialog, focus trapped, Esc cancels, danger button not focused by default
  used on   S02 S04 (delete file) S09
```

```
Farm view parts (Pixi, not DOM; specified here so the art brief matches)
  FarmGrid     tile 64px at zoom 1, wraps visually at edges with a soft fade
  TileSprite   grassland, soil (dry/wet blend by water 0..1)
  PlantSprite  per crop: 3 growth stages + ready (gentle bob); pumpkin dead + giant; cactus sorted/unsorted tint;
               hedge, treasure, apple, tail segment
  Drone        idle hover, move tween (duration from tick time), blocked (shake), emote, hat slot
  SpeechBubble print() text above the drone, fades after 1s game time
  a11y         a hidden live text "Drone at 3,4 over ripe carrot" for screen readers, updated on Step
  used on      S03
```
