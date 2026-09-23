"use client";
import { useState } from "react";
import type { UploadPurpose } from "@/server/storage";

export type UploadedFile = { id: string; url: string; name: string; mimeType: string; sizeBytes: number };

/** Upload com progresso real (XHR) para /api/uploads. */
export function useUpload(purpose: UploadPurpose) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    setProgress(0);
    return new Promise<UploadedFile | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        setProgress(null);
        let body: { error?: string } & Partial<UploadedFile> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadedFile);
        else {
          setError(body.error ?? "Falha no envio do arquivo.");
          resolve(null);
        }
      };
      xhr.onerror = () => {
        setProgress(null);
        setError("Falha de conexão durante o envio.");
        resolve(null);
      };
      xhr.open("POST", "/api/uploads");
      xhr.send(form);
    });
  }
  return { upload, progress, error, uploading: progress !== null };
}
