from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

SRC_PATH = Path('pynescript-0.2.0/src/pynescript/ast/grammar/asdl/generated/PinescriptASTNode.py')

RESERVED_IDENTIFIERS = {
    'case': 'SwitchCase',
}


def sanitize_identifier(name: str) -> str:
    """Return the TypeScript-safe identifier for a Python dataclass."""
    return RESERVED_IDENTIFIERS.get(name, name)


def load_pinescript_module(module_name: str = 'pinescript_ast') -> ModuleType:
    """Import the upstream Pinescript AST module for introspection."""
    spec = importlib.util.spec_from_file_location(module_name, SRC_PATH)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise RuntimeError(f'Unable to load Pinescript AST from {SRC_PATH!s}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module
