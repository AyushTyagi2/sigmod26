"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import ControlPanel from "@/components/ControlPanel";
import MetricsPanel from "@/components/MetricsPanel";
import { MOCK_DATASETS, MOCK_STEPS_MAP } from "@/lib/mockData";
import { convertPoligrasOutputToSteps } from "@/lib/poligrasConverter";
import { PoligrasOutput, GraphStep } from "@/types";

const GraphCanvas = dynamic(() => import("@/components/GraphCanvas"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-[#1c1c1e] rounded-2xl flex items-center justify-center">
            <div className="text-[#86868b]">Loading graph...</div>
        </div>
    ),
});

export default function VisualizationPage() {
    const [selectedDatasetId, setSelectedDatasetId] = useState(MOCK_DATASETS[0].id);
    const [steps, setSteps] = useState<GraphStep[]>(MOCK_STEPS_MAP[MOCK_DATASETS[0].id]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showCorrections, setShowCorrections] = useState(true);
    const [isLoadingRealData, setIsLoadingRealData] = useState(false);

    const selectedDataset =
        MOCK_DATASETS.find((d) => d.id === selectedDatasetId) || MOCK_DATASETS[0];

    useEffect(() => {
        // Try to load real data from session storage if available
        const lastDatasetId = sessionStorage.getItem("lastDatasetId");
        const poligrasOutput = sessionStorage.getItem("poligrasOutput");
        
        if (lastDatasetId && poligrasOutput) {
            try {
                const output: PoligrasOutput = JSON.parse(poligrasOutput);
                const convertedSteps = convertPoligrasOutputToSteps(output);
                if (convertedSteps.length > 0) {
                    setSteps(convertedSteps);
                    setSelectedDatasetId(lastDatasetId);
                    setCurrentStep(0);
                    setIsLoadingRealData(true);
                    // Clear from session storage to avoid reusing stale data
                    sessionStorage.removeItem("poligrasOutput");
                }
            } catch (error) {
                console.error("Failed to load real data:", error);
            }
        }
    }, []);

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            setCurrentStep((prev) => {
                if (prev >= steps.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1200);
        return () => clearInterval(interval);
    }, [isPlaying, steps.length]);

    const handleDatasetChange = useCallback((id: string) => {
        setSelectedDatasetId(id);
        setCurrentStep(0);
        setIsPlaying(false);
        // Load the correct dataset's steps
        setSteps(MOCK_STEPS_MAP[id] || MOCK_STEPS_MAP["astro-ph"]);
        setIsLoadingRealData(false);
    }, []);

    const handleReset = useCallback(() => {
        setCurrentStep(0);
        setIsPlaying(false);
    }, []);

    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => !prev);
    }, []);

    const handleToggleCorrections = useCallback(() => {
        setShowCorrections((prev) => !prev);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-[#000000] overflow-hidden">
            {/* Header - Apple style nav */}
            <header className="flex-shrink-0 bg-[#1d1d1f]/80 backdrop-blur-xl border-b border-[#424245] px-6 py-3">
                <div className="max-w-[1680px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#0077ed] to-[#0066cc] flex items-center justify-center">
                                <span className="text-white font-semibold text-base">P</span>
                            </div>
                            <div>
                                <h1 className="text-[17px] font-semibold text-[#f5f5f7] tracking-[-0.01em]">
                                    Poligras
                                </h1>
                                <p className="text-[11px] text-[#86868b]">
                                    Graph Summarization
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-8 text-[13px]">
                        <div>
                            <span className="text-[#86868b]">Dataset:</span>
                            <span className="text-[#f5f5f7] ml-2 font-medium">{selectedDataset.name}</span>
                        </div>
                        {/* <div>
                            <span className="text-[#86868b]">Nodes:</span>
                            <span className="text-[#f5f5f7] ml-2 font-medium tabular-nums">{selectedDataset.nodeCount.toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-[#86868b]">Edges:</span>
                            <span className="text-[#f5f5f7] ml-2 font-medium tabular-nums">{selectedDataset.edgeCount.toLocaleString()}</span>
                        </div> */}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-0 p-5 gap-4 max-w-[1680px] mx-auto w-full">
                {/* Controls */}
                <div className="flex-shrink-0">
                    <ControlPanel
                        datasets={MOCK_DATASETS}
                        selectedDatasetId={selectedDatasetId}
                        onDatasetChange={handleDatasetChange}
                        currentStep={currentStep}
                        maxSteps={steps.length}
                        onStepChange={setCurrentStep}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                        onReset={handleReset}
                        showCorrections={showCorrections}
                        onToggleCorrections={handleToggleCorrections}
                    />
                </div>

                {/* Graph + Metrics */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
                    <div className="lg:col-span-3 min-h-0">
                        {steps[currentStep] && (
                            <GraphCanvas
                                step={steps[currentStep]}
                                showCorrections={showCorrections}
                            />
                        )}
                    </div>
                    <div className="lg:col-span-1 min-h-0 overflow-y-auto">
                        <MetricsPanel
                            steps={steps}
                            currentStep={currentStep}
                            originalNodeCount={steps[0]?.nodes.length || 16}
                            originalEdgeCount={steps[0]?.edges.length || 24}
                        />
                    </div>
                </div>

                {/* Legend - Full info restored */}
                <div className="flex-shrink-0 bg-[#1c1c1e] rounded-xl border border-[#3a3a3c] px-5 py-4">
                    <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
                        <div>
                            <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-2">Nodes</div>
                            <div className="flex items-center gap-5 text-[13px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full bg-[#0a84ff]"></div>
                                    <span className="text-[#f5f5f7]">Regular Node</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded bg-[#bf5af2]"></div>
                                    <span className="text-[#f5f5f7]">Supernode</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[#ff9f0a]"></div>
                                    <span className="text-[#f5f5f7]">Newly Merged</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-2">Edges</div>
                            <div className="flex items-center gap-5 text-[13px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-0.5 bg-[#636366]"></div>
                                    <span className="text-[#f5f5f7]">Superedge</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-0.5 border-t-2 border-dashed border-[#ff453a]"></div>
                                    <span className="text-[#f5f5f7]">C+ Missing Edge</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-0.5 border-t-2 border-dotted border-[#ff9f0a]"></div>
                                    <span className="text-[#f5f5f7]">C- Spurious Edge</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-2">Interaction</div>
                            <div className="flex items-center gap-5 text-[13px] text-[#86868b]">
                                <span>Scroll to zoom</span>
                                <span>Drag to pan</span>
                                <span>Hover for details</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
