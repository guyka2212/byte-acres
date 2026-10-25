import { useEffect, useRef } from 'react'
import { MenuButton } from '../primitives/Button'
import { ConfirmDialog } from '../primitives/Overlay'

export function MenuOverlay({ saveState, onClose, onSave, onRestart, onExport, onImport, onHome, onSettings, restartLabel = 'Start this field over' }: {
  saveState: 'idle' | 'saved' | 'failed'
  onClose: () => void
  onSave: () => void
  onRestart: () => void
  onExport: () => void
  onImport: () => void
  onHome: () => void
  onSettings: () => void
  restartLabel?: string
}) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  return (
    <div role="dialog" aria-modal aria-label="Menu" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-overlay/70 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="anim-pop flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-6 shadow-window">
        <h2 className="mb-1 text-xl font-extrabold">Paused</h2>
        <p className="mb-3 text-xs text-muted">
          {saveState === 'failed' ? "Saving isn't working in this browser." : 'Your farm and code save on this device as you play.'}
        </p>
        <MenuButton ref={first} primary onClick={onClose}>Back to the farm</MenuButton>
        <MenuButton onClick={onSave}>Save now</MenuButton>
        <MenuButton onClick={onHome}>Home</MenuButton>
        <MenuButton onClick={onSettings}>Settings</MenuButton>
        <MenuButton onClick={onExport}>Download my code (.zip)</MenuButton>
        <MenuButton onClick={onImport}>Open .py files</MenuButton>
        <ConfirmDialog
          trigger={<MenuButton>{restartLabel}</MenuButton>}
          title="Start over?"
          body="This deletes this field's farm, research and code. Your other fields stay. It can't be undone."
          confirmLabel="Delete and start over"
          danger
          onConfirm={onRestart}
        />
      </div>
    </div>
  )
}
