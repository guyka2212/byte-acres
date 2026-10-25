export type ErrorKind =
  | 'SyntaxError' | 'NameError' | 'TypeError' | 'ValueError' | 'IndexError' | 'KeyError'
  | 'ZeroDivisionError' | 'RecursionError' | 'LockedError' | 'ImportError' | 'RuntimeError'

// Every error the player can see. `line`/`col` are 1-based and filled in by
// the parser or by the VM from the current instruction's source position.
export class PyError extends Error {
  constructor(public kind: ErrorKind, message: string, public line = 0, public col = 0, public file = '') {
    super(message)
  }
  get display() {
    return `${this.kind === 'LockedError' ? 'Locked' : this.kind}: ${this.message}`
  }
}
