"""Typed protocol for structured Poligras outputs."""

from __future__ import annotations

from typing import List, TypedDict


class ParameterSet(TypedDict):
    counts: int
    group_size: int
    hidden_size1: int
    hidden_size2: int
    lr: float
    dropout: float


class Meta(TypedDict):
    dataset: str
    algorithm: str
    run_id: str
    parameters: ParameterSet


class InitialStats(TypedDict):
    nodes: int
    edges: int


class SummaryStats(TypedDict):
    supernodes: int
    superedges: int
    correction_edges: int


class CorrectionBreakdown(TypedDict):
    positive: int
    negative: int


class StatsBase(TypedDict):
    initial: InitialStats
    summary: SummaryStats
    compression_ratio: float
    total_reward: float


class Stats(StatsBase, total=False):
    avg_supernode_size: float
    correction_breakdown: CorrectionBreakdown


class InitialNodeRequired(TypedDict):
    id: int
    degree: int


class InitialNode(InitialNodeRequired, total=False):
    label: str


class SummaryNodeRequired(TypedDict):
    id: str
    size: int


class SummaryNode(SummaryNodeRequired, total=False):
    label: str


class InitialEdge(TypedDict):
    source: int
    target: int
    weight: float


class SummaryEdgeRequired(TypedDict):
    source: str
    target: str
    weight: float


class SummaryEdge(SummaryEdgeRequired, total=False):
    density: float


class InitialGraph(TypedDict):
    directed: bool
    sampled: bool
    node_count: int
    edge_count: int
    nodes: List[InitialNode]
    edges: List[InitialEdge]


class SummaryGraph(TypedDict):
    directed: bool
    sampled: bool
    node_count: int
    edge_count: int
    nodes: List[SummaryNode]
    edges: List[SummaryEdge]


class GraphCollection(TypedDict):
    initial: InitialGraph
    summary: SummaryGraph


class PoligrasOutputBase(TypedDict):
    stats: Stats
    graphs: GraphCollection


class PoligrasOutput(PoligrasOutputBase, total=False):
    meta: Meta


__all__ = [
    "CorrectionBreakdown",
    "GraphCollection",
    "InitialEdge",
    "InitialGraph",
    "InitialNode",
    "InitialStats",
    "Meta",
    "ParameterSet",
    "PoligrasOutput",
    "Stats",
    "SummaryEdge",
    "SummaryGraph",
    "SummaryNode",
    "SummaryStats",
]
