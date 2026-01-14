"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import TimelineControls from "@/components/TimelineControls";
import StepMetricsPanel from "@/components/StepMetricsPanel";
import EdgeUpdatePanel from "@/components/EdgeUpdatePanel";
import { PoligrasOutput, MergeAction, ActionStats } from "@/types";

// Dynamic import for Sigma (needs client-side only)
const SigmaGraphCanvas = dynamic(() => import("@/components/SigmaGraphCanvas"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-[#1c1c1e] rounded-2xl flex items-center justify-center">
            <div className="text-[#86868b]">Loading graph...</div>
        </div>
    ),
});

export default function TimelineVisualizationPage() {
    const [output, setOutput] = useState<PoligrasOutput | null>(null);
    const [actions, setActions] = useState<MergeAction[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [datasetId, setDatasetId] = useState<string | null>(null);
    const [graphKey, setGraphKey] = useState(0); // Key to force re-render of graph canvas
    const [initialSummarySnapshot, setInitialSummarySnapshot] = useState<PoligrasOutput["graphs"]["summary"] | null>(null);
    const [latestSummarySnapshot, setLatestSummarySnapshot] = useState<PoligrasOutput["graphs"]["summary"] | null>(null);
    const [hasAppliedUpdates, setHasAppliedUpdates] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const syncSummarySnapshots = useCallback((summaryGraph?: PoligrasOutput["graphs"]["summary"], isInitialLoad = false) => {
        if (!summaryGraph) return;
        setLatestSummarySnapshot(summaryGraph);
        // Only set initial snapshot on the first load, never update it after edge updates
        if (isInitialLoad) {
            setInitialSummarySnapshot(summaryGraph);
        }
    }, []);

    // Load data from session storage or fetch from API
    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            try {
                setIsLoading(true);

                const storedDatasetId = sessionStorage.getItem("lastDatasetId");

                if (storedDatasetId) {
                    setDatasetId(storedDatasetId);
                }

                // Always fetch the original data from backend (no caching to ensure fresh original data)
                if (storedDatasetId) {
                    const response = await fetch(`/api/datasets/${storedDatasetId}/output`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch dataset output (${response.status})`);
                    }

                    const apiData: PoligrasOutput = await response.json();
                    if (!cancelled) {
                        setOutput(apiData);
                        if (apiData.timeline && apiData.timeline.length > 0) {
                            setActions(apiData.timeline);
                        }
                        // This is the original uploaded data, always set as initial snapshot
                        syncSummarySnapshots(apiData.graphs?.summary, true);
                    }
                } else {
                    setError("No dataset selected. Please upload a dataset first.");
                }
            } catch (err) {
                console.error("Failed to load data:", err);
                if (!cancelled) {
                    setError("Failed to load visualization data. Please go back and upload a dataset.");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadData();

        return () => {
            cancelled = true;
        };
    }, [syncSummarySnapshots]);

    // Playback logic - 30fps maximum using setInterval
    useEffect(() => {
        if (isPlaying && actions.length > 0) {
            let lastTime = performance.now();

            const timer = setInterval(() => {
                const now = performance.now();
                console.log(`[Playback] Step duration: ${(now - lastTime).toFixed(1)}ms`);
                lastTime = now;

                setCurrentStep((prev) => {
                    if (prev >= actions.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 32); // ~30fps max

            return () => clearInterval(timer);
        }
    }, [isPlaying, actions.length]);

    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => !prev);
    }, []);

    const handleStepChange = useCallback((step: number) => {
        setCurrentStep(step);
        setIsPlaying(false);
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
    }, []);

    // Handle edge update applied - refresh the output with updated summary
    const handleEdgeUpdateApplied = useCallback((updatedOutput: PoligrasOutput) => {
        setOutput(updatedOutput);
        // Don't cache the updated output - we want to always start from original on reload
        setGraphKey((prev) => prev + 1);
        if (updatedOutput.timeline && updatedOutput.timeline.length > 0) {
            setActions(updatedOutput.timeline);
            setCurrentStep(updatedOutput.timeline.length - 1);
        }
        // Only update latest snapshot, NOT initial snapshot - we want to preserve the original
        syncSummarySnapshots(updatedOutput.graphs?.summary, false);
        setHasAppliedUpdates(true);
        setIsPlaying(false);
    }, [syncSummarySnapshots]);

    // Fullscreen on mount
    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                if (document.fullscreenElement) return; // Already fullscreen

                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } else if ((document.documentElement as any).webkitRequestFullscreen) {
                    await (document.documentElement as any).webkitRequestFullscreen();
                } else if ((document.documentElement as any).msRequestFullscreen) {
                    await (document.documentElement as any).msRequestFullscreen();
                }
            } catch (err) {
                // Silent catch, browser blocked it
            }
        };
        // Attempt immediately
        enterFullscreen();

        // Also attempt on first interaction if blocked
        const handleInteraction = () => {
            enterFullscreen();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    // State for initial graph layout loading
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    // Get current step stats
    const currentStats: ActionStats | null =
        currentStep >= 0 && currentStep < actions.length
            ? actions[currentStep].stats
            : null;

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white">Loading data...</p>
                </div>
            </div>
        );
    }

    // Initial Layout Loading Overlay
    const loadingOverlay = !isCanvasReady && actions.length > 0 ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-500">
            <div className="text-center">
                <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-purple-200 font-medium tracking-wide">Initializing Graph Layout...</p>
            </div>
        </div>
    ) : null;

    if (error || !output) {
        return (
            <div className="h-screen flex items-center justify-center bg-black">
                <div className="text-center max-w-md">
                    <div className="text-red-400 text-6xl mb-4">⚠️</div>
                    <h2 className="text-white text-xl font-semibold mb-2">No Data Available</h2>
                    <p className="text-gray-400 mb-4">
                        {error || "Please upload a dataset first to visualize the graph summarization."}
                    </p>
                    <a
                        href="/upload"
                        className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Upload Dataset
                    </a>
                </div>
            </div>
        );
    }

    const initialGraph = output.graphs.initial;
    const summaryGraph = output.graphs.summary;
    const stats = output.stats;

    const summaryBeforeUpdates = initialSummarySnapshot ?? summaryGraph;
    const summaryAfterUpdates = hasAppliedUpdates ? (latestSummarySnapshot ?? summaryGraph) : null;

    const superedgeCountFor = (snapshot?: PoligrasOutput["graphs"]["summary"]) =>
        snapshot?.edge_count ?? stats.summary.superedges;

    const correctionCountFor = (snapshot?: PoligrasOutput["graphs"]["summary"]) =>
        snapshot?.correction_edge_count ?? stats.summary.correction_edges;



    return (
        <div className="relative h-screen w-full bg-black overflow-hidden selection:bg-blue-500/30">
            {/* 1. Full Screen Graph Canvas (Background) */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                {actions.length > 0 ? (
                    <SigmaGraphCanvas
                        key={graphKey}
                        initialGraph={initialGraph}
                        summaryGraph={summaryGraph}
                        actions={actions}
                        currentStep={currentStep}
                        onStepChange={handleStepChange}
                        onLayoutReady={() => setIsCanvasReady(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No actions found in dataset.
                    </div>
                )}
            </div>

            {/* Loading overlay temporarily disabled to test color rendering */}
            {/* {loadingOverlay} */}


            {/* 2. Top Left Floating Island (Title + Meta Stats) */}
            <div className="absolute top-6 left-6 z-30 flex flex-col gap-3 pointer-events-none">
                {/* Title Card */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center gap-3 shadow-lg w-max pointer-events-auto">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <span className="text-white font-bold text-lg">P</span>
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                            Poligras Timeline
                        </h1>
                        <p className="text-[10px] text-blue-200/70 font-medium uppercase tracking-wider">
                            {output.meta?.dataset.slice(0, 12)}...
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. Combined Floating Sidebar (Metrics Top, Controls Bottom) */}
            <div className="absolute top-6 bottom-6 right-6 z-30 w-80 pointer-events-none flex flex-col justify-start">
                <div className="pointer-events-auto bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 flex flex-col h-auto max-h-full transition-all duration-300">

                    {/* No internal scrollbar: flex layout */}
                    <div className="flex-1 flex flex-col p-5 gap-6 overflow-hidden">

                        {/* A. Metrics Section (Top Priority) */}
                        <div className="flex-shrink-0 animate-in fade-in slide-in-from-right-8 duration-700">
                            {/* We override the container styles of StepMetricsPanel to make it seamless */}
                            <StepMetricsPanel
                                stats={currentStats}
                                initialNodeCount={stats.initial.nodes}
                                initialEdgeCount={stats.initial.edges}
                                totalSteps={actions.length}
                                className="!bg-transparent !border-none !p-0 !rounded-none !shadow-none"
                            />
                        </div>

                        {/* Divider */}
                        {actions.length > 0 && <div className="h-px bg-white/10 flex-shrink-0" />}

                        {/* B. Timeline Controls - only show while playback is in progress */}
                        {actions.length > 0 && currentStep < actions.length - 1 && (
                            <div className="flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-500 pb-2">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-60">Playback</h3>
                                    {isPlaying && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                                </div>
                                <TimelineControls
                                    actions={actions}
                                    currentStep={currentStep}
                                    onStepChange={handleStepChange}
                                    isPlaying={isPlaying}
                                    onPlayPause={handlePlayPause}
                                    playbackSpeed={playbackSpeed}
                                    onSpeedChange={handleSpeedChange}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Bottom Left Panel - Edge Updates (shown after playback completes) */}
            {datasetId && currentStep >= actions.length - 1 && (
                <div className="absolute bottom-20 left-6 z-30 w-72 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-500">
                    {/* Summary Snapshot Box */}
                    <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/10 p-3 mb-3 shadow-lg space-y-3">
                        <div>
                            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Before Edge Updates</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-[10px] text-slate-500 uppercase">Superedges</p>
                                    <p className="text-lg font-bold text-blue-400">{superedgeCountFor(summaryBeforeUpdates).toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2">
                                    <p className="text-[10px] text-slate-500 uppercase">Corrections</p>
                                    <p className="text-lg font-bold text-purple-400">{correctionCountFor(summaryBeforeUpdates).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {summaryAfterUpdates && (
                            <div>
                                <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">After Edge Updates</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/50 rounded-lg p-2">
                                        <p className="text-[10px] text-slate-500 uppercase">Superedges</p>
                                        <p className="text-lg font-bold text-blue-400">{superedgeCountFor(summaryAfterUpdates).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-lg p-2">
                                        <p className="text-[10px] text-slate-500 uppercase">Corrections</p>
                                        <p className="text-lg font-bold text-purple-400">{correctionCountFor(summaryAfterUpdates).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Edge Update Panel */}
                    <EdgeUpdatePanel
                        datasetId={datasetId}
                        onUpdateApplied={handleEdgeUpdateApplied}
                    />
                </div>
            )}

            {/* Visual Flair: Vignette */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>
    );
}
