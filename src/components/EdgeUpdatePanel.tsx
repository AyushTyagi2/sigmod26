"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { PoligrasOutput } from "@/types";

interface EdgeUpdatePanelProps {
    datasetId: string;
    onUpdateApplied: (updatedOutput: PoligrasOutput) => void;
}

export default function EdgeUpdatePanel({ datasetId, onUpdateApplied }: EdgeUpdatePanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [updateStats, setUpdateStats] = useState<{
        superedges: number;
        correctionEdges: number;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setStatus("idle");
            setErrorMessage("");
            setUpdateStats(null);
        }
    }, []);

    const handleApplyUpdates = useCallback(async () => {
        if (!file || !datasetId) return;

        setIsUploading(true);
        setStatus("uploading");
        setErrorMessage("");

        const formData = new FormData();
        formData.append("updates_file", file);

        try {
            const response = await fetch(`/api/datasets/${datasetId}/apply-updates`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed with status ${response.status}`);
            }

            const updatedOutput: PoligrasOutput = await response.json();

            const summarySnapshot = updatedOutput.graphs?.summary;
            setUpdateStats({
                superedges: summarySnapshot?.edge_count ?? updatedOutput.stats.summary.superedges,
                correctionEdges: summarySnapshot?.correction_edge_count ?? updatedOutput.stats.summary.correction_edges,
            });

            setStatus("success");
            setIsUploading(false);

            // Notify parent component (no session storage caching - always use original on reload)
            onUpdateApplied(updatedOutput);

        } catch (error: any) {
            console.error("Edge update failed:", error);
            setErrorMessage(error.message || "Failed to apply edge updates");
            setStatus("error");
            setIsUploading(false);
        }
    }, [file, datasetId, onUpdateApplied]);

    const resetPanel = useCallback(() => {
        setFile(null);
        setStatus("idle");
        setErrorMessage("");
        setUpdateStats(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" />
                    Dynamic Updates
                </h3>
            </div>

            {/* File Input Area */}
            <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`
                    relative border border-dashed rounded-lg p-4 text-center cursor-pointer
                    transition-all duration-200
                    ${file ? "border-green-500/50 bg-green-500/5" : "border-slate-600 hover:border-slate-500 bg-slate-800/30"}
                    ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                />

                {!file ? (
                    <div className="space-y-2">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs text-slate-400">
                            Drop edge updates JSON
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-xs text-green-400 font-medium truncate">
                            {file.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                        </p>
                    </div>
                )}
            </div>

            {/* Apply Button */}
            <button
                onClick={handleApplyUpdates}
                disabled={!file || isUploading}
                className={`
                    w-full mt-3 py-2 px-4 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${!file || isUploading
                        ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }
                `}
            >
                {isUploading ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying...
                    </span>
                ) : (
                    "Apply Updates"
                )}
            </button>

            {/* Success State */}
            {status === "success" && updateStats && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-green-400 text-xs font-semibold mb-1">Updates Applied!</p>
                            <div className="text-[10px] text-slate-400 space-y-0.5">
                                <p>Superedges: {updateStats.superedges}</p>
                                <p>Corrections: {updateStats.correctionEdges}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={resetPanel}
                        className="mt-2 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
                    >
                        Upload another batch
                    </button>
                </div>
            )}

            {/* Error State */}
            {status === "error" && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-red-400 text-xs font-semibold mb-1">Error</p>
                            <p className="text-[10px] text-slate-400 break-words">{errorMessage}</p>
                        </div>
                    </div>
                    <button
                        onClick={resetPanel}
                        className="mt-2 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Help Text */}
            <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
                Upload a JSON file with edge updates. Format:
                <code className="block mt-1 p-2 bg-slate-800 rounded text-[9px] font-mono text-slate-400">
                    {"[{\"op\":\"add\",\"source\":\"1\",\"target\":\"2\"}]"}
                </code>
            </p>
        </div>
    );
}
