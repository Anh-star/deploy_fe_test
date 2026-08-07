/**
 * Verified-DB moderator sidebar tests.
 *
 * <p>The verified SQL Server data shows that moderators receive BOTH
 * admin leaves and user-area leaves. This test pins the exact
 * moderator filter behaviour that the production sidebar must
 * follow:</p>
 *
 * <ul>
 *   <li>only navigable leaves whose route starts with
 *       {@code /admin/} survive;</li>
 *   <li>user-area leaves ({@code /quiz-history},
 *       {@code /view-history}, {@code /favorite-documents},
 *       {@code /purchase-history}, {@code /manage-quizzes},
 *       {@code /manage-reports}, {@code /profile}) are excluded;</li>
 *   <li>duplicates are removed by {@code menu.id};</li>
 *   <li>the surviving leaves are sorted by the DB column
 *       {@code display_order};</li>
 *   <li>the leaves are presented as flat top-level items (no
 *       empty parent group heading);</li>
 *   <li>the Vietnamese label table maps each
 *       {@code /admin/...} route to the expected label;</li>
 *   <li>the System Administrator (ADMIN role) keeps the full
 *       menu tree — the moderator filter MUST NOT run.</li>
 * </ul>
 *
 * <p>This test reads the helpers from {@code ./menuTree.js} so it
 * runs without a JSX pipeline and without any DB access.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_VIETNAMESE_LABEL_BY_ROUTE,
  filterAdminSidebarForModerator,
  isModeratorRole,
  normalizeMenuTree,
  pruneEmptyMenuGroups,
  resolveAdminVietnameseLabel,
} from "../menuTree.js";

/**
 * Build the verified-DB Content Moderator payload.
 *
 * <p>The payload mirrors what the backend returns for a Content
 * Moderator: the admin leaves plus the user-area leaves the role
 * still needs on the public site. The wrappers and parent groups
 * are emitted by the backend so the moderator can reach the
 * leaves.</p>
 */
function buildVerifiedContentModeratorPayload() {
  return [
    {
      id: "1",
      name: "Dashboard",
      route: "/admin/dashboard",
      display_order: 1,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "2",
      name: "Contributor Requests",
      route: "/admin/contributor-requests",
      display_order: 2,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "3",
      name: "Pending Documents",
      route: "/admin/documents/pending",
      display_order: 3,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "4",
      name: "Lịch sử Quiz",
      route: "/quiz-history",
      display_order: 4,
      parent_id: "history",
      wrapper: false,
      children: [],
    },
    {
      id: "5",
      name: "Lịch sử tài liệu đã xem",
      route: "/view-history",
      display_order: 5,
      parent_id: "history",
      wrapper: false,
      children: [],
    },
    {
      id: "6",
      name: "Tài liệu yêu thích",
      route: "/favorite-documents",
      display_order: 6,
      parent_id: "manage",
      wrapper: false,
      children: [],
    },
    {
      id: "history",
      name: "LỊCH SỬ",
      route: null,
      display_order: 99,
      parent_id: null,
      wrapper: true,
      children: [],
    },
    {
      id: "manage",
      name: "QUẢN LÝ",
      route: null,
      display_order: 100,
      parent_id: null,
      wrapper: true,
      children: [],
    },
  ];
}

/**
 * Build the verified-DB User Moderator payload. Five admin leaves,
 * plus the two user-area leaves the role still uses on the
 * public site.
 */
function buildVerifiedUserModeratorPayload() {
  return [
    {
      id: "u1",
      name: "Dashboard",
      route: "/admin/dashboard",
      display_order: 1,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "u2",
      name: "Categories",
      route: "/admin/categories",
      display_order: 2,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "u3",
      name: "Tags",
      route: "/admin/tags",
      display_order: 3,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "u4",
      name: "Contributor Requests",
      route: "/admin/contributor-requests",
      display_order: 4,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "u5",
      name: "User Reports",
      route: "/admin/reports",
      display_order: 5,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "u6",
      name: "Lịch sử Quiz",
      route: "/quiz-history",
      display_order: 6,
      parent_id: "history",
      wrapper: false,
      children: [],
    },
    {
      id: "u7",
      name: "Lịch sử tài liệu đã xem",
      route: "/view-history",
      display_order: 7,
      parent_id: "history",
      wrapper: false,
      children: [],
    },
    {
      id: "history",
      name: "LỊCH SỬ",
      route: null,
      display_order: 99,
      parent_id: null,
      wrapper: true,
      children: [],
    },
  ];
}

test("Content Moderator sidebar keeps only verified /admin/ routes", () => {
  const payload = buildVerifiedContentModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const labels = tree.map((leaf) => resolveAdminVietnameseLabel(leaf));

  assert.deepEqual(
    labels,
    [
      "Bảng điều khiển",
      "Yêu cầu đóng góp",
      "Tài liệu đang chờ duyệt",
    ],
    "Content Moderator must show only the three verified Vietnamese admin labels."
  );
});

test("Content Moderator sidebar excludes user-area leaves", () => {
  const payload = buildVerifiedContentModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const paths = tree.map((leaf) => leaf.path);

  for (const forbidden of [
    "/quiz-history",
    "/view-history",
    "/favorite-documents",
    "/purchase-history",
    "/manage-quizzes",
    "/manage-reports",
    "/profile",
  ]) {
    assert.ok(
      !paths.includes(forbidden),
      `User-area route "${forbidden}" must NOT appear in the admin sidebar.`
    );
  }
});

test("Content Moderator sidebar excludes empty parent group headings", () => {
  const payload = buildVerifiedContentModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const labels = tree.map((leaf) => leaf.label);

  for (const forbidden of ["LỊCH SỬ", "QUẢN LÝ", "TÀI KHOẢN", "Access Control"]) {
    assert.ok(
      !labels.includes(forbidden),
      `Empty parent group "${forbidden}" must NOT be rendered.`
    );
  }
});

test("Content Moderator sidebar keeps the original DB routes", () => {
  const payload = buildVerifiedContentModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const paths = tree.map((leaf) => leaf.path);

  assert.deepEqual(paths, [
    "/admin/dashboard",
    "/admin/contributor-requests",
    "/admin/documents/pending",
  ]);
});

test("Content Moderator sidebar deduplicates by menu.id", () => {
  // Even when the backend accidentally emits the same leaf twice
  // (e.g. once as a direct permission and once as a wrapper
  // descendant) the sidebar MUST keep a single entry.
  const payload = [
    ...buildVerifiedContentModeratorPayload(),
    {
      id: "1",
      name: "Dashboard",
      route: "/admin/dashboard",
      display_order: 1,
      parent_id: null,
      wrapper: false,
      children: [],
    },
  ];
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const paths = tree.map((leaf) => leaf.path);
  assert.equal(
    paths.filter((p) => p === "/admin/dashboard").length,
    1,
    "Duplicate /admin/dashboard entries must collapse to a single sidebar entry."
  );
});

test("User Moderator sidebar keeps only verified /admin/ routes", () => {
  const payload = buildVerifiedUserModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const labels = tree.map((leaf) => resolveAdminVietnameseLabel(leaf));

  assert.deepEqual(
    labels,
    [
      "Bảng điều khiển",
      "Danh mục",
      "Thẻ",
      "Yêu cầu đóng góp",
      "Báo cáo người dùng",
    ],
    "User Moderator must show only the five verified Vietnamese admin labels."
  );
});

test("User Moderator sidebar excludes user-area leaves and empty groups", () => {
  const payload = buildVerifiedUserModeratorPayload();
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const paths = tree.map((leaf) => leaf.path);

  assert.ok(!paths.includes("/quiz-history"));
  assert.ok(!paths.includes("/view-history"));
  assert.equal(tree.length, 5);
});

test("Surviving leaves are sorted by display_order", () => {
  // Intentionally shuffle display_order to verify the helper
  // re-sorts.
  const payload = [
    {
      id: "a",
      name: "Pending Documents",
      route: "/admin/documents/pending",
      display_order: 30,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "b",
      name: "Dashboard",
      route: "/admin/dashboard",
      display_order: 10,
      parent_id: null,
      wrapper: false,
      children: [],
    },
    {
      id: "c",
      name: "Contributor Requests",
      route: "/admin/contributor-requests",
      display_order: 20,
      parent_id: null,
      wrapper: false,
      children: [],
    },
  ];
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const orders = tree.map((leaf) => leaf.displayOrder);
  assert.deepEqual(orders, [10, 20, 30]);
});

test("isModeratorRole correctly classifies Content / User Moderator", () => {
  assert.equal(isModeratorRole(["CONTENT_MODERATOR"]), true);
  assert.equal(isModeratorRole(["USER_MODERATOR"]), true);
  assert.equal(isModeratorRole(["content_moderator"]), true);
  assert.equal(isModeratorRole(["CONTRIBUTOR"]), false);
  assert.equal(isModeratorRole(["ADMIN"]), false);
  // ADMIN is always treated as System Administrator; the filter
  // MUST NOT run even if a moderator role is also present.
  assert.equal(
    isModeratorRole(["ADMIN", "CONTENT_MODERATOR"]),
    false,
    "ADMIN role always wins — moderators keep the full tree."
  );
  assert.equal(isModeratorRole(undefined), false);
  assert.equal(isModeratorRole(null), false);
});

test("System Administrator (ADMIN role) is NOT filtered", () => {
  // The full Admin tree has direct permission for every node.
  // pruneEmptyMenuGroups MUST keep every parent group and every
  // child. The filterAdminSidebarForModerator helper MUST NOT run.
  // For System Admin the parent groups carry their children in
  // a `children` array (the standard nested payload shape).
  const adminPayload = [
    {
      id: "access-control",
      name: "Access Control",
      route: "/admin/access-control",
      display_order: 1,
      parent_id: null,
      wrapper: false,
      children: [
        {
          id: "users",
          name: "Users",
          route: "/admin/users",
          display_order: 2,
          parent_id: "access-control",
          wrapper: false,
          children: [],
        },
        {
          id: "roles",
          name: "Roles",
          route: "/admin/roles",
          display_order: 3,
          parent_id: "access-control",
          wrapper: false,
          children: [],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(adminPayload));
  const labels = tree.map((n) => n.label);
  assert.ok(
    labels.includes("Access Control"),
    "Access Control parent group must survive for System Administrator."
  );
  assert.equal(tree[0].children.length, 2);
  // System Administrator's full tree must NOT be reduced by the
  // moderator filter — isModeratorRole returns false for ADMIN.
  assert.equal(isModeratorRole(["ADMIN"]), false);
});

test("Vietnamese label table maps every verified admin route", () => {
  // The map is the single source of truth for the admin sidebar.
  // Adding a new admin route MUST add a new entry here.
  const expected = {
    "/admin/dashboard": "Bảng điều khiển",
    "/admin/contributor-requests": "Yêu cầu đóng góp",
    "/admin/documents/pending": "Tài liệu đang chờ duyệt",
    "/admin/categories": "Danh mục",
    "/admin/tags": "Thẻ",
    "/admin/reports": "Báo cáo người dùng",
  };
  for (const [route, label] of Object.entries(expected)) {
    assert.equal(ADMIN_VIETNAMESE_LABEL_BY_ROUTE[route], label);
  }
  // resolveAdminVietnameseLabel must return the mapped label
  // for the verified routes.
  assert.equal(
    resolveAdminVietnameseLabel({ path: "/admin/dashboard" }),
    "Bảng điều khiển"
  );
  // Unknown routes fall back to the original DB label.
  assert.equal(
    resolveAdminVietnameseLabel({
      path: "/admin/unknown",
      label: "Original English",
    }),
    "Original English"
  );
});

test("filterAdminSidebarForModerator never returns empty parent groups", () => {
  // Even when the payload contains a deeply nested admin leaf
  // inside a wrapper chain, the helper hoists it to a top-level
  // item — no group heading is emitted.
  const payload = [
    {
      id: "g1",
      name: "G1",
      route: null,
      display_order: 1,
      parent_id: null,
      wrapper: true,
      children: [],
    },
    {
      id: "g2",
      name: "G2",
      route: null,
      display_order: 2,
      parent_id: "g1",
      wrapper: true,
      children: [],
    },
    {
      id: "leaf",
      name: "Deeply nested leaf",
      route: "/admin/deep",
      display_order: 3,
      parent_id: "g2",
      wrapper: false,
      children: [],
    },
  ];
  const tree = filterAdminSidebarForModerator(normalizeMenuTree(payload));
  const labels = tree.map((leaf) => leaf.label);
  assert.deepEqual(labels, ["Deeply nested leaf"]);
  // The hoisted leaf has no children and is rendered as a top-
  // level link.
  assert.equal(tree[0].children.length, 0);
  assert.equal(tree[0].wrapper, null);
  assert.equal(tree[0].isGroup, false);
});