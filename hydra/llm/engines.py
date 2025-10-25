"""Deterministic LLM engines used for tests."""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Iterable, List


class BaseLLMEngine(ABC):
    @abstractmethod
    def generate(self, prompt: str, *, max_tokens: int = 256) -> str:
        raise NotImplementedError


@dataclass(slots=True)
class PromptTemplate:
    name: str
    template: str

    def render(self, **variables: str) -> str:
        text = self.template
        for key, value in variables.items():
            text = text.replace(f"{{{{{key}}}}}", value)
        return text


class PromptManager:
    def __init__(self, templates: Iterable[PromptTemplate] = ()) -> None:
        self._templates: Dict[str, PromptTemplate] = {tpl.name: tpl for tpl in templates}

    def register(self, template: PromptTemplate) -> None:
        self._templates[template.name] = template

    def render(self, name: str, **variables: str) -> str:
        if name not in self._templates:
            raise KeyError(f"unknown template {name}")
        return self._templates[name].render(**variables)


class DeterministicLLM(BaseLLMEngine):
    """LLM engine that returns a reproducible answer for stable tests."""

    def __init__(self, knowledge_base: Dict[str, str]) -> None:
        self._knowledge_base = {key.lower(): value for key, value in knowledge_base.items()}

    def generate(self, prompt: str, *, max_tokens: int = 256) -> str:
        lookup = prompt.strip().lower()
        if lookup in self._knowledge_base:
            return self._knowledge_base[lookup][:max_tokens]
        # Provide deterministic fallback by hashing prompt.
        digest = hashlib.sha256(lookup.encode("utf-8")).hexdigest()
        return f"LLM-FALLBACK:{digest[:max_tokens]}"
