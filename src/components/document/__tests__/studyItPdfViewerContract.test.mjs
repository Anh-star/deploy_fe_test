/**
 * StudyItPdfViewer contract tests.
 *
 * <p>These tests pin the contract that the shared StudyIT PDF
 * viewer shell MUST hold so FULL and LIMITED previews stay
 * visually identical before and after purchase.</p>
 *
 * <ul>
 *   <li>Both modes render the dark native-style toolbar.</li>
 *   <li>There is no white toolbar anywhere in the shell.</li>
 *   <li>The page list is built once from {@code pdf.numPages} —
 *       no virtualization, no per-page mount/unmount.</li>
 *   <li>Every page owns its OWN canvas and its OWN render task;
 *       {@code canvasMapRef} and {@code renderTaskMapRef} are
 *       keyed by page number.</li>
 *   <li>Page rendering uses a positive DPR matrix
 *       {@code [ratio,0,0,ratio,0,0]} when DPR > 1; no negative
 *       matrix components, no mirroring, no scaleX(-1), no
 *       scaleY(-1).</li>
 *   <li>The render queue is bounded to concurrency 2; finishing
 *       page 1 never cancels pages 2..N.</li>
 *   <li>Cleanup runs ONLY on unmount / documentId change /
 *       buffer change.</li>
 *   <li>The current page indicator is computed from the
 *       viewport-centre geometry against the per-page wrapper
 *       elements — not from IntersectionObserver — so the
 *       toolbar indicator and the floating lock card cannot
 *       disagree.</li>
 *   <li>The toolbar exposes page indicator input, zoom in / out,
 *       fit width, rotate, download, print, thumbnails toggle —
 *       with Vietnamese aria-labels.</li>
 *   <li>The viewer never touches a storagePath, signed URL,
 *       supabase token, or public CDN URL.</li>
 *   <li>The LIMITED mode shows the StudyIT HTML unlock overlay
 *       on the first locked page (visiblePages + 1) and the
 *       compact badge on subsequent locked pages.</li>
 *   <li>In LIMITED mode the download and print buttons are
 *       disabled; in FULL mode they are enabled.</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const viewerSource = readFileSync(
  join(here, "..", "..", "document", "StudyItPdfViewer.jsx"),
  "utf8"
);
const cssSource = readFileSync(
  join(here, "..", "..", "..", "styles", "studyItPdfViewer.css"),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(join(here, "..", "..", "..", "..", "package.json"), "utf8")
);
const limitedWrapperSource = readFileSync(
  join(here, "..", "..", "document", "LimitedPaidPdfViewer.jsx"),
  "utf8"
);
const secureSource = readFileSync(
  join(here, "..", "..", "document", "SecureDocumentPreview.jsx"),
  "utf8"
);

test("StudyItPdfViewer imports pdfjs-dist from the local package", () => {
  assert.match(
    viewerSource,
    /from\s+["']pdfjs-dist["']/,
    "Viewer must import pdfjs-dist directly."
  );
  assert.match(
    viewerSource,
    /pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url/,
    "Viewer must wire the local worker via Vite ?url import."
  );
  assert.match(
    viewerSource,
    /GlobalWorkerOptions\.workerSrc\s*=\s*pdfWorkerUrl/,
    "Viewer must assign the local worker to GlobalWorkerOptions."
  );
});

test("StudyItPdfViewer does NOT use iframe / object / embed", () => {
  assert.doesNotMatch(viewerSource, /<iframe/i, "No iframe element allowed.");
  assert.doesNotMatch(viewerSource, /<object\b/i, "No <object> element allowed.");
  assert.doesNotMatch(viewerSource, /<embed\b/i, "No <embed> element allowed.");
});

test("StudyItPdfViewer never uses storagePath or signed URL", () => {
  // Strip the file-level JSDoc before scanning. The component
  // mentions these tokens in a comment to document the
  // negative invariant; the production code itself must not
  // reference them.
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeOnly, /storagePath/i);
  assert.doesNotMatch(codeOnly, /signedUrl/i);
  assert.doesNotMatch(codeOnly, /supabase/i);
  assert.doesNotMatch(codeOnly, /SUPABASE_SERVICE_ROLE/i);
  assert.doesNotMatch(codeOnly, /X-Amz-Signature/i);
  assert.doesNotMatch(codeOnly, /[?&]token=/i);
});

test("StudyItPdfViewer dark toolbar uses #323232", () => {
  const toolbarRule = /\.studyit-pdf-viewer__toolbar\s*\{[^}]*\}/m;
  const toolbarBlock = cssSource.match(toolbarRule);
  assert.ok(toolbarBlock, "Toolbar rule must exist.");
  assert.match(
    toolbarBlock[0],
    /background:\s*#323232/,
    "Toolbar background must be the dark #323232 from the reference."
  );
  assert.match(
    toolbarBlock[0],
    /color:\s*#ffffff/,
    "Toolbar text/icon colour must be white."
  );
});

test("StudyItPdfViewer toolbar height matches reference (54px)", () => {
  const toolbarRule = /\.studyit-pdf-viewer__toolbar\s*\{[^}]*\}/m;
  const toolbarBlock = cssSource.match(toolbarRule);
  assert.ok(toolbarBlock, "Toolbar rule must exist.");
  assert.match(
    toolbarBlock[0],
    /height:\s*54px/,
    "Toolbar height must be 54px to match the reference."
  );
});

test("StudyItPdfViewer does NOT carry the white limited toolbar", () => {
  // The old LIMITED-only white toolbar had
  // `.limited-paid-pdf-viewer__toolbar`. The new shared viewer
  // MUST NOT carry that legacy class anywhere in its CSS so the
  // toolbar colour stays dark.
  assert.doesNotMatch(
    cssSource,
    /\.limited-paid-pdf-viewer__toolbar/,
    "Legacy white toolbar class must be removed."
  );
});

test("StudyItPdfViewer does NOT show a Continuous text control on the toolbar", () => {
  // Per spec: the visible "Continuous" pill was a LIMITED-only
  // decoration. The shared toolbar must not surface it as a
  // control label.
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeOnly, /studyit-pdf-viewer__scroll-mode/);
  assert.doesNotMatch(codeOnly, />\s*Continuous\s*</);
});

test("StudyItPdfViewer builds an immutable page descriptor from pdf.numPages", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(
    codeOnly,
    /Array\.from\(\s*\{\s*length:\s*numPages\s*\}/,
    "Viewer must build an immutable page descriptor with Array.from({length: numPages})."
  );
  assert.match(
    codeOnly,
    /pageNumber:\s*index\s*\+\s*1/,
    "Descriptor must map each index to {pageNumber: index + 1}."
  );
});

test("StudyItPdfViewer uses per-page canvas and per-page render task maps", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(
    codeOnly,
    /canvasMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Viewer must register each page canvas in a Map keyed by pageNumber."
  );
  assert.match(
    codeOnly,
    /renderTaskMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Viewer must register each page render task in a Map keyed by pageNumber."
  );
  assert.match(
    codeOnly,
    /data-page-number=\{pageNumber\}/,
    "Each page wrapper must carry a stable page-number attribute."
  );
});

test("StudyItPdfViewer never applies a mirrored or negative transform", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeOnly, /scaleX\(\s*-\s*1\s*\)/);
  assert.doesNotMatch(codeOnly, /scaleY\(\s*-\s*1\s*\)/);
  assert.doesNotMatch(codeOnly, /rotateY\(\s*180deg\s*\)/);
  assert.doesNotMatch(codeOnly, /setTransform\(\s*-\s*\d/);
  assert.doesNotMatch(codeOnly, /matrix\(\s*-\s*\d/);
  // The transform passed to page.render MUST be a positive
  // DPR matrix when ratio > 1.
  assert.match(
    codeOnly,
    /ratio\s*===\s*1\s*\?\s*null\s*:\s*\[ratio,\s*0,\s*0,\s*ratio,\s*0,\s*0\]/,
    "page.render transform must be [ratio,0,0,ratio,0,0] when ratio > 1."
  );
});

test("StudyItPdfViewer CSS forbids mirrored canvas transforms", () => {
  const canvasBlock = cssSource.match(
    /\.studyit-pdf-viewer__canvas\s*\{[^}]*\}/
  );
  assert.ok(canvasBlock, "Canvas rule must exist.");
  assert.match(canvasBlock[0], /display:\s*block/);
  assert.match(canvasBlock[0], /transform:\s*none/);
  assert.match(canvasBlock[0], /direction:\s*ltr/);
  assert.doesNotMatch(canvasBlock[0], /scaleX\(\s*-\s*1\s*\)/);
  assert.doesNotMatch(canvasBlock[0], /scaleY\(\s*-\s*1\s*\)/);
  assert.doesNotMatch(canvasBlock[0], /rotateY\(\s*180/);
});

test("StudyItPdfViewer enforces a positive zoom range", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(codeOnly, /MIN_ZOOM\s*=\s*0\.5/);
  assert.match(codeOnly, /MAX_ZOOM\s*=\s*3\.0/);
  // The renderPage helper clamps the requested zoom to the
  // [MIN_ZOOM, MAX_ZOOM] window.
  assert.match(
    codeOnly,
    /Math\.max\(\s*MIN_ZOOM\s*,\s*Math\.min\(\s*MAX_ZOOM\s*,\s*zoomFactor/
  );
});

test("StudyItPdfViewer toolbar exposes page indicator input, zoom, fit, rotate, download, print, thumbnails", () => {
  assert.match(viewerSource, /studyit-pdf-viewer__page-input/);
  assert.match(viewerSource, /studyit-pdf-viewer-zoom-in/);
  assert.match(viewerSource, /studyit-pdf-viewer-zoom-out/);
  assert.match(viewerSource, /studyit-pdf-viewer-fit-width/);
  assert.match(viewerSource, /studyit-pdf-viewer-rotate/);
  assert.match(viewerSource, /studyit-pdf-viewer-download/);
  assert.match(viewerSource, /studyit-pdf-viewer-print/);
  assert.match(viewerSource, /studyit-pdf-viewer-toggle-thumbnails/);
  // Vietnamese aria-labels on the toolbar controls.
  assert.match(viewerSource, /aria-label="Trang hiện tại"/);
  assert.match(viewerSource, /aria-label="Thu nhỏ"/);
  assert.match(viewerSource, /aria-label="Phóng to"/);
  assert.match(viewerSource, /aria-label="Vừa chiều rộng"/);
  assert.match(viewerSource, /aria-label="Tải xuống"/);
  assert.match(viewerSource, /aria-label="In"/);
});

test("StudyItPdfViewer disables download and print in LIMITED mode", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The toolbar marks both buttons as `disabled` when in LIMITED
  // mode.
  assert.match(
    codeOnly,
    /disabled=\{isLimited\s*\|\|\s*disabled\}/,
    "Download and print buttons must be disabled in LIMITED mode."
  );
  // The limited-mode tooltip must mention purchase.
  assert.match(codeOnly, /Mua tài liệu để tải xuống/);
});

test("StudyItPdfViewer tracks current page from viewport-center geometry", () => {
  // The previous IntersectionObserver-driven approach had a
  // stale bestRatio/bestPage bug that could leave the toolbar
  // stuck on an old page even when the viewport had scrolled
  // past it. The current page is now calculated from the
  // scroll viewport's centre against the per-page wrapper
  // elements registered in `mainPageElementMapRef`.
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(
    codeOnly,
    /mainPageElementMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Viewer must keep a per-page element map for viewport geometry."
  );
  assert.match(
    codeOnly,
    /calculateViewportPage/,
    "Viewer must expose a viewport-center calculation function."
  );
  assert.match(
    codeOnly,
    /viewportCenter\s*=\s*scrollElement\.scrollTop\s*\+\s*scrollElement\.clientHeight\s*\/\s*2/,
    "Viewport center must be derived from scrollTop + clientHeight/2 of the scroll container."
  );
  assert.match(
    codeOnly,
    /addEventListener\(\s*["']scroll["']/,
    "Viewer must listen for scroll events on the main scroll container."
  );
  assert.match(
    codeOnly,
    /requestAnimationFrame/,
    "Viewer must throttle scroll-driven calculations via rAF."
  );
  // The lockedViewportActive flag has been removed in favour of
  // the permanent sticky anchor. The geometry calculation only
  // updates currentPage.
  assert.doesNotMatch(
    codeOnly,
    /lockedViewportActive/,
    "Viewer must not derive a lockedViewportActive flag any more."
  );
});

test("StudyItPdfViewer limits cleanup to unmount, documentId change, or buffer change", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  // The lifecycle effect is keyed only on (arrayBuffer, documentId).
  assert.match(codeOnly, /\[arrayBuffer,\s*documentId\]/);
});

test("StudyItPdfViewer uses bounded concurrency queue (no full cancel after page 1)", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(codeOnly, /RENDER_CONCURRENCY\s*=\s*2/);
  // The renderPage callback MUST NOT cancel every other task
  // when a single page resolves.
  const renderPageMatch = codeOnly.match(
    /const renderPage\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[rotation\]\s*\);/
  );
  assert.ok(renderPageMatch, "renderPage useCallback block must exist.");
  assert.doesNotMatch(
    renderPageMatch[0],
    /renderTaskMapRef\.current\s*=\s*new Map\(\)/,
    "renderPage must not reset the entire render task map."
  );
});

test("StudyItPdfViewer CSS uses the pages container as the scroll container", () => {
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  // The outer viewer uses `overflow: hidden` to clip the
  // rounded toolbar / body corners (intentional, not a bug).
  // The inner scroll container is the actual scroll viewport.
  const scrollRule = /\.studyit-pdf-viewer__scroll\s*\{[^}]*\}/m;
  const scrollRaw = cssSource.match(scrollRule);
  assert.ok(scrollRaw, "Scroll rule must exist.");
  const scrollBlock = stripComments(scrollRaw[0]);
  assert.match(
    scrollBlock,
    /overflow-y:\s*auto/,
    "Inner scroll container must own the vertical scroll."
  );
  assert.match(
    scrollBlock,
    /overscroll-behavior:\s*contain/,
    "Inner scroll container must contain overscroll."
  );
  // The document wrapper is a flex column that aligns each page
  // wrapper to the centre.
  const docRule = /\.studyit-pdf-viewer__document\s*\{[^}]*\}/m;
  const docRaw = cssSource.match(docRule);
  assert.ok(docRaw, "Document rule must exist.");
  const docBlock = stripComments(docRaw[0]);
  assert.match(docBlock, /display:\s*flex/);
  assert.match(docBlock, /flex-direction:\s*column/);
  assert.match(docBlock, /align-items:\s*center/);
});

test("StudyItPdfViewer CSS keeps every page wrapper in the natural flow", () => {
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  const pageRule = /\.studyit-pdf-viewer__page\s*\{[^}]*\}/m;
  const pageBlock = stripComments(cssSource.match(pageRule)[0]);
  assert.match(pageBlock, /flex:\s*0\s+0\s+auto/);
  assert.match(pageBlock, /position:\s*relative/);
});

test("StudyItPdfViewer enforces per-page descriptors without virtualization", () => {
  const codeOnly = viewerSource.replace(/\/\*[\s*S]*?\*\//g, "");
  assert.match(codeOnly, /Array\.from\(\s*\{\s*length:\s*numPages\s*\}/);
  assert.doesNotMatch(codeOnly, /pages\s*\.\s*filter\s*\(/);
  assert.doesNotMatch(codeOnly, /pages\s*\.\s*slice\s*\(/);
});

test("StudyItPdfViewer is responsive across breakpoints", () => {
  assert.match(cssSource, /@media\s*\(\s*max-width:\s*1024px\s*\)/);
  assert.match(cssSource, /@media\s*\(\s*max-width:\s*720px\s*\)/);
  assert.match(cssSource, /@media\s*\(\s*max-width:\s*480px\s*\)/);
});

test("pdfjs-dist is declared as a dependency at a stable version", () => {
  const dep = packageJson?.dependencies?.["pdfjs-dist"];
  assert.ok(dep, "pdfjs-dist must be declared in dependencies.");
  assert.match(dep, /\d+\.\d+\.\d+/, "pdfjs-dist must be pinned to a full semver.");
});

test("StudyItPdfViewer thumbnail panel renders one thumbnail per page", () => {
  // The viewer maintains a separate canvas map for thumbnails.
  const codeOnly = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(codeOnly, /thumbnailCanvasMapRef\s*=\s*useRef\(new Map\(\)\)/);
  assert.match(codeOnly, /thumbnailTaskMapRef\s*=\s*useRef\(new Map\(\)\)/);
  assert.match(codeOnly, /StudyItThumbnailPanel/);
  // Clicking a thumbnail must scroll to the page.
  assert.match(codeOnly, /handleThumbnailClick/);
});

test("StudyItPdfViewer keeps the Studocu-style overlay copy for LIMITED mode", () => {
  assert.match(viewerSource, /Đây là bản xem trước/);
  assert.match(viewerSource, /Mua tài liệu để mở khóa toàn bộ/);
  assert.match(viewerSource, /Xem đầy đủ tài liệu/);
  assert.match(viewerSource, /Tải tài liệu/);
  assert.match(viewerSource, /Truy cập nội dung không giới hạn/);
  assert.match(viewerSource, /Vì sao trang này bị làm mờ/);
});

test("StudyItPdfViewer defines the four decorative blob shapes", () => {
  for (const colour of ["--lime", "--teal", "--purple", "--pink"]) {
    assert.match(
      cssSource,
      new RegExp(`studyit-pdf-viewer__locked-blob${colour.replace("--", "--")}`)
    );
  }
});

test("StudyItPdfViewer applies a z-index above the canvas for the unlock card", () => {
  // Card sits on top of the raster; canvas stays underneath.
  const cardRule = /\.studyit-pdf-viewer__card\s*\{[^}]*\}/m;
  const cardBlock = cssSource.match(cardRule);
  assert.ok(cardBlock, "Card rule must exist.");
  assert.match(cardBlock[0], /position:\s*relative/);
  assert.match(cardBlock[0], /z-index:\s*1/);
  const overlayRule = /\.studyit-pdf-viewer__locked-overlay\s*\{[^}]*\}/m;
  const overlayBlock = cssSource.match(overlayRule);
  assert.ok(overlayBlock, "Overlay rule must exist.");
  assert.match(overlayBlock[0], /z-index:\s*5/);
});

test("LimitedPaidPdfViewer is a thin wrapper around StudyItPdfViewer in LIMITED mode", () => {
  // The legacy component must NOT carry the old PDF.js
  // implementation — it must delegate to the shared viewer.
  assert.match(
    limitedWrapperSource,
    /import\s+StudyItPdfViewer\s+from\s+["']\.\/StudyItPdfViewer["']/
  );
  assert.match(limitedWrapperSource, /mode\s*=\s*["']LIMITED["']/);
  assert.doesNotMatch(
    limitedWrapperSource,
    /pdfjs-dist/,
    "LimitedPaidPdfViewer must not re-import pdfjs-dist."
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

test("SecureDocumentPreview routes both FULL and LIMITED PDF branches through the shared viewer", () => {
  assert.match(secureSource, /StudyItPdfViewer/);

  // ── 1. Viewer orchestration ─────────────────────────────────────────────
  const bodyIdx = secureSource.indexOf("let body;");
  assert.ok(bodyIdx >= 0, "let body; must exist");
  const returnIdx = secureSource.indexOf("return (", bodyIdx);
  assert.ok(returnIdx >= 0, "component JSX return must exist after let body;");
  assert.ok(returnIdx > bodyIdx, "return must come after let body;");

  const orchBlock = secureSource.slice(bodyIdx, returnIdx);
  // showLoading → renderLoading.
  assert.match(orchBlock, /showLoading/);
  assert.match(orchBlock, /renderLoading\(\)/);
  // showViewer → renderStudyItPdf.
  assert.match(orchBlock, /showViewer/);
  assert.match(orchBlock, /renderStudyItPdf\(/);
  // showWaiting → renderWaiting.
  assert.match(orchBlock, /showWaiting/);
  assert.match(orchBlock, /renderWaiting\(/);
  // showDead → renderDead.
  assert.match(orchBlock, /showDead/);
  assert.match(orchBlock, /renderDead\(\)/);
  // showLocked → renderLocked.
  assert.match(orchBlock, /showLocked/);
  assert.match(orchBlock, /renderLocked\(\)/);
  // showError → renderError.
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
  // The showViewer branch is the ONLY branch that calls renderStudyItPdf.
  const branches = [
    /if\s*\(\s*presentation\.showLoading\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showViewer\s*\)\s*\{/,
    /else\s+if\s*\(\s*presentation\.showWaiting\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showDead\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showLocked\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showError\s*\)\s*\{/,
  ];
  for (const re of branches) {
    const m = orchBlock.match(re);
    if (m) {
      // The branch slice must not contain a renderStudyItPdf invocation.
      const branchSlice = orchBlock.slice(m.index, orchBlock.length);
      // The branch slice ends at the start of the next else-if or end of block.
      // For showViewer branch, renderStudyItPdf IS expected.
      if (!re.source.includes("showViewer")) {
        assert.doesNotMatch(branchSlice.split("else if")[0], /renderStudyItPdf\(/);
      }
    }
  }

  // ── 2. Adapter declaration ──────────────────────────────────────────────
  const adapterIdx = secureSource.indexOf("const renderStudyItPdf = (buffer, viewerMode) =>");
  assert.ok(adapterIdx >= 0, "renderStudyItPdf declaration must exist");
  // The next component-level renderer is renderWaiting.
  const nextRendererIdx = secureSource.indexOf("const renderWaiting = ", adapterIdx);
  assert.ok(nextRendererIdx >= 0, "next renderer declaration must exist after renderStudyItPdf");
  assert.ok(nextRendererIdx > adapterIdx, "next renderer must start after renderStudyItPdf");
  const adapterBlock = secureSource.slice(adapterIdx, nextRendererIdx);
  // StudyItPdfViewer is mounted.
  assert.match(adapterBlock, /StudyItPdfViewer/);
  // buffer maps to arrayBuffer.
  assert.match(adapterBlock, /arrayBuffer=\{buffer\}/);
  // viewerMode maps to mode.
  assert.match(adapterBlock, /mode=\{viewerMode\}/);
  // No FULL fallback.
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
  // Explicit FULL is accepted.
  assert.match(pdfPresBlock, /preview\.mode\s*===\s*["']FULL["']/);
  // Explicit LIMITED is accepted.
  assert.match(pdfPresBlock, /preview\.mode\s*===\s*["']LIMITED["']/);
  // viewerMode copies preview.mode.
  assert.match(pdfPresBlock, /viewerMode:\s*preview\.mode/);
  // pdfBuffer must be ArrayBuffer.
  assert.match(pdfPresBlock, /preview\.pdfBuffer\s+instanceof\s+ArrayBuffer/);
  // FULL remains FULL.
  assert.match(pdfPresBlock, /kind:\s*["']pdf["']/);
  // LIMITED remains LIMITED — there is no LIMITED→FULL remap.
  assert.doesNotMatch(pdfPresBlock, /LIMITED[\s\S]{0,80}?FULL/);
  // Unknown mode cannot default to FULL.
  assert.doesNotMatch(pdfPresBlock, /\|\|\s*["']FULL["']/);
  // Unknown mode cannot set showViewer: true outside the validPdf branch.
  // Count showViewer: true occurrences — must be exactly 1 and inside validPdf.
  const showViewerTrues = pdfPresBlock.match(/showViewer:\s*true/g) || [];
  assert.equal(
    showViewerTrues.length,
    1,
    "showViewer: true must appear exactly once in the pdf presentation block"
  );

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
  // raw Blob is checked.
  assert.match(pdfCaseBlock, /rawResult\.blob\s+instanceof\s+Blob/);
  // blob.arrayBuffer() is awaited.
  assert.match(pdfCaseBlock, /await\s+rawResult\.blob\.arrayBuffer\(\)/);
  // decoded must be ArrayBuffer.
  assert.match(pdfCaseBlock, /decoded\s+instanceof\s+ArrayBuffer/);
  // valid PDF pdfBuffer is decoded.
  assert.match(pdfCaseBlock, /pdfBuffer:\s*decoded/);
  // no Blob is returned as final pdfBuffer.
  assert.doesNotMatch(pdfCaseBlock, /pdfBuffer:\s*rawResult\.blob\b/);
});