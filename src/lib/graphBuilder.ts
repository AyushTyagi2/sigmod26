"use client";

import Graph from "graphology";
import { InitialGraph, MergeAction } from "@/types";

/**
 * Applies circular layout to all nodes in the graph
 * This ensures consistent positioning for both initial and summary graphs
 */
function applyCircularLayout(graph: Graph, radius: number = 400): void {
    const nodeCount = graph.order;
    let index = 0;
    
    graph.forEachNode((node) => {
        const angle = (2 * Math.PI * index) / nodeCount;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        graph.setNodeAttribute(node, "x", x);
        graph.setNodeAttribute(node, "y", y);
        index++;
    });
}

export function createInitialGraph(initialGraph: InitialGraph): Graph {
    const graph = new Graph({ type: "undirected", multi: false });

    // Add all nodes from initial graph
    initialGraph.nodes.forEach((node) => {
        graph.addNode(String(node.id), {
            label: String(node.id),
            weight: 1, // Logical weight (number of merged nodes)
            size: 2,   // Visual size (pixels), defaults to small
            degree: node.degree,
            // x, y will be set by circular layout below
            color: "#0a84ff", // Apple blue
        });
    });

    // Apply circular layout AFTER all nodes are added
    applyCircularLayout(graph, 400);

    // ... (edges remain same)
    initialGraph.edges.forEach((edge) => {
        const sourceId = String(edge.source);
        const targetId = String(edge.target);

        if (graph.hasNode(sourceId) && graph.hasNode(targetId)) {
            const edgeKey = `${sourceId}-${targetId}`;
            if (!graph.hasEdge(edgeKey) && !graph.hasEdge(`${targetId}-${sourceId}`)) {
                graph.addEdge(sourceId, targetId, {
                    weight: edge.weight,
                    color: "#636366",
                });
            }
        }
    });

    console.log(`[createInitialGraph] Created initial graph: ${graph.order} nodes, ${graph.size} edges`);
    return graph;
}

/**
 * Converts the summary graph from JSON format to a Graphology graph
 * Uses the SAME circular layout logic as initial graph for consistency
 * @param summaryGraph - The summary graph data
 * @param initialGraph - Not used anymore, kept for API compatibility
 */
export function createSummaryGraph(
    summaryGraph: { nodes: any[]; edges: any[] },
    initialGraph?: Graph
): Graph {
    const graph = new Graph({ type: "undirected", multi: false });

    // Add all nodes from summary graph (no positioning yet)
    summaryGraph.nodes.forEach((node) => {
        const nodeId = String(node.id);
        
        graph.addNode(nodeId, {
            label: nodeId,
            weight: node.size, // Used for logical weight
            size: 3,           // Visual size placeholder (updated by canvas)
            // x, y will be set by circular layout below
            color: node.size > 1 ? "#bf5af2" : "#0a84ff",
        });
    });

    // Apply the SAME circular layout as initial graph
    applyCircularLayout(graph, 400);

    // Add all edges
    let skippedEdges = 0;
    summaryGraph.edges.forEach((edge, idx) => {
        const sourceId = String(edge.source);
        const targetId = String(edge.target);

        if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) {
            skippedEdges++;
            if (idx < 5) { // Log first few for debugging
                console.warn(`[createSummaryGraph] Edge skipped: ${sourceId} -> ${targetId} (node missing)`);
            }
            return;
        }

        // Skip self-loops
        if (sourceId === targetId) {
            return;
        }

        try {
            // Check if edge already exists (for undirected graphs)
            if (!graph.hasEdge(sourceId, targetId) && !graph.hasEdge(targetId, sourceId)) {
                graph.addEdge(sourceId, targetId, {
                    weight: edge.weight,
                    color: "#636366",
                });
            }
        } catch (err) {
            if (idx < 5) {
                console.warn(`[createSummaryGraph] Failed to add edge ${sourceId} -> ${targetId}:`, err);
            }
        }
    });
    
    if (skippedEdges > 0) {
        console.warn(`[createSummaryGraph] Skipped ${skippedEdges} edges due to missing nodes`);
    }

    // Check for isolated nodes (nodes with no edges)
    let isolatedCount = 0;
    graph.forEachNode((node) => {
        if (graph.degree(node) === 0) {
            isolatedCount++;
            if (isolatedCount <= 3) { // Log first few
                console.warn(`[createSummaryGraph] Node ${node} is isolated (no edges)`);
            }
        }
    });
    
    if (isolatedCount > 0) {
        console.warn(
            `[createSummaryGraph] Found ${isolatedCount} isolated nodes. ` +
            `This may indicate missing edges in the summary graph data.`
        );
    }

    console.log(`[createSummaryGraph] Created graph with circular layout: ${graph.order} nodes, ${graph.size} edges`);
    return graph;
}

export function applyMergeAction(graph: Graph, action: MergeAction): Set<string> {
    const affectedNodes = new Set<string>();
    const n1 = String(action.n1);
    const n2 = String(action.n2);

    if (!graph.hasNode(n1) || !graph.hasNode(n2)) {
        console.warn(`[Graph] Merge FAILED. Missing nodes: ${n1} (Has=${graph.hasNode(n1)}) or ${n2} (Has=${graph.hasNode(n2)})`);
        return affectedNodes;
    }

    // n1 is always affected (it's the merge target)
    affectedNodes.add(n1);

    // Get current weights (logical size) and positions
    const weight1 = graph.getNodeAttribute(n1, "weight") || 1;
    const weight2 = graph.getNodeAttribute(n2, "weight") || 1;
    const x1 = graph.getNodeAttribute(n1, "x") || 0;
    const y1 = graph.getNodeAttribute(n1, "y") || 0;
    const x2 = graph.getNodeAttribute(n2, "x") || 0;
    const y2 = graph.getNodeAttribute(n2, "y") || 0;

    // Calculate new position (weighted centroid based on logical weight)
    const totalWeight = weight1 + weight2;
    const newX = (x1 * weight1 + x2 * weight2) / totalWeight;
    const newY = (y1 * weight1 + y2 * weight2) / totalWeight;

    // Update n1 with new weight and position
    graph.setNodeAttribute(n1, "weight", totalWeight);
    graph.setNodeAttribute(n1, "x", newX);
    graph.setNodeAttribute(n1, "y", newY);
    graph.setNodeAttribute(n1, "color", "#bf5af2"); // Purple for supernodes
    graph.setNodeAttribute(n1, "isHighlighted", true);

    // Transfer all edges from n2 to n1
    graph.forEachEdge(n2, (edge, attrs, source, target) => {
        const otherNode = source === n2 ? target : source;
        if (otherNode === n1) return;

        // Track neighbors as affected (their edge structure changed)
        affectedNodes.add(otherNode);

        if (graph.hasEdge(n1, otherNode) || graph.hasEdge(otherNode, n1)) {
            const existingEdge = graph.hasEdge(n1, otherNode)
                ? graph.edge(n1, otherNode)
                : graph.edge(otherNode, n1);
            if (existingEdge) {
                const existingWeight = graph.getEdgeAttribute(existingEdge, "weight") || 1;
                graph.setEdgeAttribute(existingEdge, "weight", existingWeight + (attrs.weight || 1));
            }
        } else {
            try {
                graph.addEdge(n1, otherNode, { weight: attrs.weight || 1, color: "#636366" });
            } catch { }
        }
    });

    graph.dropNode(n2);
    return affectedNodes;
}

// ... (buildGraphAtStep can remain similar, just calls applyMergeAction)
export function buildGraphAtStep(
    initialGraph: InitialGraph,
    actions: MergeAction[],
    stepIndex: number
): Graph {
    const graph = createInitialGraph(initialGraph);
    const actionsToApply = actions.slice(0, stepIndex + 1);

    graph.forEachNode((node) => {
        graph.setNodeAttribute(node, "isHighlighted", false);
    });

    actionsToApply.forEach((action, idx) => {
        applyMergeAction(graph, action); // Uses new logic
        if (idx === actionsToApply.length - 1 && graph.hasNode(action.n1)) {
            graph.setNodeAttribute(action.n1, "isHighlighted", true);
        } else if (graph.hasNode(action.n1)) {
            graph.setNodeAttribute(action.n1, "isHighlighted", false);
        }
    });

    return graph;
}


export function calculateNodeSize(vertexCount: number, maxVertexCount: number): number {
    // Tuning visual size:
    // Base: 2px (small dots)
    // Max: 15px (not too huge)
    // Logarithmic scale helps with power-law distributions
    const normalizedSize = vertexCount / Math.max(maxVertexCount, 1);

    // Scale primarily by log(count) to avoid huge balls
    // If count=1, size=2
    // If count=1000, size shouldn't be 1000x
    const size = 2 + Math.log(vertexCount) * 2 + (normalizedSize * 5);

    return Math.min(size, 20);
}

export function getGraphStats(graph: Graph): {
    nodeCount: number;
    edgeCount: number;
    maxSize: number;
    avgSize: number;
} {
    let totalWeight = 0;
    let maxWeight = 0;

    graph.forEachNode((node) => {
        const weight = graph.getNodeAttribute(node, "weight") || 1;
        totalWeight += weight;
        maxWeight = Math.max(maxWeight, weight);
    });

    return {
        nodeCount: graph.order,
        edgeCount: graph.size,
        maxSize: maxWeight, // Rename property semantics or keeping name
        avgSize: graph.order > 0 ? totalWeight / graph.order : 0,
    };
}
