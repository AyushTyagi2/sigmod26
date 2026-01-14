"""Incremental summary maintenance for dynamic edge updates."""

from __future__ import annotations

import copy
import json
import logging
from dataclasses import dataclass
from itertools import combinations
from typing import Dict, Iterable, List, Literal, Optional, Sequence, Set, Tuple

from backend.output_types import PoligrasOutput, SummaryEdge

PairKey = Tuple[str, str]
EdgeKey = Tuple[str, str]
Operation = Literal["add", "remove"]
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[DynamicUpdates] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


class UpdateStreamError(ValueError):
    """Raised when an incoming update stream cannot be parsed."""


@dataclass(frozen=True)
class EdgeUpdate:
    """Concrete, validated representation of a single edge update."""

    operation: Operation
    source: str
    target: str


def parse_update_stream(raw_data: bytes | str) -> List[EdgeUpdate]:
    """Parse a JSON update stream into normalised ``EdgeUpdate`` records.

    The file can be either a JSON array or an object with an ``updates`` field.
    Each entry must provide an operation (add/remove) and the two endpoint IDs.
    """

    if isinstance(raw_data, bytes):
        raw_text = raw_data.decode("utf-8")
    else:
        raw_text = raw_data

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise UpdateStreamError("Update file is not valid JSON") from exc

    if isinstance(payload, dict) and "updates" in payload:
        entries = payload["updates"]
    else:
        entries = payload

    if not isinstance(entries, list):
        raise UpdateStreamError("Expected a JSON array or an object with an 'updates' list")

    def _get_field(entry: Dict, keys: Sequence[str]) -> Optional[str | int]:
        for key in keys:
            if key in entry and entry[key] is not None:
                return entry[key]
        return None

    updates: List[EdgeUpdate] = []
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise UpdateStreamError(f"Update #{idx} is not an object")

        op_token = _get_field(entry, ("operation", "op", "action", "type"))
        if not isinstance(op_token, str):
            raise UpdateStreamError(f"Update #{idx} is missing an operation field (use 'type', 'op', 'operation', or 'action')")

        op_norm = op_token.strip().lower()
        if op_norm in {"add", "addition", "insert", "insertion"}:
            operation: Operation = "add"
        elif op_norm in {"remove", "removal", "delete", "deletion"}:
            operation = "remove"
        else:
            raise UpdateStreamError(f"Update #{idx} has unsupported operation '{op_token}'")

        source = _get_field(entry, ("source", "u", "from"))
        target = _get_field(entry, ("target", "v", "to"))
        if source is None or target is None:
            raise UpdateStreamError(f"Update #{idx} must specify 'source' and 'target'")

        updates.append(
            EdgeUpdate(
                operation=operation,
                source=str(source),
                target=str(target),
            )
        )

    return updates


def apply_edge_updates(summary_output: PoligrasOutput, updates: Sequence[EdgeUpdate]) -> PoligrasOutput:
    """Apply a stream of updates to an existing Poligras summary payload."""

    if not updates:
        return copy.deepcopy(summary_output)

    state = _SummaryDynamicState(summary_output)
    for update in updates:
        state.apply(update)
    return state.materialise()


class _SummaryDynamicState:
    """Mutable helper that tracks summary state while applying updates."""

    def __init__(self, payload: PoligrasOutput):
        artifacts = payload.get("artifacts")
        if not artifacts:
            raise UpdateStreamError("Summary payload is missing artifacts metadata. Regenerate the summary with an updated backend build.")

        supernode_block = artifacts.get("supernodes", {})
        members_raw = supernode_block.get("members")
        node_to_super = supernode_block.get("node_to_supernode")
        if not isinstance(members_raw, dict) or not isinstance(node_to_super, dict):
            raise UpdateStreamError("Summary artifacts do not contain supernode membership information.")

        self.members: Dict[str, List[str]] = {
            str(supernode): [str(node) for node in nodes]
            for supernode, nodes in members_raw.items()
        }
        self.node_to_super: Dict[str, str] = {str(node): str(supernode) for node, supernode in node_to_super.items()}
        self.directed = bool(payload["graphs"]["initial"].get("directed", False))
        self.self_loops = int(artifacts.get("self_loops", 0))

        corrections_raw = artifacts.get("corrections", {}) or {}
        positive_edges = corrections_raw.get("positive", [])
        negative_edges = corrections_raw.get("negative", [])

        self.correction_plus = self._build_edge_index(positive_edges)
        self.correction_minus = self._build_edge_index(negative_edges)
        self.superedges: Set[PairKey] = self._build_superedge_set(payload["graphs"]["summary"].get("edges", []))

        self._base_payload = copy.deepcopy(payload)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def apply(self, update: EdgeUpdate) -> None:
        source = str(update.source)
        target = str(update.target)
        if source == target:
            raise UpdateStreamError("Self-loop updates are not supported in the dynamic summary model.")

        try:
            super_u = self.node_to_super[source]
            super_v = self.node_to_super[target]
        except KeyError as exc:
            raise UpdateStreamError(f"Node '{exc.args[0]}' is not present in the summary membership map.") from exc

        pair_key = self._pair_key(super_u, super_v)
        edge_key = self._edge_key(source, target)

        if update.operation == "add":
            self._apply_addition(pair_key, edge_key, super_u, super_v)
        else:
            self._apply_removal(pair_key, edge_key, super_u, super_v)

    def materialise(self) -> PoligrasOutput:
        payload = self._base_payload
        summary_graph = payload["graphs"]["summary"]
        summary_graph["edges"] = self._build_summary_edges()
        summary_graph["edge_count"] = len(summary_graph["edges"])
        summary_graph["node_count"] = len(summary_graph["nodes"])

        positive_count = sum(len(edges) for edges in self.correction_plus.values())
        negative_count = sum(len(edges) for edges in self.correction_minus.values())
        correction_total = positive_count + negative_count
        summary_graph["correction_edge_count"] = correction_total

        updated_stats = self._build_stats(payload["stats"], positive_count, negative_count)
        payload["stats"] = updated_stats

        artifacts = payload.setdefault("artifacts", {})
        artifacts["supernodes"] = {
            "members": self.members,
            "node_to_supernode": self.node_to_super,
        }
        artifacts["corrections"] = {
            "positive": self._serialise_edges(self.correction_plus.values()),
            "negative": self._serialise_edges(self.correction_minus.values()),
        }
        artifacts["self_loops"] = self.self_loops

        return payload

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _apply_addition(self, pair_key: PairKey, edge_key: EdgeKey, super_u: str, super_v: str) -> None:
        if pair_key in self.superedges:
            neg_edges = self.correction_minus.setdefault(pair_key, set())
            if edge_key in neg_edges:
                neg_edges.remove(edge_key)
                self._log_change(
                    f"Resolved missing edge {edge_key} for superedge {pair_key}; remaining holes: {len(neg_edges)}"
                )
                if not neg_edges:
                    self.correction_minus.pop(pair_key, None)
                    self._log_change(f"Superedge {pair_key} now has no correction-minus entries")
            return

        pos_edges = self.correction_plus.setdefault(pair_key, set())
        if edge_key in pos_edges:
            return
        pos_edges.add(edge_key)
        self._log_change(
            f"Recorded positive correction {edge_key} for pair {pair_key}; total positives: {len(pos_edges)}"
        )

        possible = self._possible_edges(super_u, super_v)
        if possible and len(pos_edges) > possible / 2:
            self._promote_to_superedge(pair_key, super_u, super_v, pos_edges)

    def _apply_removal(self, pair_key: PairKey, edge_key: EdgeKey, super_u: str, super_v: str) -> None:
        if pair_key in self.superedges:
            neg_edges = self.correction_minus.setdefault(pair_key, set())
            if edge_key in neg_edges:
                return
            neg_edges.add(edge_key)
            possible = self._possible_edges(super_u, super_v)
            self._log_change(
                f"Marked missing edge {edge_key} for superedge {pair_key}; missing {len(neg_edges)} of {possible}"
            )

            if possible == 0:
                return
            actual_edges = possible - len(neg_edges)
            if actual_edges <= possible / 2:
                self._demote_superedge(pair_key, super_u, super_v, neg_edges)
            return

        pos_edges = self.correction_plus.get(pair_key)
        if not pos_edges:
            return
        if edge_key not in pos_edges:
            return
        pos_edges.remove(edge_key)
        self._log_change(
            f"Removed positive correction {edge_key} for pair {pair_key}; remaining positives: {len(pos_edges)}"
        )
        if not pos_edges:
            self.correction_plus.pop(pair_key, None)
            self._log_change(f"Pair {pair_key} no longer tracked in positive corrections")

    def _promote_to_superedge(
        self,
        pair_key: PairKey,
        super_u: str,
        super_v: str,
        positive_edges: Set[EdgeKey],
    ) -> None:
        self.superedges.add(pair_key)
        positive_lookup = set(positive_edges)
        missing: Set[EdgeKey] = set()
        for combo in self._iterate_pairs(super_u, super_v):
            edge_candidate = self._edge_key(*combo)
            if edge_candidate not in positive_lookup:
                missing.add(edge_candidate)
        if missing:
            self.correction_minus[pair_key] = missing
        else:
            self.correction_minus.pop(pair_key, None)
        self.correction_plus.pop(pair_key, None)
        total_corrections = sum(len(edges) for edges in self.correction_plus.values()) + \
            sum(len(edges) for edges in self.correction_minus.values())
        self._log_change(
            f"Promoted {pair_key} to superedge; missing edges: {len(self.correction_minus.get(pair_key, set()))}. "
            f"Totals -> superedges: {len(self.superedges)}, corrections: {total_corrections}"
        )

    def _demote_superedge(
        self,
        pair_key: PairKey,
        super_u: str,
        super_v: str,
        negative_edges: Set[EdgeKey],
    ) -> None:
        self.superedges.discard(pair_key)
        positives: Set[EdgeKey] = set()
        for combo in self._iterate_pairs(super_u, super_v):
            edge_candidate = self._edge_key(*combo)
            if edge_candidate not in negative_edges:
                positives.add(edge_candidate)
        if positives:
            self.correction_plus[pair_key] = positives
        else:
            self.correction_plus.pop(pair_key, None)
        self.correction_minus.pop(pair_key, None)
        total_corrections = sum(len(edges) for edges in self.correction_plus.values()) + \
            sum(len(edges) for edges in self.correction_minus.values())
        self._log_change(
            f"Demoted {pair_key} to correction sets; positives retained: {len(self.correction_plus.get(pair_key, set()))}. "
            f"Totals -> superedges: {len(self.superedges)}, corrections: {total_corrections}"
        )

    def _possible_edges(self, super_u: str, super_v: str) -> int:
        size_u = len(self.members[super_u])
        size_v = len(self.members[super_v])
        if super_u == super_v:
            if size_u < 2:
                return 0
            if self.directed:
                return size_u * (size_u - 1)
            return size_u * (size_u - 1) // 2
        if self.directed:
            return size_u * size_v
        return size_u * size_v

    def _iterate_pairs(self, super_u: str, super_v: str) -> Iterable[EdgeKey]:
        nodes_u = self.members[super_u]
        nodes_v = self.members[super_v]
        if super_u == super_v:
            yield from (
                (u, v)
                for u, v in combinations(nodes_u, 2)
            )
        else:
            for u in nodes_u:
                for v in nodes_v:
                    yield (u, v)

    def _log_change(self, message: str) -> None:
        logger.info("[DynamicUpdates] %s", message)

    def _build_summary_edges(self) -> List[SummaryEdge]:
        edges: List[SummaryEdge] = []
        for pair in sorted(self.superedges):
            super_u, super_v = pair
            possible = self._possible_edges(super_u, super_v)
            if possible == 0:
                continue
            missing = len(self.correction_minus.get(pair, set()))
            actual = possible - missing
            density = (actual / possible) if possible else 0.0
            edges.append({
                "source": super_u,
                "target": super_v,
                "weight": float(actual),
                "density": float(density),
            })
        return edges

    def _build_stats(
        self,
        previous_stats: Dict,
        positive_count: Optional[int] = None,
        negative_count: Optional[int] = None,
    ) -> Dict:
        initial_stats = previous_stats.get("initial", {})
        initial_nodes = int(initial_stats.get("nodes", 0))
        initial_edges = int(initial_stats.get("edges", 0))
        summary_supernodes = len(self.members)
        summary_superedges = len(self.superedges)
        if positive_count is None:
            positive_count = sum(len(edges) for edges in self.correction_plus.values())
        if negative_count is None:
            negative_count = sum(len(edges) for edges in self.correction_minus.values())
        correction_total = positive_count + negative_count

        denominator = initial_nodes + initial_edges
        compression_ratio = (summary_supernodes + summary_superedges) / denominator if denominator else 0.0
        total_reward = initial_edges - self.self_loops - summary_superedges - correction_total

        stats = {
            "initial": initial_stats,
            "summary": {
                "supernodes": summary_supernodes,
                "superedges": summary_superedges,
                "correction_edges": correction_total,
            },
            "compression_ratio": compression_ratio,
            "total_reward": total_reward,
            "correction_breakdown": {
                "positive": positive_count,
                "negative": negative_count,
            },
        }
        if summary_supernodes:
            stats["avg_supernode_size"] = initial_nodes / summary_supernodes
        return stats

    def _build_edge_index(self, edges: List[Dict[str, str]]) -> Dict[PairKey, Set[EdgeKey]]:
        index: Dict[PairKey, Set[EdgeKey]] = {}
        for entry in edges:
            raw_source = entry.get("source")
            raw_target = entry.get("target")
            if raw_source is None or raw_target is None:
                continue
            source = str(raw_source)
            target = str(raw_target)
            if source not in self.node_to_super or target not in self.node_to_super:
                continue
            super_u = self.node_to_super[source]
            super_v = self.node_to_super[target]
            pair_key = self._pair_key(super_u, super_v)
            index.setdefault(pair_key, set()).add(self._edge_key(source, target))
        return index

    def _build_superedge_set(self, summary_edges: List[Dict[str, str]]) -> Set[PairKey]:
        pairs: Set[PairKey] = set()
        for edge in summary_edges:
            raw_source = edge.get("source")
            raw_target = edge.get("target")
            if raw_source is None or raw_target is None:
                continue
            source = str(raw_source)
            target = str(raw_target)
            pairs.add(self._pair_key(source, target))
        return pairs

    def _pair_key(self, super_u: str, super_v: str) -> PairKey:
        if self.directed or super_u == super_v:
            return (super_u, super_v)
        return tuple(sorted((super_u, super_v)))  # type: ignore[return-value]

    def _edge_key(self, source: str, target: str) -> EdgeKey:
        if self.directed:
            return (source, target)
        if source <= target:
            return (source, target)
        return (target, source)

    @staticmethod
    def _serialise_edges(edge_sets: Iterable[Set[EdgeKey]]) -> List[Dict[str, str]]:
        serialised: List[Dict[str, str]] = []
        for edge_set in edge_sets:
            for source, target in edge_set:
                serialised.append({"source": source, "target": target})
        serialised.sort(key=lambda item: (item["source"], item["target"]))
        return serialised