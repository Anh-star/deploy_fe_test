/**
 * PAID document Supabase upload helper — Phase S1-C2.
 *
 * <p>Uses only the publishable / anon-key Supabase client (the same one the
 * free upload helper instantiates). NEVER accepts a service-role key, never
 * constructs a permanent URL, and never calls {@code getPublicUrl}.
 *
 * <p>The {@code bucket}, {@code path}, and {@code token} arguments are taken
 * VERBATIM from the backend's paid-upload-target response. The frontend
 * does not generate or alter them.
 *
 * <p>The signed token lives only in the local scope of the caller; the
 * helper itself does not store it in any module-level state and does not
 * log it.
 */
import { createClient } from "@supabase/supabase-js";

let supabaseSingleton = null;

function getSupabaseForPaidDocuments() {
  if (supabaseSingleton) return supabaseSingleton;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
  }

  supabaseSingleton = createClient(url.trim(), anonKey.trim());
  return supabaseSingleton;
}

/**
 * Internal pure helper. Exposed for unit tests so the contract can be
 * pinned without spinning up a Supabase client. The production code path
 * is {@link uploadPaidFileViaSignedUrl} below.
 *
 * <p>{@code contentTypeOverride} is the resolved canonical MIME supplied by
 * the caller. When present it MUST be used as the
 * {@code uploadToSignedUrl} {@code contentType} option so that valid
 * files whose browser {@code file.type} is empty still upload with the
 * canonical MIME derived from their extension. When omitted, the
 * helper falls back to {@code file.type} (legacy behaviour for callers
 * that pre-date the Phase S1-C2 orchestrator).
 *
 * @param {{ storage: { from: (b: string) => any } }} supabase
 * @param {File} file
 * @param {{ bucket: string, path: string, token: string }} target
 * @param {{ contentType?: string }} [options]
 */
export async function uploadPaidFileViaSignedUrlWithClient(
  supabase,
  file,
  target,
  options
) {
  if (!file) throw new Error("Thiếu tệp để tải lên.");
  if (!target || typeof target !== "object") {
    throw new Error("Thiếu paid upload target.");
  }
  const { bucket, path, token } = target;
  if (typeof bucket !== "string" || !bucket.trim()) {
    throw new Error("Paid upload target thiếu bucket.");
  }
  if (typeof path !== "string" || !path.trim()) {
    throw new Error("Paid upload target thiếu path.");
  }
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Paid upload target thiếu token.");
  }

  // Prefer the explicit resolved canonical MIME so empty browser MIME
  // does not break the upload. Fall back to file.type only when the
  // caller did not pass an override (legacy callers).
  const overrideContentType =
    typeof options?.contentType === "string" ? options.contentType.trim() : "";
  const contentType = overrideContentType || file.type || undefined;

  const { data, error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message
        : "Paid upload thất bại.";
    throw new Error(message);
  }
  if (!data || typeof data.path !== "string") {
    throw new Error("Paid upload phản hồi không hợp lệ.");
  }
  return { path: data.path, fullPath: data.fullPath ?? "" };
}

/**
 * Upload the supplied file to the backend-supplied signed-upload target.
 *
 * <p>This function deliberately does not return any URL. The caller should
 * pass the returned {@code uploadId} (kept in the submit closure) into the
 * paid create-document request, which the backend binds to the existing
 * Supabase object inside its own transaction.
 *
 * <p>The optional {@code contentType} argument is the resolved canonical
 * MIME and MUST be threaded into the {@code uploadToSignedUrl} options.
 * Phase S1-C2 orchestrator callers always pass it; legacy callers may
 * omit it (in which case {@code file.type} is used as a fallback).
 *
 * @param {File} file
 * @param {{ bucket: string, path: string, token: string }} target
 * @param {{ contentType?: string }} [options]
 * @returns {Promise<{ path: string, fullPath: string }>}
 */
export async function uploadPaidFileViaSignedUrl(file, target, options) {
  const supabase = getSupabaseForPaidDocuments();
  return uploadPaidFileViaSignedUrlWithClient(supabase, file, target, options);
}