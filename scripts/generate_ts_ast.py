import dataclasses

from pathlib import Path

from ast_common import load_pinescript_module, sanitize_identifier

OUTPUT_PATH = Path('pynescript/ast/node.ts')

module = load_pinescript_module()

import importlib.util
import sys
from pathlib import Path

SRC_PATH = Path('pynescript-0.2.0/src/pynescript/ast/grammar/asdl/generated/PinescriptASTNode.py')
OUTPUT_PATH = Path('pynescript/ast/node.ts')

spec = importlib.util.spec_from_file_location('pinescript_ast', SRC_PATH)
module = importlib.util.module_from_spec(spec)
sys.modules['pinescript_ast'] = module
spec.loader.exec_module(module)


python_type_to_ts = {
    str: 'string',
    int: 'number',
    float: 'number',
    complex: 'number',
    bool: 'boolean',
    bytes: 'string',
    type(None): 'null',
}

def convert_alias(name: str, value) -> str:
    if isinstance(value, type):
        return python_type_to_ts.get(value, 'any')
    if isinstance(value, str):
        parts = [p.strip() for p in value.split('|')]
        ts_parts = []
        for part in parts:
            if part in {'str', 'bytes'}:
                ts_parts.append('string')
            elif part in {'int', 'float', 'complex'}:
                ts_parts.append('number')
            elif part in {'bool'}:
                ts_parts.append('boolean')
            elif part in {'None', 'type(...)'}:
                ts_parts.append('null')
            elif part in {'tuple', 'frozenset'}:
                ts_parts.append('any')
            else:
                ts_parts.append(part)
        # collapse duplicates
        seen = []
        for part in ts_parts:
            if part not in seen:
                seen.append(part)
        if seen == ['any'] or 'any' in seen:
            return 'any'
        return ' | '.join(seen)
    return 'any'

alias_types = {}
for name, value in module.__dict__.items():
    if name.startswith('_'):
        continue
    if name.isupper():
        continue
    if name in {'AST'}:
        continue
    if dataclasses.is_dataclass(value):
        continue
    if isinstance(value, (type, str)):
        alias_types[name] = convert_alias(name, value)

if 'constant' not in alias_types:
    alias_types['constant'] = 'any'

import ast as pyast



RESERVED_IDENTIFIERS = {
    'case': 'SwitchCase',
}

def sanitize_identifier(name: str) -> str:
    return RESERVED_IDENTIFIERS.get(name, name)

name_map: dict[str, str] = {}

def parse_type_expr(expr) -> str:
    if isinstance(expr, str):
        expr_ast = pyast.parse(expr, mode='eval').body
        return parse_type_expr(expr_ast)
    if isinstance(expr, type):
        return python_type_to_ts.get(expr, getattr(expr, '__name__', 'any'))
    if isinstance(expr, pyast.Name):
        name = expr.id
        if name == 'None':
            return 'null'
        if name in alias_types:
            return alias_types[name]
        if name in name_map:
            return name_map[name]
        return sanitize_identifier(name)
    if isinstance(expr, pyast.Attribute):
        return expr.attr
    if isinstance(expr, pyast.Subscript):
        base = parse_type_expr(expr.value)
        if isinstance(expr.slice, pyast.Tuple):
            args = [parse_type_expr(elt) for elt in expr.slice.elts]
            inner = ', '.join(args)
        else:
            inner = parse_type_expr(expr.slice)
        if base in {'list', 'List'}:
            return f'{inner}[]'
        if base in {'tuple', 'Tuple'}:
            return f'[{inner}]'
        if base in {'set', 'Set'}:
            return f'Set<{inner}>'
        if base in {'dict', 'Dict'}:
            return f'Record<string, {inner}>'
        return f'{base}<{inner}>'
    if isinstance(expr, pyast.BinOp) and isinstance(expr.op, pyast.BitOr):
        left = parse_type_expr(expr.left)
        right = parse_type_expr(expr.right)
        parts = []
        for part in (left, right):
            if part == 'None':
                part = 'null'
            parts.append(part)
        return ' | '.join(parts)
    if isinstance(expr, pyast.Constant):
        if expr.value is None:
            return 'null'
        if isinstance(expr.value, bool):
            return 'boolean'
        if isinstance(expr.value, (int, float, complex)):
            return 'number'
        if isinstance(expr.value, str):
            return 'string'
    return 'any'

from dataclasses import is_dataclass, MISSING

dataclass_items = [
    (name, value)
    for name, value in module.__dict__.items()
    if dataclasses.is_dataclass(value)
]

for original_name, _ in dataclass_items:
    name_map[original_name] = sanitize_identifier(original_name)

class_infos = []
for name, value in dataclass_items:
    bases = [
        name_map.get(base.__name__, sanitize_identifier(base.__name__))
        for base in value.__bases__
        if base is not object
    ]
    fields = []
    class_vars = []
    base_field_names = set()
    for base in value.__mro__[1:]:
        if dataclasses.is_dataclass(base):
            for base_field in base.__dataclass_fields__.values():
                type_repr = base_field.type
                if isinstance(type_repr, str) and 'ClassVar' in type_repr:
                    continue
                base_field_names.add(base_field.name)
    for field in value.__dataclass_fields__.values():
        type_repr = field.type
        if isinstance(type_repr, str) and 'ClassVar' in type_repr:
            default_value = field.default
            if default_value is MISSING:
                default_value = None
            class_vars.append((field.name, default_value))
            continue
        if field.name in base_field_names:
            continue
        ts_type = parse_type_expr(type_repr)
        has_default = False
        default_code = None
        if field.default is not MISSING:
            has_default = True
            default_code = field.default
        elif field.default_factory is not MISSING:
            has_default = True
            factory = field.default_factory
            if factory is list:
                default_code = []
            elif factory is dict:
                default_code = {}
            elif factory is set:
                default_code = 'new Set()'
        if has_default and default_code is None and 'null' not in ts_type:
            ts_type = f'{ts_type} | null'
        fields.append((field.name, ts_type, has_default, default_code))
    class_infos.append((name_map[name], bases, fields, class_vars))


header = "// Auto-generated from PinescriptASTNode.py\n// DO NOT EDIT MANUALLY\n\n"
lines = [header]

lines.append('export class AST {\n')
lines.append('  static readonly _fields: readonly string[] = [];\n')
lines.append('  static readonly _attributes: readonly string[] = [];\n')
lines.append('  get _fields(): readonly string[] {\n')
lines.append('    return (this.constructor as typeof AST)._fields;\n')
lines.append('  }\n')
lines.append('  get _attributes(): readonly string[] {\n')
lines.append('    return (this.constructor as typeof AST)._attributes;\n')
lines.append('  }\n')
lines.append('  constructor(init?: Partial<AST>) {\n')
lines.append('    if (init) {\n')
lines.append('      Object.assign(this, init);\n')
lines.append('    }\n')
lines.append('  }\n')
lines.append('}\n\n')

for name, ts_type in alias_types.items():
    if name in {'int', 'string'}:
        continue
    lines.append(f'export type {name} = {ts_type};\n')
lines.append('\n')

def format_literal(value):
    if value is None:
        return 'null'
    if isinstance(value, str):
        return value if value.startswith('new ') else f"'{value}'"
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    return 'undefined'


def format_default(value):
    if value is None:
        return 'null'
    if value == []:
        return '[]'
    if value == {}:
        return '{}'
    if value == 'new Set()':
        return 'new Set()'
    if isinstance(value, list):
        items = ', '.join(format_literal(item) for item in value)
        return f'[{items}] as const'
    if isinstance(value, tuple):
        items = ', '.join(format_literal(item) for item in value)
        return f'[{items}]'
    literal = format_literal(value)
    if literal != 'undefined':
        return literal
    return 'undefined'

for name, bases, fields, class_vars in class_infos:
    base_clause = ''
    if bases:
        base_clause = f' extends {bases[0]}'
    lines.append(f'export class {name}{base_clause} {{\n')
    for field_name, ts_type, has_default, default in fields:
        default_str = ''
        if has_default:
            default_str = f' = {format_default(default)}'
        lines.append(f'  {field_name}: {ts_type}{default_str};\n')
    for var_name, value in class_vars:
        default_str = format_default(value)
        if default_str == 'undefined':
            default_str = '[]'
        lines.append(f'  static readonly {var_name} = {default_str};\n')
    lines.append('\n')
    lines.append('  constructor(init?: Partial<%s>) {\n' % name)
    if bases:
        lines.append('    super(init);\n')
    lines.append('    if (init) {\n')
    lines.append('      Object.assign(this, init);\n')
    lines.append('    }\n')
    lines.append('  }\n')
    lines.append('}\n\n')

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(''.join(lines))
