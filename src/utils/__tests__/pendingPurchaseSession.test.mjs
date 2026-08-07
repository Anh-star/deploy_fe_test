/**
 * Behavioral tests for the safe-next URL contract.
 *
 * <p>The login flow pipes the document detail URL through
 * {@code sanitizeInternalReturnUrl()} twice (once in the
 * LoginRequiredModal provider, once in SignIn itself). This
 * test pins the contract that the helper must enforce:</p>
 *
 * <ul>
 *   <li>Accept internal relative paths starting with a single "/".</li>
 *   <li>Reject protocol-relative ("//evil.example"), external
 *       absolute URLs (http://, https://), and javascript:, data:,
 *       vbscript: schemes.</li>
 *   <li>Reject backslash characters (some browsers treat \\foo as
 *       protocol-relative).</li>
 *   <li>Reject control characters.</li>
 *   <li>Preserve the documentId in the path / search.</li>
 *   <li>Never include tokens in the output that weren't in the input.</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// The helper reads `window.location.origin` to resolve relative
// URLs and reject cross-origin resolutions. Stub a minimal
// `window` object once, before loading the helper. Use Node's
// global `URL` constructor (available since Node 18) for the
// actual resolution logic.
const FAKE_ORIGIN = "https://app.studyit.local";
globalThis.window = {
  location: {
    origin: FAKE_ORIGIN,
    pathname: "/",
    search: "",
  },
};

// Load and evaluate the helper source so we share the exact
// same implementation the rest of the app uses (no copy/paste
// divergence). Strip the ESM `export` keywords so the function
// definition runs in a plain Function constructor scope.
const helperPath = join(here, "..", "pendingPurchaseSession.js");
const helperSrc = readFileSync(helperPath, "utf8");
const transformed = helperSrc
  .replace(/export\s+function\s+/g, "function ")
  .replace(/export\s+const\s+/g, "const ");
const sandboxFn = new Function(
  "window",
  `${transformed}\n;return { sanitizeInternalReturnUrl };`
);
const { sanitizeInternalReturnUrl } = sandboxFn(globalThis.window);

function expectAccepted(raw) {
  const result = sanitizeInternalReturnUrl(raw);
  assert.ok(
    typeof result === "string" && result.startsWith("/") && !result.startsWith("//"),
    `Expected sanitizeInternalReturnUrl(${JSON.stringify(raw)}) to return an internal path. Got ${JSON.stringify(result)}.`
  );
  return result;
}

function expectRejected(raw) {
  const result = sanitizeInternalReturnUrl(raw);
  assert.equal(
    result,
    null,
    `Expected sanitizeInternalReturnUrl(${JSON.stringify(raw)}) to return null. Got ${JSON.stringify(result)}.`
  );
}

test("accepts internal document detail URL", () => {
  const raw = "/documents/4a2b4a99-da30-46d3-9bfd-cf2d13544b84";
  const safe = expectAccepted(raw);
  assert.equal(safe, raw);
});

test("accepts internal URL with query string and strips hash", () => {
  const raw = "/documents/4a2b4a99-da30-46d3-9bfd-cf2d13544b84?tab=overview#section-1";
  const safe = expectAccepted(raw);
  // hash must be removed (open-redirect / state-leak safety).
  assert.equal(
    safe,
    "/documents/4a2b4a99-da30-46d3-9bfd-cf2d13544b84?tab=overview"
  );
});

test("rejects protocol-relative URL", () => {
  expectRejected("//evil.example/path");
  expectRejected("//");
});

test("rejects absolute http/https URLs", () => {
  expectRejected("http://evil.example");
  expectRejected("https://evil.example/path");
});

test("rejects javascript: / data: / vbscript: schemes", () => {
  expectRejected("javascript:alert(1)");
  expectRejected("data:text/html,<script>alert(1)</script>");
  expectRejected("vbscript:msgbox(1)");
});

test("rejects backslash which some browsers treat as protocol-relative", () => {
  expectRejected("/\\evil.example/path");
  expectRejected("\\evil.example");
});

test("rejects control characters", () => {
  expectRejected("/path\u0000with-null");
  expectRejected("/path\nwith-newline");
  expectRejected("/path\twith-tab");
});

test("rejects non-string input", () => {
  expectRejected(undefined);
  expectRejected(null);
  expectRejected(42);
  expectRejected({});
  expectRejected([]);
});

test("rejects empty / whitespace-only input", () => {
  expectRejected("");
  expectRejected("   ");
});

test("rejects paths that do not start with /", () => {
  expectRejected("documents/abc");
  expectRejected("?next=/foo");
});

test("output never begins with two slashes (origin-escape protection)", () => {
  // Internal traversal attempt: must not produce a path that begins
  // with "//" — that would be a protocol-relative URL and could
  // escape the origin.
  const cases = ["/foo", "/foo/bar", "/documents/abc?tab=1"];
  for (const raw of cases) {
    const safe = expectAccepted(raw);
    assert.ok(
      safe.startsWith("/") && !safe.startsWith("//"),
      `Output must start with single "/". raw=${raw} safe=${safe}`
    );
  }
});