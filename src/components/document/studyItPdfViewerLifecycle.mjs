/**
 * StudyItPdfViewer lifecycle helpers.
 *
 * <p>These helpers are extracted from StudyItPdfViewer.jsx so the
 * render-storm hotfix contract can be verified with the project's
 * {@code node --test} runner without bringing up Vite, React or
 * the DOM. The viewer imports them from this module so the
 * production code and the test code share the same constants
 * and the same cancellation logic.</p>
 */

export const ZOOM_STEP = 0.25;
export const ROTATION_STEP_DEGREES = 90;
export const THUMBNAIL_WIDTH = 140;
export const RESIZE_DEBOUNCE_MS = 120;
export const RESIZE_MIN_DELTA_PX = 2;

/**
 * Detect PDF.js RenderingCancelledException without depending on
 * the pdfjs-dist runtime types. Stays tolerant across patch
 * versions of pdfjs-dist.
 */
export function isRenderingCancelled(error) {
  if (!error) return false;
  if (error.name === "RenderingCancelledException") return true;
  if (error.code === 4) return true;
  if (/rendering cancelled/i.test(String(error.message || ""))) return true;
  return false;
}

/**
 * Cancel a render task and wait for its promise to settle. The
 * promise is awaited even on cancellation so the next render
 * NEVER starts before the previous one has finished with the
 * same canvas.
 */
export async function cancelTask(task) {
  if (!task) return;
  try {
    task.cancel();
  } catch {
    /* cancellation may already have happened */
  }
  try {
    await task.promise;
  } catch (error) {
    if (!isRenderingCancelled(error)) {
      throw error;
    }
  }
}

/**
 * Reset the canvas 2D transform and clear its bitmap. The width
 * / height attributes are intentionally left untouched — the
 * caller must resize them before the next render.
 */
export function resetCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Render a single page onto a canvas, cancelling and awaiting
 * the previous task for the same page number before starting
 * the next one. This is the single funnel through which
 * {@code page.render()} must pass — it is the only place where
 * one {@code page.render()} task can ever coexist on a canvas,
 * and even then only until the previous task's promise settles.
 *
 * The {@code generationRef} + {@code generation} pair is the
 * monotonic epoch that lets a stale async continuation abort
 * itself after a zoom / rotation / document change. The
 * generation is checked BEFORE every async yield and BEFORE
 * the next {@code page.render()} call.
 */
export async function renderPageToCanvas({
  pageNumber,
  canvas,
  taskMap,
  generation,
  generationRef,
  pdf,
  rotation = 0,
  zoom = 1,
  containerWidth = 0,
  ratio = 1,
  thumbnail = false,
  minZoom = 0.5,
  maxZoom = 3.0,
  onError = null,
}) {
  if (!canvas) return;
  if (generationRef.current !== generation) return;

  const previousTask = taskMap.get(pageNumber);
  if (previousTask) {
    await cancelTask(previousTask);
    if (taskMap.get(pageNumber) === previousTask) {
      taskMap.delete(pageNumber);
    }
  }
  if (generationRef.current !== generation) return;

  let page;
  try {
    page = await pdf.getPage(pageNumber);
  } catch (error) {
    if (!isRenderingCancelled(error)) {
      throw error;
    }
    return;
  }
  if (generationRef.current !== generation) return;

  const baseViewport = page.getViewport({ scale: 1, rotation });
  const fitScale = thumbnail
    ? THUMBNAIL_WIDTH / baseViewport.width
    : containerWidth > 0
      ? containerWidth / baseViewport.width
      : 1;
  const finalScale = thumbnail
    ? fitScale
    : Math.max(minZoom, fitScale * Math.max(minZoom, Math.min(maxZoom, zoom || 1)));
  // page.render transform: positive DPR matrix when ratio > 1.
  const viewport = page.getViewport({ scale: finalScale, rotation });

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  resetCanvas(canvas);
  canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
  canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const transform = ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0];

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform,
  });
  taskMap.set(pageNumber, renderTask);

  try {
    await renderTask.promise;
  } catch (error) {
    if (isRenderingCancelled(error)) {
      // Expected during cancellation — do not log.
    } else if (typeof onError === "function") {
      onError({ pageNumber, generation, error });
    } else {
      console.error(
        "[StudyItPdfViewer] Failed to render page " + pageNumber,
        error
      );
    }
  } finally {
    if (taskMap.get(pageNumber) === renderTask) {
      taskMap.delete(pageNumber);
    }
  }
}

/**
 * Run a bounded concurrency queue. Each page is scheduled at
 * most once per batch; the queue never starts a new page if
 * the generation has moved on. The function returns a
 * synchronous {@code stop()} callback so callers can cancel
 * the queue without awaiting it.
 */
export function runBoundedQueue({
  pageNumbers,
  pdf,
  canvasMap,
  taskMap,
  generationRef,
  generation,
  concurrency,
  thumbnail = false,
  zoom = 1,
  rotation = 0,
  containerWidth = 0,
  ratio = 1,
  minZoom = 0.5,
  maxZoom = 3.0,
  onError = null,
}) {
  let cursor = 0;
  let running = 0;
  let active = true;

  const schedule = () => {
    if (!active) return;
    while (running < concurrency && cursor < pageNumbers.length) {
      const next = pageNumbers[cursor++];
      if (!canvasMap.has(next)) continue;
      const existing = taskMap.get(next);
      if (existing && existing.generation === generation) {
        // Same-generation re-entry would cause concurrent
        // page.render() calls on the same canvas. The
        // scheduler must NEVER overlap them.
        continue;
      }
      running += 1;
      const canvas = canvasMap.get(next);
      // Reserve the slot BEFORE yielding to the async
      // pipeline so a concurrent schedule() call never
      // re-queues the same pageNumber while a previous
      // page.render() task is still associated with the
      // canvas. The placeholder is replaced by the real
      // RenderTask inside renderPageToCanvas and cleared in
      // its `finally` block.
      const placeholder = {
        placeholder: true,
        pageNumber: next,
        generation,
        cancel() {
          /* placeholder has no in-flight work; the real
             RenderTask is created by renderPageToCanvas and
             replaces this entry before it returns. */
        },
        promise: Promise.resolve(),
      };
      taskMap.set(next, placeholder);
      const work = renderPageToCanvas({
        pageNumber: next,
        canvas,
        taskMap,
        generation,
        generationRef,
        pdf,
        rotation,
        zoom,
        containerWidth,
        ratio,
        thumbnail,
        minZoom,
        maxZoom,
        onError,
      });
      work
        .catch(() => {
          /* renderPageToCanvas already isolates non-cancellation
             errors per call; the queue must never re-throw
             them or the test runner will surface an
             unhandledRejection after the assertion. */
        })
        .finally(() => {
          running -= 1;
          schedule();
        });
    }
  };

  schedule();
  return () => {
    active = false;
    // Stopping the queue must also cancel every in-flight
    // task and release the per-page slot in the task map so
    // the next generation starts from a clean slate.
    for (const [pageNumber, task] of taskMap.entries()) {
      try {
        if (task && typeof task.cancel === "function") task.cancel();
      } catch {
        /* ignore */
      }
      if (taskMap.get(pageNumber) === task) {
        taskMap.delete(pageNumber);
      }
    }
  };
}

/**
 * Compute the page nearest the centre of the scroll viewport.
 *
 * <p>This is the single source of truth for {@code currentPage}
 * and the floating-card visibility flag. It walks the
 * page-element map (main pages only — never thumbnails,
 * canvases, or overlays) and finds the page whose centre is
 * nearest the viewport centre. The first page whose
 * {@code [offsetTop, offsetTop + offsetHeight]} window
 * contains the viewport centre always wins.</p>
 *
 * <p>The algorithm is intentionally synchronous and
 * allocation-free: it does not depend on any DOM measurement
 * API other than {@code offsetTop} / {@code offsetHeight}, and
 * it returns the page number as a primitive number so it can
 * be used in a {@code setCurrentPage((prev) => ...)} updater
 * without leaking references.</p>
 *
 * @param {Iterable<[number, { offsetTop: number, offsetHeight: number }]>} pageElements
 * @param {number} viewportCenter
 * @returns {number} page number nearest the viewport centre
 */
export function computeViewportCenterPage(pageElements, viewportCenter) {
  let bestPage = 1;
  let bestDistance = Infinity;
  for (const [pageNumber, element] of pageElements) {
    if (!element || typeof element.offsetTop !== "number") continue;
    const pageTop = element.offsetTop;
    const pageHeight =
      typeof element.offsetHeight === "number" && element.offsetHeight > 0
        ? element.offsetHeight
        : 1;
    const pageBottom = pageTop + pageHeight;
    if (viewportCenter >= pageTop && viewportCenter < pageBottom) {
      return pageNumber;
    }
    const pageCenter = pageTop + pageHeight / 2;
    const distance = Math.abs(pageCenter - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPage = pageNumber;
    }
  }
  return bestPage;
}
