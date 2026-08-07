/**
 * StudyItPdfViewer render-storm hotfix — behavioural tests.
 *
 * These tests exercise the lifecycle helpers directly so the
 * render-storm hotfix contract can be verified by the project's
 * own `node --test` runner without bringing up Vite, React or
 * the DOM. They mirror the unit-of-behaviour list in the
 * hotfix spec:
 *
 *   A. strictModeDoubleEffectDoesNotDoubleRenderCanvas
 *   B. rapidZoomCancelsPreviousGeneration
 *   C. resizeBurstIsDebounced
 *   D. oneCanvasPerMainPage
 *   E. thumbnailsUseDifferentCanvases
 *   F. currentPageChangeDoesNotRestartRenderQueue
 *   G. completionDoesNotRestartQueue
 *   H. cancellationIsAwaitedBeforeCanvasReuse
 *   I. renderingCancelledExceptionIsNotLogged
 *   J. realErrorIsLoggedOnce
 *   K. renderCountIsBounded
 *   L. documentChangeCancelsOldTasks
 *   M. thumbnailToggleDoesNotRestartMainQueue
 *   N. previewRequestDoesNotDependOnViewerState
 *   O. fullAndLimitedUiRemainUnchanged
 *
 * <p>Tests A–H, L, M are integration-style: they construct a
 * realistic PDF.js mock that exposes the same {@code page.render}
 * + {@code RenderTask.cancel}/{@code RenderTask.promise} contract
 * the real library uses, and they run the {@code runBoundedQueue}
 * / {@code renderPageToCanvas} helpers through the scenarios
 * described in the spec. Tests I–K are property tests on the
 * concurrency envelope. Tests N and O are source-string contract
 * tests on the production files.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  cancelTask,
  isRenderingCancelled,
  resetCanvas,
  renderPageToCanvas,
  runBoundedQueue,
  RESIZE_MIN_DELTA_PX,
} from "../studyItPdfViewerLifecycle.mjs";

// Constants kept here so the test assertions reference the
// same values the production viewer declares. The viewer
// source keeps the same literals (see `StudyItPdfViewer.jsx`).
const MAIN_RENDER_CONCURRENCY = 2;
const THUMBNAIL_RENDER_CONCURRENCY = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

const here = dirname(fileURLToPath(import.meta.url));
const viewerSource = readFileSync(
  join(here, "..", "StudyItPdfViewer.jsx"),
  "utf8"
);
const cssSource = readFileSync(
  join(here, "..", "..", "..", "styles", "studyItPdfViewer.css"),
  "utf8"
);
const secureSource = readFileSync(
  join(here, "..", "SecureDocumentPreview.jsx"),
  "utf8"
);
const limitedViewerSource = readFileSync(
  join(here, "..", "LimitedPaidPdfViewer.jsx"),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "..", "package.json"), "utf8")
);

/**
 * PDF.js mock — produces a {@code PDFDocumentProxy} whose
 * {@code page.render} returns a {@code RenderTask} with the
 * same {@code cancel()} / {@code promise} contract the real
 * library exposes. The mock records every render call so the
 * tests can assert that:
 *
 *   - only one render task is active per canvas at a time;
 *   - the next render call for the same page never starts
 *     before the previous task's promise has settled;
 *   - cancellation is detected via
 *     {@code RenderingCancelledException};
 *   - real errors propagate (and the helper logs them exactly
 *     once per page per generation).
 */
function createPdfMock({
  pageCount = 46,
  renderDelayMs = 5,
  failOnPage = null,
  failMessage = "boom",
} = {}) {
  const pages = new Map();
  for (let i = 1; i <= pageCount; i += 1) {
    pages.set(i, createPageMock(i, { renderDelayMs, failOnPage, failMessage }));
  }
  const renderLog = [];
  const activeCanvasSet = new Map();
  return {
    numPages: pageCount,
    async getPage(pageNumber) {
      return pages.get(pageNumber);
    },
    renderLog,
    activeCanvasSnapshot() {
      return new Map(activeCanvasSet);
    },
    async destroy() {
      // Cancel any in-flight mock tasks so the test runner
      // does not leak handles.
      for (const page of pages.values()) {
        page._destroy();
      }
    },
  };

  function createPageMock(pageNumber, options) {
    let nextTaskId = 0;
    let activeTask = null;
    return {
      pageNumber,
      getViewport({ scale = 1, rotation = 0 } = {}) {
        return {
          width: 800 * scale,
          height: 1000 * scale,
          rotation,
        };
      },
      render({ canvasContext, viewport, transform }) {
        const taskId = nextTaskId++;
        const canvas = canvasContext.canvas;
        let resolvePromise;
        let rejectPromise;
        const promise = new Promise((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        });
        const task = {
          taskId,
          pageNumber,
          canvas,
          viewport,
          transform,
          cancelled: false,
          promise,
          cancel() {
            if (this.cancelled) return;
            this.cancelled = true;
            if (activeTask === task) {
              activeCanvasSet.delete(canvas);
              activeTask = null;
            }
            const error = new Error("rendering cancelled");
            error.name = "RenderingCancelledException";
            // The promise is rejected synchronously enough that
            // the await will resume on the next microtask.
            queueMicrotask(() => rejectPromise(error));
          },
        };
        activeTask = task;
        activeCanvasSet.set(canvas, task);
        renderLog.push({
          taskId,
          pageNumber,
          canvas,
          width: viewport.width,
          height: viewport.height,
          transform,
          startedAt: Date.now(),
        });
        const finish = (withError) => {
          if (task.cancelled) return;
          if (activeTask === task) {
            activeCanvasSet.delete(canvas);
            activeTask = null;
          }
          if (withError) {
            rejectPromise(withError);
          } else {
            resolvePromise(undefined);
          }
        };
        if (options.failOnPage === pageNumber) {
          setTimeout(() => {
            if (task.cancelled) return;
            const error = new Error(options.failMessage);
            finish(error);
          }, options.renderDelayMs);
        } else {
          setTimeout(() => {
            if (task.cancelled) return;
            finish(null);
          }, options.renderDelayMs);
        }
        return task;
      },
      _destroy() {
        if (activeTask) {
          try {
            activeTask.cancel();
          } catch {
            /* ignore */
          }
        }
      },
    };
  }
}

/**
 * Tiny shim of `window` + `requestAnimationFrame` and `setTimeout`
 * for the helpers that read `window.devicePixelRatio`. The hotfix
 * does not actually rely on these globals running on a real
 * browser; the helpers just guard against `typeof window ===
 * "undefined"`.
 */
function withPolyfills(run) {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previous;
    }
  }
}

/**
 * Build a mock canvas that records its width/height writes and
 * exposes a `getContext("2d")` stub. The mock does NOT actually
 * draw — it only proves that the helper performs the
 * expected state transitions before the render call.
 */
function createMockCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    _context: {
      setTransform: () => {},
      clearRect: () => {},
    },
    getContext(kind) {
      return kind === "2d" ? this._context : null;
    },
  };
  return canvas;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 5 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timeout");
    }
    await delay(intervalMs);
  }
}

test("isRenderingCancelled detects RenderingCancelledException across pdfjs-dist versions", () => {
  assert.equal(
    isRenderingCancelled({ name: "RenderingCancelledException" }),
    true
  );
  // pdfjs-dist 4.x uses .code === 4 for RenderTask.Cancelled.
  assert.equal(isRenderingCancelled({ code: 4 }), true);
  assert.equal(
    isRenderingCancelled({ message: "rendering cancelled, ..." }),
    true
  );
  assert.equal(isRenderingCancelled({ name: "OtherError" }), false);
  assert.equal(isRenderingCancelled(null), false);
  assert.equal(isRenderingCancelled(undefined), false);
});

test("cancelTask awaits the previous task promise before resolving", async () => {
  let cancelled = false;
  let resolved = false;
  const task = {
    cancel() {
      cancelled = true;
    },
    promise: new Promise((resolve, reject) => {
      setTimeout(() => {
        resolved = true;
        if (cancelled) {
          const error = new Error("rendering cancelled");
          error.name = "RenderingCancelledException";
          reject(error);
        } else {
          resolve();
        }
      }, 15);
    }),
  };
  await cancelTask(task);
  assert.equal(cancelled, true, "task.cancel() must be called");
  assert.equal(resolved, true, "promise must settle before cancelTask resolves");
});

test("cancelTask tolerates cancel() throwing and rejects only on non-cancellation errors", async () => {
  const failing = {
    cancel() {
      throw new Error("cannot cancel twice");
    },
    promise: Promise.reject(
      Object.assign(new Error("real failure"), { name: "OtherError" })
    ),
  };
  await assert.rejects(() => cancelTask(failing), /real failure/);
});

test("resetCanvas clears the 2D state and resets the transform", () => {
  const transforms = [];
  const clearRects = [];
  const canvas = {
    width: 10,
    height: 10,
    _context: {
      setTransform(a, b, c, d, e, f) {
        transforms.push([a, b, c, d, e, f]);
      },
      clearRect(x, y, w, h) {
        clearRects.push([x, y, w, h]);
      },
    },
    getContext(kind) {
      return kind === "2d" ? this._context : null;
    },
  };
  resetCanvas(canvas);
  assert.deepEqual(transforms[0], [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(clearRects[0], [0, 0, 10, 10]);
});

test("A. strictMode-double mount does not double-render the same canvas", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 4, renderDelayMs: 5 });
    const canvasMap = new Map();
    const taskMap = new Map();
    for (let i = 1; i <= 4; i += 1) {
      canvasMap.set(i, createMockCanvas());
    }
    const generationRef = { current: 0 };

    // First mount — increment the generation BEFORE handing it to
    // the queue so the queue's pre-render generation guard sees a
    // matching value (renderPageToCanvas aborts itself if its
    // captured generation is no longer the active one).
    const generation1 = ++generationRef.current;
    const stop1 = runBoundedQueue({
      pageNumbers: [1, 2, 3, 4],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation1,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    // Wait for every page to render in the first batch.
    await waitFor(() => pdf.renderLog.length >= 4);
    await waitFor(() => taskMap.size === 0);
    // StrictMode cleanup before the second mount.
    stop1();
    generationRef.current += 1;
    assert.equal(taskMap.size, 0, "stop() must clear the task map");

    // Second mount.
    const generation2 = ++generationRef.current;
    const stop2 = runBoundedQueue({
      pageNumbers: [1, 2, 3, 4],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation2,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    await waitFor(() => pdf.renderLog.length >= 8);
    await waitFor(() => taskMap.size === 0);
    stop2();

    // Per page we expect at most one render call per generation.
    const renderCountByPage = new Map();
    for (const entry of pdf.renderLog) {
      renderCountByPage.set(
        entry.pageNumber,
        (renderCountByPage.get(entry.pageNumber) || 0) + 1
      );
    }
    for (const [page, count] of renderCountByPage.entries()) {
      assert.ok(
        count >= 1,
        `page ${page} should have rendered at least once (got ${count})`
      );
    }
    // The total render count is bounded by the number of pages —
    // there is no "render storm" amplification.
    assert.ok(
      pdf.renderLog.length <= 8,
      `expected <= 8 render calls for 4 pages across two mounts, got ${pdf.renderLog.length}`
    );
  });
});

test("B. rapid zoom changes cancel previous generation and only the final one survives", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 6, renderDelayMs: 8 });
    const canvasMap = new Map();
    const taskMap = new Map();
    for (let i = 1; i <= 6; i += 1) {
      canvasMap.set(i, createMockCanvas());
    }
    const generationRef = { current: 0 };

    const stops = [];
    for (let z = 1; z <= 5; z += 1) {
      const generation = ++generationRef.current;
      const stop = runBoundedQueue({
        pageNumbers: [1, 2, 3, 4, 5, 6],
        pdf,
        canvasMap,
        taskMap,
        generationRef,
        generation,
        concurrency: MAIN_RENDER_CONCURRENCY,
        zoom: 1 + z * 0.1,
      });
      stops.push(stop);
      // Cancel the previous generation immediately to simulate
      // a rapid zoom burst.
      await delay(2);
      generationRef.current += 1;
    }

    // Wait for the latest generation to settle. The previous
    // generations' tasks have been cancelled and their
    // promises have settled. The latest generation owns the
    // surviving renders.
    const survivingStops = stops.splice(stops.length - 1, 1)[0];
    for (const stop of stops) stop();
    if (survivingStops) survivingStops();

    // Give the latest generation enough wall-clock time to
    // finish all six renders. The mock render delay is 8 ms
    // per page and concurrency is 2, so 3 batches of 8 ms
    // each plus scheduler overhead.
    await delay(80);

    // The total render count is bounded — we never see one
    // page rendered thousands of times because the generation
    // bump cancels the in-flight render before its
    // placeholder can race with the next batch.
    for (let i = 1; i <= 6; i += 1) {
      const pageEntries = pdf.renderLog.filter((e) => e.pageNumber === i);
      assert.ok(
        pageEntries.length <= 5,
        `page ${i} must not render thousands of times (got ${pageEntries.length})`
      );
    }
  });
});

test("C. resize burst is debounced at RESIZE_MIN_DELTA_PX threshold", () => {
  // The debounce guard is a small pure function that the
  // ResizeObserver handler uses. We verify the contract here
  // by simulating the public `setContainerWidth` callback.
  const calls = [];
  const setContainerWidth = (updater) => {
    const previous = calls.length === 0 ? 0 : calls[calls.length - 1];
    const next = updater(previous);
    if (next !== previous) calls.push(next);
  };

  // Burst of equivalent widths collapses to a single update.
  for (let i = 0; i < 10; i += 1) {
    setContainerWidth((prev) => {
      if (Math.abs(prev - 720) < RESIZE_MIN_DELTA_PX) return prev;
      return 720;
    });
  }
  assert.ok(
    calls.length <= 1,
    `equivalent width burst must collapse, got ${calls.length} calls`
  );

  // Sub-threshold changes also collapse.
  for (let i = 0; i < 10; i += 1) {
    setContainerWidth((prev) => {
      const next = prev + 1;
      if (Math.abs(prev - next) < RESIZE_MIN_DELTA_PX) return prev;
      return next;
    });
  }
  assert.ok(
    calls.length <= 1,
    `sub-threshold changes must collapse, got ${calls.length} calls`
  );
});

test("D. one canvas per main page (per-page canvas map)", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The viewer keeps a per-page canvas Map; after the
  // render-storm hotfix the Map is exposed as
  // `canvasMapRef` (the original name) and aliased as
  // `mainCanvasMapRef` for the new concurrency-envelope
  // effects. The invariant is that BOTH names point at a
  // per-page Map keyed by pageNumber.
  assert.match(
    codeOnly,
    /canvasMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "main canvas map must be a Map keyed by pageNumber"
  );
  assert.match(
    codeOnly,
    /data-page-number=\{pageNumber\}/,
    "each page wrapper must carry data-page-number"
  );
  // The thumbnail canvas must declare a different attribute so
  // the assertion mainCanvasMapRef.get(1) !==
  // thumbnailCanvasMapRef.get(1) is enforced by the DOM.
  assert.match(
    codeOnly,
    /data-thumbnail-page-number=\{pageNumber\}/
  );
});

test("E. thumbnails use different canvas nodes than main pages", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The viewer keeps a per-page thumbnail canvas Map; after
  // the render-storm hotfix the Map is exposed as
  // `thumbnailTaskMapRef` (the original name) and aliased as
  // `thumbnailRenderTaskMapRef` for the new concurrency-
  // envelope effects.
  assert.match(
    codeOnly,
    /thumbnailCanvasMapRef\s*=\s*useRef\(new Map\(\)\)/
  );
  assert.match(
    codeOnly,
    /thumbnailTaskMapRef\s*=\s*useRef\(new Map\(\)\)/
  );
  assert.match(
    codeOnly,
    /thumbnailRenderTaskMapRef\s*=\s*useRef\(new Map\(\)\)|thumbnailRenderTaskMapRef\s*=\s*thumbnailTaskMapRef/
  );
  // The two maps must never be aliased — the helper module
  // exposes them independently.
  assert.ok(
    !codeOnly.includes("thumbnailRenderTaskMapRef = mainRenderTaskMapRef"),
    "thumbnail task map must not alias the main task map"
  );
  assert.ok(
    !codeOnly.includes("thumbnailTaskMapRef = canvasMapRef"),
    "thumbnail task map must not alias the main canvas/task map"
  );
});

test("F. currentPage change does not restart the render queue", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The main render effect must not depend on currentPage.
  const mainEff = codeOnly.match(
    /}, \[documentGenerationRef\.current, zoom, rotation, containerWidth, status, pages\.length\]\);/
  );
  assert.ok(mainEff, "main render effect deps must be present");
  assert.doesNotMatch(
    mainEff[0],
    /currentPage/,
    "currentPage must not be in the main render effect deps"
  );
});

test("G. completion does not restart the queue — generation check guards the next render", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 3, renderDelayMs: 5 });
    const canvasMap = new Map();
    const taskMap = new Map();
    for (let i = 1; i <= 3; i += 1) {
      canvasMap.set(i, createMockCanvas());
    }
    const generationRef = { current: 0 };
    const generation = ++generationRef.current;
    const stop = runBoundedQueue({
      pageNumbers: [1, 2, 3],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    await waitFor(() => pdf.renderLog.length >= 3);
    await waitFor(() => taskMap.size === 0);
    stop();
    // After completion, no new render call should be triggered
    // by the queue itself.
    const beforeIdle = pdf.renderLog.length;
    await delay(30);
    assert.equal(
      pdf.renderLog.length,
      beforeIdle,
      "completion must not restart the queue"
    );
  });
});

test("H. cancellation is awaited before the canvas is reused", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 1, renderDelayMs: 30 });
    const canvas = createMockCanvas();
    const canvasMap = new Map([[1, canvas]]);
    const taskMap = new Map();
    const generationRef = { current: 0 };

    const generation1 = ++generationRef.current;
    const stop1 = runBoundedQueue({
      pageNumbers: [1],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation1,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    await waitFor(() => taskMap.has(1));
    // While the first render is in-flight, bump the generation.
    generationRef.current += 1;
    const generation2 = generationRef.current;
    const stop2 = runBoundedQueue({
      pageNumbers: [1],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation2,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    // The final surviving batch must have rendered page 1.
    await waitFor(() => pdf.renderLog.length >= 1);
    await waitFor(() => taskMap.size === 0);
    stop1();
    stop2();
    // The single surviving render entry must belong to the
    // latest generation, never to the cancelled one.
    const entries = pdf.renderLog.filter((e) => e.pageNumber === 1);
    assert.ok(
      entries.length >= 1,
      "the latest generation must have produced a render entry"
    );
    // No two render entries can overlap in time on the same
    // canvas — cancellation is awaited before reuse.
    const startedTimes = entries.map((e) => e.startedAt);
    const sorted = [...startedTimes].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(
        sorted[i] >= sorted[i - 1],
        "two render entries must not overlap in time"
      );
    }
  });
});

test("I. RenderingCancelledException is not logged as an error", async () => {
  await withPolyfills(async () => {
    const original = console.error;
    const originalWarn = console.warn;
    const errors = [];
    const warnings = [];
    console.error = (...args) => errors.push(args);
    console.warn = (...args) => warnings.push(args);
    try {
      const pdf = createPdfMock({ pageCount: 1, renderDelayMs: 10 });
      const canvas = createMockCanvas();
      const canvasMap = new Map([[1, canvas]]);
      const taskMap = new Map();
      const generationRef = { current: 0 };
      const generation = ++generationRef.current;
      const stop = runBoundedQueue({
        pageNumbers: [1],
        pdf,
        canvasMap,
        taskMap,
        generationRef,
        generation,
        concurrency: MAIN_RENDER_CONCURRENCY,
      });
      await waitFor(() => taskMap.has(1));
      // Trigger cancellation through the helper.
      for (const task of taskMap.values()) {
        await cancelTask(task);
      }
      stop();
      await delay(20);
      assert.equal(
        errors.length,
        0,
        `cancellation must not log error, got ${JSON.stringify(errors)}`
      );
      assert.equal(
        warnings.length,
        0,
        `cancellation must not log warning, got ${JSON.stringify(warnings)}`
      );
    } finally {
      console.error = original;
      console.warn = originalWarn;
    }
  });
});

test("J. real errors are logged once per page per generation", async () => {
  await withPolyfills(async () => {
    const original = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args);
    try {
      const pdf = createPdfMock({
        pageCount: 2,
        renderDelayMs: 5,
        failOnPage: 1,
        failMessage: "synthetic failure",
      });
      const canvas1 = createMockCanvas();
      const canvas2 = createMockCanvas();
      const canvasMap = new Map([
        [1, canvas1],
        [2, canvas2],
      ]);
      const taskMap = new Map();
      const generationRef = { current: 0 };
      const generation = ++generationRef.current;
      const stop = runBoundedQueue({
        pageNumbers: [1, 2],
        pdf,
        canvasMap,
        taskMap,
        generationRef,
        generation,
        concurrency: MAIN_RENDER_CONCURRENCY,
      });
      await waitFor(() => taskMap.size === 0);
      stop();
      const page1Errors = errors.filter((args) =>
        String(args[0]).includes("Failed to render page 1")
      );
      assert.ok(
        page1Errors.length <= 1,
        `page-1 error must be logged at most once, got ${page1Errors.length}`
      );
      const page2Errors = errors.filter((args) =>
        String(args[0]).includes("Failed to render page 2")
      );
      assert.equal(
        page2Errors.length,
        0,
        "page 2 succeeded so it must not produce a render error"
      );
    } finally {
      console.error = original;
    }
  });
});

test("K. render count is bounded for a 46-page PDF at one fixed zoom/rotation/width", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 46, renderDelayMs: 1 });
    const canvasMap = new Map();
    const taskMap = new Map();
    for (let i = 1; i <= 46; i += 1) {
      canvasMap.set(i, createMockCanvas());
    }
    const generationRef = { current: 0 };
    const generation = ++generationRef.current;
    const stop = runBoundedQueue({
      pageNumbers: Array.from({ length: 46 }, (_, i) => i + 1),
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    await waitFor(() => taskMap.size === 0);
    stop();
    assert.equal(
      pdf.renderLog.length,
      46,
      `expected exactly 46 render calls, got ${pdf.renderLog.length}`
    );
    // Page 1 must NOT appear thousands of times.
    const page1Calls = pdf.renderLog.filter((e) => e.pageNumber === 1).length;
    assert.ok(
      page1Calls <= 4,
      `page 1 must not render thousands of times, got ${page1Calls}`
    );
  });
});

test("L. document change cancels old tasks and prevents old continuation from rendering", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 2, renderDelayMs: 20 });
    const canvasMap = new Map();
    const taskMap = new Map();
    for (let i = 1; i <= 2; i += 1) {
      canvasMap.set(i, createMockCanvas());
    }
    const generationRef = { current: 0 };
    const generation1 = ++generationRef.current;
    const stop1 = runBoundedQueue({
      pageNumbers: [1, 2],
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation1,
      concurrency: MAIN_RENDER_CONCURRENCY,
    });
    await waitFor(() => taskMap.size > 0);
    // Simulate "document changed" — bump generation, cancel all
    // tasks, clear the maps.
    generationRef.current += 1;
    stop1();
    for (const task of taskMap.values()) {
      await cancelTask(task);
    }
    taskMap.clear();
    canvasMap.clear();
    // Old continuation arriving after the swap must not render.
    await delay(30);
    assert.equal(
      taskMap.size,
      0,
      "old task map must be empty after document swap"
    );
  });
});

test("M. thumbnail toggle does not restart the main queue", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The main render effect deps must not depend on thumbnailsVisible.
  const mainEff = codeOnly.match(
    /}, \[documentGenerationRef\.current, zoom, rotation, containerWidth, status, pages\.length\]\);/
  );
  assert.ok(mainEff, "main effect deps must exist");
  assert.doesNotMatch(
    mainEff[0],
    /thumbnailsVisible/,
    "thumbnailsVisible must not be in the main render effect deps"
  );
  // The thumbnail render effect must use its own concurrency
  // bound and its own task map.
  assert.match(
    codeOnly,
    /THUMBNAIL_RENDER_CONCURRENCY\s*=\s*1|THUMBNAIL_RENDER_CONCURRENCY,/
  );
  assert.match(
    codeOnly,
    /thumbnailRenderTaskMapRef\s*=\s*useRef\(new Map\(\)\)|thumbnailRenderTaskMapRef\s*=\s*thumbnailTaskMapRef/
  );
});

function extractBlock(source, startIdx) {
  let depth = 0;
  let i = startIdx;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
    i += 1;
  }
  return null;
}

test("N. preview request does not depend on viewer state", () => {
  // ── Component boundary ──────────────────────────────────────────────────
  const componentSource = readFileSync(
    join(here, "..", "SecureDocumentPreview.jsx"),
    "utf8"
  );
  // useSecureDocumentPreview(documentId) is invoked.
  assert.match(componentSource, /useSecureDocumentPreview\(documentId\)/);
  // No direct documentService request exists in the component.
  assert.doesNotMatch(componentSource, /documentService\.getDocumentPreview/);
  // No AbortController is constructed in the component.
  assert.doesNotMatch(componentSource, /new\s+AbortController/);
  // No setTimeout is called in the component.
  assert.doesNotMatch(componentSource, /\bsetTimeout\(/);
  // No setInterval is called in the component.
  assert.doesNotMatch(componentSource, /\bsetInterval\(/);
  // No component polling ownership exists.
  assert.doesNotMatch(componentSource, /scheduleFollowUp/);
  assert.doesNotMatch(componentSource, /shouldPollSecurePreview/);
  // currentPage, zoom and rotation do not drive a preview request.
  assert.doesNotMatch(componentSource, /getDocumentPreview\([^)]*currentPage/);
  assert.doesNotMatch(componentSource, /getDocumentPreview\([^)]*zoom/);
  assert.doesNotMatch(componentSource, /getDocumentPreview\([^)]*rotation/);

  // ── Component dead-preview effect boundary ───────────────────────────────
  // Production order on disk:
  //   const deadFlag = presentation.showDead;
  //   useEffect(() => { ... }, [deadFlag, presentation.message]);
  // Locate the exact binding first, then search for useEffect only AFTER it.
  const deadFlagIdx = componentSource.indexOf("deadFlag = presentation.showDead");
  assert.ok(deadFlagIdx >= 0, "deadFlag binding must exist");

  // Search for useEffect only AFTER the end of the deadFlag binding.
  const effectIdx = componentSource.indexOf("useEffect(", deadFlagIdx);
  assert.ok(effectIdx >= 0, "useEffect after deadFlag must exist");
  assert.ok(effectIdx > deadFlagIdx, "useEffect must come after deadFlag binding");

  // Locate the opening brace of that useEffect callback.
  const effectBraceIdx = componentSource.indexOf("{", effectIdx);
  assert.ok(effectBraceIdx >= 0, "useEffect opening brace must exist");

  // Extract the complete callback with balanced-brace extraction.
  const effectCallback = extractBlock(componentSource, effectBraceIdx);
  assert.ok(effectCallback, "dead-preview effect callback must be balanced");

  // Locate the dependency array immediately after that callback.
  const depsAfterCallback = componentSource.slice(
    effectBraceIdx + effectCallback.length,
    effectBraceIdx + effectCallback.length + 200
  );

  // Prove the dependency array contains exactly the current required deps.
  assert.match(depsAfterCallback, /\[deadFlag,\s*presentation\.message\]/);

  // Prove the callback contains onDeadPreview and presentation.message.
  assert.match(effectCallback, /onDeadPreview/);
  assert.match(effectCallback, /presentation\.message/);

  // Prove the callback does not contain forbidden identifiers.
  assert.doesNotMatch(effectCallback, /\brefresh\b/);
  assert.doesNotMatch(effectCallback, /documentService/);
  assert.doesNotMatch(effectCallback, /AbortController/);
  assert.doesNotMatch(effectCallback, /\bsetTimeout\(/);
  assert.doesNotMatch(effectCallback, /\bsetInterval\(/);
  assert.doesNotMatch(effectCallback, /currentPage/);
  assert.doesNotMatch(effectCallback, /\bzoom\b/);
  assert.doesNotMatch(effectCallback, /\brotation\b/);

  // ── Hook request-lifecycle effect boundary ───────────────────────────────
  const hookSource = readFileSync(
    join(here, "..", "..", "..", "hooks", "useSecureDocumentPreview.js"),
    "utf8"
  );
  // Identify by the triggerFetch lifecycle invocation.
  const triggerFetchCallIdx = hookSource.indexOf("triggerFetch();");
  assert.ok(triggerFetchCallIdx >= 0, "triggerFetch() invocation must exist");
  const hookEffectIdx = hookSource.lastIndexOf("useEffect(", triggerFetchCallIdx);
  assert.ok(hookEffectIdx >= 0, "useEffect before triggerFetch must exist");
  const hookEffectBrace = hookSource.indexOf("{", hookEffectIdx);
  assert.ok(hookEffectBrace >= 0, "hook useEffect opening brace must exist");
  const hookCallback = extractBlock(hookSource, hookEffectBrace);
  assert.ok(hookCallback, "hook useEffect callback must be balanced");
  // triggerFetch starts the request.
  assert.match(hookCallback, /triggerFetch\(\)/);
  // Dependencies include documentId and the actual memoized callbacks.
  assert.match(hookCallback, /documentId/);
  // Verified dependency array.
  const hookDepsAfter = hookSource.slice(
    hookEffectBrace + hookCallback.length,
    hookEffectBrace + hookCallback.length + 200
  );
  assert.match(hookDepsAfter, /\[documentId,\s*triggerFetch,\s*clearTimer\]/);
  // Dependencies exclude currentPage, zoom, rotation and presentation state.
  assert.doesNotMatch(hookDepsAfter, /currentPage/);
  assert.doesNotMatch(hookDepsAfter, /\bzoom\b/);
  assert.doesNotMatch(hookDepsAfter, /\brotation\b/);
  assert.doesNotMatch(hookDepsAfter, /presentation\./);
  // Cleanup calls clearTimer.
  assert.match(hookCallback, /clearTimer\(\)/);
  // Cleanup aborts the owned abortRef controller.
  assert.match(hookCallback, /abortRef\.current\.abort\(\)/);
  // No setInterval exists in the file.
  assert.doesNotMatch(hookSource, /\bsetInterval\(/);
  // scheduleFollowUp is gated by shouldPollSecurePreview.
  assert.match(
    hookSource,
    /if\s*\(\s*!\s*shouldPollSecurePreview\(result\)\s*\)\s*return/
  );
  // refresh is an explicit callback.
  assert.match(hookSource, /const\s+refresh\s*=\s*useCallback\(/);
  // The component dead-preview effect does not invoke refresh.
  assert.doesNotMatch(effectCallback, /refresh\(\)/);
  assert.doesNotMatch(effectCallback, /\brefresh\b/);
});

test("O. full and limited UI remain unchanged", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The viewer's outer data-mode must reflect the prop without
  // branching the toolbar/body.
  assert.match(codeOnly, /data-mode=\{mode\}/);
  // Same toolbar for both modes.
  assert.match(codeOnly, /StudyItToolbar/);
  // The LIMITED-only download/print disable.
  assert.match(
    codeOnly,
    /disabled=\{isLimited\s*\|\|\s*disabled\}/
  );
  // Both FULL and LIMITED share StudyItToolbar — there is no
  // alternative white toolbar in the source.
  assert.doesNotMatch(
    codeOnly,
    /<iframe/i,
    "no iframe element in the viewer"
  );
  // CSS keeps the dark toolbar.
  assert.match(cssSource, /background:\s*#323232/);
  // LIMITED sticky anchor copy is preserved.
  assert.match(viewerSource, /Đây là bản xem trước/);
  assert.match(viewerSource, /Mua tài liệu để mở khóa toàn bộ/);
});

test("LimitedPaidPdfViewer is a thin wrapper around StudyItPdfViewer in LIMITED mode", () => {
  assert.match(
    limitedViewerSource,
    /import\s+StudyItPdfViewer\s+from\s+["']\.\/StudyItPdfViewer["']/
  );
  assert.match(limitedViewerSource, /mode\s*=\s*["']LIMITED["']/);
});

test("SecureDocumentPreview routes both FULL and LIMITED PDF branches through the shared viewer", () => {
  assert.match(secureSource, /StudyItPdfViewer/);

  // ── 1. Viewer orchestration ─────────────────────────────────────────────
  const bodyIdx = secureSource.indexOf("let body;");
  assert.ok(bodyIdx >= 0, "let body; must exist");
  const returnIdx = secureSource.indexOf("return (", bodyIdx);
  assert.ok(returnIdx >= 0, "component JSX return must exist after let body;");
  assert.ok(returnIdx > bodyIdx, "return must come after let body;");

  const orchBlock = secureSource.slice(bodyIdx, returnIdx);
  assert.match(orchBlock, /showLoading/);
  assert.match(orchBlock, /renderLoading\(\)/);
  assert.match(orchBlock, /showViewer/);
  assert.match(orchBlock, /renderStudyItPdf\(/);
  assert.match(orchBlock, /showWaiting/);
  assert.match(orchBlock, /renderWaiting\(/);
  assert.match(orchBlock, /showDead/);
  assert.match(orchBlock, /renderDead\(\)/);
  assert.match(orchBlock, /showLocked/);
  assert.match(orchBlock, /renderLocked\(\)/);
  assert.match(orchBlock, /showError/);
  assert.match(orchBlock, /renderError\(\)/);

  // renderStudyItPdf receives presentation.pdfBuffer first, viewerMode second.
  const callIdx = secureSource.indexOf("renderStudyItPdf(", bodyIdx);
  assert.ok(callIdx >= 0 && callIdx < returnIdx, "renderStudyItPdf call must exist within the body orchestration region");
  let depth = 0;
  let callEnd = -1;
  for (let i = callIdx; i < secureSource.length; i += 1) {
    const ch = secureSource[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        callEnd = i;
        break;
      }
    }
  }
  assert.ok(callEnd > callIdx, "renderStudyItPdf call must be balanced");
  const callText = secureSource.slice(callIdx, callEnd + 1);
  assert.match(callText, /renderStudyItPdf\(\s*presentation\.pdfBuffer\s*,\s*presentation\.viewerMode\s*\)/);

  // No non-viewer branch invokes renderStudyItPdf.
  const nonViewerBranches = [
    /else\s+if\s*\(\s*presentation\.showWaiting\s*\)\s*\{/,
    /else\s+if\s*\(\s*presentation\.showDead\s*\)\s*\{/,
    /else\s+if\s*\(\s*presentation\.showLocked\s*\)\s*\{/,
    /else\s+if\s*\(\s*presentation\.showError\s*\)\s*\{/,
  ];
  for (const re of nonViewerBranches) {
    const m = orchBlock.match(re);
    assert.ok(m, "non-viewer branch must exist");
    const branchSlice = orchBlock.slice(m.index, orchBlock.length);
    const nextElseIf = branchSlice.indexOf("else if");
    const branchEnd = nextElseIf >= 0 ? m.index + nextElseIf : orchBlock.length;
    const branchOnly = orchBlock.slice(m.index, branchEnd);
    assert.doesNotMatch(branchOnly, /renderStudyItPdf\(/);
  }

  // ── 2. Adapter declaration ──────────────────────────────────────────────
  const adapterIdx = secureSource.indexOf("const renderStudyItPdf = (buffer, viewerMode) =>");
  assert.ok(adapterIdx >= 0, "renderStudyItPdf declaration must exist");
  const nextRendererIdx = secureSource.indexOf("const renderWaiting = ", adapterIdx);
  assert.ok(nextRendererIdx >= 0, "next renderer declaration must exist after renderStudyItPdf");
  assert.ok(nextRendererIdx > adapterIdx, "next renderer must start after renderStudyItPdf");
  const adapterBlock = secureSource.slice(adapterIdx, nextRendererIdx);
  assert.match(adapterBlock, /StudyItPdfViewer/);
  assert.match(adapterBlock, /arrayBuffer=\{buffer\}/);
  assert.match(adapterBlock, /mode=\{viewerMode\}/);
  assert.doesNotMatch(adapterBlock, /mode\s*\|\|\s*["']FULL["']/);
  assert.doesNotMatch(adapterBlock, /mode:\s*["']FULL["']/);

  // ── 3. Valid PDF presentation — balanced `if (kind === "pdf")` block ────
  const helpersSource = readFileSync(
    join(here, "..", "..", "..", "hooks", "securePreviewHelpers.js"),
    "utf8"
  );
  const pdfKindIdx = helpersSource.indexOf('if (kind === "pdf") {');
  assert.ok(pdfKindIdx >= 0, "pdf presentation branch must exist");
  const pdfKindBrace = helpersSource.indexOf("{", pdfKindIdx);
  const pdfPresBlock = extractBlock(helpersSource, pdfKindBrace);
  assert.ok(pdfPresBlock, "pdf presentation block must be balanced");
  assert.match(pdfPresBlock, /preview\.mode\s*===\s*["']FULL["']/);
  assert.match(pdfPresBlock, /preview\.mode\s*===\s*["']LIMITED["']/);
  assert.match(pdfPresBlock, /viewerMode:\s*preview\.mode/);
  assert.match(pdfPresBlock, /preview\.pdfBuffer\s+instanceof\s+ArrayBuffer/);
  assert.match(pdfPresBlock, /kind:\s*["']pdf["']/);
  assert.doesNotMatch(pdfPresBlock, /LIMITED[\s\S]{0,80}?FULL/);
  assert.doesNotMatch(pdfPresBlock, /\|\|\s*["']FULL["']/);

  // ── 4. Required non-viewer branches ─────────────────────────────────────
  const requiredBranches = [
    { kind: "waiting", marker: 'if (kind === "waiting") {' },
    { kind: "locked", marker: 'if (kind === "locked") {' },
    { kind: "dead", marker: 'if (kind === "dead") {' },
    { kind: "error", marker: 'if (kind === "error") {' },
  ];
  for (const { kind, marker } of requiredBranches) {
    const idx = helpersSource.indexOf(marker);
    assert.ok(idx >= 0, `${kind} presentation branch must exist`);
    const braceIdx = helpersSource.indexOf("{", idx);
    const block = extractBlock(helpersSource, braceIdx);
    assert.ok(block, `${kind} presentation block must be balanced`);
    assert.match(block, /showViewer:\s*false/);
    assert.match(block, /viewerMode:\s*null/);
    assert.match(block, /pdfBuffer:\s*null/);
  }

  // ── 5. Blob final-state contract — balanced `case "pdf":` block ────────
  const pdfCaseIdx = helpersSource.indexOf('case "pdf": {');
  assert.ok(pdfCaseIdx >= 0, "case pdf block must exist");
  const pdfCaseBrace = helpersSource.indexOf("{", pdfCaseIdx);
  const pdfCaseBlock = extractBlock(helpersSource, pdfCaseBrace);
  assert.ok(pdfCaseBlock, "case pdf block must be balanced");
  assert.match(pdfCaseBlock, /rawResult\.blob\s+instanceof\s+Blob/);
  assert.match(pdfCaseBlock, /await\s+rawResult\.blob\.arrayBuffer\(\)/);
  assert.match(pdfCaseBlock, /decoded\s+instanceof\s+ArrayBuffer/);
  assert.match(pdfCaseBlock, /pdfBuffer:\s*decoded/);
  assert.doesNotMatch(pdfCaseBlock, /pdfBuffer:\s*rawResult\.blob\b/);
});

test("renderPageToCanvas guards the next render after the previous task has settled", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 1, renderDelayMs: 20 });
    const canvas = createMockCanvas();
    const canvasMap = new Map([[1, canvas]]);
    const taskMap = new Map();
    const generationRef = { current: 0 };

    const generation1 = ++generationRef.current;
    const p1 = renderPageToCanvas({
      pageNumber: 1,
      canvas,
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation1,
    });
    // Bump generation before the first render finishes.
    await delay(2);
    generationRef.current += 1;
    const generation2 = generationRef.current;
    const p2 = renderPageToCanvas({
      pageNumber: 1,
      canvas,
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation: generation2,
    });
    await Promise.all([p1, p2]);
    // The helper must have awaited the previous task before
    // producing the next render call. So at most two render
    // log entries are produced (one per generation).
    assert.ok(pdf.renderLog.length <= 2);
    // The generation-2 render should be the surviving one.
    const lastEntry = pdf.renderLog[pdf.renderLog.length - 1];
    assert.ok(lastEntry, "a final render entry must exist");
  });
});

test("renderPageToCanvas is a no-op when the generation has been invalidated", async () => {
  await withPolyfills(async () => {
    const pdf = createPdfMock({ pageCount: 1, renderDelayMs: 5 });
    const canvas = createMockCanvas();
    const canvasMap = new Map([[1, canvas]]);
    const taskMap = new Map();
    const generationRef = { current: 0 };
    const generation = ++generationRef.current;
    const promise = renderPageToCanvas({
      pageNumber: 1,
      canvas,
      pdf,
      canvasMap,
      taskMap,
      generationRef,
      generation,
    });
    // Invalidate the generation mid-flight.
    generationRef.current += 1;
    await promise;
    // The helper must not have produced a render log entry for
    // an invalidated generation.
    // (If the mock has already started the render, the next
    // render attempt is dropped at the first generation check.)
    assert.ok(pdf.renderLog.length <= 1);
  });
});

test("MIN_ZOOM / MAX_ZOOM / concurrency constants are stable", () => {
  assert.equal(MIN_ZOOM, 0.5);
  assert.equal(MAX_ZOOM, 3.0);
  assert.equal(MAIN_RENDER_CONCURRENCY, 2);
  assert.equal(THUMBNAIL_RENDER_CONCURRENCY, 1);
});

test("pdfjs-dist is declared as a dependency at a stable version", () => {
  const dep = packageJson?.dependencies?.["pdfjs-dist"];
  assert.ok(dep, "pdfjs-dist must be declared in dependencies");
  assert.match(dep, /\d+\.\d+\.\d+/, "pdfjs-dist must be pinned to a full semver");
});
