/**
 * Fetches PDF bytes from the document preview endpoint and normalises
 * them into the same shape used by the secure preview hook.
 *
 * <p>Free documents (paid=false) go through the same
 * {@code GET /api/documents/{id}/preview} endpoint as paid documents.
 * The backend resolves the free access path and returns FULL PDF bytes
 * for READY artifacts. Free documents have no access gate — the
 * endpoint is publicly accessible and the response is identical to the
 * paid owner/purchaser flow.</p>
 *
 * <p>This hook intentionally uses the same
 * {@code documentService.getDocumentPreview} path as
 * {@link SecureDocumentPreview} so both free and paid READY
 * documents arrive at the shared {@link StudyItPdfViewer} in the
 * same way: an {@code ArrayBuffer} with a known page count.</p>
 */

import { useCallback, useEffect, useState } from "react";
import { documentService } from "../services/api";

/**
 * @param {{ kind: string|null, pdfBuffer: ArrayBuffer|null, totalPages: number|null, message: string|null }} result
 * @returns {{
 *   kind: "pdf"|"error"|null,
 *   mode: "FULL"|null,
 *   previewState: "READY"|null,
 *   pdfBuffer: ArrayBuffer|null,
 *   totalPages: number|null,
 *   message: string|null,
 *   retryable: boolean
 * }}
 */
export function normalizeFreePreviewResult(result) {
  if (!result) {
    return { kind: null, mode: null, previewState: null, pdfBuffer: null, totalPages: null, message: null, retryable: false };
  }
  if (result.kind === "pdf") {
    return {
      kind: "pdf",
      mode: result.mode || "FULL",
      previewState: "READY",
      pdfBuffer: result.pdfBuffer instanceof ArrayBuffer ? result.pdfBuffer : null,
      totalPages: typeof result.totalPages === "number" ? result.totalPages : null,
      message: null,
      retryable: false,
    };
  }
  // Any non-pdf result (waiting, dead, locked, error) maps to error for
  // free documents — free documents do not poll, so a non-READY response
  // is treated as unavailable.
  return {
    kind: "error",
    mode: null,
    previewState: null,
    pdfBuffer: null,
    totalPages: null,
    message: result.message || "Không thể tải bản xem trước.",
    retryable: false,
  };
}

/**
 * Hook that fetches PDF bytes for a free document from the
 * document preview endpoint ({@code GET /api/documents/{id}/preview}).
 *
 * <p>The endpoint resolves free access and returns FULL PDF bytes for
 * READY artifacts — the same response as the paid owner flow. Free
 * documents do not poll; a non-200 response means the preview is
 * unavailable and the component shows a simple error state.</p>
 *
 * <p>Mount lifecycle:</p>
 * <ul>
 *   <li>On mount or documentId change, call
 *       {@code documentService.getDocumentPreview(documentId)}.</li>
 *   <li>While in flight, {@code loading} is true and {@code preview}
 *       is null.</li>
 *   <li>On success (HTTP 200 PDF), normalise to
 *       {@code kind:"pdf", mode:"FULL", previewState:"READY"}.</li>
 *   <li>On any non-2xx response (HTTP 202 waiting, 409 dead,
 *       network error), normalise to {@code kind:"error"}.</li>
 *   <li>Free documents never poll.</li>
 * </ul>
 *
 * @param {string|null|undefined} documentId
 * @returns {{ preview: object|null, loading: boolean, refresh: () => void }}
 */
export function useFreeDocumentPdfBytes(documentId) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const abortRef = { current: null };
  const activeRef = { current: true };

  const triggerFetch = useCallback(async () => {
    if (!activeRef.current) return;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      // documentService.getDocumentPreview interprets the axios response
      // internally and returns the discriminated result object:
      //   { kind: "pdf", pdfBuffer, mode, totalPages, ... }
      //   { kind: "waiting", previewState, message, retryable, ... }
      //   { kind: "dead", previewState, message, retryable, ... }
      //   { kind: "locked", message }
      //   { kind: "error", message }
      const result = await documentService.getDocumentPreview(documentId, {
        signal: controller.signal,
      });

      if (!activeRef.current || controller.signal.aborted) return;

      const normalized = normalizeFreePreviewResult(result);
      if (!activeRef.current) return;
      setPreview(normalized);
      setLoading(false);
    } catch (err) {
      if (!activeRef.current || controller.signal.aborted) return;
      if (err?.name === "AbortError") return;

      const normalized = normalizeFreePreviewResult({
        kind: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Không thể tải bản xem trước.",
      });
      if (!activeRef.current) return;
      setPreview(normalized);
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    activeRef.current = true;
    if (!documentId) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }
    setPreview(null);
    setLoading(true);
    triggerFetch();
    return () => {
      activeRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [documentId, triggerFetch]);

  const refresh = useCallback(() => {
    if (!documentId) return;
    setPreview(null);
    setLoading(true);
    triggerFetch();
  }, [documentId, triggerFetch]);

  return { preview, loading, refresh };
}
