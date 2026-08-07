/**
 * Source-contract test for the sidebar empty-group filter.
 *
 * <p>Verifies that {@code AdminLayout.jsx} wires the recursive
 * {@code pruneEmptyMenuGroups} helper (now in {@code ./menuTree.js})
 * into the memoised {@code menuTree}. This catches accidental
 * removal of the fix.</p>
 *
 * <p>The test reads the source as text so it stays free of any runtime
 * environment requirement (no React, no Vite).</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(
  join(here, "..", "AdminLayout.jsx"),
  "utf8"
);
const menuTreeSource = readFileSync(
  join(here, "..", "menuTree.js"),
  "utf8"
);

test("AdminLayout wires the menuTree helper (no inline duplicate)", () => {
  // The helpers must live in menuTree.js so the integration test
  // can import them directly without a JSX pipeline. The layout
  // file should import them and never re-declare them inline.
  assert.match(
    menuTreeSource,
    /export\s+function\s+pruneEmptyMenuGroups\s*\(/,
    "menuTree.js must export pruneEmptyMenuGroups"
  );
  assert.match(
    menuTreeSource,
    /export\s+function\s+normalizeMenuTree\s*\(/,
    "menuTree.js must export normalizeMenuTree"
  );
  assert.match(
    layoutSource,
    /from\s+['"]\.\/menuTree['"]/,
    "AdminLayout.jsx must import from ./menuTree"
  );
  assert.doesNotMatch(
    layoutSource,
    /function\s+pruneEmptyMenuGroups\s*\(/,
    "AdminLayout.jsx must NOT redeclare pruneEmptyMenuGroups inline"
  );
  assert.doesNotMatch(
    layoutSource,
    /function\s+normalizeMenuTree\s*\(/,
    "AdminLayout.jsx must NOT redeclare normalizeMenuTree inline"
  );
});

test("menuTree memo now runs pruneEmptyMenuGroups before render", () => {
  // Match across newlines so we tolerate any formatting the author uses.
  const block = layoutSource.match(
    /const\s+menuTree\s*=\s*useMemo\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)/
  );
  assert.ok(block, "menuTree useMemo not found");
  assert.match(block[0], /pruneEmptyMenuGroups/);
  // Moderator branch: filter to /admin/... leaves only.
  assert.match(
    block[0],
    /filterAdminSidebarForModerator/,
    "Moderator branch must use filterAdminSidebarForModerator"
  );
});

test("no hard-coded removal of specific sidebar groups (generic helper)", () => {
  // We deliberately do NOT remove empty groups by name; the helper is
  // generic. Guard against accidental hard-coding of "TÀI KHOẢN" /
  // "QUẢN LÝ" / "LỊCH SỬ" removal logic.
  const forbidden = /(removeByLabel|dropByName|skipGroup)\s*\(/;
  assert.doesNotMatch(menuTreeSource, forbidden);
});

test("Sidebar does not fall back to document.fileUrl for paid previews", () => {
  // Cross-check that the shared SecureDocumentPreview is wired into the
  // admin detail page rather than the legacy fileUrl iframe.
  const detailSource = readFileSync(
    join(here, "..", "..", "..", "pages", "admin", "AdminDocumentDetailPage.jsx"),
    "utf8"
  );
  assert.match(detailSource, /SecureDocumentPreview/);
  assert.doesNotMatch(
    detailSource,
    /detail\.fileUrl/,
    "AdminDocumentDetailPage must not read detail.fileUrl for preview anymore"
  );
});
