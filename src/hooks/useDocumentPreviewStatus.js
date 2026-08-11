import { useCallback, useEffect, useRef, useState } from "react";
import { getDocumentPreviewStatus } from "../api/adminDocumentApi";

/**
 * Polling hook for the moderator-only admin preview-status endpoint.
 *
 * <p>Phase O4B final: this hook is dedicated to the admin metadata
 * endpoint
 * {@code GET /api/admin/documents/{id}/preview-status}. It NEVER
 * hits the secure binary preview endpoint
 * {@code GET /api/documents/{id}/preview}, NEVER processes PDF
 * bytes, and NEVER inspects 202 / 409 response bodies &mdash; those
 * belong to the secure-preview endpoint.</p>
 *
 * <p>Contract:</p>
 * <ul>
 *   <li>Axios default rejection behavior &mdash; 401, 403, 500
 *       propagate as errors.</li>
 *   <li>Polling stops when the status is non-polling (READY, DEAD,
 *       non-office) or when the hook is unmounted.</li>
 *   <li>Ownership of in-flight requests: an obsolete request's
 *       {@code finally} block clears {@code abortRef} and
 *       {@code fetchingRef} only when its controller still owns
 *       {@code abortRef.current}.</li>
 *   <li>401 and 403 stop polling immediately &mdash; they are
 *       authorization failures, not transient errors.</li>
 *   <li>500 surfaces as a real error; it is NEVER coerced into a
 *       preview status descriptor.</li>
 * </ul>
 *
 * @param {string|null|undefined} documentId - the document UUID; polling
 *   does not start when this is falsy.
 * @param {object} [options]
 * @param {number} [options.intervalMs=2500] - polling interval in milliseconds.
 *   Default 2.5&nbsp;seconds sits inside the latency-optimised backend
 *   (3&nbsp;second worker poll) so a brand-new FULL row is picked up
 *   before the worker can finish its first conversion.
 * @param {number} [options.maxRetries=3] - how many consecutive HTTP failures are
 *   tolerated before the hook reports an error state.
 * @param {boolean} [options.officeOnly=true] - when true, the hook treats any
 *   non-office response (no safe state descriptor, or 200 PDF) as terminal.
 */
export function useDocumentPreviewStatus(documentId, options = {}) {
  const {
    intervalMs = 2500,
    maxRetries = 3,
    officeOnly = true,
  } = options;

  /**
   * Statuses that require continued polling. The hook keeps fetching
   * while the response carries one of these states.
   */
  const POLLING_STATUSES = ["PENDING", "PROCESSING", "RETRY"];

  const [status, setStatus] = useState(
    /** @type {import('../api/types/documentPreview').DocumentPreviewStatus|null} */ (null)
  );
  const [loading, setLoading] = useState(false);
  const [httpError, setHttpError] = useState(/** @type {string|null} */ (null));

  /** Count of consecutive HTTP errors. Resets to 0 on success. */
  const consecutiveErrorsRef = useRef(0);
  /** The live timer handle. Cleared on unmount or documentId change. */
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null));
  /** True while a fetch is in-flight. Prevents overlapping requests. */
  const fetchingRef = useRef(false);
  /** Ref to the latest AbortController, used to cancel in-flight requests. */
  const abortRef = useRef(/** @type {AbortController|null} */ (null));

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(
    async (isActive) => {
      if (!isActive()) return;
      if (fetchingRef.current) return;

      // Cancel any in-flight request from a previous cycle. The
      // controller we create below becomes the new current request.
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      const controller = new AbortController();
      abortRef.current = controller;

      fetchingRef.current = true;
      setLoading(true);
      setHttpError(null);

      try {
        // The hook is dedicated to the admin metadata endpoint.
        // Axios default rejection behavior applies: 401 / 403 / 500
        // propagate as real errors and the catch block below stops
        // polling on 401 / 403.
        const payload = await getDocumentPreviewStatus(documentId, {
          signal: controller.signal,
        });

        if (!isActive()) return;
        if (controller.signal.aborted) return;

        consecutiveErrorsRef.current = 0;

        const next = {
          officeDocument: payload?.officeDocument ?? !officeOnly,
          fullStatus: payload?.fullStatus ?? null,
          lastError: payload?.lastError ?? null,
          attemptCount: payload?.attemptCount ?? null,
          maxAttempts: payload?.maxAttempts ?? null,
          safeMessage: payload?.message ?? null,
          retryable: payload?.retryable === true,
        };
        setStatus(next);
        setLoading(false);

        if (!next.officeDocument) {
          clearTimer();
          return;
        }
        if (
          next.fullStatus === "READY" ||
          next.fullStatus === "DEAD" ||
          next.fullStatus === "LOCKED"
        ) {
          clearTimer();
          return;
        }
        if (!POLLING_STATUSES.includes(next.fullStatus)) {
          clearTimer();
          setHttpError("Trạng thái bản xem trước không hợp lệ");
          return;
        }
        if (isActive()) {
          clearTimer();
          timerRef.current = setTimeout(() => fetchStatus(isActive), intervalMs);
        }
      } catch (err) {
        if (!isActive()) return;
        if (controller.signal.aborted) return;

        // Treat 401 / 403 as definitive — do not retry.
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          consecutiveErrorsRef.current = maxRetries + 1;
        }

        consecutiveErrorsRef.current += 1;
        setLoading(false);

        if (consecutiveErrorsRef.current > maxRetries) {
          setHttpError(err?.response?.data?.message || err?.message || "Lỗi kết nối");
          clearTimer();
        } else {
          setHttpError(null);
          if (isActive()) {
            clearTimer();
            timerRef.current = setTimeout(
              () => fetchStatus(isActive),
              intervalMs
            );
          }
        }
      } finally {
        // Request ownership invariant: a completing request is
        // allowed to clear abortRef / fetchingRef ONLY when it is
        // still the current request. A newer request may have
        // replaced abortRef.current already; erasing those refs
        // from an obsolete request would hand ownership of the
        // newer request back to nothing and let a stale setTimeout
        // fire an overlapping fetchStatus.
        if (abortRef.current === controller) {
          abortRef.current = null;
          fetchingRef.current = false;
        }
      }
    },
    [documentId, intervalMs, maxRetries, officeOnly, clearTimer]
  );

  useEffect(() => {
    if (!documentId) {
      setStatus(null);
      setLoading(false);
      setHttpError(null);
      consecutiveErrorsRef.current = 0;
      clearTimer();
      return undefined;
    }

    // Track whether the component is still mounted. Scoped to this
    // effect only — no out-of-scope references.
    let active = true;
    const isActive = () => active;

    fetchStatus(isActive);

    return () => {
      active = false;
      clearTimer();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      fetchingRef.current = false;
    };
  }, [documentId, fetchStatus, clearTimer]);

  /** Manually refresh the current status. Resets error state. */
  const refresh = useCallback(() => {
    if (!documentId) return;

    clearTimer();

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    fetchingRef.current = false;
    consecutiveErrorsRef.current = 0;
    setHttpError(null);

    fetchStatus(() => true);
  }, [documentId, fetchStatus, clearTimer]);

  return { status, loading, httpError, refresh };
}

/**
 * Reads the safe state descriptor from the admin metadata endpoint.
 *
 * @param {{
 *   officeDocument?: boolean,
 *   fullStatus?: string,
 *   lastError?: string|null,
 *   attemptCount?: number|null,
 *   maxAttempts?: number|null,
 *   message?: string|null,
 *   retryable?: boolean
 * } | null | undefined} payload
 * @returns {object|null}
 */
function readSafeStateFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.officeDocument === false) return null;
  if (typeof payload.fullStatus !== "string") return null;
  return {
    officeDocument: true,
    fullStatus: payload.fullStatus,
    lastError: payload.lastError ?? null,
    attemptCount: payload.attemptCount ?? null,
    maxAttempts: payload.maxAttempts ?? null,
    safeMessage: payload.message ?? null,
    retryable: payload.retryable === true,
  };
}
