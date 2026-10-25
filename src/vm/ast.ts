export interface Pos { line: number; col: number }

export type Expr = Pos & (
  | { t: 'Num'; v: number }
  | { t: 'Str'; v: string }
  | { t: 'Const'; v: boolean | null }
  | { t: 'Name'; id: string }
  | { t: 'List'; items: Expr[] }
  | { t: 'Tuple'; items: Expr[] }
  | { t: 'Dict'; keys: Expr[]; values: Expr[] }
  | { t: 'Set'; items: Expr[] }
  | { t: 'BinOp'; op: string; l: Expr; r: Expr }
  | { t: 'Unary'; op: '-' | '+' | 'not'; v: Expr }
  | { t: 'BoolOp'; op: 'and' | 'or'; l: Expr; r: Expr }
  | { t: 'Compare'; ops: string[]; items: Expr[] }
  | { t: 'IfExp'; test: Expr; body: Expr; orelse: Expr }
  | { t: 'Call'; fn: Expr; args: Expr[]; star?: Expr }
  | { t: 'Attr'; obj: Expr; name: string }
  | { t: 'Index'; obj: Expr; index: Expr }
  | { t: 'Slice'; obj: Expr; lo?: Expr; hi?: Expr; step?: Expr }
)

export type Stmt = Pos & (
  | { t: 'Expr'; e: Expr }
  | { t: 'Assign'; targets: Expr[]; value: Expr }
  | { t: 'AugAssign'; target: Expr; op: string; value: Expr }
  | { t: 'If'; test: Expr; body: Stmt[]; orelse: Stmt[] }
  | { t: 'While'; test: Expr; body: Stmt[] }
  | { t: 'For'; target: Expr; iter: Expr; body: Stmt[] }
  | { t: 'Break' } | { t: 'Continue' } | { t: 'Pass' }
  | { t: 'Def'; name: string; params: string[]; defaults: Expr[]; star?: string; body: Stmt[] }
  | { t: 'Return'; value?: Expr }
  | { t: 'Global'; names: string[] }
  | { t: 'Import'; module: string; alias?: string }
  | { t: 'FromImport'; module: string; names: string[] }
)
