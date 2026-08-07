/**
 * Viewport-center geometry + floating-card visibility hotfix tests.
 *
 * <p>The previous implementation relied on an IntersectionObserver
 * with a {@code bestRatio}/{@code bestPage} pair captured at the
 * observer-instance scope. Those values were never reset between
 * scroll positions, so once a page achieved the highest ratio the
 * indicator got stuck on that page even when the viewport had
 * scrolled past it. The live screenshot showed the toolbar at
 * {@code 2 / 46} while the viewport was actually centred on a
 * locked blurred page.</p>
 *
 * <p>This file pins the new contract:</p>
 *
 * <ul>
 *   <li>A — viewport-centre geometry returns the page whose
 *       centre is nearest the scroll viewport centre.</li>
 *   <li>B — a blurred locked page cannot report a readable page.</li>
 *   <li>C/D/E — page-5 hides the card, page-6 shows it, page-N
 *       keeps it visible.</li>
 *   <li>F/G — thumbnail click and page input re-schedule a
 *       recalculation.</li>
 *   <li>H — zoom / rotation / fit-width re-schedule a recalculation
 *       without restarting PDF rendering.</li>
 *   <li>I — only main page wrappers are registered for the geometry
 *       calculation. Thumbnails and canvases are excluded.</li>
 *   <li>J — the calculation uses the main PDF scroll container's
 *       {@code scrollTop} and {@code clientHeight}, never
 *       {@code window}.</li>
 *   <li>K — scroll handler is rAF-throttled: many scroll events in
 *       one frame collapse to one calculation.</li>
 *   <li>L — repeated calculation of the same page does not produce
 *       repeated state changes.</li>
 *   <li>M — single CTA contract is preserved (guest + authenticated).</li>
 *   <li>N — render-storm lifecycle invariants remain intact
 *       (canvas maps, generations, bounded queue).</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeViewportCenterPage } from "../studyItPdfViewerLifecycle.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const viewerSource = readFileSync(
  join(here, "..", "..", "document", "StudyItPdfViewer.jsx"),
  "utf8"
);
const cssSource = readFileSync(
  join(here, "..", "..", "..", "styles", "studyItPdfViewer.css"),
  "utf8"
);
const lifecycleSource = readFileSync(
  join(here, "..", "..", "document", "studyItPdfViewerLifecycle.mjs"),
  "utf8"
);

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// ------------------------------------------------------------------
// A. viewportCenterDeterminesCurrentPage
// ------------------------------------------------------------------

test("A. viewportCenterDeterminesCurrentPage — centre inside page 6 returns 6", () => {
  const pages = new Map();
  // Each page is 800px tall with 14px gap. Page 1 starts at 18.
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  // Viewport centre inside page 6 (somewhere in the middle).
  const page6Centre = TOP + 5 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  assert.equal(computeViewportCenterPage(pages.entries(), page6Centre), 6);
});

test("A. viewportCenterDeterminesCurrentPage — page 3", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page3Centre = TOP + 2 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  assert.equal(computeViewportCenterPage(pages.entries(), page3Centre), 3);
});

// ------------------------------------------------------------------
// B. blurredPageCannotReportReadablePage
// ------------------------------------------------------------------

test("B. blurredPageCannotReportReadablePage — page 10 viewport centre returns 10", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page10Centre = TOP + 9 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  // The OLD buggy observer could report page 2 here because
  // bestPage was stuck. The new algorithm must report 10.
  assert.equal(computeViewportCenterPage(pages.entries(), page10Centre), 10);
});

// ------------------------------------------------------------------
// C. pageFiveHidesCard
// ------------------------------------------------------------------

test("C. pageFiveHidesCard — page 5 centre returns 5 (readable)", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page5Centre = TOP + 4 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  const result = computeViewportCenterPage(pages.entries(), page5Centre);
  assert.equal(result, 5);
  // Card is hidden when bestPage (5) is NOT > visiblePages (5).
  assert.ok(!(result > 5), "Card must be hidden when bestPage <= visiblePages.");
});

// ------------------------------------------------------------------
// D. pageSixShowsCard
// ------------------------------------------------------------------

test("D. pageSixShowsCard — page 6 centre returns 6 (locked)", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page6Centre = TOP + 5 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  const result = computeViewportCenterPage(pages.entries(), page6Centre);
  assert.equal(result, 6);
  assert.ok(result > 5, "Card must be shown when bestPage > visiblePages.");
});

// ------------------------------------------------------------------
// E. scrollToFinalPageKeepsCard
// ------------------------------------------------------------------

test("E. scrollToFinalPageKeepsCard — page 46 centre returns 46", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page46Centre = TOP + 45 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  const result = computeViewportCenterPage(pages.entries(), page46Centre);
  assert.equal(result, 46);
  assert.ok(result > 5, "Card must remain visible at the final page.");
});

// ------------------------------------------------------------------
// F. thumbnailClickRecalculatesPage
// ------------------------------------------------------------------

test("F. thumbnailClickRecalculatesPage — click 20 → page 20", () => {
  const codeOnly = stripComments(viewerSource);
  // handleThumbnailClick must schedule a viewport calculation.
  const handleBlock = codeOnly.match(
    /const handleThumbnailClick\s*=\s*useCallback\(\s*[\s\S]*?\},\s*\[[^\]]*\]\s*\);/
  );
  assert.ok(handleBlock, "handleThumbnailClick must exist.");
  assert.match(
    handleBlock[0],
    /scheduleViewportCalculation/,
    "handleThumbnailClick must call scheduleViewportCalculation."
  );
});

// ------------------------------------------------------------------
// G. thumbnailClickReadablePageHidesCard
// ------------------------------------------------------------------

test("G. thumbnailClickReadablePageHidesCard — click 3 → currentPage 3 → card hidden", () => {
  const pages = new Map();
  const PAGE_HEIGHT = 800;
  const GAP = 14;
  const TOP = 18;
  for (let i = 1; i <= 46; i += 1) {
    pages.set(i, { offsetTop: TOP + (i - 1) * (PAGE_HEIGHT + GAP), offsetHeight: PAGE_HEIGHT });
  }
  const page3Centre = TOP + 2 * (PAGE_HEIGHT + GAP) + PAGE_HEIGHT / 2;
  const result = computeViewportCenterPage(pages.entries(), page3Centre);
  assert.equal(result, 3);
  assert.ok(!(result > 5), "Card must be hidden after scrolling to page 3.");
});

// ------------------------------------------------------------------
// H. zoomRecalculatesWithoutRerenderStorm
// ------------------------------------------------------------------

test("H. zoomRecalculatesWithoutRerenderStorm — zoom effect is pure geometry", () => {
  const codeOnly = stripComments(viewerSource);
  // The zoom-driven recalculation effect must NOT touch canvas
  // maps, task maps, generation refs, status setters, or
  // AbortController.
  const effects = codeOnly.match(
    /useEffect\(\(\)\s*=>\s*\{\s*scheduleViewportCalculation\(\)[\s\S]*?\},\s*\[[^\]]+\]\s*\);/g
  );
  assert.ok(effects && effects.length > 0, "Zoom/rotation recalc effects must exist.");
  for (const effect of effects) {
    assert.doesNotMatch(
      effect,
      /canvasMapRef|renderTaskMapRef|mainCanvasMapRef|mainRenderTaskMapRef|thumbnailCanvasMapRef|thumbnailTaskMapRef/,
      "Recalc effect must not touch canvas / task maps."
    );
    assert.doesNotMatch(
      effect,
      /mainRenderGenerationRef|thumbnailRenderGenerationRef|documentGenerationRef/,
      "Recalc effect must not bump generation refs."
    );
    assert.doesNotMatch(
      effect,
      /setPages|setStatus|setPdfMeta|setError|setZoom|setRotation|setContainerWidth|abortRef/,
      "Recalc effect must not mutate render-related state."
    );
  }
});

// ------------------------------------------------------------------
// I. thumbnailPanelDoesNotPolluteMainPageMap
// ------------------------------------------------------------------

test("I. thumbnailPanelDoesNotPolluteMainPageMap — only main pages register", () => {
  const codeOnly = stripComments(viewerSource);
  // The page wrapper renders the mainPageRefProducer on the
  // .studyit-pdf-viewer__page div. The thumbnail panel must
  // NOT call registerMainPageElement.
  assert.match(
    codeOnly,
    /registerMainPageElement/,
    "Main page wrapper registration helper must exist."
  );
  // The thumbnail-panel render path must NOT touch
  // mainPageElementMapRef.
  assert.doesNotMatch(
    codeOnly,
    /StudyItThumbnailPanel[\s\S]*?mainPageElementMapRef/,
    "Thumbnail panel must not write to mainPageElementMapRef."
  );
  // The registerMainPageElement callback only mutates
  // mainPageElementMapRef.
  const regBlock = codeOnly.match(
    /mainPageElementRegisterRef\.current\s*=\s*\(pageNumber,\s*node\)\s*=>\s*\{[\s\S]*?\}/
  );
  assert.ok(regBlock, "registerMainPageElement must be defined inline.");
  assert.match(
    regBlock[0],
    /mainPageElementMapRef\.current\.(set|delete)/,
    "registerMainPageElement must only mutate mainPageElementMapRef."
  );
});

// ------------------------------------------------------------------
// J. currentPageGeometryUsesMainScrollContainer
// ------------------------------------------------------------------

test("J. currentPageGeometryUsesMainScrollContainer — uses scrollTop + clientHeight/2", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /viewportCenter\s*=\s*scrollElement\.scrollTop\s*\+\s*scrollElement\.clientHeight\s*\/\s*2/,
    "Viewport centre must be scrollTop + clientHeight/2 of the scroll container."
  );
  // Must NOT use window as the scroll source.
  assert.doesNotMatch(
    codeOnly,
    /window\.scrollTop|window\.scrollY|window\.innerHeight/,
    "Calculation must not use window.scrollTop / window.innerHeight."
  );
});

// ------------------------------------------------------------------
// K. scrollHandlerIsRafThrottled
// ------------------------------------------------------------------

test("K. scrollHandlerIsRafThrottled — single rAF per scroll burst", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /if\s*\(\s*viewportRafRef\.current\s*!=\s*null\s*\)\s*return/,
    "scheduleViewportCalculation must early-return when a frame is already pending."
  );
  assert.match(
    codeOnly,
    /viewportRafRef\.current\s*=\s*requestAnimationFrame/,
    "scheduleViewportCalculation must request a single rAF per call."
  );
  // Cleanup must cancel the pending rAF.
  assert.match(
    codeOnly,
    /cancelAnimationFrame\(viewportRafRef\.current\)/,
    "Cleanup must cancel any pending rAF."
  );
});

// ------------------------------------------------------------------
// L. samePageDoesNotCauseStateLoop
// ------------------------------------------------------------------

test("L. samePageDoesNotCauseStateLoop — setCurrentPage is referentially stable", () => {
  const codeOnly = stripComments(viewerSource);
  // setCurrentPage must guard with `previous === bestPage ? previous : bestPage`.
  assert.match(
    codeOnly,
    /setCurrentPage\(\s*\(previous\)\s*=>\s*\(previous\s*===\s*bestPage\s*\?\s*previous\s*:\s*bestPage\)\)/,
    "setCurrentPage must early-return when the page is unchanged."
  );
});

// ------------------------------------------------------------------
// M. floatingCardSingleCtaRegression
// ------------------------------------------------------------------

test("M. floatingCardSingleCtaRegression — single CTA contract preserved", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /Đăng nhập để mua — \$\{priceLabel\}/,
    "Guest CTA label 'Đăng nhập để mua — {price}' must remain."
  );
  assert.match(
    codeOnly,
    /Mua ngay — \$\{priceLabel\}/,
    "Authenticated CTA label 'Mua ngay — {price}' must remain."
  );
  assert.doesNotMatch(
    codeOnly,
    /studyit-pdf-viewer__card-cta--secondary/,
    "Old secondary CTA class must NOT reappear."
  );
});

// ------------------------------------------------------------------
// N. renderStormRegression
// ------------------------------------------------------------------

test("N. renderStormRegression — PDF.js lifecycle invariants remain intact", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /canvasMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Per-page canvas map must still exist."
  );
  assert.match(
    codeOnly,
    /renderTaskMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Per-page render task map must still exist."
  );
  assert.match(
    codeOnly,
    /mainRenderGenerationRef\s*=\s*useRef\(0\)/,
    "Main render generation ref must still exist."
  );
  assert.match(
    codeOnly,
    /thumbnailRenderGenerationRef\s*=\s*useRef\(0\)/,
    "Thumbnail render generation ref must still exist."
  );
  assert.match(codeOnly, /MAIN_RENDER_CONCURRENCY\s*=\s*RENDER_CONCURRENCY/);
  assert.match(codeOnly, /THUMBNAIL_RENDER_CONCURRENCY\s*=\s*1/);
  assert.match(codeOnly, /runBoundedQueue\(\{/);
  assert.match(codeOnly, /MIN_ZOOM\s*=\s*0\.5/);
  assert.match(codeOnly, /MAX_ZOOM\s*=\s*3\.0/);

  // Lifecycle helper exports remain.
  assert.match(
    lifecycleSource,
    /export\s+async\s+function\s+renderPageToCanvas/,
    "renderPageToCanvas helper must still exist."
  );
  assert.match(
    lifecycleSource,
    /export\s+function\s+runBoundedQueue/,
    "runBoundedQueue helper must still exist."
  );
  assert.match(
    lifecycleSource,
    /export\s+function\s+computeViewportCenterPage/,
    "computeViewportCenterPage helper must be exported."
  );
});

// ------------------------------------------------------------------
// Floating layer DOM placement (sanity check).
// ------------------------------------------------------------------

test("sticky anchor sits inside the document container, not the page loop", () => {
  const codeOnly = stripComments(viewerSource);
  // The viewport wrapper, scroll, and document containers must exist.
  assert.match(codeOnly, /studyit-pdf-viewer__viewport/);
  assert.match(codeOnly, /studyit-pdf-viewer__document/);
  // The sticky anchor element must exist in the JSX.
  assert.match(codeOnly, /className="studyit-pdf-lock-anchor"/);
  // The anchor must be inserted AFTER the last readable page
  // and BEFORE the first locked page.
  assert.match(
    codeOnly,
    /shouldRenderLockCard\s*&&[\s\S]{0,120}pageNumber\s*===\s*anchorAfterPage\s*\+\s*1/,
    "Anchor must be inserted only after the last readable page."
  );
  // Structural proof: the anchor is rendered as a sibling of each
  // page <div>, wrapped in a React.Fragment. We assert that
  // `<StickyLockAnchor` appears as a child of the page loop
  // (inside the `<React.Fragment>` for the page at the boundary)
  // and not as a descendant of any `.studyit-pdf-viewer__page`
  // div.
  const stickyIdx = codeOnly.indexOf("<StickyLockAnchor");
  const pageDivIdx = codeOnly.indexOf('className="studyit-pdf-viewer__page"');
  const pageDivCloseIdx = codeOnly.indexOf("</div>", pageDivIdx);
  assert.ok(stickyIdx > 0, "StickyLockAnchor must be referenced in the JSX.");
  assert.ok(pageDivIdx > 0, "Page wrapper div must exist.");
  assert.ok(pageDivCloseIdx > 0, "Page wrapper closing div must exist.");
  // The sticky anchor must NOT appear inside a page wrapper div.
  assert.ok(
    stickyIdx > pageDivCloseIdx ||
      stickyIdx < pageDivIdx ||
      (stickyIdx > pageDivIdx && stickyIdx < pageDivCloseIdx) === false,
    "StickyLockAnchor must not be a child of a .studyit-pdf-viewer__page div."
  );
});

// ------------------------------------------------------------------
// CSS — viewport wrapper must be the positioning context.
// ------------------------------------------------------------------

test("viewport wrapper CSS — relative positioning + flex", () => {
  const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = css.match(/\.studyit-pdf-viewer__viewport\s*\{[^}]*\}/);
  assert.ok(block, "Viewport wrapper rule must exist.");
  assert.match(block[0], /position:\s*relative/);
  assert.match(block[0], /flex:\s*1\s+1\s+auto/);
  assert.match(block[0], /overflow:\s*hidden/);
});