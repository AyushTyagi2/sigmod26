"use client";

import React from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { MergeAction } from "@/types";

interface TimelineControlsProps {
    actions: MergeAction[];
    currentStep: number;
    onStepChange: (step: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    playbackSpeed: number;
    onSpeedChange: (speed: number) => void;
}

export default function TimelineControls({
    actions,
    currentStep,
    onStepChange,
    isPlaying,
    onPlayPause,
    playbackSpeed,
    onSpeedChange,
}: TimelineControlsProps) {
    const totalSteps = actions.length;
    const progressPercent = totalSteps > 0 ? (currentStep / (totalSteps - 1)) * 100 : 0;

    // Current action info
    const currentAction = currentStep >= 0 && currentStep < actions.length ? actions[currentStep] : null;

    // Use memoized sparkline bars
    const sparklineBars = useSparkline(actions, currentStep);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStep = parseInt(e.target.value, 10);
        onStepChange(newStep);
    };

    const goToStart = () => onStepChange(0);
    const goToEnd = () => onStepChange(Math.max(0, totalSteps - 1));
    const stepBack = () => onStepChange(Math.max(0, currentStep - 1));
    const stepForward = () => onStepChange(Math.min(totalSteps - 1, currentStep + 1));

    return (
        <div className="w-full flex flex-col gap-5">
            {/* 1. Progress Slider */}
            <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden group">
                <div
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-100"
                    style={{ width: `${progressPercent}%` }}
                />
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalSteps - 1)}
                    value={currentStep}
                    onChange={handleSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>

            {/* 2.5 Fullscreen Toggle (Above Playback) */}
            <div className="flex justify-center -mb-2 z-20">
                <button
                    onClick={() => {
                        if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen().catch(() => { });
                        } else {
                            document.exitFullscreen().catch(() => { });
                        }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-[10px] text-slate-400 hover:text-white uppercase tracking-wider backdrop-blur-sm"
                    title="Toggle Fullscreen"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                    <span>Fullscreen</span>
                </button>
            </div>

            {/* 2. Playback Buttons (Centered) */}
            <div className="flex items-center justify-center gap-2">
                {/* ... existing buttons ... */}
                <button onClick={goToStart} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Start">
                    <SkipBack size={16} />
                </button>
                <button onClick={stepBack} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Back">
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={onPlayPause}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
                <button onClick={stepForward} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Next">
                    <ChevronRight size={20} />
                </button>
                <button onClick={goToEnd} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="End">
                    <SkipForward size={16} />
                </button>
            </div>

            {/* 3. Info Row (Step + Speed) */}
            <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1">
                <div className="font-mono">
                    Step <span className="text-white">{currentStep + 1}</span><span className="opacity-50">/{totalSteps}</span>
                </div>

                <div className="flex items-center gap-2 bg-white/5 rounded-lg pl-2 pr-1 py-1 border border-white/5 hover:border-white/10 transition-colors">
                    <span>Speed</span>
                    <select
                        value={playbackSpeed}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className="bg-transparent text-white focus:outline-none cursor-pointer"
                    >
                        <option value={0.5} className="text-black">0.5x</option>
                        <option value={1} className="text-black">1.0x</option>
                        <option value={2} className="text-black">2.0x</option>
                        <option value={5} className="text-black">5.0x</option>
                        <option value={10} className="text-black">10x</option>
                    </select>
                </div>
            </div>

            {/* 4. Current Merge Action Info */}
            {currentAction ? (
                <div className="bg-white/5 rounded-lg p-2.5 border border-white/5 flex items-center justify-center gap-2 text-xs font-mono">
                    <span className="text-slate-500">Merge:</span>
                    <span className="text-purple-300">{currentAction.n1}</span>
                    <span className="text-slate-600">+</span>
                    <span className="text-purple-300">{currentAction.n2}</span>
                    <span className="ml-auto text-emerald-400 font-bold">+{currentAction.stats.reward}</span>
                </div>
            ) : (
                <div className="h-[38px]" /> // Spacer to avoid layout jump
            )}

            {/* 5. Sparkline */}
            <div className="mt-1">
                <div className="flex justify-between items-end text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-0.5">
                    <span>Reward History</span>
                </div>
                <div className="h-10 flex items-end gap-[1px] opacity-70 hover:opacity-100 transition-opacity">
                    {sparklineBars}
                </div>
            </div>
        </div>
    );
}

// Memoized Helper for Sparkline Bars to prevent re-calc during high-speed playback
function useSparkline(actions: MergeAction[], currentStep: number) {
    const { minReward, maxReward } = React.useMemo(() => {
        let min = Infinity;
        let max = -Infinity;
        if (actions.length === 0) return { minReward: 0, maxReward: 1 };

        for (const a of actions) {
            if (a.stats.reward < min) min = a.stats.reward;
            if (a.stats.reward > max) max = a.stats.reward;
        }
        if (min === Infinity) { min = 0; max = 1; }
        if (min === max) max = min + 1;
        return { minReward: min, maxReward: max };
    }, [actions]);

    return React.useMemo(() => {
        const windowSize = 50;
        const startIdx = Math.max(0, currentStep - windowSize);
        const endIdx = Math.min(actions.length, currentStep + windowSize);

        const visibleActions = actions.slice(startIdx, endIdx);
        const range = maxReward - minReward;

        return visibleActions.map((action, idx) => {
            const absoluteIndex = startIdx + idx;
            const isCurrent = absoluteIndex === currentStep;
            const isFuture = absoluteIndex > currentStep;

            const normalized = (action.stats.reward - minReward) / range;
            const height = Math.max(4, normalized * 100);

            return (
                <div
                    key={absoluteIndex}
                    className={`flex-1 rounded-sm transition-all ${isCurrent ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10" :
                        isFuture ? "invisible" : "bg-blue-500/50"
                        }`}
                    style={{ height: `${height}%` }}
                    title={`Step ${absoluteIndex + 1}: ${action.stats.reward}`}
                />
            );
        });
    }, [actions, currentStep, minReward, maxReward]);
}
