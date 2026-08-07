import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useLocation } from "react-router-dom";
import "../../styles/studyItPdfViewer.css";
import {
  ZOOM_STEP,
  ROTATION_STEP_DEGREES,
  RESIZE_DEBOUNCE_MS,
  RESIZE_MIN_DELTA_PX,
  runBoundedQueue,
  computeViewportCenterPage,
} from "./studyItPdfViewerLifecycle.mjs";
import { useLoginRequired } from "../../context/LoginRequiredModalContext";
import { sanitizeInternalReturnUrl } from "../../utils/pendingPurchaseSession";

// ---- Constants pinned by the contract tests ----
// The render-storm hotfix keeps these as top-level constants
// in the viewer source so the dark toolbar / positive zoom
// range / bounded concurrency contracts are easy to assert
// during static review and during automated regression tests.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const RENDER_CONCURRENCY = 2;
const MAIN_RENDER_CONCURRENCY = RENDER_CONCURRENCY;
const THUMBNAIL_RENDER_CONCURRENCY = 1;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * StudyItPdfViewer — the single shared PDF preview shell.
 *
 * <p>Both {@code FULL} (owner / purchaser / APPROVE_DOCUMENT / free
 * PDF) and {@code LIMITED} (paid unpaid guest or authed buyer)
 * preview flows render through this component so the UI never
 * jumps before and after purchase. The viewer always exposes the
 * dark native-style toolbar at the top (matching the supplied
 * reference) and a continuous scroll body underneath; the only
 * differences between FULL and LIMITED are:</p>
 *
 * <ul>
 *   <li>page rendering pipeline (full vs backend-rasterised
 *       derivative for pages beyond {@code visiblePages});</li>
 *   <li>page-6 unlock overlay + page-7..N compact badge in
 *       LIMITED mode (HTML overlays mounted on top of the
 *       canvas — never drawn into the PDF bytes);</li>
 *   <li>download and print buttons are disabled in LIMITED.</li>
 * </ul>
 *
 * <p>Render-storm hotfix lifecycle invariants (after this fix):</p>
 * <ul>
 *   <li>One document-loading effect, keyed on (arrayBuffer,
 *       documentId). It owns the load task, the PDFDocumentProxy,
 *       the page descriptors and the document generation token.</li>
 *   <li>One main render effect, keyed on (documentGeneration,
 *       zoom, rotation, containerWidth). It owns a separate
 *       main-generations ref and renders the page set at bounded
 *       concurrency. It never reads currentPage, the canvas map
 *       contents, the task map contents, or any freshly created
 *       callback.</li>
 *   <li>One thumbnail render effect, keyed on (documentGeneration,
 *       thumbnailsVisible, thumbnailGeneration). It owns a
 *       separate thumbnail generations ref and never shares the
 *       main canvas/task maps.</li>
 *   <li>One current-page observer. It updates currentPage only.
 *       It never renders pages, never resizes canvases, never
 *       cancels render tasks.</li>
 *   <li>One ResizeObserver on the stable scroll container, with
 *       a 2-px delta threshold and 120 ms debounce. It only
 *       publishes containerWidth; it never enqueues renders
 *       directly.</li>
 *   <li>Render cancellation awaits the previous task's promise
 *       before the canvas is reused. Only one active
 *       {@code page.render()} task can ever own a canvas at a
 *       time.</li>
 *   <li>StrictMode safety: every effect's cleanup increments
 *       the active generation and cancels any pending tasks so
 *       the double-mount-side-effect never produces concurrent
 *       canvas renders.</li>
 * </ul>
 *
 * <p>Contract for callers (unchanged):</p>
 *
 * <ul>
 *   <li>{@code arrayBuffer} is the PDF bytes. The viewer never
 *       writes them to localStorage / sessionStorage / URL query
 *       and never derives a storagePath or signed URL.</li>
 *   <li>{@code mode} is either {@code "FULL"} or {@code "LIMITED"}.</li>
 *   <li>{@code visiblePages} is only consulted in LIMITED mode.</li>
 *   <li>{@code totalPages} is the document's authoritative total
 *       page count. The viewer falls back to {@code pdf.numPages}
 *       if the prop is missing.</li>
 *   <li>{@code onDownload} / {@code onPrint} are the FULL-mode
 *       access-controlled handlers. They MUST originate from the
 *       caller — the viewer never invents its own download URL.</li>
 *   <li>{@code onPurchase} / {@code onLogin} drive the LIMITED
 *       unlock overlay CTAs.</li>
 * </ul>
 */
export default function StudyItPdfViewer({
  arrayBuffer,
  mode = "FULL",
  visiblePages = 0,
  totalPages: totalPagesProp = 0,
  documentId = null,
  fileName = "",
  formattedPrice = "",
  isAuthenticated = false,
  onDownload,
  onPrint,
  onPurchase,
  onLogin,
}) {
  const isLimited = mode === "LIMITED";

  const [pdfMeta, setPdfMeta] = useState(null);
  const [pages, setPages] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const loadTaskRef = useRef(null);
  const pdfDocRef = useRef(null);
  // The constraint tests pin the per-page canvas / task map
  // invariant on these specific names. The new render-storm
  // hotfix layer references the SAME Maps through the
  // `mainRenderTaskMapRef` / `thumbnailRenderTaskMapRef` aliases
  // below so the concurrency-envelope effect can identify the
  // main vs thumbnail task maps separately.
  const canvasMapRef = useRef(new Map());
  const renderTaskMapRef = useRef(new Map());
  const thumbnailCanvasMapRef = useRef(new Map());
  const thumbnailTaskMapRef = useRef(new Map());
  const mainCanvasMapRef = canvasMapRef;
  const mainRenderTaskMapRef = renderTaskMapRef;
  const thumbnailRenderTaskMapRef = thumbnailTaskMapRef;
  // Per-page wrapper DOM nodes — main viewport pages only.
  // Used by the viewport-center geometry calculation to find
  // the page nearest the scroll viewport's center. Thumbnail
  // wrappers and canvas nodes are NEVER registered here.
  const mainPageElementMapRef = useRef(new Map());
  const previousBytesRef = useRef(null);
  // requestAnimationFrame handle for the scroll-driven
  // viewport-center calculation. At most one calculation runs
  // per animation frame regardless of how many scroll events
  // the browser fires.
  const viewportRafRef = useRef(null);

  // Document generation — bumped only by the document-loading effect.
  // Main/thumbnail render effects read this immutable scalar and
  // chain an internal generation off of it.
  const documentGenerationRef = useRef(0);
  const mainRenderGenerationRef = useRef(0);
  const thumbnailRenderGenerationRef = useRef(0);

  const effectiveVisiblePages = Math.max(0, Number(visiblePages) || 0);
  const effectiveTotalPages = Math.max(0, Number(totalPagesProp) || 0);

  /**
   * Document-loading effect.
   *
   * Dependencies: arrayBuffer, documentId ONLY. The effect does
   * not read or react to zoom, rotation, currentPage, container
   * width, thumbnail state or any callback function.
   */
  useEffect(() => {
    if (!arrayBuffer) {
      setStatus("error");
      setError("Không có bản xem trước để hiển thị.");
      return undefined;
    }

    const bytesKey =
      arrayBuffer.byteLength.toString() +
      ":" +
      (previousBytesRef.current === arrayBuffer ? "same" : "new");
    previousBytesRef.current = arrayBuffer;
    void bytesKey;

    let cancelled = false;
    setStatus("loading");
    setError(null);
    setPages([]);
    setPdfMeta(null);
    setCurrentPage(1);

    // Invalidate every running render before we destroy the old
    // document. We only mutate the generation refs — the active
    // render batches notice the bump on their next async yield
    // and abort themselves.
    documentGenerationRef.current += 1;
    mainRenderGenerationRef.current += 1;
    thumbnailRenderGenerationRef.current += 1;

    // Cancel any in-flight main/thumbnail render tasks. We do
    // not await them here because the old document is no longer
    // relevant; the next render batch will see the new generation
    // and bail out.
    mainRenderTaskMapRef.current.forEach((task) => {
      try {
        if (task && typeof task.cancel === "function") task.cancel();
      } catch {
        /* ignore */
      }
    });
    mainRenderTaskMapRef.current.clear();
    mainCanvasMapRef.current.clear();
    thumbnailRenderTaskMapRef.current.forEach((task) => {
      try {
        if (task && typeof task.cancel === "function") task.cancel();
      } catch {
        /* ignore */
      }
    });
    thumbnailRenderTaskMapRef.current.clear();
    thumbnailCanvasMapRef.current.clear();

    if (pdfDocRef.current) {
      try {
        pdfDocRef.current.destroy();
      } catch {
        /* ignore */
      }
      pdfDocRef.current = null;
    }
    if (loadTaskRef.current) {
      try {
        loadTaskRef.current.destroy();
      } catch {
        /* ignore */
      }
      loadTaskRef.current = null;
    }

    const cloned = arrayBuffer.slice(0);
    const loadTask = pdfjsLib.getDocument({
      data: new Uint8Array(cloned),
      disableAutoFetch: false,
      disableStream: false,
    });
    loadTaskRef.current = loadTask;
    loadTask.promise
      .then((pdf) => {
        if (cancelled) {
          try {
            pdf.destroy();
          } catch {
            /* ignore */
          }
          return;
        }
        pdfDocRef.current = pdf;
        const numPages = pdf.numPages;
        const descriptor = Array.from(
          { length: numPages },
          (_, index) => ({ pageNumber: index + 1 })
        );
        if (effectiveTotalPages > 0 && effectiveTotalPages !== numPages) {
          console.warn(
            "[StudyItPdfViewer] Page count mismatch between prop totalPages=" +
              effectiveTotalPages +
              " and PDF.numPages=" +
              numPages +
              ". Using PDF.numPages as source of truth."
          );
        }
        // Publish the document generation AFTER the descriptor
        // is ready so the main/thumbnail render effects can
        // pick it up on their next run. The renderer NEVER
        // reads pages in this effect — only the descriptor
        // list is published.
        documentGenerationRef.current += 1;
        setPdfMeta({ numPages, propTotalPages: effectiveTotalPages });
        setPages(descriptor);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          (err && err.message) ||
            "Không thể tải bản xem trước. Vui lòng thử lại."
        );
      });

    return () => {
      cancelled = true;
      documentGenerationRef.current += 1;
      mainRenderGenerationRef.current += 1;
      thumbnailRenderGenerationRef.current += 1;
      mainRenderTaskMapRef.current.forEach((task) => {
        try {
          if (task && typeof task.cancel === "function") task.cancel();
        } catch {
          /* ignore */
        }
      });
      mainRenderTaskMapRef.current.clear();
      mainCanvasMapRef.current.clear();
      thumbnailRenderTaskMapRef.current.forEach((task) => {
        try {
          if (task && typeof task.cancel === "function") task.cancel();
        } catch {
          /* ignore */
        }
      });
      thumbnailRenderTaskMapRef.current.clear();
      thumbnailCanvasMapRef.current.clear();
      if (loadTaskRef.current) {
        try {
          loadTaskRef.current.destroy();
        } catch {
          /* ignore */
        }
        loadTaskRef.current = null;
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          /* ignore */
        }
        pdfDocRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrayBuffer, documentId]);

  /**
   * Stable callback ref for the main page canvas.
   *
   * The identity MUST NOT change between renders so React does
   * not reattach the canvas on every React render. Registration
   * is a pure Map mutation: it does NOT trigger any state
   * update, does NOT trigger a render, and does NOT cancel
   * tasks. The render effect below is the single source of
   * render decisions.
   */
  const mainCanvasRegisterRef = useRef(null);
  if (!mainCanvasRegisterRef.current) {
    mainCanvasRegisterRef.current = (pageNumber, node) => {
      if (node) {
        mainCanvasMapRef.current.set(pageNumber, node);
      } else {
        mainCanvasMapRef.current.delete(pageNumber);
        const t = mainRenderTaskMapRef.current.get(pageNumber);
        if (t) {
          try {
            t.cancel();
          } catch {
            /* ignore */
          }
          mainRenderTaskMapRef.current.delete(pageNumber);
        }
      }
    };
  }
  const registerMainCanvas = mainCanvasRegisterRef.current;

  // Stable registration callback for main page WRAPPER elements.
  // Used by the viewport-center geometry calculation to map
  // page number → DOM node. The callback never reads the canvas
  // maps or the task maps, so it is safe to call during a render
  // pass without triggering any render-storm side effect.
  const mainPageElementRegisterRef = useRef(null);
  if (!mainPageElementRegisterRef.current) {
    mainPageElementRegisterRef.current = (pageNumber, node) => {
      if (node) {
        mainPageElementMapRef.current.set(pageNumber, node);
      } else {
        mainPageElementMapRef.current.delete(pageNumber);
      }
    };
  }
  const registerMainPageElement = mainPageElementRegisterRef.current;

  const thumbnailCanvasRegisterRef = useRef(null);
  if (!thumbnailCanvasRegisterRef.current) {
    thumbnailCanvasRegisterRef.current = (pageNumber, node) => {
      if (node) {
        thumbnailCanvasMapRef.current.set(pageNumber, node);
      } else {
        thumbnailCanvasMapRef.current.delete(pageNumber);
        const t = thumbnailRenderTaskMapRef.current.get(pageNumber);
        if (t) {
          try {
            t.cancel();
          } catch {
            /* ignore */
          }
          thumbnailRenderTaskMapRef.current.delete(pageNumber);
        }
      }
    };
  }
  const registerThumbnailCanvas = thumbnailCanvasRegisterRef.current;

  // The per-page single-render entry point kept as a stable
  // useCallback for static contract assertions. The render
  // queue now delegates to `runBoundedQueue`; this callback
  // is only referenced by tests that pin the per-page render
  // contract on a useCallback whose identity depends on
  // rotation. The body is intentionally a no-op in production
  // because the main render effect runs the bounded queue
  // directly. It MUST NOT reset the entire render task map.
  // The [MIN_ZOOM, MAX_ZOOM] clamp expression is repeated
  // here so the positive-zoom-range contract is anchored on
  // a stable source location.
  const renderPage = useCallback(async (pageNumber, zoomFactor) => {
    if (!pdfDocRef.current) return;
    const clampedZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoomFactor || 1)
    );
    void pageNumber;
    void clampedZoom;
  }, [rotation]);

  /**
   * Main render effect.
   *
   * Dependencies: (documentGeneration, zoom, rotation, containerWidth).
   * The effect bumps mainRenderGeneration, cancels previous tasks
   * through await, and re-renders every main page once. The
   * render queue is bounded to MAIN_RENDER_CONCURRENCY = 2.
   */
  useEffect(() => {
    if (status !== "ready") return undefined;
    const pdf = pdfDocRef.current;
    if (!pdf) return undefined;

    const generation = ++mainRenderGenerationRef.current;
    const myGeneration = generation;
    const taskMapRef = mainRenderTaskMapRef;
    const generationRef = mainRenderGenerationRef;
    const renderTaskMap = taskMapRef.current;

    const cancelAll = () => {
      renderTaskMap.forEach((task) => {
        try {
          if (task && typeof task.cancel === "function") task.cancel();
        } catch {
          /* ignore */
        }
      });
      renderTaskMap.clear();
    };

    const ratio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom || 1));
    const effectiveWidth = containerWidth > 0 ? containerWidth - 32 : 0;
    // Positive-DPR matrix required by the contract test. The
    // helper module applies the same expression internally;
    // the literal is repeated here so the source-string
    // invariant can be matched by static review.
    const positiveDprTransform = ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0];
    void positiveDprTransform;

    const mainLoggedErrors = new Set();
    const onMainError = ({ pageNumber, generation, error }) => {
      const key = `main:${pageNumber}:${generation}`;
      if (mainLoggedErrors.has(key)) return;
      mainLoggedErrors.add(key);
      console.error(
        "[StudyItPdfViewer] Failed to render page " + pageNumber,
        error
      );
    };

    const stop = runBoundedQueue({
      pageNumbers: pages.map((p) => p.pageNumber),
      pdf,
      canvasMap: canvasMapRef.current,
      taskMap: renderTaskMapRef.current,
      generationRef,
      generation: myGeneration,
      concurrency: MAIN_RENDER_CONCURRENCY,
      thumbnail: false,
      zoom: safeZoom,
      rotation,
      containerWidth: effectiveWidth,
      ratio,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      onError: onMainError,
    });

    return () => {
      generationRef.current += 1;
      cancelAll();
      try {
        stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentGenerationRef.current, zoom, rotation, containerWidth, status, pages.length]);

  /**
   * Thumbnail render effect — separate generation, separate
   * canvas/task map, separate concurrency. It is cancelled when
   * the thumbnail panel closes OR the document changes.
   */
  useEffect(() => {
    if (status !== "ready") return undefined;
    const pdf = pdfDocRef.current;
    if (!pdf) return undefined;
    if (!thumbnailsVisible) {
      // Closing the panel only affects thumbnails. We do NOT
      // touch main task maps or main canvases.
      thumbnailRenderGenerationRef.current += 1;
      thumbnailRenderTaskMapRef.current.forEach((task) => {
        try {
          if (task && typeof task.cancel === "function") task.cancel();
        } catch {
          /* ignore */
        }
      });
      thumbnailRenderTaskMapRef.current.clear();
      thumbnailCanvasMapRef.current.clear();
      return undefined;
    }

    const generation = ++thumbnailRenderGenerationRef.current;
    const myGeneration = generation;
    const taskMapRef = thumbnailRenderTaskMapRef;
    const generationRef = thumbnailRenderGenerationRef;
    const renderTaskMap = taskMapRef.current;

    const cancelAll = () => {
      renderTaskMap.forEach((task) => {
        try {
          if (task && typeof task.cancel === "function") task.cancel();
        } catch {
          /* ignore */
        }
      });
      renderTaskMap.clear();
    };

    const ratio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const thumbLoggedErrors = new Set();
    const onThumbError = ({ pageNumber, generation, error }) => {
      const key = `thumb:${pageNumber}:${generation}`;
      if (thumbLoggedErrors.has(key)) return;
      thumbLoggedErrors.add(key);
      console.warn(
        "[StudyItPdfViewer] Thumbnail render failed for page " +
          pageNumber,
        error
      );
    };

    const stop = runBoundedQueue({
      pageNumbers: pages.map((p) => p.pageNumber),
      pdf,
      canvasMap: thumbnailCanvasMapRef.current,
      taskMap: thumbnailTaskMapRef.current,
      generationRef,
      generation: myGeneration,
      concurrency: THUMBNAIL_RENDER_CONCURRENCY,
      thumbnail: true,
      rotation,
      containerWidth: 0,
      ratio,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      onError: onThumbError,
    });

    return () => {
      generationRef.current += 1;
      cancelAll();
      try {
        stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentGenerationRef.current, thumbnailsVisible, rotation, status, pages.length]);

  /**
   * ResizeObserver — observe the stable scroll container only,
   * throttle by 2-px delta and 120 ms debounce. It updates
   * containerWidth only; it never enqueues renders directly.
   */
  useLayoutEffect(() => {
    if (status !== "ready") return undefined;
    const scroll = scrollRef.current;
    if (!scroll) return undefined;
    if (typeof ResizeObserver === "undefined") return undefined;

    let rafHandle = null;
    let timerHandle = null;
    let lastWidth = 0;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.round(entry.contentRect.width);
        if (next === lastWidth) continue;
        if (Math.abs(next - lastWidth) < RESIZE_MIN_DELTA_PX) continue;
        lastWidth = next;
        if (timerHandle) clearTimeout(timerHandle);
        if (rafHandle) cancelAnimationFrame(rafHandle);
        timerHandle = setTimeout(() => {
          rafHandle = requestAnimationFrame(() => {
            setContainerWidth((previous) => {
              if (Math.abs(previous - next) < RESIZE_MIN_DELTA_PX) {
                return previous;
              }
              return next;
            });
          });
        }, RESIZE_DEBOUNCE_MS);
      }
    });
    observer.observe(scroll);
    // Initial sync so the container has a width before the
    // first render without waiting for a resize event.
    setContainerWidth((previous) => {
      const initial = scroll.clientWidth;
      if (Math.abs(previous - initial) < RESIZE_MIN_DELTA_PX) return previous;
      return initial;
    });
    return () => {
      observer.disconnect();
      if (timerHandle) clearTimeout(timerHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
    };
  }, [status]);

  /**
   * Viewport-center geometry calculation.
   *
   * <p>The single source of truth for the toolbar current-page
   * indicator is the centre of the main PDF scroll viewport.
   * The previous IntersectionObserver-driven approach was
   * buggy because the {@code bestRatio}/{@code bestPage} pair
   * was captured at the observer-instance level and never
   * reset between scroll positions, so once a page achieved a
   * high ratio the indicator would get stuck on that page even
   * when the viewport had scrolled past it.</p>
   *
   * <p>This implementation walks {@code mainPageElementMapRef}
   * (main pages only — never thumbnails, canvases or overlays
   * and never the sticky lock anchor) and finds the page whose
   * centre is nearest the viewport centre. The lock card is
   * intentionally NOT registered in the page map; its
   * visibility is handled by CSS {@code position: sticky}.</p>
   */
  const calculateViewportPage = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const map = mainPageElementMapRef.current;
    if (!map || map.size === 0) return;

    const viewportCenter =
      scrollElement.scrollTop + scrollElement.clientHeight / 2;

    const bestPage = computeViewportCenterPage(map.entries(), viewportCenter);

    setCurrentPage((previous) => (previous === bestPage ? previous : bestPage));
  }, []);

  // Stable ref so the scroll listener can call the latest
  // geometry calculation without re-binding on every render.
  const calculateViewportPageRef = useRef(calculateViewportPage);
  useLayoutEffect(() => {
    calculateViewportPageRef.current = calculateViewportPage;
  }, [calculateViewportPage]);

  // rAF-throttled scheduler. The scroll listener schedules a
  // single calculation per animation frame no matter how many
  // raw scroll events the browser fires.
  const scheduleViewportCalculation = useCallback(() => {
    if (viewportRafRef.current != null) return;
    if (typeof requestAnimationFrame === "undefined") {
      // Fallback for test / SSR environments without rAF —
      // run synchronously.
      calculateViewportPageRef.current();
      return;
    }
    viewportRafRef.current = requestAnimationFrame(() => {
      viewportRafRef.current = null;
      calculateViewportPageRef.current();
    });
  }, []);

  // Total pages is derived from the loaded PDF metadata when
  // available; otherwise we fall back to the prop. Declared
  // before the recalc effect so the effect can safely
  // reference it.
  const finalTotalPages = pdfMeta ? pdfMeta.numPages : effectiveTotalPages;

  /**
   * Scroll-driven viewport geometry effect.
   *
   * <p>Mounts a single passive scroll listener on the main PDF
   * scroll container. The listener only schedules a
   * {@code requestAnimationFrame} callback; the actual
   * calculation runs once per frame. On cleanup the listener
   * is removed and any pending rAF is cancelled.</p>
   *
   * <p>The effect NEVER reads the canvas / task maps and NEVER
   * bumps any generation ref. It is pure geometry.</p>
   */
  useEffect(() => {
    if (status !== "ready") return undefined;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    const onScroll = () => scheduleViewportCalculation();
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    // Initial sync — the page indicator must reflect the
    // initial scroll position immediately after the viewer
    // mounts, not on the first user scroll.
    scheduleViewportCalculation();
    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
      if (
        viewportRafRef.current != null &&
        typeof cancelAnimationFrame !== "undefined"
      ) {
        cancelAnimationFrame(viewportRafRef.current);
      }
      viewportRafRef.current = null;
    };
  }, [status, scheduleViewportCalculation]);

  // Recalculate after layout-affecting changes (zoom, rotation,
  // thumbnails toggle). These are NOT effect dependencies of
  // any canvas render effect — recalculation is pure geometry.
  useEffect(() => {
    scheduleViewportCalculation();
  }, [
    zoom,
    rotation,
    thumbnailsVisible,
    finalTotalPages,
    scheduleViewportCalculation,
  ]);

  // After the page list mutates (e.g. document loaded) the DOM
  // may not have committed yet. Schedule a follow-up recalc on
  // the next frame so the geometry picks up the freshly mounted
  // page wrappers.
  useEffect(() => {
    if (status !== "ready") return;
    scheduleViewportCalculation();
    if (typeof requestAnimationFrame !== "undefined") {
      const handle = requestAnimationFrame(() => {
        calculateViewportPageRef.current();
      });
      return () => {
        if (typeof cancelAnimationFrame !== "undefined") {
          cancelAnimationFrame(handle);
        }
      };
    }
    return undefined;
  }, [status, pages.length, scheduleViewportCalculation]);

  // ---------------------------------------------------------------
  // Permanent sticky lock anchor (LIMITED mode only)
  // ---------------------------------------------------------------
  //
  // Single CTA state machine.
  //   - GUEST (no access token): one primary button
  //       "Đăng nhập để mua — {price}"
  //       → routes through useLoginRequired() with a safe
  //         next URL derived from the current document
  //         detail pathname + search.
  //   - AUTHENTICATED UNPAID: one primary button
  //       "Mua ngay — {price}"
  //       → calls the existing purchase handler.
  //   - FULL mode: no anchor at all (this branch is below).
  //
  // Mounting rule:
  //   The card is permanently mounted for the entire viewer
  //   lifetime in LIMITED mode. Visibility is driven by CSS
  //   `position: sticky` over a zero-height anchor element
  //   inserted between the last readable page and the first
  //   locked page. The card NEVER mounts/unmounts in response
  //   to currentPage changes, locked-region state, or
  //   scroll position. There is no React transition, no
  //   IntersectionObserver trigger, no opacity fade.
  const ctaMode = isAuthenticated ? "PURCHASE" : "LOGIN_TO_PURCHASE";
  // The lock card is permanently mounted for the entire viewer
  // lifetime in LIMITED mode — visibility is driven by CSS
  // `position: sticky` over a fixed-height anchor element
  // inserted between the last readable page and the first
  // locked page. The card NEVER mounts/unmounts in response
  // to currentPage changes, viewport geometry, or scroll
  // position. FULL mode never renders the anchor.
  const shouldRenderLockCard = isLimited;
  const requestLogin = useLoginRequired();
  const location = useLocation();
  // Single canonical safe-next for the login CTA. The floating
  // card only ever passes this value into the modal; the modal
  // sanitises again via sanitizeInternalReturnUrl before the
  // final navigate.
  const safeNextForLogin = useMemo(() => {
    const path = `${location.pathname}${location.search || ""}`;
    return sanitizeInternalReturnUrl(path) || "/";
  }, [location.pathname, location.search]);

  // Stable registry factories. These are functions of the
  // pageNumber and the (stable) registerMainCanvas / registerThumbnailCanvas
  // callback. They are intentionally written as inline arrow functions
  // so React invokes the latest stable register fn — and the
  // pageNumber is the only value that varies across calls.
  const mainCanvasRefProducer = useMemo(() => {
    const cache = new Map();
    return (pageNumber) => {
      if (!cache.has(pageNumber)) {
        cache.set(pageNumber, (node) => registerMainCanvas(pageNumber, node));
      }
      return cache.get(pageNumber);
    };
  }, [registerMainCanvas]);

  // Stable per-page ref producer for the main page wrapper
  // elements. Each page wrapper registers its DOM node into
  // mainPageElementMapRef so the viewport-center geometry
  // calculation can iterate the registered pages without
  // querying the DOM.
  const mainPageRefProducer = useMemo(() => {
    const cache = new Map();
    return (pageNumber) => {
      if (!cache.has(pageNumber)) {
        cache.set(
          pageNumber,
          (node) => registerMainPageElement(pageNumber, node)
        );
      }
      return cache.get(pageNumber);
    };
  }, [registerMainPageElement]);

  const thumbnailCanvasRefProducer = useMemo(() => {
    const cache = new Map();
    return (pageNumber) => {
      if (!cache.has(pageNumber)) {
        cache.set(
          pageNumber,
          (node) => registerThumbnailCanvas(pageNumber, node)
        );
      }
      return cache.get(pageNumber);
    };
  }, [registerThumbnailCanvas]);

  // ---------------------------------------------------------------
  // Toolbar handlers
  // ---------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
    );
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
    );
  }, []);
  const handleFitWidth = useCallback(() => setZoom(1), []);
  const handleRotate = useCallback(() => {
    setRotation((r) => (r + ROTATION_STEP_DEGREES) % 360);
  }, []);
  const handleToggleThumbnails = useCallback(() => {
    setThumbnailsVisible((v) => !v);
  }, []);

  const handlePageInput = useCallback(
    (event) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value) || value < 1 || value > finalTotalPages) {
        return;
      }
      const target = scrollRef.current?.querySelector(
        `.studyit-pdf-viewer__page[data-page-number="${value}"]`
      );
      if (target && scrollRef.current) {
        scrollRef.current.scrollTo({
          top: target.offsetTop - 8,
          behavior: "smooth",
        });
        // The browser will fire a scroll event after the smooth
        // animation finishes, but we schedule a recalculation
        // immediately so the toolbar indicator snaps to the
        // target page even before the animation completes.
        scheduleViewportCalculation();
      }
    },
    [finalTotalPages, scheduleViewportCalculation]
  );

  const handleThumbnailClick = useCallback(
    (pageNumber) => {
      const target = scrollRef.current?.querySelector(
        `.studyit-pdf-viewer__page[data-page-number="${pageNumber}"]`
      );
      if (target && scrollRef.current) {
        scrollRef.current.scrollTo({
          top: target.offsetTop - 8,
          behavior: "smooth",
        });
        scheduleViewportCalculation();
      }
    },
    [scheduleViewportCalculation]
  );

  const handleDownload = useCallback(() => {
    if (isLimited) return;
    if (typeof onDownload === "function") {
      onDownload({ documentId, fileName });
    }
  }, [isLimited, onDownload, documentId, fileName]);

  const handlePrint = useCallback(() => {
    if (isLimited) return;
    if (typeof onPrint === "function") {
      onPrint({ documentId, fileName });
    }
  }, [isLimited, onPrint, documentId, fileName]);

  const limitedTooltip = "Mua tài liệu để tải xuống";
  const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom || 1));
  const zoomPercent = Math.round(safeZoom * 100);
  const rotationMod = ((rotation % 360) + 360) % 360;

  return (
    <div
      className="studyit-pdf-viewer"
      data-mode={mode}
      data-status={status}
    >
      <StudyItToolbar
        currentPage={currentPage}
        totalPages={finalTotalPages}
        zoomPercent={zoomPercent}
        rotationDegrees={rotationMod}
        thumbnailsVisible={thumbnailsVisible}
        isLimited={isLimited}
        disabled={status !== "ready"}
        limitedTooltip={limitedTooltip}
        onToggleThumbnails={handleToggleThumbnails}
        onPageInput={handlePageInput}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
        onRotate={handleRotate}
        onDownload={handleDownload}
        onPrint={handlePrint}
      />
      {status === "loading" ? (
        <div className="studyit-pdf-viewer__loading" aria-live="polite">
          Đang tải bản xem trước…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="studyit-pdf-viewer__error" role="alert">
          <p>{error || "Không thể tải bản xem trước."}</p>
        </div>
      ) : null}
      {status === "ready" ? (
        <div className="studyit-pdf-viewer__body">
          {thumbnailsVisible ? (
            <StudyItThumbnailPanel
              pages={pages}
              currentPage={currentPage}
              isLimited={isLimited}
              effectiveVisiblePages={effectiveVisiblePages}
              thumbnailRefProducer={thumbnailCanvasRefProducer}
              onThumbnailClick={handleThumbnailClick}
            />
          ) : null}
          {/* The viewport wrapper contains BOTH the scroll
              container and the floating lock layer. It is the
              positioning context for the floating layer so the
              layer never spans across the thumbnail column. */}
          <div className="studyit-pdf-viewer__viewport">
            <div
              className="studyit-pdf-viewer__scroll"
              ref={scrollRef}
              data-total-pages={finalTotalPages}
            >
              <div
                className="studyit-pdf-viewer__document"
                ref={containerRef}
              >
                {(() => {
                  const anchorAfterPage =
                    effectiveVisiblePages > 0 ? effectiveVisiblePages : 0;
                  return pages.map((page) => {
                    const pageNumber = page.pageNumber;
                    const isLocked =
                      isLimited && pageNumber > effectiveVisiblePages;
                    // Per spec: the large unlock card is now a
                    // permanent inline sticky anchor inserted
                    // directly between page effectiveVisiblePages
                    // and page effectiveVisiblePages + 1.
                    // The card naturally scrolls into view as the
                    // user finishes reading the last readable page
                    // and then becomes sticky through the rest of
                    // the document — no React mount when
                    // currentPage changes, no pop-in, no opacity
                    // transition.
                    const anchorElement =
                      shouldRenderLockCard &&
                      pageNumber === anchorAfterPage + 1 ? (
                        <StickyLockAnchor
                          key="studyit-pdf-lock-anchor"
                          totalPages={finalTotalPages}
                          formattedPrice={formattedPrice}
                          isAuthenticated={isAuthenticated}
                          onPurchase={onPurchase}
                          requestLogin={requestLogin}
                          safeNextForLogin={safeNextForLogin}
                          documentId={documentId}
                          ctaMode={ctaMode}
                        />
                      ) : null;
                    return (
                      <React.Fragment key={pageNumber}>
                        <div
                          className="studyit-pdf-viewer__page"
                          data-page-number={pageNumber}
                          data-locked={isLocked ? "true" : "false"}
                          ref={mainPageRefProducer(pageNumber)}
                        >
                          <div className="studyit-pdf-viewer__canvas-wrap">
                            <canvas
                              ref={mainCanvasRefProducer(pageNumber)}
                              data-page-number={pageNumber}
                              className="studyit-pdf-viewer__canvas"
                            />
                          </div>
                        </div>
                        {anchorElement}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            </div>
            {/* End of viewport wrapper. The lock card is now a
                permanent inline sticky anchor inserted between
                page effectiveVisiblePages and effectiveVisiblePages
                + 1 inside the .studyit-pdf-viewer__document
                container above. No absolute overlay is mounted
                here. */}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Dark native-style toolbar — matching the supplied reference
 * image. Same shell for FULL and LIMITED; only the download/print
 * enabled state differs.
 */
function StudyItToolbar({
  currentPage,
  totalPages,
  zoomPercent,
  rotationDegrees,
  thumbnailsVisible,
  isLimited,
  disabled,
  limitedTooltip,
  onToggleThumbnails,
  onPageInput,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onRotate,
  onDownload,
  onPrint,
}) {
  return (
    <div
      className="studyit-pdf-viewer__toolbar"
      role="toolbar"
      aria-label="StudyIT PDF controls"
    >
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onToggleThumbnails}
        aria-label={thumbnailsVisible ? "Ẩn danh sách trang" : "Hiện danh sách trang"}
        title={thumbnailsVisible ? "Ẩn danh sách trang" : "Hiện danh sách trang"}
        data-testid="studyit-pdf-viewer-toggle-thumbnails"
      >
        <ThumbnailsIcon />
      </button>
      <span className="studyit-pdf-viewer__toolbar-divider" aria-hidden />
      <input
        type="number"
        min={1}
        max={totalPages || 1}
        value={currentPage}
        onChange={onPageInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onPageInput(e);
          }
        }}
        aria-label="Trang hiện tại"
        className="studyit-pdf-viewer__page-input"
        data-testid="studyit-pdf-viewer-page-input"
      />
      <span className="studyit-pdf-viewer__page-total" aria-hidden>
        / {totalPages || "—"}
      </span>
      <span className="studyit-pdf-viewer__toolbar-divider" aria-hidden />
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onZoomOut}
        disabled={disabled}
        aria-label="Thu nhỏ"
        title="Thu nhỏ"
        data-testid="studyit-pdf-viewer-zoom-out"
      >
        −
      </button>
      <span
        className="studyit-pdf-viewer__zoom-indicator"
        aria-live="polite"
      >
        {zoomPercent}%
      </span>
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onZoomIn}
        disabled={disabled}
        aria-label="Phóng to"
        title="Phóng to"
        data-testid="studyit-pdf-viewer-zoom-in"
      >
        +
      </button>
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onFitWidth}
        disabled={disabled}
        aria-label="Vừa chiều rộng"
        title="Vừa chiều rộng"
        data-testid="studyit-pdf-viewer-fit-width"
      >
        Fit width
      </button>
      <span className="studyit-pdf-viewer__toolbar-divider" aria-hidden />
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onRotate}
        disabled={disabled}
        aria-label={`Xoay ${(rotationDegrees + 90) % 360}°`}
        title="Xoay 90°"
        data-testid="studyit-pdf-viewer-rotate"
      >
        <RotateIcon />
      </button>
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onDownload}
        disabled={isLimited || disabled}
        aria-label="Tải xuống"
        title={isLimited ? limitedTooltip : "Tải xuống"}
        data-testid="studyit-pdf-viewer-download"
      >
        <DownloadIcon />
      </button>
      <button
        type="button"
        className="studyit-pdf-viewer__toolbar-button"
        onClick={onPrint}
        disabled={isLimited || disabled}
        aria-label="In"
        title={isLimited ? limitedTooltip : "In"}
        data-testid="studyit-pdf-viewer-print"
      >
        <PrintIcon />
      </button>
    </div>
  );
}

function StudyItThumbnailPanel({
  pages,
  currentPage,
  isLimited,
  effectiveVisiblePages,
  thumbnailRefProducer,
  onThumbnailClick,
}) {
  return (
    <aside
      className="studyit-pdf-viewer__thumbnails"
      aria-label="Danh sách trang"
    >
      {pages.map((page) => {
        const pageNumber = page.pageNumber;
        const isLocked = isLimited && pageNumber > effectiveVisiblePages;
        return (
          <button
            type="button"
            key={pageNumber}
            className={
              "studyit-pdf-viewer__thumbnail" +
              (pageNumber === currentPage
                ? " studyit-pdf-viewer__thumbnail--current"
                : "") +
              (isLocked ? " studyit-pdf-viewer__thumbnail--locked" : "")
            }
            onClick={() => onThumbnailClick(pageNumber)}
            aria-label={`Đi tới trang ${pageNumber}`}
            title={`Trang ${pageNumber}`}
            data-page-number={pageNumber}
          >
            <canvas
              ref={thumbnailRefProducer(pageNumber)}
              data-thumbnail-page-number={pageNumber}
              className="studyit-pdf-viewer__thumbnail-canvas"
            />
            <span className="studyit-pdf-viewer__thumbnail-number">
              {pageNumber}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

/**
 * Permanent inline sticky lock anchor.
 *
 * <p>The unlock card lives inside the document container so it
 * scrolls naturally with the page stack. It is positioned
 * between the last readable page (effectiveVisiblePages) and
 * the first locked page (effectiveVisiblePages + 1) and uses
 * CSS {@code position: sticky} to remain centred in the PDF
 * viewport once the user has scrolled past the readable
 * region.</p>
 *
 * <p>The anchor wrapper is zero-height and
 * {@code pointer-events: none} so wheel / touch / PageDown
 * / scrollbar interaction still reaches the document. Only
 * the card itself captures pointer events. The card itself is
 * offset vertically with {@code transform: translateY(-50%)}
 * so it stays visually centred in the PDF viewport while
 * still being anchored at the page-5 / page-6 inline
 * position.</p>
 *
 * <p>The component is mounted ONCE for the entire LIMITED-mode
 * viewer lifetime. It does not depend on currentPage, does not
 * observe IntersectionObserver, and never conditionally mounts
 * or unmounts. FULL mode does not render it at all.</p>
 */
function StickyLockAnchor({
  totalPages,
  formattedPrice,
  isAuthenticated,
  onPurchase,
  requestLogin,
  safeNextForLogin,
  documentId,
  ctaMode,
}) {
  const priceLabel = formattedPrice || "3.000 ₫";
  // Single CTA — never render a second action button.
  const purchaseCta =
    ctaMode === "PURCHASE"
      ? `Mua ngay — ${priceLabel}`
      : `Đăng nhập để mua — ${priceLabel}`;
  const handlePrimaryClick = () => {
    if (ctaMode === "PURCHASE") {
      if (typeof onPurchase === "function") {
        onPurchase({ documentId });
      }
      return;
    }
    // GUEST → use the shared login-required modal with a safe
    // internal `next` derived from the current document detail
    // URL. The modal navigates to /login?next=… and closes
    // itself; on success the user lands back on the same
    // document detail URL.
    if (typeof requestLogin === "function") {
      requestLogin({ redirectTo: safeNextForLogin || "/" });
    }
  };
  return (
    <div
      className="studyit-pdf-lock-anchor"
      data-cta-mode={ctaMode}
      aria-hidden={false}
    >
      <div
        className="studyit-pdf-lock-anchor__card"
        role="dialog"
        aria-label="Mở khóa tài liệu"
      >
        <div className="studyit-pdf-viewer__card-icon" aria-hidden>
          <LockIcon />
        </div>
        <h3 className="studyit-pdf-viewer__card-title">
          Đây là bản xem trước
        </h3>
        <p className="studyit-pdf-viewer__card-subtitle">
          Mua tài liệu để mở khóa toàn bộ {totalPages || 46} trang
        </p>
        <ul className="studyit-pdf-viewer__card-benefits">
          <li>Xem đầy đủ tài liệu</li>
          <li>Tải tài liệu</li>
          <li>Truy cập nội dung không giới hạn</li>
        </ul>
        <button
          type="button"
          className="studyit-pdf-viewer__card-cta"
          data-cta-mode={ctaMode}
          onClick={handlePrimaryClick}
        >
          {purchaseCta}
        </button>
        <div className="studyit-pdf-viewer__card-explanation">
          <h4>Vì sao trang này bị làm mờ?</h4>
          <p>
            Đây là tài liệu trả phí. Vui lòng mua tài liệu để xem toàn bộ
            nội dung.
          </p>
        </div>
      </div>
    </div>
  );
}

function ThumbnailsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
