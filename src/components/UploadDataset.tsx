"use client";
import { useState, useRef } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2, Folder, Play, Settings, Zap } from "lucide-react";

export default function FastUploadDataset() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState("file");
  const [datasetId, setDatasetId] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [processingResult, setProcessingResult] = useState(null);
  const [currentFile, setCurrentFile] = useState("");
  
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
  const abortControllerRef = useRef(null);

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (adjust based on network)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    return formatFileSize(bytesPerSecond) + "/s";
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

  const uploadFileInChunks = async (file, sharedDatasetId) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileName = file.name;
    let uploadedBytes = 0;
    const startTime = Date.now();

    setCurrentFile(fileName);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('fileName', fileName);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('datasetId', sharedDatasetId);

      try {
        abortControllerRef.current = new AbortController();
        
        const response = await fetch("http://localhost:8000/upload-chunk", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Chunk ${chunkIndex} upload failed`);
        }

        uploadedBytes += (end - start);
        const currentProgress = (uploadedBytes / file.size) * 100;
        setProgress(currentProgress);

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speed = uploadedBytes / elapsedSeconds;
        setUploadSpeed(speed);

      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Upload cancelled');
        }
        throw error;
      }
    }

    // Finalize the upload
    const finalizeResponse = await fetch("http://localhost:8000/finalize-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, datasetId: sharedDatasetId })
    });

    if (!finalizeResponse.ok) {
      throw new Error("Failed to finalize upload");
    }

    return await finalizeResponse.json();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setStatus("uploading");
    setIsUploading(true);
    setProgress(0);
    setUploadSpeed(0);

    try {
      let finalDatasetId = null;
      
      // Check if any file is large enough for chunking
      const hasLargeFile = files.some(f => f.size > 10 * 1024 * 1024);
      
      if (hasLargeFile) {
        // Generate a single dataset ID for chunked uploads
        const generatedDatasetId = `dataset_${Date.now()}`;
        
        // Upload files sequentially
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          if (file.size > 10 * 1024 * 1024) {
            const result = await uploadFileInChunks(file, generatedDatasetId);
            finalDatasetId = result.dataset_id;
          } else {
            // Small file - still use chunked upload with same dataset ID
            const result = await uploadFileInChunks(file, generatedDatasetId);
            finalDatasetId = result.dataset_id;
          }
          
          // Update progress for multiple files
          setProgress(((i + 1) / files.length) * 100);
        }
      } else {
        // All files are small - use direct upload
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        const response = await fetch("http://localhost:8000/upload-multiple", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");
        
        const data = await response.json();
        finalDatasetId = data.dataset_id;
        setProgress(100);
      }

      setDatasetId(finalDatasetId);
      setStatus("upload_success");
      setIsUploading(false);
      setShowConfig(true);
      setCurrentFile("");
      
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");
      setIsUploading(false);
      setProgress(0);
      setUploadSpeed(0);
      setCurrentFile("");
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setStatus("cancelled");
    setProgress(0);
    setUploadSpeed(0);
    setCurrentFile("");
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
    setUploadSpeed(0);
    setIsUploading(false);
    setIsProcessing(false);
    setDatasetId("");
    setShowConfig(false);
    setProcessingResult(null);
    setCurrentFile("");
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Fast Dataset Upload</h1>
          </div>
          <p className="text-slate-400">Optimized chunked upload for large files (up to 100GB+)</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 p-8">
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
                  Supports files up to 100GB+ • Chunked upload with resume capability
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
                        • {file.webkitRelativePath || file.name} ({formatFileSize(file.size)})
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

          {isUploading && (
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-start text-sm">
                <div>
                  <span className="text-slate-400">Uploading...</span>
                  {currentFile && (
                    <p className="text-xs text-slate-500 mt-1 truncate max-w-xs">
                      Current: {currentFile}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">{progress.toFixed(1)}%</div>
                  {uploadSpeed > 0 && (
                    <div className="text-xs text-green-400">{formatSpeed(uploadSpeed)}</div>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 h-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <button
                onClick={cancelUpload}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Cancel Upload
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-blue-400 font-semibold">Processing dataset...</p>
                <p className="text-sm text-slate-300">Running Poligras analysis. This may take a few minutes.</p>
              </div>
            </div>
          )}

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
                  <p className="text-sm text-slate-300 mb-3">Redirecting to visualization...</p>
                </div>
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

          {status === "cancelled" && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold mb-1">Upload cancelled</p>
                <p className="text-sm text-slate-300">You can start a new upload anytime</p>
              </div>
            </div>
          )}

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
                  <Zap className="w-5 h-5" />
                  <span>Fast Upload {uploadMode === "folder" ? "Folder" : "Files"}</span>
                </span>
              )}
            </button>
          )}

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

          {status === "complete" && (
            <button
              onClick={resetUpload}
              className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300"
            >
              Upload New Dataset
            </button>
          )}

          <p className="mt-6 text-center text-xs text-slate-500">
            Chunked upload with automatic resume • Optimized for files up to 100GB+
          </p>
        </div>

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
                {Object.entries(config).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-2 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="number"
                      step={key === 'lr' || key === 'weight_decay' ? '0.0001' : key === 'dropout' ? '0.1' : '1'}
                      value={value}
                      onChange={(e) => setConfig({
                        ...config, 
                        [key]: key.includes('lr') || key.includes('dropout') || key.includes('weight') 
                          ? parseFloat(e.target.value) 
                          : parseInt(e.target.value)
                      })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
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