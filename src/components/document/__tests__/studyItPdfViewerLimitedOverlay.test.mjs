/**
 * Permanent sticky lock card + single-CTA contract tests.
 *
 * <p>This file pins the post-render-storm UX contract for the
 * LIMITED preview so the new sticky anchor cannot regress to the
 * previous "two CTAs" behaviour, to a page-6-embedded overlay, or
 * to a {@code position: fixed} viewport overlay.</p>
 *
 * <ul>
 *   <li>A/B — single CTA state machine (guest + authenticated).</li>
 *   <li>C/D/E — lock card is permanently mounted in LIMITED mode
 *       and never gated on currentPage.</li>
 *   <li>F/G — anchor sits between page 5 and page 6, not inside
 *       any page wrapper, not in the thumbnail panel.</li>
 *   <li>H — anchor uses CSS {@code position: sticky}; the absolute
 *       floating layer must be gone.</li>
 *   <li>I — pointer-events isolation: anchor is none, card is auto.</li>
 *   <li>J — toolbar controls remain interactive while card visible.</li>
 *   <li>K/L — safe-next URL is sanitised; no tokens; reject
 *       protocol-relative, external, javascript: URLs.</li>
 *   <li>M — post-login CTA swaps to PURCHASE once authenticated.</li>
 *   <li>N — purchase handler is called exactly once per click.</li>
 *   <li>O — FULL mode does not render the sticky anchor.</li>
 *   <li>P — render-storm lifecycle invariants remain intact
 *       (canvas maps, generations, bounded queue).</li>
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
const safeNextHelper = readFileSync(
  join(here, "..", "..", "..", "utils", "pendingPurchaseSession.js"),
  "utf8"
);
const signInSource = readFileSync(
  join(here, "..", "..", "..", "pages", "auth", "SignIn.jsx"),
  "utf8"
);

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// ------------------------------------------------------------------
// A. guestHasExactlyOneCta
// ------------------------------------------------------------------

test("A. guestHasExactlyOneCta — guest LIMITED shows one CTA only", () => {
  const codeOnly = stripComments(viewerSource);
  // The sticky anchor is the only place the card lives.
  assert.match(
    codeOnly,
    /studyit-pdf-lock-anchor/,
    "Sticky lock anchor class must exist."
  );
  // The card button reads "Đăng nhập để mua" for guests.
  assert.match(
    codeOnly,
    /Đăng nhập để mua — \$\{priceLabel\}/,
    "Guest CTA label must be 'Đăng nhập để mua — {price}'."
  );
  // The old secondary "Đăng nhập" button has been removed.
  assert.doesNotMatch(
    codeOnly,
    /studyit-pdf-viewer__card-cta--secondary/,
    "Old secondary login button class must be gone."
  );
  // No bare "Đăng nhập" button (only inside the label "Đăng nhập để mua").
  const danglingLoginButtons = codeOnly.match(
    /className="studyit-pdf-viewer__card-cta[\s\S]{0,120}?>Đăng nhập</g
  );
  assert.equal(
    danglingLoginButtons,
    null,
    "No secondary 'Đăng nhập' button may remain in the card."
  );
  // CTA label must be computed from ctaMode, not isAuthenticated.
  assert.match(
    codeOnly,
    /ctaMode\s*===\s*["']PURCHASE["']\s*\?\s*[`'"]Mua ngay/,
    "Authenticated CTA label must be 'Mua ngay — {price}'."
  );
});

// ------------------------------------------------------------------
// B. authenticatedUnpaidHasExactlyOnePurchaseCta
// ------------------------------------------------------------------

test("B. authenticatedUnpaidHasExactlyOnePurchaseCta — single purchase CTA", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /ctaMode\s*===\s*["']PURCHASE["']/,
    "ctaMode PURCHASE branch must exist."
  );
  // The CTA label string must reference the LOGIN_TO_PURCHASE label.
  assert.match(
    codeOnly,
    /Đăng nhập để mua/,
    "Guest CTA label string 'Đăng nhập để mua' must exist."
  );
  // The card carries only ONE button (no nested conditional
  // rendering a second button).
  const cardBlock = codeOnly.match(
    /studyit-pdf-lock-anchor__card[\s\S]*?<\/div>\s*<\/div>/m
  );
  assert.ok(cardBlock, "Sticky lock card block must exist.");
  const ctaButtons = cardBlock[0].match(/<button\b/g) || [];
  assert.equal(
    ctaButtons.length,
    1,
    `Sticky card must contain exactly one <button>. Found ${ctaButtons.length}.`
  );
});

// ------------------------------------------------------------------
// C/D/E — visibility permanently mounted in LIMITED mode
// ------------------------------------------------------------------

test("C/D/E. lock card is permanently mounted in LIMITED mode (not gated on currentPage)", () => {
  const codeOnly = stripComments(viewerSource);
  // The card mount is gated on `isLimited` ONLY. It must NOT
  // depend on currentPage, lockedViewportActive, or any other
  // viewport state.
  assert.match(
    codeOnly,
    /const\s+shouldRenderLockCard\s*=\s*isLimited\s*;/,
    "Card mount must be: shouldRenderLockCard = isLimited."
  );
  assert.doesNotMatch(
    codeOnly,
    /currentPage\s*>\s*effectiveVisiblePages/,
    "Card must NOT use currentPage > effectiveVisiblePages to mount."
  );
  assert.doesNotMatch(
    codeOnly,
    /lockedViewportActive/,
    "Card must NOT depend on lockedViewportActive."
  );
  assert.doesNotMatch(
    codeOnly,
    /showFloatingLockCard/,
    "Old conditional showFloatingLockCard name must be removed."
  );
});

// ------------------------------------------------------------------
// F/G — anchor sits between last readable and first locked page
// ------------------------------------------------------------------

test("F/G. anchor sits between page 5 and page 6, not inside any page wrapper", () => {
  const codeOnly = stripComments(viewerSource);
  // No FirstLockedOverlay usage anywhere.
  assert.doesNotMatch(
    codeOnly,
    /<FirstLockedOverlay\b/,
    "FirstLockedOverlay component usage must be removed."
  );
  assert.doesNotMatch(
    codeOnly,
    /isFirstLocked/,
    "isFirstLocked variable must be removed."
  );
  // The old per-page overlay class must not be used inside the page loop.
  assert.doesNotMatch(
    codeOnly,
    /studyit-pdf-viewer__locked-overlay/,
    "Old 'locked-overlay' class must no longer be rendered in the page wrapper."
  );
  // The anchor is gated on shouldRenderLockCard AND pageNumber === anchorAfterPage + 1.
  assert.match(
    codeOnly,
    /shouldRenderLockCard\s*&&[\s\S]{0,120}pageNumber\s*===\s*anchorAfterPage\s*\+\s*1/,
    "Anchor must be inserted only after the last readable page."
  );
  // The anchor class must be present in the rendered JSX.
  assert.match(
    codeOnly,
    /className="studyit-pdf-lock-anchor"/,
    "Anchor element must render with the sticky class."
  );
});

// ------------------------------------------------------------------
// H — sticky (not absolute, not fixed)
// ------------------------------------------------------------------

test("H. lock anchor uses position: sticky, NOT absolute or fixed", () => {
  const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const anchorBlock = css.match(
    /\.studyit-pdf-lock-anchor\s*\{[^}]*\}/
  );
  assert.ok(anchorBlock, "Sticky anchor rule must exist.");
  assert.match(
    anchorBlock[0],
    /position:\s*sticky/,
    "Anchor must be position: sticky."
  );
  assert.doesNotMatch(
    anchorBlock[0],
    /position:\s*fixed/,
    "Anchor MUST NOT use position: fixed."
  );
  assert.doesNotMatch(
    anchorBlock[0],
    /position:\s*absolute/,
    "Anchor MUST NOT use position: absolute (the old floating layer was absolute)."
  );
  // The old absolute floating layer must have been removed.
  assert.doesNotMatch(
    css,
    /\.studyit-pdf-floating-lock-layer\s*\{/,
    "Old absolute floating lock layer rule must be removed."
  );
  assert.doesNotMatch(
    css,
    /\.studyit-pdf-floating-lock-card\s*\{/,
    "Old floating lock card rule must be removed."
  );
});

// ------------------------------------------------------------------
// I — pointer-events isolation
// ------------------------------------------------------------------

test("I. sticky anchor does not block scroll, card captures pointer events", () => {
  const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const anchorBlock = css.match(
    /\.studyit-pdf-lock-anchor\s*\{[^}]*\}/
  );
  assert.ok(anchorBlock, "Sticky anchor rule must exist.");
  assert.match(
    anchorBlock[0],
    /pointer-events:\s*none/,
    "Anchor must be pointer-events: none so wheel / touch / PageDown still reach the document."
  );
  const cardBlock = css.match(
    /\.studyit-pdf-lock-anchor__card\s*\{[^}]*\}/
  );
  assert.ok(cardBlock, "Sticky card rule must exist.");
  assert.match(
    cardBlock[0],
    /pointer-events:\s*auto/,
    "Card must capture pointer events."
  );
});

// ------------------------------------------------------------------
// J — toolbar remains usable
// ------------------------------------------------------------------

test("J. toolbar remains usable — toolbar sits above the sticky card", () => {
  const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const toolbarBlock = css.match(
    /\.studyit-pdf-viewer__toolbar\s*\{[^}]*\}/
  );
  assert.ok(toolbarBlock, "Toolbar rule must exist.");
  assert.match(
    toolbarBlock[0],
    /z-index:\s*10/,
    "Toolbar z-index must remain >= 10."
  );
  const anchorBlock = css.match(
    /\.studyit-pdf-lock-anchor\s*\{[^}]*\}/
  );
  assert.ok(anchorBlock, "Sticky anchor rule must exist.");
  assert.match(
    anchorBlock[0],
    /z-index:\s*30/,
    "Anchor must have its own z-index above the document."
  );
  // The toolbar is rendered as a sibling of the body, BEFORE the
  // body in the JSX. The sticky anchor lives inside the body, so
  // the toolbar can never be covered by the card.
  const toolbarIdx = viewerSource.indexOf("<StudyItToolbar");
  const bodyIdx = viewerSource.indexOf(
    '<div className="studyit-pdf-viewer__body">'
  );
  assert.ok(toolbarIdx > 0, "Toolbar must be present in JSX.");
  assert.ok(bodyIdx > 0, "Viewer body must be present in JSX.");
  assert.ok(
    toolbarIdx < bodyIdx,
    "Toolbar must be a sibling rendered BEFORE the viewer body so the sticky card cannot cover it."
  );
});

// ------------------------------------------------------------------
// K — guestLoginUsesSafeNext
// ------------------------------------------------------------------

test("K. guestLoginUsesSafeNext — rejects open-redirect payloads", () => {
  // The sanitizeInternalReturnUrl helper is the contract source of truth.
  assert.match(
    safeNextHelper,
    /function\s+sanitizeInternalReturnUrl/,
    "Sanitize helper must exist."
  );
  assert.match(
    safeNextHelper,
    /javascript:/i,
    "Helper must reject javascript: scheme."
  );
  assert.match(
    safeNextHelper,
    /data:/i,
    "Helper must reject data: scheme."
  );
  assert.match(
    safeNextHelper,
    /vbscript:/i,
    "Helper must reject vbscript: scheme."
  );
  assert.match(
    safeNextHelper,
    /startsWith\("\/\/"\)/,
    "Helper must reject protocol-relative // prefix."
  );
  assert.match(
    safeNextHelper,
    /startsWith\("\/"\)/,
    "Helper must require single leading /."
  );
  // The encodeURIComponent contract is enforced at the navigation
  // boundary (LoginRequiredModalContext + SignIn), not inside the
  // helper. Both call sites must encode the next path once.
  const loginModalSource = readFileSync(
    join(here, "..", "..", "..", "context", "LoginRequiredModalContext.tsx"),
    "utf8"
  );
  assert.match(
    loginModalSource,
    /encodeURIComponent/,
    "Login modal must encode the next path via encodeURIComponent."
  );
  assert.match(
    signInSource,
    /sanitizeInternalReturnUrl/,
    "SignIn must re-sanitize the next path before navigation."
  );
  // No token in URL.
  const codeOnly = stripComments(viewerSource);
  assert.doesNotMatch(
    codeOnly,
    /accessToken.*=.*location/,
    "Viewer must not put accessToken in URL."
  );
  assert.doesNotMatch(
    codeOnly,
    /searchParams\.get\("next"\)/,
    "Viewer must not read next from query params directly."
  );
});

// ------------------------------------------------------------------
// L — loginReturnRestoresDocument
// ------------------------------------------------------------------

test("L. loginReturnRestoresDocument — SignIn returns to next path", () => {
  assert.match(
    signInSource,
    /sanitizeInternalReturnUrl/,
    "SignIn must sanitize the next path before navigation."
  );
  assert.match(
    signInSource,
    /navigate\(safeNextPath/,
    "SignIn must navigate to the sanitized next path on success."
  );
  assert.match(
    signInSource,
    /replace:\s*true/,
    "SignIn must replace history so the user cannot navigate back into login."
  );
  // Viewer constructs next from current pathname + search.
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /location\.pathname/,
    "Viewer must derive next from current location.pathname."
  );
  assert.match(
    codeOnly,
    /location\.search/,
    "Viewer must include location.search in next."
  );
});

// ------------------------------------------------------------------
// M — postLoginCtaChangesToPurchase
// ------------------------------------------------------------------

test("M. postLoginCtaChangesToPurchase — ctaMode driven by isAuthenticated", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /const\s+ctaMode\s*=\s*isAuthenticated\s*\?\s*["']PURCHASE["']\s*:\s*["']LOGIN_TO_PURCHASE["']/,
    "ctaMode must switch on isAuthenticated."
  );
  // The button receives a data-cta-mode attribute for downstream assertions.
  assert.match(
    codeOnly,
    /data-cta-mode=\{ctaMode\}/,
    "Primary CTA must expose data-cta-mode for tests / debugging."
  );
});

// ------------------------------------------------------------------
// N — purchaseHandlerCalledOnce
// ------------------------------------------------------------------

test("N. purchaseHandlerCalledOnce — single handler per click", () => {
  const codeOnly = stripComments(viewerSource);
  // The PURCHASE branch calls onPurchase with a single payload.
  const purchaseBranch = codeOnly.match(
    /if\s*\(\s*ctaMode\s*===\s*["']PURCHASE["']\s*\)[\s\S]{0,300}/
  );
  assert.ok(purchaseBranch, "PURCHASE branch must exist.");
  const onPurchaseCalls =
    (purchaseBranch[0].match(/onPurchase\(/g) || []).length;
  assert.equal(
    onPurchaseCalls,
    1,
    `PURCHASE branch must call onPurchase exactly once. Found ${onPurchaseCalls}.`
  );
});

// ------------------------------------------------------------------
// O — fullModeHasNoLockAnchor
// ------------------------------------------------------------------

test("O. fullModeHasNoFloatingCard — viewer gates anchor on isLimited", () => {
  const codeOnly = stripComments(viewerSource);
  assert.match(
    codeOnly,
    /const\s+shouldRenderLockCard\s*=\s*isLimited\s*;/,
    "Anchor visibility must require isLimited."
  );
  // The page loop must NOT render the anchor in FULL mode (it
  // uses shouldRenderLockCard as the gate).
  assert.match(
    codeOnly,
    /shouldRenderLockCard\s*&&[\s\S]{0,120}pageNumber\s*===\s*anchorAfterPage\s*\+\s*1/,
    "Anchor must be conditionally rendered only in LIMITED mode."
  );
});

// ------------------------------------------------------------------
// P — renderStormRegression
// ------------------------------------------------------------------

test("P. renderStormRegression — lifecycle invariants remain intact", () => {
  const codeOnly = stripComments(viewerSource);
  // Canvas map invariants.
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
    /thumbnailCanvasMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Thumbnail canvas map must still exist."
  );
  assert.match(
    codeOnly,
    /thumbnailTaskMapRef\s*=\s*useRef\(new Map\(\)\)/,
    "Thumbnail task map must still exist."
  );
  // Generation refs.
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
  // Bounded concurrency constants.
  assert.match(codeOnly, /MAIN_RENDER_CONCURRENCY\s*=\s*RENDER_CONCURRENCY/);
  assert.match(codeOnly, /THUMBNAIL_RENDER_CONCURRENCY\s*=\s*1/);
  // Viewer must continue to call runBoundedQueue for main + thumbnail.
  assert.match(codeOnly, /runBoundedQueue\(\{/);
  // The card mount decision does NOT touch canvas maps.
  const visibilityBlock = codeOnly.match(
    /shouldRenderLockCard[\s\S]{0,200}/
  );
  assert.ok(visibilityBlock, "Card visibility line must exist.");
  assert.doesNotMatch(
    visibilityBlock[0],
    /canvasMapRef|renderTaskMapRef|mainCanvasMapRef|mainRenderTaskMapRef/,
    "Card visibility must NOT read canvas / task maps."
  );
  assert.doesNotMatch(
    visibilityBlock[0],
    /setPages|setCurrentPage|setZoom|setRotation|setStatus|setContainerWidth/,
    "Card visibility must NOT call any state setter that restarts the render lifecycle."
  );
  // The sticky card scroll-handling effect never calls page.render
  // or bumps generation refs. Identify the effect by matching a
  // tight body that contains `addEventListener("scroll"` AND
  // `scheduleViewportCalculation()` AND ends with a close before
  // any other useEffect opens.
  const scrollEffects = codeOnly.match(
    /addEventListener\(\s*["']scroll["'][\s\S]{0,2000}?scheduleViewportCalculation\(\)[\s\S]{0,500}?\},\s*\[[^\]]+\]\s*\);/g
  );
  assert.ok(
    scrollEffects && scrollEffects.length >= 1,
    "Scroll-driven viewport recalculation effect must exist."
  );
  for (const effect of scrollEffects || []) {
    assert.doesNotMatch(
      effect,
      /documentGenerationRef\.current\s*\+=\s*1/,
      "Scroll effect must not bump the document generation."
    );
    assert.doesNotMatch(
      effect,
      /mainRenderGenerationRef\.current\s*\+=\s*1/,
      "Scroll effect must not bump the main render generation."
    );
    assert.doesNotMatch(
      effect,
      /thumbnailRenderGenerationRef\.current\s*\+=\s*1/,
      "Scroll effect must not bump the thumbnail render generation."
    );
    assert.doesNotMatch(
      effect,
      /runBoundedQueue/,
      "Scroll effect must not enqueue renders."
    );
  }
});

// ------------------------------------------------------------------
// N. noCompactBadgeDuplicate
// ------------------------------------------------------------------

test("N. noCompactBadgeDuplicate — compact badge removed in favor of sticky card", () => {
  const codeOnly = stripComments(viewerSource);
  // LaterLockedBadge component must be removed.
  assert.doesNotMatch(codeOnly, /function\s+LaterLockedBadge\b/);
  assert.doesNotMatch(codeOnly, /<LaterLockedBadge\b/);
  // Compact badge copy "Mua tài liệu để xem trang này" must not
  // be rendered any more (it lives in the now-removed badge).
  // The string itself is fine to keep elsewhere (e.g. in tests),
  // but the viewer source must not render it.
  // The badge class must not be referenced.
  assert.doesNotMatch(codeOnly, /studyit-pdf-viewer__locked-badge/);
});

// ------------------------------------------------------------------
// P. contributorFullRegression
// ------------------------------------------------------------------

test("P. contributorFullRegression — FULL mode renders no sticky anchor", () => {
  const codeOnly = stripComments(viewerSource);
  // shouldRenderLockCard must be FALSE for FULL (isLimited=false).
  assert.match(
    codeOnly,
    /const\s+shouldRenderLockCard\s*=\s*isLimited\s*;/,
    "Sticky anchor gate must be shouldRenderLockCard = isLimited."
  );
  // The anchor element must be conditionally rendered ONLY when
  // shouldRenderLockCard is true.
  assert.match(
    codeOnly,
    /shouldRenderLockCard\s*&&[\s\S]{0,120}pageNumber\s*===\s*anchorAfterPage\s*\+\s*1/,
    "Anchor must only be rendered when shouldRenderLockCard is true."
  );
  // The contributor FULL preview path: when isLimited=false the
  // toolbar renders normally with download/print enabled. Both
  // branches share the same StudyItPdfViewer component.
  assert.match(codeOnly, /disabled=\{isLimited\s*\|\|\s*disabled\}/);
  // The viewer's data-mode attribute reflects the prop without
  // branching the toolbar.
  assert.match(codeOnly, /data-mode=\{mode\}/);
});