/**
 * Converter: PoligrasOutput (spec format) → GraphStep[] (animation format)
 * 
 * This module bridges the standardized PoligrasOutput format (meta, stats, graphs)
 * with the frontend's animation model (step-by-step visualization).
 * 
 * Since PoligrasOutput only contains initial and summary snapshots,
 * we synthesize intermediate steps by simulating merges based on supernode sizes.
 */

import { PoligrasOutput, GraphStep } from "@/types";

/**
 * Convert PoligrasOutput to animation steps for visualization
 * @param output - The standardized Poligras output
 * @returns Array of GraphStep objects for animation
 */
export function convertPoligrasOutputToSteps(output: PoligrasOutput): GraphStep[] {
    const initialGraph = output.graphs.initial;
    const summaryGraph = output.graphs.summary;
    const stats = output.stats;

    // Build a mapping of supernode IDs to their member nodes
    const supernodeMembers = new Map<string, number[]>();
    const supernodeSizes = new Map<string, number>();

    // For initial nodes, map them to their containing supernodes
    // Since we don't have explicit membership from the API,
    // we infer from the summary graph structure
    summaryGraph.nodes.forEach((sn) => {
        supernodeSizes.set(sn.id, sn.size);
        supernodeMembers.set(sn.id, []);
    });

    // Simple heuristic: distribute initial nodes to supernodes based on sizes
    let nodeIndex = 0;
    summaryGraph.nodes.forEach((sn) => {
        const members: number[] = [];
        for (let i = 0; i < sn.size && nodeIndex < initialGraph.node_count; i++) {
            members.push(nodeIndex);
            nodeIndex++;
        }
        supernodeMembers.set(sn.id, members);
    });

    // Create animation steps
    const steps: GraphStep[] = [];

    // Step 0: Full initial graph (or sampled if too large)
    const initialStep: GraphStep = {
        step_id: 0,
        nodes: initialGraph.nodes.map((node) => ({
            id: String(node.id),
            label: `N${node.id}`,
            vertex_count: 1,
            is_new_merge: false,
        })),
        edges: initialGraph.edges.map((edge) => ({
            source: String(edge.source),
            target: String(edge.target),
            weight: edge.weight,
            density: 0, // Will be recalculated from context
        })),
        corrections: {
            positive: [],
            negative: [],
        },
        action_metadata: {
            merged_pair: ["", ""],
            reward: 0,
        },
    };
    steps.push(initialStep);

    // Generate intermediate steps by simulating merges
    // Sort supernodes by size (largest first) for natural progression
    const sortedSupernodes = Array.from(supernodeSizes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

    let cumulativeReward = 0;

    for (let stepIdx = 1; stepIdx <= sortedSupernodes.length; stepIdx++) {
        const currentSupernodeId = sortedSupernodes[stepIdx - 1];
        const mergedMembers = supernodeMembers.get(currentSupernodeId) || [];

        // Calculate compression and reward for this step
        const nodesRemoved = mergedMembers.length - 1;
        const stepReward = estimateStepReward(
            initialGraph,
            summaryGraph,
            cumulativeReward,
            stats.total_reward,
            stepIdx,
            sortedSupernodes.length
        );
        cumulativeReward += stepReward;

        // Build nodes for this step
        // Regular nodes + supernodes created so far
        const stepNodes = initialGraph.nodes
            .filter((n) => !isNodeMerged(n.id, supernodeMembers, stepIdx, sortedSupernodes))
            .map((n) => ({
                id: String(n.id),
                label: `N${n.id}`,
                vertex_count: 1,
                is_new_merge: false,
            }));

        // Add created supernodes
        for (let i = 0; i < stepIdx; i++) {
            const snId = sortedSupernodes[i];
            const snSize = supernodeSizes.get(snId) || 1;
            stepNodes.push({
                id: snId,
                label: snId,
                vertex_count: snSize,
                is_new_merge: i === stepIdx - 1, // Highlight the most recently created supernode
            });
        }

        // Build edges for this step
        const stepEdges = buildStepEdges(
            initialGraph.edges,
            summaryGraph.edges,
            supernodeMembers,
            stepIdx,
            sortedSupernodes
        );

        // Estimate correction edges
        const estimatedCorrections = estimateCorrectionEdges(
            stats,
            stepIdx,
            sortedSupernodes.length
        );

        const step: GraphStep = {
            step_id: stepIdx,
            nodes: stepNodes,
            edges: stepEdges,
            corrections: estimatedCorrections,
            action_metadata: {
                merged_pair: [
                    stepIdx > 1 ? sortedSupernodes[stepIdx - 2] : "",
                    currentSupernodeId,
                ],
                reward: stepReward,
            },
        };

        steps.push(step);
    }

    return steps;
}

/**
 * Check if a node has been merged into a supernode by this step
 */
function isNodeMerged(
    nodeId: number,
    supernodeMembers: Map<string, number[]>,
    upToStep: number,
    sortedSupernodes: string[]
): boolean {
    for (let i = 0; i < upToStep; i++) {
        const snId = sortedSupernodes[i];
        const members = supernodeMembers.get(snId) || [];
        if (members.includes(nodeId)) {
            return true;
        }
    }
    return false;
}

/**
 * Estimate reward for a step based on overall compression progress
 */
function estimateStepReward(
    initialGraph: PoligrasOutput["graphs"]["initial"],
    summaryGraph: PoligrasOutput["graphs"]["summary"],
    cumulativeSoFar: number,
    totalReward: number,
    currentStep: number,
    totalSteps: number
): number {
    // Distribute total reward proportionally across steps
    const remainingReward = totalReward - cumulativeSoFar;
    const remainingSteps = totalSteps - currentStep + 1;
    return Math.round(remainingReward / Math.max(1, remainingSteps));
}

/**
 * Build edges for an intermediate step
 */
function buildStepEdges(
    initialEdges: PoligrasOutput["graphs"]["initial"]["edges"],
    summaryEdges: PoligrasOutput["graphs"]["summary"]["edges"],
    supernodeMembers: Map<string, number[]>,
    currentStep: number,
    sortedSupernodes: string[]
): GraphStep["edges"] {
    const activeSupernodesSet = new Set(sortedSupernodes.slice(0, currentStep));
    const stepEdges: GraphStep["edges"] = [];
    const seenPairs = new Set<string>();

    // Add summary edges for created supernodes
    summaryEdges.forEach((sedge) => {
        if (
            activeSupernodesSet.has(sedge.source) &&
            activeSupernodesSet.has(sedge.target)
        ) {
            const key = [sedge.source, sedge.target].sort().join("-");
            if (!seenPairs.has(key)) {
                seenPairs.add(key);
                const density = sedge.density ?? 0;
                stepEdges.push({
                    source: sedge.source,
                    target: sedge.target,
                    weight: sedge.weight,
                    density,
                });
            }
        }
    });

    // Add initial edges between unmerged nodes
    initialEdges.forEach((edge) => {
        const sourceId = String(edge.source);
        const targetId = String(edge.target);
        const sourceMerged = isMerged(edge.source, supernodeMembers, currentStep, sortedSupernodes);
        const targetMerged = isMerged(edge.target, supernodeMembers, currentStep, sortedSupernodes);

        if (!sourceMerged && !targetMerged) {
            const key = [sourceId, targetId].sort().join("-");
            if (!seenPairs.has(key)) {
                seenPairs.add(key);
                stepEdges.push({
                    source: sourceId,
                    target: targetId,
                    weight: edge.weight,
                    density: 0,
                });
            }
        }
    });

    return stepEdges;
}

/**
 * Helper: Check if a node is merged by current step
 */
function isMerged(
    nodeId: number,
    supernodeMembers: Map<string, number[]>,
    upToStep: number,
    sortedSupernodes: string[]
): boolean {
    for (let i = 0; i < upToStep; i++) {
        const members = supernodeMembers.get(sortedSupernodes[i]) || [];
        if (members.includes(nodeId)) {
            return true;
        }
    }
    return false;
}

/**
 * Estimate correction edges for a step based on overall stats
 */
function estimateCorrectionEdges(
    stats: PoligrasOutput["stats"],
    currentStep: number,
    totalSteps: number
): GraphStep["corrections"] {
    const breakdownTotal = (stats.correction_breakdown?.positive ?? 0) +
        (stats.correction_breakdown?.negative ?? 0);
    
    const progressRatio = currentStep / totalSteps;
    const estimatedPositive = Math.round(
        (stats.correction_breakdown?.positive ?? 0) * progressRatio
    );
    const estimatedNegative = Math.round(
        (stats.correction_breakdown?.negative ?? 0) * progressRatio
    );

    return {
        positive: Array(estimatedPositive)
            .fill(null)
            .map((_, i) => [`n${i}`, `n${i + 1}`]),
        negative: Array(estimatedNegative)
            .fill(null)
            .map((_, i) => [`m${i}`, `m${i + 1}`]),
    };
}
