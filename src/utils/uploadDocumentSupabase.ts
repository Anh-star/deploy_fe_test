/**
 * Upload tài liệu (file + thumbnail + hồ sơ chứng chỉ) lên Supabase Storage.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseSingleton: SupabaseClient | null = null;

function getSupabaseForDocuments(): SupabaseClient {
  if (supabaseSingleton) return supabaseSingleton;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
  }

  supabaseSingleton = createClient(url.trim(), anonKey.trim());
  return supabaseSingleton;
}

function normalizeFolderPrefix(folder: string | undefined): string {
  if (!folder?.trim()) return "";
  return folder
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}

function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i <= 0 || i === fileName.length - 1) return "";
  return fileName.slice(i);
}

export type UploadDocumentStorageResult = {
  url: string;
  fileName: string;
  path: string;
};

export const DEFAULT_DOCUMENT_BUCKET = "documents";
export const CONTRIBUTOR_BUCKET =
  (import.meta.env.VITE_SUPABASE_CONTRIBUTOR_BUCKET as string | undefined)?.trim() ||
  "contributor-requests";

/**
 * @param folder Tiền tố trong bucket (vd. assets/UploadedDocuments hoặc files)
 * @param bucketName Tên bucket (mặc định "documents")
 */
export async function uploadDocumentToSupabase(
  file: File,
  folder?: string,
  bucketName: string = DEFAULT_DOCUMENT_BUCKET
): Promise<UploadDocumentStorageResult> {
  const isDocument =
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.name.toLowerCase().endsWith(".doc") ||
    file.name.toLowerCase().endsWith(".docx") ||
    file.name.toLowerCase().endsWith(".pptx");

  const maxSize = isDocument ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`Kích thước tệp vượt quá giới hạn ${isDocument ? "25MB" : "10MB"}.`);
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (!allowedTypes.includes(file.type) && !isDocument) {
    throw new Error(
      "Định dạng tệp không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, PDF, DOC, DOCX, và PPTX."
    );
  }

  const ext = fileExtension(file.name);
  const prefix = normalizeFolderPrefix(folder);
  const objectPath = prefix
    ? `${prefix}/${crypto.randomUUID()}${ext}`
    : `${crypto.randomUUID()}${ext}`;

  const supabase = getSupabaseForDocuments();
  const { error } = await supabase.storage.from(bucketName).upload(objectPath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    throw new Error(error.message || "Upload failed");
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath);

  return {
    url: data.publicUrl,
    fileName: file.name,
    path: objectPath,
  };
}

/**
 * Upload hồ sơ/chứng chỉ/tài liệu mẫu của Contributor lên bucket "contributor-requests".
 */
export async function uploadContributorFileToSupabase(
  file: File,
  folder?: string
): Promise<UploadDocumentStorageResult> {
  return uploadDocumentToSupabase(file, folder, CONTRIBUTOR_BUCKET);
}
