import { describe, expect, it } from 'vitest'
import { fileAt } from '../../src/ui/primitives/CodeEditor'

const files = new Set(['tools', 'maze'])
const at = (line: string, word: string) => { const i = line.indexOf(word); return fileAt(line, i, i + word.length, files) }

describe('Ctrl+click on a file name', () => {
  it('opens a file named after import or from', () => {
    expect(at('import tools', 'tools')).toBe('tools')
    expect(at('    from maze import run', 'maze')).toBe('maze')
  })
  it('opens a file used before a dot', () => {
    expect(at('    tools.go_to(0, 0)', 'tools')).toBe('tools')
  })
  it('ignores words that are not one of my files, or not used as a file', () => {
    expect(at('import nothing', 'nothing')).toBeNull()
    expect(at('tools = 3', 'tools')).toBeNull()
    expect(at('import tools', 'import')).toBeNull()
  })
})
