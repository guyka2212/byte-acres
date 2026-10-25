import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crc32, makeZip, moduleName } from '../../src/save/zip'

describe('zip export', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })

  it('Python reads the archive back byte for byte', () => {
    const files = { 'main.py': 'while True:\n    harvest()\n', 'tools.py': '# café 🌱\ndef tend():\n    pass\n' }
    const dir = mkdtempSync(join(tmpdir(), 'zip-'))
    const path = join(dir, 'code.zip')
    writeFileSync(path, makeZip(files))
    const script = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps({n: z.read(n).decode("utf-8") for n in z.namelist()}))'
    const out = execFileSync('python', ['-c', script, path], { encoding: 'utf8' })
    expect(JSON.parse(out)).toEqual(files)
  })

  it('accepts only names Python can import', () => {
    expect(moduleName('tools.py')).toBe('tools')
    expect(moduleName('my_farm2.PY')).toBe('my_farm2')
    expect(moduleName('2fast.py')).toBeNull()
    expect(moduleName('bad name.py')).toBeNull()
    expect(moduleName('../evil.py')).toBeNull()
  })
})
