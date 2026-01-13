"use client";
import { useState, useRef } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2, Folder, Play, Settings, FileText } from "lucide-react";

export default function UploadDataset() {
  const [activeTab, setActiveTab] = useState<"raw" | "json">("raw");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState("file");
  const [datasetId, setDatasetId] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Poligras configuration
  const [config, setConfig] = useState({
    counts: 100,
    group_size: 200,
    hidden_size1: 64,
    hidden_size2: 32,
    lr: 0.001,
    dropout: 0.0,
    weight_decay: 0.0,
    bad_counter: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Only handle if consistent with active tab
    // For simplicity, drop is only enabled for Raw mode in this version
    // or checks extensions
    if (activeTab === "raw") {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        setFiles(droppedFiles);
        setStatus("");
        setProgress(0);
        setProcessingResult(null);
        setErrorMessage("");
      }
    } else {
      // JSON mode drop handling could be added here
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 1 && droppedFiles[0].name.endsWith('.json')) {
        setFiles(droppedFiles);
        setStatus("");
        setProgress(0);
        setErrorMessage("");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setStatus("");
    setProgress(0);
    setProcessingResult(null);
    setErrorMessage("");
  };

  // Upload Logic for RAW DATASET
  const handleRawUpload = async () => {
    if (files.length === 0) return;

    setStatus("uploading");
    setIsUploading(true);
    setProgress(0);
    setErrorMessage("");

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      // Fake progress for UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
      }, 200);

      const response = await fetch("http://localhost:8000/upload-multiple", {
        method: "POST",
        body: formData,
        mode: 'cors',
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setDatasetId(data.dataset_id);
      setStatus("upload_success");
      setIsUploading(false);

      sessionStorage.setItem("lastDatasetId", data.dataset_id);
      setShowConfig(true); // Open config for Poligras run

    } catch (error: any) {
      setErrorMessage(error.message || "Upload failed");
      setStatus("error");
      setIsUploading(false);
    }
  };

  // Upload Logic for JSON (Direct Visualization)
  const handleJsonUpload = async () => {
    if (files.length === 0) return;

    setStatus("uploading");
    setIsUploading(true);
    setProgress(0);
    setErrorMessage("");

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
      }, 100);

      const response = await fetch("http://localhost:8000/upload-json", {
        method: "POST",
        body: formData,
        mode: 'cors',
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setDatasetId(data.dataset_id);
      // Skip processing, directly complete
      setStatus("complete");
      setIsUploading(false);
      setProcessingResult({ dataset_id: data.dataset_id, bypassed: true });

      sessionStorage.setItem("lastDatasetId", data.dataset_id);

    } catch (error: any) {
      setErrorMessage(error.message || "Upload failed");
      setStatus("error");
      setIsUploading(false);
    }
  };

  const handleRunPoligras = async () => {
    if (!datasetId) return;

    setIsProcessing(true);
    setStatus("processing");
    setShowConfig(false);
    setErrorMessage("");

    try {
      const response = await fetch("http://localhost:8000/poligras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: datasetId, ...config }),
        mode: 'cors',
      });

      if (!response.ok) throw new Error("Processing failed");

      const result = await response.json();
      setProcessingResult(result);
      setStatus("complete");
      setIsProcessing(false);

      sessionStorage.setItem("lastDatasetId", datasetId);
      sessionStorage.setItem("poligrasSummary", JSON.stringify({
        dataset_id: datasetId,
        timestamp: new Date().toISOString(),
        has_result: true
      }));

    } catch (error: any) {
      setErrorMessage(error.message || "Processing failed");
      setStatus("processing_error");
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setStatus("");
    setProgress(0);
    setIsUploading(false);
    setIsProcessing(false);
    setDatasetId("");
    setShowConfig(false);
    setProcessingResult(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (jsonInputRef.current) jsonInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dataset Upload & Processing</h1>
          <p className="text-slate-400">Upload your datasets and run Poligras analysis</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 p-8">

          {/* TABS */}
          {!datasetId && !isUploading && !isProcessing && (
            <div className="flex border-b border-slate-700 mb-6">
              <button
                onClick={() => { setActiveTab("raw"); setFiles([]); }}
                className={`flex-1 pb-4 text-center font-medium transition-colors ${activeTab === 'raw' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Raw Dataset
              </button>
              <button
                onClick={() => { setActiveTab("json"); setFiles([]); }}
                className={`flex-1 pb-4 text-center font-medium transition-colors ${activeTab === 'json' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Pre-processed JSON
              </button>
            </div>
          )}

          {/* RAW MODE: File/Folder Toggle */}
          {activeTab === "raw" && !datasetId && !isUploading && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${uploadMode === "file"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
              >
                <File className="w-4 h-4 inline mr-2" />
                Upload Files
              </button>
              <button
                onClick={() => setUploadMode("folder")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${uploadMode === "folder"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
              >
                <Folder className="w-4 h-4 inline mr-2" />
                Upload Folder
              </button>
            </div>
          )}

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (isUploading || isProcessing) return;
              if (activeTab === "raw") {
                if (uploadMode === "file") fileInputRef.current?.click();
                else folderInputRef.current?.click();
              } else {
                jsonInputRef.current?.click();
              }
            }}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-300 ease-in-out
              ${isDragging
                ? "border-blue-500 bg-blue-500/10 scale-105"
                : "border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50"
              }
              ${files.length > 0 ? "border-green-500 bg-green-500/10" : ""}
              ${(isUploading || isProcessing) ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isProcessing}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory="true"
              directory="true"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isProcessing}
            />
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isProcessing}
            />

            {files.length === 0 ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {activeTab === "raw" ? (
                    uploadMode === "file" ? <Upload className="w-16 h-16 text-slate-400" /> : <Folder className="w-16 h-16 text-slate-400" />
                  ) : (
                    <div className="bg-slate-800 p-2 rounded-xl">
                      <FileText className="w-16 h-16 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-white mb-2">
                    {activeTab === "raw"
                      ? (uploadMode === "file" ? "Drop your files here" : "Drop your folder here")
                      : "Drop output.json here"
                    }
                  </p>
                  <p className="text-slate-400 text-sm">
                    or click to browse
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <File className="w-16 h-16 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white mb-1">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-sm text-slate-400">
                    Total size: {formatFileSize(getTotalSize())}
                  </p>
                </div>
                {!isUploading && !isProcessing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUpload();
                    }}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove files
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-blue-400 font-semibold">Processing dataset...</p>
                <p className="text-sm text-slate-300">Running Poligras analysis. This may take a few minutes.</p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {status === "upload_success" && !showConfig && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-400 font-semibold mb-1">Upload successful!</p>
                <p className="text-sm text-slate-300">
                  Dataset ID: <span className="font-mono bg-slate-700/50 px-2 py-1 rounded text-xs">{datasetId}</span>
                </p>
              </div>
            </div>
          )}

          {status === "complete" && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start space-x-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-semibold mb-1">Ready for Visualization!</p>
                  <p className="text-sm text-slate-300 mb-3">Data is pre-loaded safely.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <a
                  href="/visualize"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Visualization
                </a>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold mb-1">Error</p>
                <p className="text-sm text-slate-300">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!datasetId && (
            <button
              onClick={activeTab === 'raw' ? handleRawUpload : handleJsonUpload}
              disabled={files.length === 0 || isUploading}
              className={`
                w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white
                transition-all duration-300 ease-in-out transform
                ${files.length === 0 || isUploading
                  ? "bg-slate-700 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
                }
              `}
            >
              {isUploading ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>{activeTab === 'raw' ? `Upload ${uploadMode === 'folder' ? 'Folder' : 'Files'}` : 'Upload JSON'}</span>
                </span>
              )}
            </button>
          )}

          {/* Config & Continue Logic for Raw Upload */}
          {datasetId && !isProcessing && status !== "complete" && activeTab === "raw" && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfig(true)}
                className="flex-1 py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 hover:scale-105"
              >
                <span className="flex items-center justify-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Configure & Run</span>
                </span>
              </button>
              <button
                onClick={resetUpload}
                className="py-4 px-6 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all duration-300"
              >
                Reset
              </button>
            </div>
          )}

          {/* Reset Button after Complete */}
          {status === "complete" && (
            <button onClick={resetUpload} className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 ...">
              Upload New Dataset
            </button>
          )}

        </div>

        {/* Configuration Modal (Only for Raw Mode) */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Configure Poligras</h2>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Inputs ... (Truncated for brevity, but needed in real file) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Counts</label>
                  <input type="number" value={config.counts} onChange={(e) => setConfig({ ...config, counts: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                {/* ... Other inputs same as before ... */}
                {/* Only including one input example in this tool call to keep it short if logic allows, but better to include all. */}
                {/* I will include all inputs to ensure correctness */}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Group Size</label>
                  <input type="number" value={config.group_size} onChange={(e) => setConfig({ ...config, group_size: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Hidden Size 1</label>
                  <input type="number" value={config.hidden_size1} onChange={(e) => setConfig({ ...config, hidden_size1: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Hidden Size 2</label>
                  <input type="number" value={config.hidden_size2} onChange={(e) => setConfig({ ...config, hidden_size2: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Learning Rate</label>
                  <input type="number" step="0.0001" value={config.lr} onChange={(e) => setConfig({ ...config, lr: parseFloat(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Dropout</label>
                  <input type="number" step="0.1" value={config.dropout} onChange={(e) => setConfig({ ...config, dropout: parseFloat(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Weight Decay</label>
                  <input type="number" step="0.0001" value={config.weight_decay} onChange={(e) => setConfig({ ...config, weight_decay: parseFloat(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bad Counter</label>
                  <input type="number" value={config.bad_counter} onChange={(e) => setConfig({ ...config, bad_counter: parseInt(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleRunPoligras}
                  className="flex-1 py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all duration-300"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <Play className="w-5 h-5" />
                    <span>Run Analysis</span>
                  </span>
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="py-3 px-6 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}