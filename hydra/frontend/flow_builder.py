"""Flow builder utilities for constructing agent pipelines."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, List


@dataclass(slots=True)
class FlowNode:
    id: str
    type: str
    config: Dict[str, str]


@dataclass(slots=True)
class FlowEdge:
    source: str
    target: str
    condition: str


class FlowBuilder:
    def __init__(self) -> None:
        self._nodes: Dict[str, FlowNode] = {}
        self._edges: List[FlowEdge] = []

    def add_node(self, node: FlowNode) -> None:
        if node.id in self._nodes:
            raise ValueError(f"duplicate node {node.id}")
        self._nodes[node.id] = node

    def connect(self, source: str, target: str, condition: str = "always") -> None:
        if source not in self._nodes or target not in self._nodes:
            raise KeyError("source and target must exist")
        self._edges.append(FlowEdge(source, target, condition))

    def serialize(self) -> Dict[str, any]:
        return {
            "nodes": [asdict(node) for node in self._nodes.values()],
            "edges": [asdict(edge) for edge in self._edges],
        }
