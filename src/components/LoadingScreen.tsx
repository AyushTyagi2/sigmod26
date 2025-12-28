"use client";
import React from 'react';
import { Loader2, Database, GitBranch, CheckCircle } from 'lucide-react';

interface LoadingScreenProps {
  stage: string;
  progress: number;
  message: string;
}

export default function LoadingScreen({ stage, progress, message }: LoadingScreenProps) {
  const stages = [
    { id: 'metadata', label: 'Loading Metadata', icon: Database },
    { id: 'initial', label: 'Loading Initial Graph', icon: GitBranch },
    { id: 'summary', label: 'Loading Summary Graph', icon: GitBranch },
    { id: 'processing', label: 'Processing Data', icon: Loader2 },
    { id: 'complete', label: 'Complete', icon: CheckCircle }
  ];

  const currentStageIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
      <div className="max-w-md w-full px-8">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-b from-[#0077ed] to-[#0066cc] flex items-center justify-center shadow-xl">
            <span className="text-white font-bold text-3xl">P</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Poligras</h1>
          <p className="text-slate-400">Loading your visualization...</p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4 mb-8">
          {stages.slice(0, -1).map((stageItem, index) => {
            const Icon = stageItem.icon;
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <div
                key={stageItem.id}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  isCurrent
                    ? 'bg-blue-500/10 border border-blue-500/30 scale-105'
                    : isComplete
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isCurrent
                      ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                      : isComplete
                      ? 'bg-green-500'
                      : 'bg-slate-700'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : isCurrent ? (
                    <Icon className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      isCurrent || isComplete ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {stageItem.label}
                  </p>
                  {isCurrent && message && (
                    <p className="text-sm text-slate-400 mt-1">{message}</p>
                  )}
                </div>
                {isComplete && (
                  <div className="text-green-400 text-sm font-medium">✓</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Overall Progress</span>
            <span className="text-white font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-500 ease-out shadow-lg shadow-blue-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Loading message */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            {stage === 'complete' 
              ? '🎉 All done! Opening visualization...' 
              : 'Please wait while we prepare your graph data...'}
          </p>
        </div>
      </div>
    </div>
  );
}