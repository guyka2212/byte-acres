import { useMemo } from 'react'
import { FileCode2, Pause, Pencil, StepForward } from 'lucide-react'
import type { UiState } from '../../game/client'
import { IconButton, RunButton, type RunState } from '../primitives/Button'
import { CodeEditor, type CompletionData, type LineMark } from '../primitives/CodeEditor'
import { FloatingWindow, type FloatingWindowProps } from '../primitives/FloatingWindow'
import { WarningBadge } from '../primitives/Game'

export function CodeWindow({ name, source, state, onChange, onRun, onStop, onResume, onPause, onStep, onRename, onShowOutput, completions, files, onOpenFile, windowProps }: {
  name: string
  source: string
  state: UiState
  onChange: (src: string) => void
  onRun: () => void
  onStop: () => void
  onResume: () => void
  onPause: () => void
  onStep: () => void
  /** missing for main.py, which keeps its name */
  onRename?: () => void
  completions: CompletionData | null
  files?: string[]
  onOpenFile?: (name: string) => void
  onShowOutput: () => void
  windowProps: Omit<FloatingWindowProps, 'title' | 'children'>
}) {
  const mine = state.run !== 'idle' && state.file === name
  const run: RunState = mine ? state.run : 'idle'

  const marks = useMemo<LineMark[]>(() => {
    const m: LineMark[] = []
    if (mine && state.line > 0) m.push({ line: state.line, kind: state.run === 'paused' ? 'paused' : 'running' })
    if (state.diagnostic && state.diagnostic.file === name && state.diagnostic.line > 0) m.push({ line: state.diagnostic.line, kind: 'error' })
    return m
  }, [mine, state.line, state.run, state.diagnostic, name])

  // warnings from this file's latest run
  const warnings = useMemo(() => {
    let start = 0
    state.logs.forEach((l, i) => { if (l.kind === 'info' && l.text.startsWith('Running ')) start = i })
    return state.logs.slice(start).filter(l => l.kind === 'warning' && (!l.file || l.file === name)).length
  }, [state.logs, name])
  const errors = state.diagnostic?.file === name ? 1 : 0

  return (
    <FloatingWindow
      {...windowProps}
      title={`${name}.py`}
      icon={<FileCode2 className="size-4" />}
      code
      actions={
        <>
          <WarningBadge warnings={warnings} errors={errors} onClick={onShowOutput} />
          {onRename && (
            <IconButton size="sm" label={`Rename ${name}.py`} onClick={onRename}>
              <Pencil className="size-3.5" />
            </IconButton>
          )}
          {run === 'running' && (
            <IconButton size="sm" label="Pause" shortcut="F6" onClick={onPause}>
              <Pause className="size-4" />
            </IconButton>
          )}
          <IconButton size="sm" label="Step one line" shortcut="F10" onClick={onStep} disabled={state.run === 'running'}>
            <StepForward className="size-4" />
          </IconButton>
          <RunButton
            state={run}
            fileName={name}
            onClick={run === 'idle' ? onRun : run === 'running' ? onStop : onResume}
          />
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <CodeEditor label={`${name}.py`} value={source} onChange={onChange} marks={marks} completions={completions} files={files} onOpenFile={onOpenFile} />
        </div>
        {errors > 0 && state.diagnostic && (
          <button
            onClick={onShowOutput}
            className="flex shrink-0 items-start gap-2 border-t border-danger/40 bg-danger/10 px-3 py-2 text-left font-mono text-xs text-danger"
          >
            <span className="shrink-0 font-bold">line {state.diagnostic.line}</span>
            <span className="min-w-0 flex-1">{state.diagnostic.message}</span>
          </button>
        )}
      </div>
    </FloatingWindow>
  )
}
