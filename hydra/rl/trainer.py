"""Preference-based trainer for reinforcement learning signal aggregation."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List


@dataclass(slots=True)
class PreferenceSample:
    symbolic_score: float
    llm_score: float
    preferred: str  # "symbolic" or "llm"


class PreferenceTrainer:
    def __init__(self, learning_rate: float = 0.1) -> None:
        self.learning_rate = learning_rate
        self.weights = {"symbolic": 0.0, "llm": 0.0}
        self._samples: List[PreferenceSample] = []

    def add_sample(self, sample: PreferenceSample) -> None:
        if sample.preferred not in {"symbolic", "llm"}:
            raise ValueError("preferred must be 'symbolic' or 'llm'")
        self._samples.append(sample)

    def train(self, epochs: int = 50) -> None:
        for _ in range(epochs):
            for sample in self._samples:
                features = {
                    "symbolic": sample.symbolic_score,
                    "llm": sample.llm_score,
                }
                logits = {key: self.weights[key] * value for key, value in features.items()}
                exp_symbolic = math.exp(logits["symbolic"])
                exp_llm = math.exp(logits["llm"])
                total = exp_symbolic + exp_llm
                probs = {
                    "symbolic": exp_symbolic / total,
                    "llm": exp_llm / total,
                }
                for key in self.weights:
                    target = 1.0 if key == sample.preferred else 0.0
                    gradient = (target - probs[key]) * features[key]
                    self.weights[key] += self.learning_rate * gradient

    def predict(self, symbolic_score: float, llm_score: float) -> str:
        symbolic_value = self.weights["symbolic"] * symbolic_score
        llm_value = self.weights["llm"] * llm_score
        return "symbolic" if symbolic_value >= llm_value else "llm"
