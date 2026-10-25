import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, Play, Square, StepForward } from 'lucide-react'
import { cn } from '../cn'
import { Tooltip } from './Overlay'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'bg-surface-raised text-fg border border-border hover:bg-surface-hover',
  ghost: 'text-fg hover:bg-surface-hover',
  danger: 'bg-danger text-on-danger hover:brightness-110',
}
const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-md font-bold transition-[filter,background-color,transform] duration-[var(--tk-motion-fast)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  size?: 'sm' | 'md'
  pressed?: boolean
}

export function IconButton({ label, shortcut, size = 'md', pressed, className, children, ...rest }: IconButtonProps) {
  return (
    <Tooltip content={shortcut ? `${label}  ${shortcut}` : label}>
      <button
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          'inline-grid place-items-center rounded-sm text-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-accent-soft aria-pressed:text-accent',
          size === 'sm' ? 'size-7' : 'size-8',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export type RunState = 'idle' | 'running' | 'paused'

export function RunButton({ state, fileName, disabled, onClick }: {
  state: RunState
  fileName: string
  disabled?: boolean
  onClick?: () => void
}) {
  const conf = {
    idle: { label: `Run ${fileName}`, icon: <Play className="size-3.5" fill="currentColor" />, cls: 'bg-accent text-on-accent' },
    running: { label: `Stop ${fileName}`, icon: <Square className="size-3.5" fill="currentColor" />, cls: 'bg-danger text-on-danger anim-pulse-ring' },
    paused: { label: `Resume ${fileName}`, icon: <StepForward className="size-3.5" />, cls: 'bg-warning text-on-accent' },
  }[state]
  return (
    <Tooltip content={`${conf.label}  ${state === 'running' ? 'Shift+F5' : 'F5'}`}>
      <button
        aria-label={conf.label}
        disabled={disabled}
        onClick={onClick}
        className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold disabled:opacity-50', conf.cls)}
      >
        {conf.icon}
        {state === 'idle' ? 'Run' : state === 'running' ? 'Stop' : 'Resume'}
      </button>
    </Tooltip>
  )
}

export const MenuButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }>(function MenuButton(
  { primary, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'h-11 w-70 rounded-md px-5 text-left text-base font-bold transition-transform duration-[var(--tk-motion-fast)] hover:translate-x-1 disabled:opacity-50',
        primary ? 'bg-accent text-on-accent' : 'border border-border bg-surface-raised text-fg hover:bg-surface-hover',
        className,
      )}
      {...rest}
    />
  )
})
