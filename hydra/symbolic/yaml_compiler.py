"""YAML DSL compiler that emits JSONLogic fragments."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .rule_composer import RuleFragment

try:  # pragma: no cover - optional dependency path
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None


@dataclass(slots=True)
class CompiledRule:
    fragment: RuleFragment


def compile_yaml_rule(source: str) -> CompiledRule:
    data = _load_yaml_like(source)
    if not isinstance(data, dict):
        raise TypeError("YAML rule must be a mapping")
    name = data.get("name")
    if not isinstance(name, str):
        raise ValueError("Rule requires a name")
    condition = data.get("when")
    consequence = data.get("then")
    if not isinstance(condition, dict) or not isinstance(consequence, dict):
        raise ValueError("Rule must define 'when' and 'then' JSONLogic blocks")
    dependencies = data.get("dependencies", [])
    if not isinstance(dependencies, list):
        raise ValueError("dependencies must be a list")
    priority = int(data.get("priority", 0))
    fragment = RuleFragment(
        name=name,
        condition=condition,
        consequence=consequence,
        dependencies=[str(dep) for dep in dependencies],
        priority=priority,
    )
    return CompiledRule(fragment=fragment)


def _load_yaml_like(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("Empty YAML rule")
    if yaml is not None:
        return yaml.safe_load(text)
    return _parse_with_indentation(text.splitlines())


def _parse_with_indentation(lines: List[str], indent: int = 0) -> Any:
    result: Dict[str, Any] = {}
    index = 0
    while index < len(lines):
        raw_line = lines[index]
        if not raw_line.strip() or raw_line.strip().startswith('#'):
            index += 1
            continue
        current_indent = len(raw_line) - len(raw_line.lstrip(' '))
        if current_indent < indent:
            break
        if ':' not in raw_line:
            raise ValueError(f"Invalid DSL line: {raw_line}")
        key, value = raw_line.split(':', 1)
        key = key.strip()
        value = value.strip()
        if value:
            result[key] = _coerce_scalar(value)
            index += 1
        else:
            nested_lines: List[str] = []
            index += 1
            while index < len(lines):
                next_line = lines[index]
                next_indent = len(next_line) - len(next_line.lstrip(' '))
                if next_indent <= current_indent:
                    break
                nested_lines.append(next_line)
                index += 1
            if nested_lines and nested_lines[0].strip().startswith('- '):
                result[key] = _parse_list(nested_lines, current_indent + 2)
            else:
                result[key] = _parse_with_indentation(nested_lines, current_indent + 2)
    return result


def _parse_list(lines: List[str], indent: int) -> List[Any]:
    items: List[Any] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        current_indent = len(line) - len(line.lstrip(' '))
        if current_indent < indent - 2:
            break
        if not line.strip().startswith('- '):
            raise ValueError(f"Invalid list entry: {line}")
        value = line.strip()[2:]
        if value:
            items.append(_coerce_scalar(value))
            index += 1
        else:
            nested_lines: List[str] = []
            index += 1
            while index < len(lines):
                next_line = lines[index]
                next_indent = len(next_line) - len(next_line.lstrip(' '))
                if next_indent <= current_indent:
                    break
                nested_lines.append(next_line)
                index += 1
            if nested_lines and nested_lines[0].strip().startswith('- '):
                items.append(_parse_list(nested_lines, current_indent + 2))
            else:
                items.append(_parse_with_indentation(nested_lines, current_indent + 2))
    return items


def _coerce_scalar(value: str) -> Any:
    lowered = value.lower()
    if lowered in {"true", "false"}:
        return lowered == "true"
    if lowered == "null":
        return None
    try:
        if '.' in value:
            return float(value)
        return int(value)
    except ValueError:
        return value
