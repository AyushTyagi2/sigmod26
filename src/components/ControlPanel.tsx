"use client";

import React from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Eye, EyeOff } from "lucide-react";
import { DatasetManifest } from "@/types";

interface ControlPanelProps {
    datasets: DatasetManifest[];
    selectedDatasetId: string;
    onDatasetChange: (id: string) => void;
    currentStep: number;
    maxSteps: number;
    onStepChange: (step: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onReset: () => void;
    showCorrections: boolean;
    onToggleCorrections: () => void;
}

export default function ControlPanel({
    datasets,
    selectedDatasetId,
    onDatasetChange,
    currentStep,
    maxSteps,
    onStepChange,
    isPlaying,
    onPlayPause,
    onReset,
    showCorrections,
    onToggleCorrections,
}: ControlPanelProps) {
    return (
        <div className="bg-[#1c1c1e] rounded-xl border border-[#3a3a3c] px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
                {/* Dataset Selector */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-[#86868b] uppercase tracking-wider">
                        Dataset
                    </label>
                    <select
                        value={selectedDatasetId}
                        onChange={(e) => onDatasetChange(e.target.value)}
                        className="bg-[#2c2c2e] text-[#f5f5f7] text-[13px] pl-3 pr-8 py-2 rounded-lg border border-[#3a3a3c] focus:outline-none focus:border-[#0a84ff] transition-colors appearance-none cursor-pointer"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2386868b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                            backgroundPosition: "right 8px center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "16px",
                        }}
                    >
                        {datasets.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onReset}
                        className="p-2.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#3a3a3c] rounded-lg transition-colors"
                        title="Reset"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onStepChange(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="p-2.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#3a3a3c] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous Step"
                    >
                        <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onPlayPause}
                        className={`p-3 rounded-full transition-all ${isPlaying
                            ? "bg-[#ff453a] text-white"
                            : "bg-[#0a84ff] text-white hover:bg-[#0077ed]"
                            }`}
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? (
                            <Pause className="w-4 h-4" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={() => onStepChange(Math.min(maxSteps - 1, currentStep + 1))}
                        disabled={currentStep === maxSteps - 1}
                        className="p-2.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#3a3a3c] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next Step"
                    >
                        <SkipForward className="w-4 h-4" />
                    </button>
                </div>

                {/* Step Slider */}
                <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-[#86868b] uppercase tracking-wider">Iteration</span>
                        <span className="text-[#f5f5f7] font-medium tabular-nums">
                            {currentStep} of {maxSteps - 1}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={maxSteps - 1}
                        value={currentStep}
                        onChange={(e) => onStepChange(parseInt(e.target.value))}
                        className="w-full h-1 bg-[#3a3a3c] rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3.5
              [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[#f5f5f7]
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                </div>

                {/* Corrections Toggle */}
                <button
                    onClick={onToggleCorrections}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${showCorrections
                        ? "bg-[#0a84ff]/20 text-[#0a84ff] border border-[#0a84ff]/40"
                        : "bg-[#2c2c2e] text-[#86868b] border border-[#3a3a3c] hover:text-[#f5f5f7]"
                        }`}
                    title={showCorrections ? "Hide Corrections" : "Show Corrections"}
                >
                    {showCorrections ? (
                        <Eye className="w-4 h-4" />
                    ) : (
                        <EyeOff className="w-4 h-4" />
                    )}
                    <span>Corrections</span>
                </button>
            </div>
        </div>
    );
}
