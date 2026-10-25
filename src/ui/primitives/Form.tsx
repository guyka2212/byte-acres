import { useEffect, useId, useState, type InputHTMLAttributes } from 'react'
import * as RSwitch from '@radix-ui/react-switch'
import * as RSlider from '@radix-ui/react-slider'
import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronDown as Next, ChevronUp, Search, X } from 'lucide-react'
import { cn } from '../cn'
import { IconButton } from './Button'

export function TextInput({ label, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold text-muted">{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          'h-9 rounded-md border bg-code-bg px-3 text-sm text-fg placeholder:text-faint hover:border-muted focus-visible:border-focus focus-visible:outline-none disabled:opacity-50',
          error ? 'border-danger' : 'border-border-input',
        )}
        {...rest}
      />
      {error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm">{label}</label>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="relative h-6 w-10 rounded-pill border border-border-input bg-code-bg transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50"
      >
        <RSwitch.Thumb className="block size-4 translate-x-0.5 rounded-pill bg-fg transition-transform duration-[var(--tk-motion-fast)] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-accent" />
      </RSwitch.Root>
    </div>
  )
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format = String }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span id={`${label}-l`}>{label}</span>
        <span className="font-semibold tabular-nums text-muted">{format(value)}</span>
      </div>
      <RSlider.Root
        aria-labelledby={`${label}-l`}
        value={[value]} min={min} max={max} step={step}
        onValueChange={v => onChange(v[0])}
        className="relative flex h-5 touch-none select-none items-center"
      >
        <RSlider.Track className="relative h-1.5 flex-1 rounded-pill bg-surface-hover">
          <RSlider.Range className="absolute h-full rounded-pill bg-accent" />
        </RSlider.Track>
        <RSlider.Thumb aria-label={label} className="block size-4 rounded-pill border-2 border-accent bg-fg shadow-pop" />
      </RSlider.Root>
    </div>
  )
}

export function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span id={`${label}-sl`} className="text-sm">{label}</span>
      <RSelect.Root value={value} onValueChange={onChange}>
        <RSelect.Trigger aria-labelledby={`${label}-sl`} className="inline-flex h-9 min-w-40 items-center justify-between gap-2 rounded-md border border-border-input bg-code-bg px-3 text-sm">
          <RSelect.Value />
          <RSelect.Icon><ChevronDown className="size-4 text-muted" /></RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface-raised p-1 shadow-pop">
            <RSelect.Viewport>
              {options.map(o => (
                <RSelect.Item key={o.value} value={o.value} className="flex h-8 cursor-default items-center justify-between gap-3 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-accent-soft">
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  <RSelect.ItemIndicator><Check className="size-4 text-accent" /></RSelect.ItemIndicator>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  )
}

export function KeybindRow({ action, keys, conflict, onChange }: { action: string; keys: string; conflict?: string; onChange: (k: string) => void }) {
  const [listening, setListening] = useState(false)
  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key !== 'Escape') {
        const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) onChange([...mods, e.key.length === 1 ? e.key.toUpperCase() : e.key].join('+'))
        else return
      }
      setListening(false)
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [listening, onChange])
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{action}</span>
      <div className="flex items-center gap-2">
        {conflict && <span className="text-xs text-warning">Also used by {conflict}</span>}
        <button
          onClick={() => setListening(true)}
          aria-live="polite"
          className={cn(
            'h-8 min-w-24 rounded-md border px-2.5 font-mono text-xs font-semibold',
            listening ? 'border-accent bg-accent-soft text-accent' : conflict ? 'border-warning bg-code-bg' : 'border-border-input bg-code-bg',
          )}
        >
          {listening ? 'Press a key…' : keys}
        </button>
      </div>
    </div>
  )
}

export function SearchBar({ query, onQuery, index, total, onNext, onPrev, onClose }: {
  query: string; onQuery: (q: string) => void; index: number; total: number; onNext: () => void; onPrev: () => void; onClose: () => void
}) {
  const [docs, setDocs] = useState(true)
  const [code, setCode] = useState(true)
  return (
    <div role="search" className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-1 shadow-pop">
      <Search className="ml-1.5 size-4 text-muted" aria-hidden />
      <input
        aria-label="Search code and docs"
        value={query}
        onChange={e => onQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.shiftKey ? onPrev : onNext)()
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Search…"
        className="h-7 w-44 bg-transparent px-1 text-sm outline-none placeholder:text-faint"
      />
      <span className={cn('min-w-14 text-right text-xs tabular-nums', query && !total ? 'text-danger' : 'text-muted')}>
        {query ? (total ? `${index} of ${total}` : 'No match') : ''}
      </span>
      <IconButton size="sm" label="Search docs" pressed={docs} onClick={() => setDocs(!docs)}><span className="text-[11px] font-bold">Doc</span></IconButton>
      <IconButton size="sm" label="Search code" pressed={code} onClick={() => setCode(!code)}><span className="text-[11px] font-bold">.py</span></IconButton>
      <IconButton size="sm" label="Previous match" shortcut="Shift+Enter" onClick={onPrev}><ChevronUp className="size-4" /></IconButton>
      <IconButton size="sm" label="Next match" shortcut="Enter" onClick={onNext}><Next className="size-4" /></IconButton>
      <IconButton size="sm" label="Close search" shortcut="Esc" onClick={onClose}><X className="size-4" /></IconButton>
    </div>
  )
}
