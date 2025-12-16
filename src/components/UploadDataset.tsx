"use client";
import { useState, useRef } from "react";
import { Upload, File, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function UploadDataset() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setStatus("");
      setProgress(0);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setStatus("");
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        setStatus("error");
        setIsUploading(false);
        return;
      }

      const data = await response.json();
      setStatus("success");
      setIsUploading(false);
      
      // Store dataset ID for display
      sessionStorage.setItem("lastDatasetId", data.dataset_id);
    } catch (error) {
      setStatus("error");
      setIsUploading(false);
      setProgress(0);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setStatus("");
    setProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dataset Upload</h1>
          <p className="text-slate-400">Upload your datasets for processing and analysis</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 p-8">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-300 ease-in-out
              ${isDragging 
                ? "border-blue-500 bg-blue-500/10 scale-105" 
                : "border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50"
              }
              ${file ? "border-green-500 bg-green-500/10" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".csv,.json,.xlsx,.xls,.parquet,.txt"
            />

            {!file ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Upload className="w-16 h-16 text-slate-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-white mb-2">
                    Drop your dataset here
                  </p>
                  <p className="text-slate-400 text-sm">
                    or click to browse files
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Supports CSV, JSON, Excel, Parquet, and TXT files
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <File className="w-16 h-16 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white mb-1">
                    {file.name}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetUpload();
                  }}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove file
                </button>
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

          {/* Status Messages */}
          {status === "success" && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-400 font-semibold mb-1">Upload successful!</p>
                <p className="text-sm text-slate-300">
                  Dataset ID: <span className="font-mono bg-slate-700/50 px-2 py-1 rounded">
                    {sessionStorage.getItem("lastDatasetId")}
                  </span>
                </p>
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

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={`
              w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white
              transition-all duration-300 ease-in-out transform
              ${!file || isUploading
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
                <span>Upload Dataset</span>
              </span>
            )}
          </button>

          {/* Info Text */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Large files may take several minutes to upload. Please don't close this window.
          </p>
        </div>
      </div>
    </div>
  );
}