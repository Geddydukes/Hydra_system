"""Pytest fixtures for the Python feather-agent runtime."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from hydra.feather_agent import FeatherRuntime


@pytest.fixture(scope="session")
def feather_runtime() -> FeatherRuntime:
    return FeatherRuntime()
