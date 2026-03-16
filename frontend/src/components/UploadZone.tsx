"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle } from "lucide-react";

interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFileAccepted, disabled }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: { errors: { message: string }[] }[]) => {
      setError(null);
      if (rejected.length > 0) {
        setError("Only PDF files are accepted.");
        return;
      }
      if (accepted.length > 0) {
        onFileAccepted(accepted[0]);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled,
  });

  const file = acceptedFiles[0];

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
          transition-all duration-200 select-none
          ${disabled ? "opacity-40 cursor-not-allowed border-slate-700" : ""}
          ${isDragActive
            ? "border-amber-400 bg-amber-400/5"
            : "border-slate-600 hover:border-slate-400 bg-slate-800/40 hover:bg-slate-800/60"
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          {file ? (
            <>
              <FileText className="w-10 h-10 text-amber-400" />
              <p className="text-slate-200 font-mono text-sm">{file.name}</p>
              <p className="text-slate-500 text-xs">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <Upload
                className={`w-10 h-10 transition-colors ${
                  isDragActive ? "text-amber-400" : "text-slate-500"
                }`}
              />
              <div>
                <p className="text-slate-300 text-sm">
                  {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF"}
                </p>
                <p className="text-slate-500 text-xs mt-1">or click to browse</p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
