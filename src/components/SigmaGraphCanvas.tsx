"use client";

import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { InitialGraph, MergeAction, SummaryGraph } from "@/types";
import { createInitialGraph, applyMergeAction, createSummaryGraph } from "@/lib/graphBuilder";
import forceAtlas2 from "graphology-layout-forceatlas2";

// Apple Design System Dark Mode Colors
const COLORS = {
    node: "#0a84ff",        // systemBlue
    supernode: "#bf5af2",   // systemPurple
    highlighted: "#FFD700", // Yellow - always visible
    edge: "#48484a",        // systemGray
    background: "#1c1c1e",  // Dark background
};

interface SigmaGraphCanvasProps {
    initialGraph: InitialGraph;
    summaryGraph?: SummaryGraph;
    actions: MergeAction[];
    currentStep: number;
    onStepChange?: (step: number) => void;
    onLayoutReady?: () => void;
}

export default function SigmaGraphCanvas({
    initialGraph,
    summaryGraph,
    actions,
    currentStep,
    onLayoutReady,
}: SigmaGraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const baseGraphRef = useRef<Graph | null>(null);
    const lastStepRef = useRef<number>(-1);
    const lastHighlightedRef = useRef<string | null>(null);

    const [sigmaReady, setSigmaReady] = useState(false);

    // 1. Initialize Base Graph & Layout (Run ONCE)
    useEffect(() => {
        if (!initialGraph) return;

        // Create initial graph with circular layout (handled inside createInitialGraph)
        const graph = createInitialGraph(initialGraph);

        // Apply ForceAtlas2 layout for better spacing
        forceAtlas2.assign(graph, {
            iterations: 50,
            settings: {
                gravity: 1,
                scalingRatio: 10,
                strongGravityMode: true,
                slowDown: 10,
                barnesHutOptimize: true,
                barnesHutTheta: 0.5,
            },
        });

        baseGraphRef.current = graph;
        if (onLayoutReady) onLayoutReady();

        return () => { };
    }, [initialGraph, onLayoutReady]);

    // 2. Initialize Sigma
    useEffect(() => {
        if (!containerRef.current || !baseGraphRef.current) return;

        const graphMetadata = baseGraphRef.current.export();
        const graph = new Graph();
        graph.import(graphMetadata);

        const sigma = new Sigma(graph, containerRef.current, {
            renderLabels: false, // DISABLED for performance
            labelRenderedSizeThreshold: 100, // Very high to prevent any label rendering
            labelSize: 12,
            labelColor: { color: "#ffffff" },
            defaultNodeColor: COLORS.node,
            defaultEdgeColor: COLORS.edge,
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
            zIndex: false, // DISABLED for performance (sorting is expensive)
            allowInvalidContainer: true,
        });

        sigmaRef.current = sigma;

        // Hover events
        let hoveredNode: string | null = null;
        sigma.on("enterNode", ({ node }) => {
            hoveredNode = node;
            sigma.getGraph().setNodeAttribute(node, "highlighted", true);
            sigma.refresh();
        });

        sigma.on("leaveNode", ({ node }) => {
            if (hoveredNode === node) {
                hoveredNode = null;
                sigma.getGraph().setNodeAttribute(node, "highlighted", false);
                sigma.refresh();
            }
        });

        lastStepRef.current = -1;
        lastHighlightedRef.current = null;
        setSigmaReady(true);

        return () => {
            sigma.kill();
            sigmaRef.current = null;
            setSigmaReady(false);
        };
    }, [initialGraph]);

    // 3. Handle Step Updates (Incremental / Jump)
    useEffect(() => {
        const sigma = sigmaRef.current;
        const baseGraph = baseGraphRef.current;

        if (!sigma) return;

        const graph = sigma.getGraph();
        const prevStep = lastStepRef.current;

        // Helper to update visuals for a SINGLE node (O(1))
        const updateSingleNodeVisuals = (node: string) => {
            if (!graph.hasNode(node)) return;

            const weight = graph.getNodeAttribute(node, "weight") || 1;
            const isHighlighted = graph.getNodeAttribute(node, "isHighlighted");
            const visualSize = Math.min(2 + Math.log(weight) * 1.5, 8);

            if (isHighlighted) {
                graph.setNodeAttribute(node, "color", COLORS.highlighted);
                graph.setNodeAttribute(node, "zIndex", 1000);
                graph.setNodeAttribute(node, "size", visualSize * 3);
            } else if (weight > 1) {
                graph.setNodeAttribute(node, "color", COLORS.supernode);
                graph.setNodeAttribute(node, "zIndex", 10);
                graph.setNodeAttribute(node, "size", visualSize);
            } else {
                graph.setNodeAttribute(node, "color", COLORS.node);
                graph.setNodeAttribute(node, "zIndex", 1);
                graph.setNodeAttribute(node, "size", 2);
            }
        };

        // Helper to update ALL visuals (O(N))
        const updateAllVisuals = () => {
            graph.forEachNode((node) => {
                updateSingleNodeVisuals(node);
            });
        };

        // OPTIMIZATION: Jump to End (Summary State)
        // Only trigger jump-to-end optimization when coming from far away (not adjacent steps)
        const isJumpToEnd = currentStep === actions.length && prevStep < actions.length - 1;

        if (summaryGraph && isJumpToEnd && baseGraph) {
            console.log(`[Canvas] Jump to end: using summary graph with ${summaryGraph.nodes.length} nodes, ${summaryGraph.edges.length} edges`);
            // Pass baseGraph to preserve original node positions
            const finalGraph = createSummaryGraph(summaryGraph, baseGraph);

            // Run fewer iterations since we're starting from original positions
            forceAtlas2.assign(finalGraph, {
                iterations: 100, // Reduced since we have better starting positions
                settings: {
                    gravity: 1,
                    scalingRatio: 10,
                    strongGravityMode: true,
                    slowDown: 10,
                    barnesHutOptimize: true,
                    barnesHutTheta: 0.5,
                },
            });

            graph.clear();
            graph.import(finalGraph.export());

            updateAllVisuals();
            sigma.refresh();
            lastStepRef.current = currentStep;
            lastHighlightedRef.current = null;
            return;
        }

        // Forward Play - SYNCHRONOUS single step processing
        if (currentStep > prevStep) {
            console.log(`[Canvas] Forward: ${prevStep} -> ${currentStep}`);
            
            // Remove previous highlight
            if (lastHighlightedRef.current && graph.hasNode(lastHighlightedRef.current)) {
                graph.setNodeAttribute(lastHighlightedRef.current, "isHighlighted", false);
                updateSingleNodeVisuals(lastHighlightedRef.current);
            }
            
            if (currentStep === 0) {
                // Step 0: Just base graph, no actions applied
                lastHighlightedRef.current = null;
            } else {
                // Apply the action for this step (currentStep is 1-indexed)
                // Step 1 means apply actions[0], Step 2 means apply actions[1], etc.
                const actionIndex = currentStep - 1;
                if (actionIndex >= 0 && actionIndex < actions.length) {
                    const action = actions[actionIndex];
                    const affected = applyMergeAction(graph, action);

                    // Update visuals only for affected nodes
                    affected.forEach((node) => {
                        if (graph.hasNode(node)) updateSingleNodeVisuals(node);
                    });

                    // Highlight the merged node
                    const n1 = String(action.n1);
                    if (graph.hasNode(n1)) {
                        graph.setNodeAttribute(n1, "isHighlighted", true);
                        updateSingleNodeVisuals(n1);
                        lastHighlightedRef.current = n1;
                    }
                }
            }
        }
        // Seek / Jump / Rewind (Backward Movement ONLY)
        else if (currentStep < prevStep) {
            if (!baseGraph) {
                console.warn("[Sigma] Cannot seek: BaseGraph is missing");
                return;
            }

            graph.clear();
            graph.import(baseGraph.export());

            for (let i = 0; i <= currentStep && i < actions.length; i++) {
                applyMergeAction(graph, actions[i]);
            }

            lastHighlightedRef.current = null;

            if (currentStep >= 0 && currentStep < actions.length) {
                const lastAction = actions[currentStep];
                const n1 = String(lastAction.n1);
                if (graph.hasNode(n1)) {
                    graph.setNodeAttribute(n1, "isHighlighted", true);
                    lastHighlightedRef.current = n1;
                }
            }

            updateAllVisuals();
        }

        const beforeRefresh = performance.now();
        sigma.refresh();
        console.log(`[Canvas] sigma.refresh() took: ${(performance.now() - beforeRefresh).toFixed(1)}ms`);
        lastStepRef.current = currentStep;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, actions.length, sigmaReady]);

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl p-3 text-white text-xs pointer-events-none">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.node }} />
                        <span>Single Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.supernode }} />
                        <span>Supernode</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.highlighted }} />
                        <span>Just Merged</span>
                    </div>
                </div>
            </div>

            {/* Canvas container */}
            <div
                ref={containerRef}
                className="flex-1 w-full min-h-[500px] lg:min-h-0"
                style={{
                    backgroundColor: COLORS.background,
                }}
            />
        </div>
    );
}
