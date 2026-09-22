"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useUpload, type UploadedFile } from "@/hooks/use-upload";
import type { UploadPurpose } from "@/server/storage";
import { Progress } from "./progress";
import { cn } from "@/lib/utils";

/** Área de upload (clique ou arraste) com progresso e erro. */
export function FileDropzone({
  purpose,
  accept,
  hint,
  onUploaded,
  className,
  compact,
  label = "Clique para enviar ou arraste o arquivo",
}: {
  purpose: UploadPurpose;
  accept?: string;
  hint?: string;
  onUploaded: (f: UploadedFile) => void;
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { upload, progress, error, uploading } = useUpload(purpose);

  async function handle(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const res = await upload(f);
    if (res) onUploaded(res);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2/40 text-center transition-colors hover:border-primary hover:bg-primary-soft/40 disabled:opacity-70",
          compact ? "px-4 py-4" : "px-6 py-8",
          drag && "border-primary bg-primary-soft/60",
        )}
      >
        <UploadCloud className="size-5 text-subtle" aria-hidden />
        <span className="text-sm font-medium text-fg">{uploading ? `Enviando… ${progress}%` : label}</span>
        {hint && <span className="text-caption text-subtle">{hint}</span>}
        {uploading && <Progress value={progress ?? 0} className="mt-1 max-w-xs" size="sm" label="Progresso do envio" />}
      </button>
      <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} onChange={(e) => handle(e.target.files)} />
      {error && <p role="alert" className="mt-1.5 text-caption font-medium text-danger">{error}</p>}
    </div>
  );
}
