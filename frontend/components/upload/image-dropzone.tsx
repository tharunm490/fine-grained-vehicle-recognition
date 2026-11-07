"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileWarning, ImagePlus, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png"]);

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    return "Unsupported file type. Upload a JPG or PNG image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image exceeds the 12 MB upload limit.";
  }
  if (file.size === 0) {
    return "This file is empty.";
  }
  return null;
}

interface ImageDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export function ImageDropzone({ file, onFileChange, disabled = false, className }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const message = validateImageFile(candidate);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onFileChange(candidate);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    onFileChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        disabled={disabled}
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />

      {file && preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-media/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Preview of ${file.name}`}
            className="max-h-[360px] w-full object-contain"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-media/85 via-media/45 to-transparent p-3.5 pt-10">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-on-media">{file.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-on-media/55">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type.replace("image/", "").toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={openPicker}
                className="border border-on-media/10 bg-on-media/10 text-on-media backdrop-blur hover:bg-on-media/20"
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={handleRemove}
                aria-label="Remove image"
                className="bg-media/30 text-on-media backdrop-blur hover:bg-rose-500/25 hover:text-rose-100"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload a vehicle image"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-5 py-10 text-center transition-all duration-200",
            dragging
              ? "border-cyan-300/60 bg-cyan-400/[0.07] shadow-[inset_0_0_60px_-20px_var(--drag-glow)]"
              : "border-border/90 bg-white/[0.015] hover:border-cyan-300/35 hover:bg-cyan-400/[0.025]",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <div className="surface-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
          <div
            className={cn(
              "relative mb-4 flex size-12 items-center justify-center rounded-2xl border transition-colors",
              dragging
                ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-200"
                : "border-border bg-white/[0.03] text-muted-foreground group-hover:border-cyan-300/25 group-hover:text-cyan-200",
            )}
          >
            {dragging ? <UploadCloud className="size-5" /> : <ImagePlus className="size-5" />}
          </div>
          <p className="relative text-sm font-medium text-foreground">
            {dragging ? "Drop the image to analyze" : "Drop a vehicle photo here"}
          </p>
          <p className="relative mt-1.5 text-xs text-muted-foreground">
            or <span className="text-cyan-300/90">browse your files</span>
          </p>
          <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-[9px] tracking-wide text-muted-foreground/50 uppercase">
            <span className="rounded border border-border/70 bg-black/20 px-1.5 py-0.5">JPG</span>
            <span className="rounded border border-border/70 bg-black/20 px-1.5 py-0.5">PNG</span>
            <span>·</span>
            <span>Max 12 MB</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2 text-[11px] leading-4 text-rose-200">
          <FileWarning className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5 px-0.5 text-[10px] text-muted-foreground/50">
          <ShieldCheck className="size-3 text-emerald-400/60" />
          Images are sent only to your local FastAPI backend.
        </div>
      )}
    </div>
  );
}
