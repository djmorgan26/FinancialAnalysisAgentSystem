"use client";

import { useState, useCallback } from "react";

interface UploadResult {
  success: boolean;
  message: string;
  platform?: string;
  fileName?: string;
}

const supportedPlatforms = [
  {
    id: "fidelity",
    name: "Fidelity",
    color: "#4ade80",
    description: "Portfolio positions, account history",
    formats: ".csv",
  },
  {
    id: "schwab",
    name: "Schwab",
    color: "#60a5fa",
    description: "Brokerage positions, transactions",
    formats: ".csv",
  },
  {
    id: "robinhood",
    name: "Robinhood",
    color: "#a78bfa",
    description: "Account statements, crypto",
    formats: ".csv",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    color: "#f59e0b",
    description: "Transaction history",
    formats: ".csv",
  },
  {
    id: "chase",
    name: "Chase",
    color: "#3b82f6",
    description: "Checking, savings, credit cards",
    formats: ".csv",
  },
  {
    id: "citi",
    name: "Citi",
    color: "#06b6d4",
    description: "Credit card statements",
    formats: ".csv",
  },
];

export default function ImportPanel() {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newResults: UploadResult[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".csv")) {
        newResults.push({
          success: false,
          message: `${file.name}: Only CSV files are supported`,
          fileName: file.name,
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          newResults.push({
            success: true,
            message: data.message || `${file.name}: Imported successfully`,
            platform: data.platform,
            fileName: file.name,
          });
        } else {
          newResults.push({
            success: false,
            message: data.error || `${file.name}: Import failed`,
            fileName: file.name,
          });
        }
      } catch {
        newResults.push({
          success: false,
          message: `${file.name}: Upload failed. Make sure the server is running.`,
          fileName: file.name,
        });
      }
    }

    setResults((prev) => [...newResults, ...prev]);
    setIsUploading(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-lg border-2 border-dashed transition-colors p-12 text-center ${
          isDragging
            ? "border-accent bg-accent-muted/30"
            : "border-card-border hover:border-muted"
        }`}
      >
        <input
          type="file"
          accept=".csv"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-card-border flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isUploading ? "Uploading..." : "Drop CSV files here or click to browse"}
            </p>
            <p className="text-xs text-muted mt-1">
              Supports exports from Fidelity, Schwab, Robinhood, Coinbase, Chase, Citi
            </p>
          </div>
        </div>
      </div>

      {/* Supported platforms */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Supported Platforms
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {supportedPlatforms.map((platform) => (
            <div
              key={platform.id}
              className="rounded-lg border border-card-border bg-card p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <span className="text-sm font-medium text-foreground">
                  {platform.name}
                </span>
                <span className="text-[10px] text-muted font-mono ml-auto">
                  {platform.formats}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {platform.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Upload results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Import Log
            </h3>
            <button
              onClick={() => setResults([])}
              className="text-xs text-muted hover:text-muted-foreground transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {results.map((result, i) => (
              <div
                key={i}
                className={`rounded-md px-3 py-2 text-sm flex items-start gap-2 ${
                  result.success
                    ? "bg-positive-muted/50 text-positive"
                    : "bg-negative-muted/50 text-negative"
                }`}
              >
                <span className="mt-0.5 flex-shrink-0">
                  {result.success ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z" />
                    </svg>
                  )}
                </span>
                {result.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
