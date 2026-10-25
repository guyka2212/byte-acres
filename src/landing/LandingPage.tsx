import { useState, type ReactNode } from 'react'
import { BookOpen, Bug, Check, ChevronDown, Code2, GraduationCap, Laptop, Play, Save, School, Sparkles, Trophy, User, Waypoints } from 'lucide-react'
import { cn } from '../ui/cn'
import { InlineCode } from '../ui/primitives/Game'
import { GlobalLeaderboard } from '../ui/home/GlobalLeaderboard'

const PLAY_URL = './app.html'
const HOME_URL = './app.html#/signup'

function Cta({ children = 'Start farming, free' }: { children?: ReactNode }) {
  return (
    <a
      href={PLAY_URL}
      className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-base font-extrabold text-on-accent transition-[filter] hover:brightness-110"
    >
      <Play className="size-4" fill="currentColor" aria-hidden />
      {children}
    </a>
  )
}

function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-h`} className={cn('mx-auto max-w-6xl px-4 py-16 md:px-8', className)}>
      <h2 id={`${id}-h`} className="mb-8 text-xl font-extrabold md:text-[length:var(--tk-type-xl-size)]">{title}</h2>
      {children}
    </section>
  )
}

type Feature = { icon: ReactNode; title: string; body: string; ready: boolean }

const FEATURES: Feature[] = [
  { icon: <Sparkles className="size-5" />, title: 'A teacher that stays', body: 'Every new idea comes with a short lesson and three hints, from a nudge to almost the answer.', ready: true },
  { icon: <Waypoints className="size-5" />, title: 'A bridge before every big jump', body: 'Small steps into sorting and maze-solving, with the method named and explained.', ready: true },
  { icon: <Trophy className="size-5" />, title: 'Made for classes', body: 'Teachers open a class and share a code. Students join, farm, and climb a live leaderboard. The teacher demos on a field with everything unlocked.', ready: true },
  { icon: <Bug className="size-5" />, title: 'Errors that point at the fix', body: "The line is marked and the message is in plain words. Use something you haven't unlocked and it tells you what to get.", ready: true },
  { icon: <Save className="size-5" />, title: 'Your code is never lost', body: "It saves as you type, keeps a copy when you close the tab, and two open tabs can't overwrite each other.", ready: true },
  { icon: <Code2 className="size-5" />, title: 'An editor that behaves', body: 'Shift+Tab, undo, and you can edit while the drone runs.', ready: true },
  { icon: <Laptop className="size-5" />, title: 'Runs anywhere', body: "Windows, Mac, Linux, Chromebook, even a phone. It's a web page.", ready: true },
]

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Do I need to know how to code?', a: 'No. You start with one line, and every new idea comes with a page that explains it.' },
  { q: 'Is it real Python?', a: <>It's a small, real subset: variables, <InlineCode>if</InlineCode>, loops, functions, lists, dicts. What you learn carries over to Python. Some things aren't in yet, like classes, and the game tells you so instead of failing silently.</> },
  { q: 'What if I get stuck?', a: 'Errors point at the line and say what is wrong. Every idea has a lesson with three hints, a page in the field guide, and a command book that lists exactly what you can use.' },
  { q: 'Will I lose my code?', a: 'It saves as you play, keeps a copy when you close the tab, and every field is kept in the cloud with your account.' },
  { q: 'Does it run on a Mac, a Chromebook or a school laptop?', a: 'Yes, in any modern browser.' },
  { q: 'Is it really free?', a: 'Yes. The whole game, cloud saves and classes are free. No trial, no subscription, no ads.' },
  { q: 'Can I use it with a class or my kids?', a: 'Yes. Sign in as a teacher, open a class and put its code on the board. Students make a free account, join with the code, and you see a live leaderboard. A demonstration field with everything unlocked lets you show the class how things work.' },
]

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = q.replace(/\W+/g, '-').toLowerCase()
  return (
    <li className="border-b border-border">
      <h3>
        <button
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-bold hover:text-accent"
        >
          {q}
          <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-muted transition-transform duration-[var(--tk-motion-fast)]', open && 'rotate-180')} />
        </button>
      </h3>
      <div id={id} hidden={!open} className="max-w-[68ch] pb-4 text-base text-muted">{a}</div>
    </li>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <a href="#top" className="flex items-center gap-2 text-base font-extrabold">
            <img src="brand/logo-64.png" alt="" width={28} height={28} className="size-7" />
            Byte Acres
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-md px-3 py-2 text-muted hover:text-fg sm:block">How it works</a>
            <a href="#leaderboard" className="hidden rounded-md px-3 py-2 text-muted hover:text-fg sm:block">Leaderboard</a>
            <a href="#pricing" className="hidden rounded-md px-3 py-2 text-muted hover:text-fg sm:block">Pricing</a>
            <a href={PLAY_URL} className="rounded-md bg-accent-soft px-3 py-2 font-bold text-accent hover:brightness-125">Play</a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* 1. hero */}
        <section aria-labelledby="hero-h" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1fr_1.15fr] md:px-8 md:pt-20">
          <div>
            <h1 id="hero-h" className="text-[length:var(--tk-type-xl-size)] font-extrabold leading-tight md:text-display md:leading-[var(--tk-type-display-line)]">
              Learn to code by teaching a drone to farm.
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
              Byte Acres is a cozy farming game you play by writing real Python, one idea at a time, with help that stays when it gets hard.
              It runs in your browser, so there's nothing to install.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta />
              <span className="text-sm text-muted">Free account with your email and a password.</span>
            </div>
          </div>
          <figure className="overflow-hidden rounded-lg border border-border shadow-window">
            <picture>
              <source media="(max-width: 640px)" srcSet="landing/farm-phone.png" />
              <img
                src="landing/farm-desktop.png"
                width={1440}
                height={900}
                alt="The Byte Acres game: Python code on the left, a 3D farm of pumpkins, sunflowers and cactus, and the drone in a straw hat saying how many petals the biggest sunflower has."
                className="block h-auto w-full"
              />
            </picture>
          </figure>
        </section>

        {/* 2. the problem */}
        <Section id="problem" title="Most coding games stop teaching too soon" className="border-t border-border">
          <div className="grid max-w-4xl gap-6 text-lg leading-relaxed md:grid-cols-2">
            <p>They teach you three things, then leave you with a wall of text and a search engine. You came to learn, and you end up copying answers from a video.</p>
            <p className="text-muted">And once the first tricks are learned, there's often nothing left to do but wait while numbers go up.</p>
          </div>
        </Section>

        {/* 3. how it works */}
        <Section id="how" title="How it works" className="border-t border-border">
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              { n: 1, t: 'Write a line', b: <>Start with <InlineCode>harvest()</InlineCode>. That's real Python.</> },
              { n: 2, t: 'Press Run and watch', b: 'Your drone does exactly what you wrote, and the line it is on lights up.' },
              { n: 3, t: 'Earn the next idea', b: 'Harvests buy loops, functions and lists. Each comes with a page in the field guide that explains it.' },
            ].map(s => (
              <li key={s.n} className="rounded-lg border border-border bg-surface p-6">
                <span aria-hidden className="grid size-9 place-items-center rounded-pill bg-accent-soft text-base font-extrabold text-accent">{s.n}</span>
                <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-base text-muted">{s.b}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* 4. features, fixes first */}
        <Section id="features" title="What makes it different" className="border-t border-border">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <li key={f.title} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <span aria-hidden className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent">{f.icon}</span>
                  <span className={cn('rounded-pill px-2.5 py-0.5 text-xs font-bold', f.ready ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                    {f.ready ? 'Available' : 'In development'}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-base text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 flex max-w-[68ch] items-start gap-2 text-base text-muted">
            <BookOpen className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
            Also in the box: a 3D farm, a research tree, a field guide with a page for every idea, a command book, autocomplete you can switch off,
            hats, and crops that are puzzles of their own: pumpkins, sunflowers, cactus and mazes.
          </p>
        </Section>

        {/* the leaderboard: everyone's best field */}
        <Section id="leaderboard" title="Leaderboard" className="border-t border-border">
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-start">
            <p className="max-w-[44ch] text-lg leading-relaxed text-muted">
              Everything you've ever harvested on a field, added up. Better code harvests more, so the top of the board is the best code.
              Pick which field counts, or keep yours off the board, in Settings.
            </p>
            <GlobalLeaderboard limit={20} />
          </div>
        </Section>

        {/* 5. pricing: everything is free */}
        <Section id="pricing" title="Free. All of it." className="border-t border-border">
          <ul className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <User className="size-5" />, name: 'Players', price: 'Free', primary: true,
                who: 'The whole game: every crop, every idea, every lesson.',
                points: ['As many fields as you like', 'Saved in the cloud, play on any device', 'Sign up with an email and a password'],
                cta: <Cta>Start farming</Cta>,
              },
              {
                icon: <School className="size-5" />, name: 'Teachers', price: 'Free',
                who: 'Open classes and watch everyone learn.',
                points: ['A join code for each class', 'A live leaderboard', 'A demo field with everything unlocked', 'Your own field to race the class'],
                cta: <a href={HOME_URL} className="inline-flex h-11 items-center rounded-md border border-border px-5 font-bold hover:bg-surface-hover">Open a class</a>,
              },
              {
                icon: <GraduationCap className="size-5" />, name: 'Students', price: 'Free',
                who: 'Join with the code from your teacher.',
                points: ['Join with a 6-letter code', 'All your classes in one list', 'See where you are on the leaderboard'],
                cta: <a href={HOME_URL} className="inline-flex h-11 items-center rounded-md border border-border px-5 font-bold hover:bg-surface-hover">Join a class</a>,
              },
            ].map(t => (
              <li key={t.name} className={cn('flex flex-col gap-3 rounded-lg border bg-surface p-6', t.primary ? 'border-accent' : 'border-border')}>
                <h3 className="flex items-center gap-2 text-base font-bold text-muted">
                  <span aria-hidden className="grid size-8 place-items-center rounded-md bg-accent-soft text-accent">{t.icon}</span>{t.name}
                </h3>
                <p className="text-xl font-extrabold">{t.price}</p>
                <p className="text-base">{t.who}</p>
                <ul className="space-y-1.5 text-sm text-muted">
                  {t.points.map(p => <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{p}</li>)}
                </ul>
                <div className="mt-auto pt-2">{t.cta}</div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-base text-muted">No trial, no subscription, no ads, nothing to unlock with money.</p>
        </Section>

        {/* 6. FAQ */}
        <Section id="faq" title="Questions" className="border-t border-border">
          <ul className="max-w-3xl border-t border-border">
            {FAQ.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </ul>
        </Section>

        {/* 7. final call */}
        <section aria-labelledby="final-h" className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-20 md:px-8">
            <h2 id="final-h" className="text-[length:var(--tk-type-xl-size)] font-extrabold">Your drone is waiting.</h2>
            <p className="text-lg text-muted">Write your first line in under a minute. Free for everyone, in your browser.</p>
            <Cta />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted md:px-8">
          <span>Byte Acres</span>
          <span className="flex gap-4"><a href="privacy.html" className="hover:text-fg">Privacy</a><a href="terms.html" className="hover:text-fg">Terms</a></span>
        </div>
      </footer>
    </div>
  )
}
