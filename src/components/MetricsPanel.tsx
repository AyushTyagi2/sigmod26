"use client";

import React, { useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { GraphStep } from "@/types";

interface MetricsPanelProps {
    steps: GraphStep[];
    currentStep: number;
    originalNodeCount: number;
    originalEdgeCount: number;
}

function calculateAvgDegree(nodeCount: number, edgeCount: number): number {
    if (nodeCount === 0) return 0;
    return (2 * edgeCount) / nodeCount;
}

function estimateTriangleCount(step: GraphStep): number {
    const n = step.nodes.length;
    const e = step.edges.length;
    if (n < 3) return 0;
    const maxEdges = (n * (n - 1)) / 2;
    const density = e / maxEdges;
    const avgDeg = (2 * e) / n;
    return Math.max(0, Math.round(density * n * avgDeg * (avgDeg - 1) / 6));
}

// Approximate MDL cost: bits(G) + bits(C)
function calculateMDLCost(step: GraphStep): number {
    const nodeBits = step.nodes.length * Math.log2(step.nodes.length + 1);
    const edgeBits = step.edges.length * 2;
    const correctionBits = (step.corrections.positive.length + step.corrections.negative.length) * 3;
    return Math.round(nodeBits + edgeBits + correctionBits);
}

export default function MetricsPanel({
    steps,
    currentStep,
}: MetricsPanelProps) {
    const allMetrics = useMemo(() => {
        let cumulativeReward = 0;
        return steps.map((step) => {
            const supernodeCount = step.nodes.filter((n) => n.vertex_count > 1).length;
            cumulativeReward += step.action_metadata.reward;
            const avgDegree = calculateAvgDegree(step.nodes.length, step.edges.length);
            const triangleCount = estimateTriangleCount(step);
            const mdlCost = calculateMDLCost(step);

            return {
                step: step.step_id,
                nodeCount: step.nodes.length,
                edgeCount: step.edges.length,
                supernodeCount,
                reward: step.action_metadata.reward,
                cumulativeReward,
                avgDegree,
                triangleCount,
                mdlCost,
            };
        });
    }, [steps]);

    const currentMetrics = allMetrics[currentStep] || allMetrics[0];
    const step0Metrics = allMetrics[0];
    const nodesReduced = step0Metrics.nodeCount - currentMetrics.nodeCount;
    const compressionPct = ((1 - currentMetrics.nodeCount / step0Metrics.nodeCount) * 100);

    return (
        <div className="bg-[#1c1c1e] rounded-xl border border-[#3a3a3c] p-5 h-full overflow-y-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#3a3a3c]">
                <h3 className="text-[13px] font-semibold text-[#f5f5f7] uppercase tracking-wider">
                    Metrics
                </h3>
                <span className="text-[11px] text-[#86868b] tabular-nums bg-[#2c2c2e] px-2 py-1 rounded">
                    Step {currentStep}/{steps.length - 1}
                </span>
            </div>

            {/* Primary Metrics - No duplicates */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#2c2c2e] rounded-xl p-4">
                    <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Compression</div>
                    <div className="text-[28px] font-semibold text-[#f5f5f7] tabular-nums leading-tight">
                        {compressionPct.toFixed(0)}%
                    </div>
                    <div className="text-[11px] text-[#86868b] mt-1">{nodesReduced} nodes merged</div>
                </div>
                <div className="bg-[#2c2c2e] rounded-xl p-4">
                    <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-1">Total Reward</div>
                    <div className="text-[28px] font-semibold text-[#30d158] tabular-nums leading-tight">
                        +{currentMetrics.cumulativeReward}
                    </div>
                    <div className="text-[11px] text-[#86868b] mt-1">+{currentMetrics.reward} this step</div>
                </div>
            </div>

            {/* Graph Structure Stats - concise row */}
            <div className="grid grid-cols-5 gap-2">
                <div className="bg-[#2c2c2e] rounded-lg p-2 text-center">
                    <div className="text-[16px] font-semibold text-[#f5f5f7] tabular-nums">{currentMetrics.nodeCount}</div>
                    <div className="text-[9px] text-[#86868b] uppercase">Nodes</div>
                </div>
                <div className="bg-[#2c2c2e] rounded-lg p-2 text-center">
                    <div className="text-[16px] font-semibold text-[#bf5af2] tabular-nums">{currentMetrics.supernodeCount}</div>
                    <div className="text-[9px] text-[#86868b] uppercase">Super</div>
                </div>
                <div className="bg-[#2c2c2e] rounded-lg p-2 text-center">
                    <div className="text-[16px] font-semibold text-[#f5f5f7] tabular-nums">{currentMetrics.edgeCount}</div>
                    <div className="text-[9px] text-[#86868b] uppercase">Edges</div>
                </div>
                <div className="bg-[#2c2c2e] rounded-lg p-2 text-center">
                    <div className="text-[16px] font-semibold text-[#0a84ff] tabular-nums">{currentMetrics.avgDegree.toFixed(1)}</div>
                    <div className="text-[9px] text-[#86868b] uppercase">Avg°</div>
                </div>
                <div className="bg-[#2c2c2e] rounded-lg p-2 text-center">
                    <div className="text-[16px] font-semibold text-[#ff9f0a] tabular-nums">{currentMetrics.triangleCount}</div>
                    <div className="text-[9px] text-[#86868b] uppercase">△</div>
                </div>
            </div>

            {/* Single Chart: MDL Cost over Iterations (most important metric per llms.txt) */}
            <div>
                <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-2">
                    MDL Cost <span className="normal-case text-[#636366]">(bits)</span>
                </div>
                <div className="h-36 bg-[#2c2c2e] rounded-lg p-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={allMetrics.slice(0, currentStep + 1)}>
                            <defs>
                                <linearGradient id="mdlGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0a84ff" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#0a84ff" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3c" />
                            <XAxis
                                dataKey="step"
                                stroke="#636366"
                                tick={{ fill: "#636366", fontSize: 10 }}
                                label={{ value: "Iteration", position: "insideBottomRight", offset: -5, fill: "#636366", fontSize: 9 }}
                            />
                            <YAxis
                                stroke="#636366"
                                tick={{ fill: "#636366", fontSize: 10 }}
                                label={{ value: "bits", angle: -90, position: "insideLeft", fill: "#636366", fontSize: 9 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#2c2c2e",
                                    border: "1px solid #3a3a3c",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    color: "#f5f5f7",
                                }}
                                formatter={(value: number) => [`${value} bits`, "MDL Cost"]}
                            />
                            <Area
                                type="monotone"
                                dataKey="mdlCost"
                                stroke="#0a84ff"
                                strokeWidth={2}
                                fill="url(#mdlGrad)"
                                dot={{ fill: "#0a84ff", r: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Corrections */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#2c2c2e] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#ff453a]"></div>
                        <span className="text-[10px] text-[#86868b] uppercase tracking-wider">C+ Missing</span>
                    </div>
                    <div className="text-[20px] font-semibold text-[#ff453a] tabular-nums">
                        {steps[currentStep]?.corrections.positive.length || 0}
                    </div>
                </div>
                <div className="bg-[#2c2c2e] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-[#ff9f0a]"></div>
                        <span className="text-[10px] text-[#86868b] uppercase tracking-wider">C- Spurious</span>
                    </div>
                    <div className="text-[20px] font-semibold text-[#ff9f0a] tabular-nums">
                        {steps[currentStep]?.corrections.negative.length || 0}
                    </div>
                </div>
            </div>

            {/* Last Action */}
            <div className="pt-3 border-t border-[#3a3a3c]">
                <div className="text-[11px] text-[#86868b] uppercase tracking-wider mb-2">Last Action</div>
                <div className="bg-[#2c2c2e] rounded-lg p-3">
                    <div className="text-[13px] text-[#f5f5f7]">
                        Merged: <span className="text-[#bf5af2] font-medium">
                            {steps[currentStep]?.action_metadata.merged_pair[0] || "—"}
                        </span>
                        {" + "}
                        <span className="text-[#bf5af2] font-medium">
                            {steps[currentStep]?.action_metadata.merged_pair[1] || "—"}
                        </span>
                    </div>
                    <div className="text-[11px] text-[#86868b] mt-1">
                        Reward: <span className="text-[#30d158]">+{steps[currentStep]?.action_metadata.reward || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
