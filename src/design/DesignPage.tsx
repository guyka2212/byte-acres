import { useState, type ReactNode } from 'react'
import { Code2, Droplets, Expand, FileCode2, Flower2, Gauge, Repeat, ScrollText, Sprout, Trash2, Variable } from 'lucide-react'
import { Button, IconButton, MenuButton, RunButton, type RunState } from '../ui/primitives/Button'
import { FloatingWindow } from '../ui/primitives/FloatingWindow'
import { CodeEditor, type LineMark } from '../ui/primitives/CodeEditor'
import {
  DocPage, InlineCode, ItemCounter, OutputLog, SaveSlotCard, UnlockNode, WarningBadge,
  type ItemId, type LogRow,
} from '../ui/primitives/Game'
import { KeybindRow, SearchBar, Select, Slider, TextInput, Toggle } from '../ui/primitives/Form'
import { Callout, ConfirmDialog, Toast } from '../ui/primitives/Overlay'
import { Toolbar } from '../ui/primitives/Toolbar'

const SAMPLE = `# sweep the field, harvest what's ripe
def sweep():
    for x in range(get_world_size()):
        for y in range(get_world_size()):
            if can_harvest():
                harvest()
            move(North)
        move(East)

while True:
    sweep()  # forever
    print("lap done", 42)
`

const COLOR_ROLES = [
  'bg', 'surface', 'surface-raised', 'surface-hover', 'code-bg', 'line-active', 'border', 'border-input',
  'text', 'text-muted', 'text-faint', 'accent', 'on-accent', 'accent-soft', 'danger', 'success', 'warning',
]
const SYNTAX = ['keyword', 'builtin', 'string', 'number', 'enum', 'comment', 'operator']
const ITEMS: ItemId[] = ['hay', 'wood', 'carrot', 'pumpkin', 'cactus', 'power', 'gold', 'bone', 'water', 'goo']
const TYPE = ['display', 'xl', 'lg', 'base', 'sm', 'code', 'xs'] as const

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-border py-10">
      <h2 className="mb-5 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-md border border-border" style={{ background: `var(${varName})` }} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate font-mono text-xs text-faint">{varName}</p>
      </div>
    </div>
  )
}

export function DesignPage() {
  const [run, setRun] = useState<RunState>('idle')
  const [code, setCode] = useState(SAMPLE)
  const [focused, setFocused] = useState('code')
  const [hay, setHay] = useState(1240)
  const [toggle, setToggle] = useState(true)
  const [vol, setVol] = useState(70)
  const [lang, setLang] = useState('en')
  const [bind, setBind] = useState('F5')
  const [query, setQuery] = useState('harvest')
  const [hint, setHint] = useState(true)
  const [bought, setBought] = useState(false)

  const marks: LineMark[] =
    run === 'running' ? [{ line: 6, kind: 'running' }]
      : run === 'paused' ? [{ line: 7, kind: 'paused' }, { line: 12, kind: 'error' }]
        : [{ line: 12, kind: 'error' }]

  const log: LogRow[] = [
    { kind: 'info', text: 'Running main.py' },
    { kind: 'print', text: 'lap done 42', drone: 0 },
    { kind: 'warning', text: 'harvest() on an unripe plant destroyed it', line: 6 },
    { kind: 'error', text: "NameError: 'sweeep' is not defined. Did you mean 'sweep'?", line: 12 },
  ]

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-30">
        <Toolbar
          tabs={[
            { id: 'code', title: 'main.py', icon: <FileCode2 className="size-3.5" />, active: focused === 'code' },
            { id: 'out', title: 'Output', icon: <ScrollText className="size-3.5" />, active: focused === 'out', warning: true },
            { id: 'docs', title: 'Field guide', active: focused === 'docs' },
          ]}
          onTab={setFocused}
        />
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <header className="py-10">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Design system</p>
          <h1 className="mt-2 text-display font-extrabold">Night workshop</h1>
          <p className="mt-3 max-w-[60ch] text-base text-muted">
            Dark, rounded windows floating over a sunny farm. Every colour here is a role from{' '}
            <InlineCode>replica/design/tokens.json</InlineCode>. The accent is Byte Acres' dusk violet.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 text-sm">
            {['colour', 'type', 'buttons', 'windows', 'hud', 'unlocks', 'forms', 'overlays', 'menus'].map(s => (
              <a key={s} href={`#/design`} onClick={e => { e.preventDefault(); document.getElementById(s)?.scrollIntoView({ behavior: 'smooth' }) }} className="rounded-pill border border-border px-3 py-1 capitalize text-muted hover:bg-surface-hover hover:text-fg">
                {s}
              </a>
            ))}
          </nav>
        </header>

        <Section id="colour" title="Colour roles">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COLOR_ROLES.map(c => <Swatch key={c} name={c} varName={`--tk-color-${c}`} />)}
          </div>
          <h3 className="mb-3 mt-8 text-sm font-bold text-muted">Syntax</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {SYNTAX.map(s => <Swatch key={s} name={s} varName={`--tk-color-syntax-${s}`} />)}
          </div>
          <h3 className="mb-3 mt-8 text-sm font-bold text-muted">Items</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {ITEMS.map(i => <Swatch key={i} name={i} varName={`--tk-color-item-${i}`} />)}
          </div>
        </Section>

        <Section id="type" title="Type">
          <div className="space-y-3">
            {TYPE.map(t => (
              <div key={t} className="flex items-baseline gap-6">
                <span className="w-16 shrink-0 font-mono text-xs text-faint">{t}</span>
                <span
                  className={t === 'code' ? 'font-mono' : ''}
                  style={{ fontSize: `var(--tk-type-${t}-size)`, lineHeight: `var(--tk-type-${t}-line)`, fontWeight: `var(--tk-type-${t}-weight)` as unknown as number }}
                >
                  {t === 'code' ? 'move(North)  # one step' : 'The drone hums over the carrots'}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Plant it</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />}>Delete file</Button>
            <Button variant="primary" loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="primary">Small</Button>
            <Button size="md" variant="primary">Medium</Button>
            <Button size="lg" variant="primary">Large</Button>
            <IconButton label="Step" shortcut="F10"><Code2 className="size-4" /></IconButton>
            <IconButton label="Toggle grid" pressed><Expand className="size-4" /></IconButton>
            <RunButton state="idle" fileName="main" />
            <RunButton state="running" fileName="main" />
            <RunButton state="paused" fileName="main" />
            <RunButton state="idle" fileName="main" disabled />
            <WarningBadge warnings={2} errors={0} />
            <WarningBadge warnings={1} errors={3} />
          </div>
        </Section>

        <Section id="windows" title="Windows, editor, output, docs">
          <p className="mb-4 text-sm text-muted">Drag by the title bar, resize from the corner, Alt+arrows to move with the keyboard. Click Run to cycle states.</p>
          <div className="relative h-[560px] overflow-hidden rounded-lg border border-border" style={{ background: 'repeating-conic-gradient(#2b4a2a 0 25%, #2f522e 0 50%) 0 0 / 64px 64px' }}>
            <FloatingWindow
              title="main.py"
              icon={<FileCode2 className="size-4" />}
              x={16} y={16} width={500} height={360}
              code
              focused={focused === 'code'}
              onFocus={() => setFocused('code')}
              onMinimize={() => {}}
              actions={
                <>
                  <WarningBadge warnings={1} errors={1} onClick={() => setFocused('out')} />
                  <IconButton size="sm" label="Step" shortcut="F10" onClick={() => setRun('paused')}><Code2 className="size-4" /></IconButton>
                  <RunButton state={run} fileName="main" onClick={() => setRun(run === 'idle' ? 'running' : run === 'running' ? 'paused' : 'idle')} />
                </>
              }
            >
              <CodeEditor label="main.py" value={code} onChange={setCode} marks={marks} />
            </FloatingWindow>
            <FloatingWindow
              title="Output"
              icon={<ScrollText className="size-4" />}
              x={300} y={300} width={460} height={220}
              code
              focused={focused === 'out'}
              onFocus={() => setFocused('out')}
              onClose={() => {}}
            >
              <OutputLog rows={log} />
            </FloatingWindow>
            <FloatingWindow
              title="Field guide · Loops"
              x={600} y={24} width={420} height={300}
              focused={focused === 'docs'}
              onFocus={() => setFocused('docs')}
              onClose={() => {}}
            >
              <DocPage title="Loops" isNew>
                <p>A <InlineCode>while</InlineCode> loop runs its body again and again, as long as its condition is true.</p>
                <p>Your drone never gets tired, so <InlineCode>while True:</InlineCode> is a fine place to start.</p>
                <p className="text-muted">See also: <a href="#/design" className="text-accent underline-offset-2 hover:underline">for loops</a></p>
              </DocPage>
            </FloatingWindow>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="h-28 overflow-hidden rounded-lg border border-border bg-code-bg"><OutputLog rows={[]} /></div>
            <div className="h-28 overflow-hidden rounded-lg border border-border"><CodeEditor label="empty file" value="" /></div>
          </div>
        </Section>

        <Section id="hud" title="Resource HUD">
          <ul className="flex flex-wrap gap-2" aria-label="Resources">
            <ItemCounter item="hay" count={hay} />
            <ItemCounter item="wood" count={86_400} />
            <ItemCounter item="carrot" count={3_400_000_000n} />
            <ItemCounter item="power" count={512} powered />
            <ItemCounter item="gold" count={0} />
          </ul>
          <Button className="mt-4" size="sm" onClick={() => setHay(h => h + 25)}>Harvest +25 hay</Button>
        </Section>

        <Section id="unlocks" title="Research tree nodes">
          <div className="flex flex-wrap gap-4">
            <UnlockNode name="Loops" kind="language" icon={<Repeat className="size-4" />} state="bought" costs={[]} />
            <UnlockNode
              name="Watering" kind="upgrade" icon={<Droplets className="size-4" />}
              state={bought ? 'bought' : 'affordable'} level={bought ? 3 : 2} maxLevel={5}
              costs={[{ item: 'wood', amount: 800, have: 1200 }]} onBuy={() => setBought(true)}
            />
            <UnlockNode name="Variables" kind="language" icon={<Variable className="size-4" />} state="locked" costs={[{ item: 'carrot', amount: 35, have: 12 }]} />
            <UnlockNode name="Sunflowers" kind="crop" icon={<Flower2 className="size-4" />} state="locked" costs={[{ item: 'carrot', amount: 500, have: 600 }, { item: 'wood', amount: 2000, have: 900 }]} />
            <UnlockNode name="Speed" kind="upgrade" icon={<Gauge className="size-4" />} state="maxed" level={5} maxLevel={5} costs={[]} />
            <UnlockNode name="Grass" kind="crop" icon={<Sprout className="size-4" />} state="affordable" level={1} maxLevel={10} costs={[{ item: 'hay', amount: 300, have: hay }]} />
          </div>
        </Section>

        <Section id="forms" title="Forms and options">
          <div className="grid max-w-3xl gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <TextInput label="Farm name" placeholder="Sunny acres" />
              <TextInput label="Farm name" defaultValue="" error="Give your farm a name" />
              <TextInput label="Disabled" disabled defaultValue="read only" />
              <SearchBar query={query} onQuery={setQuery} index={2} total={query === 'harvest' ? 7 : 0} onNext={() => {}} onPrev={() => {}} onClose={() => {}} />
            </div>
            <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
              <Toggle label="Show first-run hints" checked={toggle} onChange={setToggle} />
              <Toggle label="Disabled toggle" checked={false} onChange={() => {}} disabled />
              <Slider label="Music volume" value={vol} onChange={setVol} format={v => `${v}%`} />
              <Select label="Language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'he', label: 'עברית' }, { value: 'de', label: 'Deutsch' }]} />
              <KeybindRow action="Run current file" keys={bind} onChange={setBind} />
              <KeybindRow action="Step" keys="F10" conflict="Next window" onChange={() => {}} />
            </div>
          </div>
        </Section>

        <Section id="overlays" title="Toasts, hints, dialogs">
          <div className="flex flex-wrap items-start gap-6">
            <div className="space-y-3">
              <Toast variant="success" title="Watering unlocked" body="use_item(Water) is in the field guide" onClose={() => {}} />
              <Toast variant="achievement" title="First thousand hay" body="Your drone is getting good at this." />
              <Toast variant="warning" title="Storage is almost full" body="Export your files to keep them safe." onClose={() => {}} />
              <Toast title="Saved" />
            </div>
            {hint
              ? <Callout onDismiss={() => setHint(false)}>Type <InlineCode>harvest()</InlineCode> in the code window, then press <b>Run</b>.</Callout>
              : <Button size="sm" onClick={() => setHint(true)}>Show hint again</Button>}
            <ConfirmDialog
              trigger={<Button variant="danger" icon={<Trash2 className="size-4" />}>Delete main.py</Button>}
              title="Delete main.py?"
              body="The file is removed from this save. This can't be undone."
              confirmLabel="Delete"
              danger
              onConfirm={() => {}}
            />
          </div>
        </Section>

        <Section id="menus" title="Main menu and save slots">
          <div className="grid gap-8 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col gap-2">
              <MenuButton primary>Continue</MenuButton>
              <MenuButton>Load farm</MenuButton>
              <MenuButton>New farm</MenuButton>
              <MenuButton>Options</MenuButton>
              <MenuButton disabled>Export files</MenuButton>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SaveSlotCard name="Sunny acres" played="12h 40m" size={8} savedAt="2 minutes ago" />
              <SaveSlotCard empty />
              <SaveSlotCard name="Old test farm" corrupt />
            </div>
          </div>
        </Section>
      </main>
    </div>
  )
}
