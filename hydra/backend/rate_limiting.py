"""Simple token bucket rate limiter."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Dict


@dataclass(slots=True)
class RateLimitResult:
    allowed: bool
    remaining: float
    reset_at: float


class RateLimiter:
    def __init__(self, rate: float, capacity: float) -> None:
        self.rate = rate
        self.capacity = capacity
        self._buckets: Dict[str, tuple[float, float]] = {}

    def check(self, key: str) -> RateLimitResult:
        now = time.time()
        tokens, last = self._buckets.get(key, (self.capacity, now))
        tokens = min(self.capacity, tokens + (now - last) * self.rate)
        if tokens < 1.0:
            reset = now + (1.0 - tokens) / self.rate
            self._buckets[key] = (tokens, now)
            return RateLimitResult(False, tokens, reset)
        tokens -= 1.0
        self._buckets[key] = (tokens, now)
        return RateLimitResult(True, tokens, now)
