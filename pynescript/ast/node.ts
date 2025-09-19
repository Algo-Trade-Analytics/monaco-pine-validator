// Auto-generated from PinescriptASTNode.py
// DO NOT EDIT MANUALLY

export class AST {
  static readonly _fields: readonly string[] = [];
  static readonly _attributes: readonly string[] = [];
  get _fields(): readonly string[] {
    return (this.constructor as typeof AST)._fields;
  }
  get _attributes(): readonly string[] {
    return (this.constructor as typeof AST)._attributes;
  }
  constructor(init?: Partial<AST>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export type identifier = string;
export type constant = any;

export class mod extends AST {

  constructor(init?: Partial<mod>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Script extends mod {
  body: stmt[] = [];
  annotations: string[] = [];
  static readonly _fields = ['body', 'annotations'] as const;

  constructor(init?: Partial<Script>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Expression extends mod {
  body: expr | null = null;
  static readonly _fields = ['body'] as const;

  constructor(init?: Partial<Expression>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class stmt extends AST {
  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<stmt>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class FunctionDef extends stmt {
  name: string | null = null;
  args: param[] = [];
  body: stmt[] = [];
  method: number | null = null;
  export: number | null = null;
  annotations: string[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['name', 'args', 'body', 'method', 'export', 'annotations'] as const;

  constructor(init?: Partial<FunctionDef>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class TypeDef extends stmt {
  name: string | null = null;
  body: stmt[] = [];
  export: number | null = null;
  annotations: string[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['name', 'body', 'export', 'annotations'] as const;

  constructor(init?: Partial<TypeDef>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Assign extends stmt {
  target: expr | null = null;
  value: expr | null = null;
  type: expr | null = null;
  mode: decl_mode | null = null;
  annotations: string[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['target', 'value', 'type', 'mode', 'annotations'] as const;

  constructor(init?: Partial<Assign>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class ReAssign extends stmt {
  target: expr | null = null;
  value: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['target', 'value'] as const;

  constructor(init?: Partial<ReAssign>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class AugAssign extends stmt {
  target: expr | null = null;
  op: operator | null = null;
  value: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['target', 'op', 'value'] as const;

  constructor(init?: Partial<AugAssign>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Import extends stmt {
  namespace: string | null = null;
  name: string | null = null;
  version: number | null = null;
  alias: string | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['namespace', 'name', 'version', 'alias'] as const;

  constructor(init?: Partial<Import>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Expr extends stmt {
  value: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value'] as const;

  constructor(init?: Partial<Expr>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Break extends stmt {
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<Break>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Continue extends stmt {
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<Continue>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class expr extends AST {
  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<expr>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class BoolOp extends expr {
  op: bool_op | null = null;
  values: expr[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['op', 'values'] as const;

  constructor(init?: Partial<BoolOp>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class BinOp extends expr {
  left: expr | null = null;
  op: operator | null = null;
  right: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['left', 'op', 'right'] as const;

  constructor(init?: Partial<BinOp>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class UnaryOp extends expr {
  op: unary_op | null = null;
  operand: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['op', 'operand'] as const;

  constructor(init?: Partial<UnaryOp>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Conditional extends expr {
  test: expr | null = null;
  body: expr | null = null;
  orelse: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['test', 'body', 'orelse'] as const;

  constructor(init?: Partial<Conditional>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Compare extends expr {
  left: expr | null = null;
  ops: compare_op[] = [];
  comparators: expr[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['left', 'ops', 'comparators'] as const;

  constructor(init?: Partial<Compare>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Call extends expr {
  func: expr | null = null;
  args: arg[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['func', 'args'] as const;

  constructor(init?: Partial<Call>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Constant extends expr {
  value: any | null = null;
  kind: string | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'kind'] as const;

  constructor(init?: Partial<Constant>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Attribute extends expr {
  value: expr | null = null;
  attr: string | null = null;
  ctx: expr_context | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'attr', 'ctx'] as const;

  constructor(init?: Partial<Attribute>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Subscript extends expr {
  value: expr | null = null;
  slice: expr | null = null;
  ctx: expr_context | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'slice', 'ctx'] as const;

  constructor(init?: Partial<Subscript>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Name extends expr {
  id: string | null = null;
  ctx: expr_context | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['id', 'ctx'] as const;

  constructor(init?: Partial<Name>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Tuple extends expr {
  elts: expr[] = [];
  ctx: expr_context | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['elts', 'ctx'] as const;

  constructor(init?: Partial<Tuple>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class ForTo extends expr {
  target: expr | null = null;
  start: expr | null = null;
  end: expr | null = null;
  body: stmt[] = [];
  step: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['target', 'start', 'end', 'body', 'step'] as const;

  constructor(init?: Partial<ForTo>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class ForIn extends expr {
  target: expr | null = null;
  iter: expr | null = null;
  body: stmt[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['target', 'iter', 'body'] as const;

  constructor(init?: Partial<ForIn>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class While extends expr {
  test: expr | null = null;
  body: stmt[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['test', 'body'] as const;

  constructor(init?: Partial<While>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class If extends expr {
  test: expr | null = null;
  body: stmt[] = [];
  orelse: stmt[] = [];
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['test', 'body', 'orelse'] as const;

  constructor(init?: Partial<If>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Switch extends expr {
  cases: SwitchCase[] = [];
  subject: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['cases', 'subject'] as const;

  constructor(init?: Partial<Switch>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Qualify extends expr {
  qualifier: type_qual | null = null;
  value: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['qualifier', 'value'] as const;

  constructor(init?: Partial<Qualify>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Specialize extends expr {
  value: expr | null = null;
  args: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'args'] as const;

  constructor(init?: Partial<Specialize>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class decl_mode extends AST {

  constructor(init?: Partial<decl_mode>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Var extends decl_mode {

  constructor(init?: Partial<Var>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class VarIp extends decl_mode {

  constructor(init?: Partial<VarIp>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class type_qual extends AST {

  constructor(init?: Partial<type_qual>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Const extends type_qual {

  constructor(init?: Partial<Const>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Input extends type_qual {

  constructor(init?: Partial<Input>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Simple extends type_qual {

  constructor(init?: Partial<Simple>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Series extends type_qual {

  constructor(init?: Partial<Series>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class expr_context extends AST {

  constructor(init?: Partial<expr_context>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Load extends expr_context {

  constructor(init?: Partial<Load>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Store extends expr_context {

  constructor(init?: Partial<Store>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class bool_op extends AST {

  constructor(init?: Partial<bool_op>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class And extends bool_op {

  constructor(init?: Partial<And>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Or extends bool_op {

  constructor(init?: Partial<Or>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class operator extends AST {

  constructor(init?: Partial<operator>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Add extends operator {

  constructor(init?: Partial<Add>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Sub extends operator {

  constructor(init?: Partial<Sub>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Mult extends operator {

  constructor(init?: Partial<Mult>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Div extends operator {

  constructor(init?: Partial<Div>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Mod extends operator {

  constructor(init?: Partial<Mod>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class unary_op extends AST {

  constructor(init?: Partial<unary_op>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Not extends unary_op {

  constructor(init?: Partial<Not>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class UAdd extends unary_op {

  constructor(init?: Partial<UAdd>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class USub extends unary_op {

  constructor(init?: Partial<USub>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class compare_op extends AST {

  constructor(init?: Partial<compare_op>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Eq extends compare_op {

  constructor(init?: Partial<Eq>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class NotEq extends compare_op {

  constructor(init?: Partial<NotEq>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Lt extends compare_op {

  constructor(init?: Partial<Lt>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class LtE extends compare_op {

  constructor(init?: Partial<LtE>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Gt extends compare_op {

  constructor(init?: Partial<Gt>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class GtE extends compare_op {

  constructor(init?: Partial<GtE>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class param extends AST {
  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<param>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Param extends param {
  name: string | null = null;
  default: expr | null = null;
  type: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['name', 'default', 'type'] as const;

  constructor(init?: Partial<Param>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class arg extends AST {
  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<arg>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Arg extends arg {
  value: expr | null = null;
  name: string | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'name'] as const;

  constructor(init?: Partial<Arg>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class SwitchCase extends AST {

  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;


  constructor(init?: Partial<SwitchCase>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}


export class Case extends SwitchCase {

  body: stmt[] = [];
  pattern: expr | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['body', 'pattern'] as const;

  constructor(init?: Partial<Case>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class cmnt extends AST {
  lineno: number | null = null;
  col_offset: number | null = null;
  end_lineno: number | null = null;
  end_col_offset: number | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;

  constructor(init?: Partial<cmnt>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class Comment extends cmnt {
  value: string | null = null;
  kind: string | null = null;
  static readonly _attributes = ['lineno', 'col_offset', 'end_lineno', 'end_col_offset'] as const;
  static readonly _fields = ['value', 'kind'] as const;

  constructor(init?: Partial<Comment>) {
    super(init);
    if (init) {
      Object.assign(this, init);
    }
  }
}

