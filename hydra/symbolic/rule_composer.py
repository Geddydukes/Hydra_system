"""Utilities for composing JSONLogic rules with dependency awareness."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

JsonLogic = Dict[str, Any]


@dataclass(slots=True)
class RuleFragment:
    name: str
    condition: JsonLogic
    consequence: JsonLogic
    dependencies: List[str] = field(default_factory=list)
    priority: int = 0


class RuleComposer:
    """Compose multiple JSONLogic fragments into a single executable rule."""

    def __init__(self) -> None:
        self._fragments: List[RuleFragment] = []
        self._fallback: Optional[JsonLogic] = None

    def add_fragment(self, fragment: RuleFragment) -> None:
        self._fragments.append(fragment)
        self._fragments.sort(key=lambda frag: (-frag.priority, frag.name))

    def set_fallback(self, rule: JsonLogic) -> None:
        self._fallback = rule

    def compile(self) -> JsonLogic:
        if not self._fragments:
            raise ValueError("No rule fragments registered")
        sequence: List[Any] = []
        resolved: set[str] = set()
        for fragment in self._fragments:
            if not set(fragment.dependencies).issubset(resolved):
                missing = set(fragment.dependencies) - resolved
                raise ValueError(f"Fragment {fragment.name} missing dependencies: {sorted(missing)}")
            sequence.append(fragment.condition)
            sequence.append(fragment.consequence)
            resolved.add(fragment.name)
        if self._fallback is not None:
            sequence.append(self._fallback)
        else:
            sequence.append({"var": "default_result"})
        return {"if": sequence}


def chain_rules(*rules: JsonLogic) -> JsonLogic:
    if not rules:
        raise ValueError("At least one rule required")
    result: JsonLogic = rules[0]
    for rule in rules[1:]:
        result = {"merge": [result, rule]}
    return result
