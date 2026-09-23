import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { ValidationError } from "@/server/errors";
import type { FileVisibility } from "@prisma/client";

/**
 * Armazenamento de arquivos com driver plugável.
 * Hoje: disco local (STORAGE_LOCAL_DIR), fora de /public — todo acesso passa
 * por /api/files/[id], que aplica as regras de autorização.
 * Para S3/R2/GCS, implemente StorageDriver e selecione via STORAGE_DRIVER.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  stream(key: string, range?: { start: number; end: number }): Promise<ReadableStream>;
  size(key: string): Promise<number>;
  remove(key: string): Promise<void>;
}

const root = path.resolve(env.STORAGE_LOCAL_DIR);

function safePath(key: string) {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Chave de armazenamento inválida");
  return full;
}

const localDriver: StorageDriver = {
  async put(key, data) {
    const full = safePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  get: (key) => readFile(safePath(key)),
  async stream(key, range) {
    const node = createReadStream(safePath(key), range);
    return Readable.toWeb(node) as ReadableStream;
  },
  async size(key) {
    return (await stat(safePath(key))).size;
  },
  async remove(key) {
    await rm(safePath(key), { force: true });
  },
};

export const storage: StorageDriver = localDriver;

// ── Políticas de upload ─────────────────────────────────────────────

type Policy = { maxMb: number; types: Record<string, string[]>; visibility: FileVisibility };

const IMAGE = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };
const DOCS = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "text/plain": ["txt"],
};
const AUDIO = { "audio/mpeg": ["mp3"], "audio/mp4": ["m4a"], "audio/x-m4a": ["m4a"], "audio/wav": ["wav"], "audio/ogg": ["ogg"] };
const VIDEO = { "video/mp4": ["mp4"], "video/webm": ["webm"] };
const CAPTIONS = { "text/vtt": ["vtt"] };

export const UPLOAD_POLICIES = {
  avatar: { maxMb: 3, types: IMAGE, visibility: "PUBLIC" },
  cover: { maxMb: 5, types: IMAGE, visibility: "PUBLIC" },
  banner: { maxMb: 6, types: IMAGE, visibility: "PUBLIC" },
  logo: { maxMb: 2, types: { ...IMAGE, "image/svg+xml": ["svg"] }, visibility: "PUBLIC" },
  material: { maxMb: 50, types: { ...DOCS, ...IMAGE, ...AUDIO }, visibility: "PRIVATE" },
  lessonMedia: { maxMb: env.UPLOAD_MAX_MB, types: { ...DOCS, ...AUDIO, ...VIDEO, ...CAPTIONS }, visibility: "PRIVATE" },
  submission: { maxMb: 20, types: { ...DOCS, ...IMAGE }, visibility: "PRIVATE" },
  attachment: { maxMb: 10, types: { ...DOCS, ...IMAGE }, visibility: "PRIVATE" },
} satisfies Record<string, Policy>;

export type UploadPurpose = keyof typeof UPLOAD_POLICIES;

/** Verifica a assinatura binária (magic bytes) dos formatos mais sensíveis. */
function sniffMatches(mime: string, buf: Buffer) {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  switch (mime) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/webp":
      return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    case "application/pdf":
      return buf.subarray(0, 5).toString() === "%PDF-";
    case "application/zip":
    case "application/x-zip-compressed":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return starts(0x50, 0x4b);
    case "image/svg+xml": {
      // SVG pode carregar scripts: aceitamos apenas arquivos sem <script>/handlers.
      const txt = buf.toString("utf8");
      return /<svg[\s>]/i.test(txt) && !/<script|on\w+\s*=|javascript:/i.test(txt);
    }
    default:
      return true;
  }
}

export async function saveUpload(
  file: File,
  purpose: UploadPurpose,
  ownerId: string,
): Promise<{ id: string; url: string; name: string; mimeType: string; sizeBytes: number }> {
  const policy: Policy = UPLOAD_POLICIES[purpose];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type || "application/octet-stream";
  const allowedExts = policy.types[mime];

  if (!allowedExts || !allowedExts.includes(ext)) {
    const accepted = [...new Set(Object.values(policy.types).flat())].join(", ");
    throw new ValidationError(`Formato não permitido. Aceitos: ${accepted}.`);
  }
  if (file.size === 0) throw new ValidationError("O arquivo está vazio.");
  if (file.size > policy.maxMb * 1024 * 1024) {
    throw new ValidationError(`O arquivo excede o limite de ${policy.maxMb} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(mime, buffer)) throw new ValidationError("O conteúdo do arquivo não corresponde ao formato informado.");

  const now = new Date();
  const key = `${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}.${ext}`;
  await storage.put(key, buffer);

  const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
  const record = await db.fileAsset.create({
    data: { ownerId, storageKey: key, originalName: safeName, mimeType: mime, sizeBytes: file.size, visibility: policy.visibility },
  });
  return { id: record.id, url: `/api/files/${record.id}`, name: safeName, mimeType: mime, sizeBytes: file.size };
}

export function fileUrl(id: string) {
  return `/api/files/${id}`;
}
