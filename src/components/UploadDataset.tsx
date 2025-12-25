"use client";
import { useState, useRef } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2, Folder, Play, Settings } from "lucide-react";

export default function UploadDataset() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState("file");
  const [datasetId, setDatasetId] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [processingResult, setProcessingResult] = useState(null);
  
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

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setStatus("");
      setProgress(0);
      setProcessingResult(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setStatus("");
    setProgress(0);
    setProcessingResult(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setStatus("uploading");
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("http://localhost:8000/upload-multiple", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Upload error:", errorData);
        setStatus("error");
        setIsUploading(false);
        return;
      }

      const data = await response.json();
      setDatasetId(data.dataset_id);
      setStatus("upload_success");
      setIsUploading(false);
      
      sessionStorage.setItem("lastDatasetId", data.dataset_id);
      
      // Show config modal
      setShowConfig(true);
      
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleRunPoligras = async () => {
    if (!datasetId) return;

    setIsProcessing(true);
    setStatus("processing");
    setShowConfig(false);

    try {
      const response = await fetch("http://localhost:8000/poligras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset: datasetId,
          ...config
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Processing error:", errorData);
        setStatus("processing_error");
        setIsProcessing(false);
        return;
      }

      const result = await response.json();
      setProcessingResult(result);
      setStatus("complete");
      setIsProcessing(false);
      
      // Save output to session storage for visualization page
      sessionStorage.setItem("poligrasOutput", JSON.stringify(result));
      sessionStorage.setItem("lastDatasetId", datasetId);
      
      // Redirect to visualization page after short delay
      setTimeout(() => {
        window.location.href = "/visualize";
      }, 1500);
      
    } catch (error) {
      console.error("Processing failed:", error);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
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
          {/* Upload Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setUploadMode("file")}
              disabled={isUploading || isProcessing}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                uploadMode === "file"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              } ${(isUploading || isProcessing) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <File className="w-4 h-4 inline mr-2" />
              Upload Files
            </button>
            <button
              onClick={() => setUploadMode("folder")}
              disabled={isUploading || isProcessing}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                uploadMode === "folder"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              } ${(isUploading || isProcessing) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Folder className="w-4 h-4 inline mr-2" />
              Upload Folder
            </button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (isUploading || isProcessing) return;
              if (uploadMode === "file") {
                fileInputRef.current?.click();
              } else {
                folderInputRef.current?.click();
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
              webkitdirectory="true"
              directory="true"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isProcessing}
            />

            {files.length === 0 ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {uploadMode === "file" ? (
                    <Upload className="w-16 h-16 text-slate-400" />
                  ) : (
                    <Folder className="w-16 h-16 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-white mb-2">
                    {uploadMode === "file" 
                      ? "Drop your files here" 
                      : "Drop your folder here"}
                  </p>
                  <p className="text-slate-400 text-sm">
                    or click to browse
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Supports CSV, ZIP, TAR, PKL, PT, and PTH files
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {uploadMode === "folder" ? (
                    <Folder className="w-16 h-16 text-green-400" />
                  ) : (
                    <File className="w-16 h-16 text-green-400" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white mb-1">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-sm text-slate-400">
                    Total size: {formatFileSize(getTotalSize())}
                  </p>
                </div>
                {files.length <= 10 && (
                  <div className="max-h-32 overflow-y-auto text-left space-y-1">
                    {files.map((file, idx) => (
                      <p key={idx} className="text-xs text-slate-400 truncate">
                        • {file.webkitRelativePath || file.name}
                      </p>
                    ))}
                  </div>
                )}
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
          {status === "upload_success" && !showConfig && !isProcessing && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-400 font-semibold mb-1">Upload successful!</p>
                <p className="text-sm text-slate-300">
                  Dataset ID: <span className="font-mono bg-slate-700/50 px-2 py-1 rounded text-xs">
                    {datasetId}
                  </span>
                </p>
              </div>
            </div>
          )}

          {status === "complete" && processingResult && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start space-x-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-semibold mb-1">Processing complete!</p>
                  <p className="text-sm text-slate-300 mb-3">Analysis finished successfully.</p>
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(processingResult, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold mb-1">Upload failed</p>
                <p className="text-sm text-slate-300">
                  Please check your connection and try again
                </p>
              </div>
            </div>
          )}

          {status === "processing_error" && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold mb-1">Processing failed</p>
                <p className="text-sm text-slate-300">
                  An error occurred during analysis. Check the logs for details.
                </p>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {!datasetId && (
            <button
              onClick={handleUpload}
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
                  <span>Upload {uploadMode === "folder" ? "Folder" : "Files"}</span>
                </span>
              )}
            </button>
          )}

          {/* Action Buttons after Upload */}
          {datasetId && !isProcessing && status !== "complete" && (
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
            <button
              onClick={resetUpload}
              className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300"
            >
              Upload New Dataset
            </button>
          )}

          {/* Info Text */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Large uploads may take several minutes. Please don't close this window.
          </p>
        </div>

        {/* Configuration Modal */}
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Counts
                  </label>
                  <input
                    type="number"
                    value={config.counts}
                    onChange={(e) => setConfig({...config, counts: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Group Size
                  </label>
                  <input
                    type="number"
                    value={config.group_size}
                    onChange={(e) => setConfig({...config, group_size: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Hidden Size 1
                  </label>
                  <input
                    type="number"
                    value={config.hidden_size1}
                    onChange={(e) => setConfig({...config, hidden_size1: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Hidden Size 2
                  </label>
                  <input
                    type="number"
                    value={config.hidden_size2}
                    onChange={(e) => setConfig({...config, hidden_size2: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Learning Rate
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={config.lr}
                    onChange={(e) => setConfig({...config, lr: parseFloat(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Dropout
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.dropout}
                    onChange={(e) => setConfig({...config, dropout: parseFloat(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Weight Decay
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={config.weight_decay}
                    onChange={(e) => setConfig({...config, weight_decay: parseFloat(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bad Counter
                  </label>
                  <input
                    type="number"
                    value={config.bad_counter}
                    onChange={(e) => setConfig({...config, bad_counter: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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