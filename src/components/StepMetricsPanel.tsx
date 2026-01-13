"use client";

import React from "react";
import { ActionStats } from "@/types";

interface StepMetricsPanelProps {
    stats: ActionStats | null;
    initialNodeCount: number;
    initialEdgeCount: number;
    totalSteps: number;
    className?: string;
}

export default function StepMetricsPanel({
    stats,
    initialNodeCount,
    initialEdgeCount,
    totalSteps,
    className = "",
}: StepMetricsPanelProps) {
    if (!stats) {
        return (
            <div className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10 ${className}`}>
                <h3 className="text-white font-semibold mb-4">Step Metrics</h3>
                <p className="text-gray-400 text-sm">No step selected</p>
            </div>
        );
    }

    const compressionPercent = (1 - stats.summarisation_ratio) * 100;
    const nodeReduction = initialNodeCount - stats.supernode_count;
    const edgeReduction = initialEdgeCount - stats.edge_count;
    const progress = ((stats.step_index + 1) / totalSteps) * 100;

    return (
        <div className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Step Metrics</h3>
                <span className="text-sm text-gray-400">
                    Step {stats.step_index + 1} of {totalSteps}
                </span>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Reward */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Reward</div>
                    <div className="text-2xl font-bold text-green-400">
                        +{stats.reward}
                    </div>
                </div>

                {/* Compression */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Compression</div>
                    <div className="text-2xl font-bold text-purple-400">
                        {compressionPercent.toFixed(1)}%
                    </div>
                </div>

                {/* Supernodes */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Supernodes</div>
                    <div className="text-xl font-bold text-white">
                        {stats.supernode_count.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">
                        -{nodeReduction.toLocaleString()} nodes
                    </div>
                </div>

                {/* Edges */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Edges</div>
                    <div className="text-xl font-bold text-white">
                        {stats.edge_count.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">
                        -{edgeReduction.toLocaleString()} edges
                    </div>
                </div>

                {/* Average Degree */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Avg Degree</div>
                    <div className="text-xl font-bold text-white">
                        {stats.avg_degree.toFixed(2)}
                    </div>
                </div>

                {/* Summarisation Ratio */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-gray-400 text-xs mb-1">Summary Ratio</div>
                    <div className="text-xl font-bold text-white">
                        {(stats.summarisation_ratio * 100).toFixed(2)}%
                    </div>
                </div>
            </div>
        </div>
    );
}
