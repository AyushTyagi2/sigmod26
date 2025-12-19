"use client";

import React, { useEffect, useRef, useCallback } from "react";
import cytoscape, { Core, NodeSingular } from "cytoscape";
import { GraphStep } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const coseBilkent = require("cytoscape-cose-bilkent");

if (typeof cytoscape("core", "coseBilkent") === "undefined") {
    cytoscape.use(coseBilkent);
}

interface GraphCanvasProps {
    step: GraphStep;
    showCorrections: boolean;
}

// Apple Design System Dark Mode Colors
const COLORS = {
    node: "#0a84ff",        // systemBlue
    nodeBorder: "#0077ed",
    supernode: "#bf5af2",   // systemPurple
    supernodeBorder: "#a855f7",
    highlighted: "#ff9f0a", // systemOrange - for newly merged
    highlightedBorder: "#f59e0b",
    edge: "#636366",        // systemGray
    positive: "#ff453a",    // systemRed
    negative: "#ff9f0a",    // systemOrange
    background: "#1c1c1e",  // Dark background
};

function getNodeColors(isSuper: boolean, isHighlighted: boolean) {
    if (isHighlighted) {
        return { color: COLORS.highlighted, border: COLORS.highlightedBorder };
    }
    if (isSuper) {
        return { color: COLORS.supernode, border: COLORS.supernodeBorder };
    }
    return { color: COLORS.node, border: COLORS.nodeBorder };
}

export default function GraphCanvas({ step, showCorrections }: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);
    const previousPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            style: [
                {
                    selector: "node",
                    style: {
                        shape: "ellipse",
                        "background-color": "data(color)",
                        "background-opacity": 1,
                        "border-width": 2,
                        "border-color": "data(borderColor)",
                        label: "data(label)",
                        "font-family": "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                        "font-size": "12px",
                        "font-weight": 600,
                        "text-valign": "center",
                        "text-halign": "center",
                        color: "#ffffff",
                        "text-outline-color": "data(color)",
                        "text-outline-width": 2,
                        width: "data(size)",
                        height: "data(size)",
                        "transition-property": "background-color, border-color, width, height",
                        "transition-duration": 150,
                    },
                },
                {
                    selector: "node.supernode",
                    style: {
                        shape: "round-rectangle",
                        "border-width": 2.5,
                    },
                },
                {
                    selector: "node.highlighted",
                    style: {
                        "border-width": 3,
                        "shadow-blur": 15,
                        "shadow-color": COLORS.highlighted,
                        "shadow-opacity": 0.5,
                        "shadow-offset-x": 0,
                        "shadow-offset-y": 0,
                        "z-index": 999,
                    },
                },
                {
                    selector: "edge.superedge",
                    style: {
                        "line-color": COLORS.edge,
                        "curve-style": "bezier",
                        width: "data(width)",
                        opacity: 0.6,
                        "line-cap": "round",
                        "transition-property": "opacity, line-color",
                        "transition-duration": 150,
                    },
                },
                {
                    selector: "edge.highlighted-edge",
                    style: {
                        opacity: 0.9,
                        "line-color": "#8e8e93",
                    },
                },
                {
                    selector: "edge.positive-correction",
                    style: {
                        "line-color": COLORS.positive,
                        "line-style": "dashed",
                        "line-dash-pattern": [8, 4],
                        "curve-style": "bezier",
                        width: 2,
                        opacity: 0.7,
                    },
                },
                {
                    selector: "edge.negative-correction",
                    style: {
                        "line-color": COLORS.negative,
                        "line-style": "dotted",
                        "line-dash-pattern": [4, 4],
                        "curve-style": "bezier",
                        width: 2,
                        opacity: 0.7,
                    },
                },
            ],
            layout: { name: "preset" },
            wheelSensitivity: 0.2,
            minZoom: 0.3,
            maxZoom: 3,
            boxSelectionEnabled: false,
        });

        cyRef.current = cy;

        cy.on("mouseover", "node", (e) => {
            const node = e.target as NodeSingular;
            node.connectedEdges().addClass("highlighted-edge");
        });

        cy.on("mouseout", "node", (e) => {
            const node = e.target as NodeSingular;
            node.connectedEdges().removeClass("highlighted-edge");
        });

        return () => {
            cy.destroy();
        };
    }, []);

    const updateGraph = useCallback(() => {
        const cy = cyRef.current;
        if (!cy) return;

        const elements: cytoscape.ElementDefinition[] = [];
        const nodeIds = new Set(step.nodes.map((n) => n.id));

        cy.nodes().forEach((node) => {
            previousPositionsRef.current.set(node.id(), node.position());
        });

        const maxVertexCount = Math.max(...step.nodes.map((n) => n.vertex_count), 1);

        step.nodes.forEach((node) => {
            const previousPos = previousPositionsRef.current.get(node.id);
            const normalizedSize = node.vertex_count / maxVertexCount;
            const size = 30 + normalizedSize * 35 + Math.log(node.vertex_count + 1) * 7;
            const cappedSize = Math.min(size, 90);

            const isSuper = node.vertex_count > 1;
            const colors = getNodeColors(isSuper, node.is_new_merge);

            elements.push({
                data: {
                    id: node.id,
                    label: node.vertex_count > 1 ? `${node.vertex_count}` : "",
                    size: cappedSize,
                    color: colors.color,
                    borderColor: colors.border,
                },
                position: previousPos || {
                    x: Math.random() * 500 + 50,
                    y: Math.random() * 400 + 50,
                },
                classes: [
                    node.is_new_merge ? "highlighted" : "",
                    isSuper ? "supernode" : "",
                ].filter(Boolean).join(" "),
            });
        });

        const maxDensity = Math.max(...step.edges.map((e) => e.density), 0.1);

        step.edges.forEach((edge, idx) => {
            if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
                const normalizedWidth = (edge.density / maxDensity) * 3.5 + 1;
                elements.push({
                    data: {
                        id: `edge-${idx}`,
                        source: edge.source,
                        target: edge.target,
                        width: Math.max(1, Math.min(normalizedWidth, 6)),
                    },
                    classes: "superedge",
                });
            }
        });

        if (showCorrections) {
            step.corrections.positive.forEach((pair, idx) => {
                if (nodeIds.has(pair[0]) && nodeIds.has(pair[1])) {
                    elements.push({
                        data: { id: `pos-corr-${idx}`, source: pair[0], target: pair[1] },
                        classes: "positive-correction",
                    });
                }
            });

            step.corrections.negative.forEach((pair, idx) => {
                if (nodeIds.has(pair[0]) && nodeIds.has(pair[1])) {
                    elements.push({
                        data: { id: `neg-corr-${idx}`, source: pair[0], target: pair[1] },
                        classes: "negative-correction",
                    });
                }
            });
        }

        cy.elements().remove();
        cy.add(elements);

        if (step.step_id === 0 || previousPositionsRef.current.size === 0) {
            cy.layout({
                name: "cose-bilkent",
                animate: "end",
                animationDuration: 500,
                nodeDimensionsIncludeLabels: true,
                idealEdgeLength: 100,
                nodeRepulsion: 5500,
                edgeElasticity: 0.4,
                gravity: 0.22,
                numIter: 2200,
                tile: true,
                randomize: false,
                fit: true,
                padding: 50,
            } as cytoscape.LayoutOptions).run();
        } else {
            cy.fit(undefined, 50);
        }
    }, [step, showCorrections]);

    useEffect(() => {
        updateGraph();
    }, [updateGraph]);

    return (
        <div className="relative w-full h-full">
            <div
                ref={containerRef}
                className="w-full h-full rounded-2xl border border-[#3a3a3c]"
                style={{
                    minHeight: "400px",
                    backgroundColor: COLORS.background,
                }}
            />
        </div>
    );
}
