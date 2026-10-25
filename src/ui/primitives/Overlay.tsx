import { useEffect, useState, type ReactNode } from 'react'
import * as RTooltip from '@radix-ui/react-tooltip'
import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../cn'

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={400}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            sideOffset={6}
            className="z-50 whitespace-pre rounded-sm bg-surface-raised px-2 py-1 text-xs font-semibold text-fg shadow-pop"
          >
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  )
}

type ToastVariant = 'info' | 'success' | 'warning' | 'achievement'
const bar: Record<ToastVariant, string> = {
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  achievement: 'bg-item-gold',
}

export function Toast({ variant = 'info', title, body, onClose }: {
  variant?: ToastVariant
  title: string
  body?: string
  onClose?: () => void
}) {
  return (
    <div role="status" className="anim-pop relative flex w-80 overflow-hidden rounded-md bg-surface-raised shadow-pop">
      <span className={cn('w-1 shrink-0', bar[variant])} aria-hidden />
      <div className="flex-1 px-3 py-2.5">
        <p className="text-sm font-bold">{title}</p>
        {body && <p className="text-xs text-muted">{body}</p>}
      </div>
      {onClose && (
        <button aria-label="Dismiss" onClick={onClose} className="m-1.5 grid size-6 place-items-center rounded-sm text-muted hover:bg-surface-hover hover:text-fg">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function ConfirmDialog({ trigger, title, body, confirmLabel, danger, onConfirm }: {
  trigger: ReactNode
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}) {
  return (
    <RDialog.Root>
      <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-overlay/60" />
        <RDialog.Content className="anim-pop fixed left-1/2 top-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-window">
          <RDialog.Title className="text-lg font-bold">{title}</RDialog.Title>
          <RDialog.Description className="mt-1.5 text-sm text-muted">{body}</RDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <RDialog.Close asChild>
              <button autoFocus className="h-9 rounded-md border border-border bg-surface-raised px-3.5 text-sm font-bold hover:bg-surface-hover">Cancel</button>
            </RDialog.Close>
            <RDialog.Close asChild>
              <button
                onClick={onConfirm}
                className={cn('h-9 rounded-md px-3.5 text-sm font-bold', danger ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent')}
              >
                {confirmLabel}
              </button>
            </RDialog.Close>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export function Callout({ children, onDismiss, arrow = 'left', className }: {
  children: ReactNode
  onDismiss: () => void
  arrow?: 'left' | 'top' | 'none'
  className?: string
}) {
  const [dontShow, setDontShow] = useState(false)
  useEffect(() => {
    // Escape in the editor closes a suggestion list; it must not skip the hints
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as HTMLElement | null)?.closest?.('.cm-editor')) onDismiss()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onDismiss])
  return (
    <div role="dialog" aria-label="Hint" className={cn('anim-pop relative w-72 rounded-md border border-accent bg-accent-soft p-3 shadow-pop', className)}>
      {arrow !== 'none' && <span
        aria-hidden
        className={cn(
          'absolute size-3 rotate-45 border-accent bg-accent-soft',
          arrow === 'left' ? '-left-1.5 top-5 border-b border-l' : '-top-1.5 left-6 border-l border-t',
        )}
      />}
      <div className="text-sm">{children}</div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} className="accent-[var(--color-accent)]" />
          Don't show hints
        </label>
        <button onClick={onDismiss} className="h-7 rounded-md bg-accent px-2.5 text-xs font-bold text-on-accent">Got it</button>
      </div>
    </div>
  )
}

/** asks for a name; `validate` returns an error message or null */
export function NameDialog({ open, title, label, initial, confirmLabel, validate, onConfirm, onCancel }: {
  open: boolean
  title: string
  label: string
  initial: string
  confirmLabel: string
  validate: (v: string) => string | null
  onConfirm: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (open) { setValue(initial); setTouched(false) } }, [open, initial])
  const error = validate(value)
  const submit = () => { setTouched(true); if (!error) onConfirm(value.trim()) }
  return (
    <RDialog.Root open={open} onOpenChange={o => !o && onCancel()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[90] bg-overlay/60" />
        <RDialog.Content className="anim-pop fixed left-1/2 top-1/2 z-[91] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-window">
          <RDialog.Title className="text-lg font-bold">{title}</RDialog.Title>
          <RDialog.Description className="sr-only">{label}</RDialog.Description>
          <form className="mt-4" onSubmit={e => { e.preventDefault(); submit() }}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">{label}</span>
              <input
                autoFocus
                value={value}
                onChange={e => { setValue(e.target.value); setTouched(true) }}
                aria-invalid={touched && !!error}
                className={cn('h-9 rounded-md border bg-code-bg px-3 font-mono text-sm text-fg focus-visible:border-focus focus-visible:outline-none', touched && error ? 'border-danger' : 'border-border-input')}
              />
            </label>
            <p className="mt-1.5 min-h-4 text-xs text-danger" aria-live="polite">{touched ? error : ''}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onCancel} className="h-9 rounded-md border border-border bg-surface-raised px-3.5 text-sm font-bold hover:bg-surface-hover">Cancel</button>
              <button type="submit" className="h-9 rounded-md bg-accent px-3.5 text-sm font-bold text-on-accent">{confirmLabel}</button>
            </div>
          </form>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** a confirm dialog opened from code (a menu item), not from its own trigger */
export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <RDialog.Root open={open} onOpenChange={o => !o && onCancel()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[90] bg-overlay/60" />
        <RDialog.Content className="anim-pop fixed left-1/2 top-1/2 z-[91] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-window">
          <RDialog.Title className="text-lg font-bold">{title}</RDialog.Title>
          <RDialog.Description className="mt-1.5 text-sm text-muted">{body}</RDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <button autoFocus onClick={onCancel} className="h-9 rounded-md border border-border bg-surface-raised px-3.5 text-sm font-bold hover:bg-surface-hover">Cancel</button>
            <button onClick={onConfirm} className={cn('h-9 rounded-md px-3.5 text-sm font-bold', danger ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent')}>{confirmLabel}</button>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
