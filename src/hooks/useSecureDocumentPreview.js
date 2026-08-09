import { useCallback, useEffect, useRef, useState } from "react";
import { documentService } from "../services/api";
import {
  securePreviewValidateStatus,
  normalizeSecurePreviewResult,
  normalizeSecurePreviewError,
  isSecurePreviewTerminal,
  shouldPollSecurePreview,
  computeAdaptiveCadenceMs,
} from "./securePreviewHelpers";

/**
 * Polling hook for the AUTHORIZED secure binary preview endpoint
 * {@code GET /api/documents/{id}/preview}.
 *
 * <h2>Wire contract — exact whitelist</h2>
 *
 * The hook installs {@link securePreviewValidateStatus} on every
 * request. The whitelist accepts 2xx (including 202) and 409 only.
 * 401 / 403 / 500 propagate as real axios errors.
 *
 * <h2>Polling policy — terminal-only</h2>
 *
 * <ul>
 *   <li>The hook polls only for waiting states whose previewState
 *       is PENDING / PROCESSING / RETRY. See
 *       {@link shouldPollSecurePreview}.</li>
 *   <li>401 / 403 / 500 → {@code kind: "error"}. NO follow-up
 *       timer is scheduled. Manual {@link refresh} is allowed and
 *       issues exactly one new operator-initiated request.</li>
 *   <li>Locked / dead / error are terminal — the timer is cleared
 *       and no follow-up is scheduled.</li>
 *   <li>Transient cancellation caused by unmount / refresh does
 *       NOT surface an error.</li>
 * </ul>
 *
 * <h2>Unified result contract</h2>
 *
 * <pre>
 * {
 *   kind: "pdf" | "waiting" | "locked" | "dead" | "error",
 *   mode: "FULL" | "LIMITED" | "LOCKED" | null,
 *   previewState: "PENDING" | "PROCESSING" | "RETRY" |
 *                 "READY" | "DEAD" | null,
 *   pdfBuffer: ArrayBuffer | null,
 *   message: string | null,
 *   retryable: boolean
 * }
 * </pre>
 *
 * FULL and LIMITED both use {@code kind: "pdf"}; {@code mode}
 * differentiates them. waiting / locked / dead / error NEVER carry
 * a {@code pdfBuffer}. The final normalized result is produced by
 * a single {@link normalizeSecurePreviewResult} call that decodes
 * any Blob to ArrayBuffer.
 *
 * <h2>Ownership</h2>
 *
 * <ul>
 *   <li>This hook owns its own timer, AbortController, and fetching
 *       flag. The admin-status hook
 *       {@code useDocumentPreviewStatus} owns its own disjoint
 *       refs.</li>
 *   <li>An obsolete request's finally block may clear
 *       {@code abortRef} / {@code fetchingRef} only when its
 *       controller still owns {@code abortRef.current}.</li>
 *   <li>Concurrent requests are prevented by the
 *       {@code fetchingRef} guard.</li>
 * </ul>
 *
 * @param {string|null|undefined} documentId
 * @param {object} [options]
 * @param {number} [options.intervalMs=2500] - DEPRECATED. The polling
 *   cadence is now driven by {@link computeAdaptiveCadenceMs}: first
 *   15&nbsp;seconds poll at 1_000&nbsp;ms, 15–30&nbsp;seconds at
 *   2_000&nbsp;ms, beyond 30&nbsp;seconds at 3_000&nbsp;ms. The
 *   argument is preserved for backward compatibility with any
 *   caller that already passed it; it is otherwise ignored.
 */
export function useSecureDocumentPreview(documentId, options = {}) {
  const { intervalMs: _ignoredIntervalMs = 2500 } = options;

  /** @type {[object|null,(v:object|null)=>void]} */
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [httpError, setHttpError] = useState(null);

  const timerRef = useRef(null);
  const fetchingRef = useRef(false);
  const abortRef = useRef(null);
  const activeRef = useRef(true);
  /**
   * Phase-1 speed: anchor for the adaptive cadence. Set on the
   * FIRST poll of the current document. Reset whenever
   * {@code documentId} changes (route change A → B) so the next
   * poll for document B starts at the fast end of the curve.
   */
  const sessionStartRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isActive = () => activeRef.current === true;

  /**
   * Schedule the next poll. NO-OP for terminal results and when
   * the component is unmounted.
   *
   * Phase-1 speed: the delay is computed from the elapsed time
   * since the FIRST poll of the current session:
   *
   *   elapsedMs < 15_000   →  1_000 ms
   *   elapsedMs < 30_000   →  2_000 ms
   *   elapsedMs ≥ 30_000   →  3_000 ms
   *
   * A pending schedule is replaced (not stacked) so the next poll
   * always reflects the latest elapsed value. This guarantees:
   *
   *   - at most one scheduled timer per component;
   *   - the timer is consumed by exactly one fetch on the next tick;
   *   - the request-finishes → setTimeout(next poll) pattern is
   *     preserved (no overlapping requests);
   *   - a route change A → B (documentId change) resets
   *     sessionStartRef so the new document starts fast.
   */
  const scheduleFollowUp = useCallback(
    (result) => {
      if (!isActive()) return;
      if (!shouldPollSecurePreview(result)) return;
      clearTimer();
      const start = sessionStartRef.current;
      const elapsed = start == null ? 0 : Date.now() - start;
      const delay = computeAdaptiveCadenceMs(elapsed);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (isActive() && typeof triggerFetchRef.current === "function") {
          triggerFetchRef.current();
        }
      }, delay);
    },
    [clearTimer]
  );

  const triggerFetchRef = useRef(null);

  const triggerFetch = useCallback(async () => {
    if (!isActive()) return;
    if (fetchingRef.current) return;

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
      const rawResult = await documentService.getDocumentPreview(
        documentId,
        {
          signal: controller.signal,
          validateStatus: securePreviewValidateStatus,
        }
      );

      if (!isActive() || controller.signal.aborted) return;

      const finalResult = await normalizeSecurePreviewResult(rawResult);

      if (!isActive() || controller.signal.aborted) return;

      setPreview(finalResult);
      setLoading(false);

      if (isSecurePreviewTerminal(finalResult)) {
        clearTimer();
        return;
      }
      scheduleFollowUp(finalResult);
    } catch (err) {
      if (!isActive() || controller.signal.aborted) return;
      const errorResult = normalizeSecurePreviewError(err);
      if (!errorResult) {
        // Cancellation — do not surface.
        return;
      }
      clearTimer();
      setLoading(false);
      setHttpError(errorResult.message);
      setPreview(errorResult);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        fetchingRef.current = false;
      }
    }
  }, [documentId, clearTimer, scheduleFollowUp]);

  // Keep the ref pointing at the latest triggerFetch so that the
  // setTimeout callback in scheduleFollowUp always invokes the
  // current closure.
  triggerFetchRef.current = triggerFetch;

  // Mount / unmount lifecycle.
  useEffect(() => {
    if (!documentId) {
      setPreview(null);
      setLoading(false);
      setHttpError(null);
      clearTimer();
      activeRef.current = true;
      sessionStartRef.current = null;
      return undefined;
    }
    activeRef.current = true;
    // Phase-1 speed: anchor the adaptive cadence at the first
    // poll of the current session. Subsequent polls read this
    // anchor to compute the next delay.
    sessionStartRef.current = Date.now();
    triggerFetch();
    return () => {
      activeRef.current = false;
      sessionStartRef.current = null;
      clearTimer();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      fetchingRef.current = false;
    };
  }, [documentId, triggerFetch, clearTimer]);

  /**
   * Manually refresh — operator-initiated. Issues exactly one new
   * request and resets the error / preview state.
   */
  const refresh = useCallback(() => {
    if (!documentId) return;
    setHttpError(null);
    clearTimer();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    fetchingRef.current = false;
    triggerFetch();
  }, [documentId, triggerFetch, clearTimer]);

  return { preview, loading, httpError, refresh };
}
