from __future__ import annotations

import dataclasses
import json
from dataclasses import MISSING
from typing import Any, ClassVar, get_origin

from ast_common import load_pinescript_module, sanitize_identifier


module = load_pinescript_module('pinescript_ast_metadata')


def is_class_var(field: dataclasses.Field[Any]) -> bool:
    type_repr = field.type
    if isinstance(type_repr, str):
        return 'ClassVar' in type_repr
    origin = get_origin(type_repr)
    return origin is ClassVar


def describe_default(field: dataclasses.Field[Any]) -> dict[str, Any]:
    if field.default_factory is not MISSING:
        factory = field.default_factory
        if factory is list:
            return {'kind': 'list'}
        if factory is dict:
            return {'kind': 'dict'}
        if factory is set:
            return {'kind': 'set'}
        return {'kind': 'factory', 'name': getattr(factory, '__name__', repr(factory))}
    if field.default is not MISSING:
        value = field.default
        if value is None:
            return {'kind': 'null'}
        if isinstance(value, (str, bool, int, float)):
            return {'kind': 'literal', 'value': value}
        return {'kind': 'value', 'repr': repr(value)}
    return {'kind': 'required'}


classes: dict[str, Any] = {}

ast_class = getattr(module, 'AST')
classes['AST'] = {
    'bases': [],
    'fields': list(getattr(ast_class, '_fields', [])),
    'attributes': list(getattr(ast_class, '_attributes', [])),
    'dataclass_fields': [],
    'defaults': {},
}

for name, value in sorted(module.__dict__.items()):
    if not dataclasses.is_dataclass(value):
        continue
    sanitized_name = sanitize_identifier(name)
    bases = [
        sanitize_identifier(base.__name__)
        for base in value.__bases__
        if base is not object
    ]
    attributes = list(getattr(value, '_attributes', []))
    fields = list(getattr(value, '_fields', []))
    dataclass_fields: list[str] = []
    defaults: dict[str, dict[str, Any]] = {}
    for field in value.__dataclass_fields__.values():
        if is_class_var(field):
            continue
        dataclass_fields.append(field.name)
        defaults[field.name] = describe_default(field)
    classes[sanitized_name] = {
        'bases': bases,
        'fields': fields,
        'attributes': attributes,
        'dataclass_fields': dataclass_fields,
        'defaults': defaults,
    }

print(json.dumps({'classes': classes}, indent=2, sort_keys=True))
