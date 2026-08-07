/**
 * Runtime regression test for the Content Moderator sidebar.
 *
 * <p>The earlier correction only verified the
 * {@code pruneEmptyMenuGroups} helper in isolation; the live UI kept
 * showing three empty parent groups (TÀI KHOẢN, QUẢN LÝ, LỊCH SỬ)
 * because the helper relied on the raw {@code children} field — and
 * the backend now ALWAYS emits a {@code children} array for every
 * MenuDto, so the field-based heuristic could not separate a leaf
 * from an empty group.</p>
 *
 * <p>This test sets up the exact API fixture a Content Moderator
 * would receive (with explicit {@code wrapper} flags and
 * {@code parentId} references), runs the helpers through the same
 * imports {@code AdminLayout.jsx} uses, and asserts on the
 * resulting normalised tree.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMenuTree,
  pruneEmptyMenuGroups,
} from "../menuTree.js";

/**
 * Build the Content Moderator fixture using the modern payload
 * shape. The backend walks up from each permitted menu to its
 * ancestors so the user can reach that menu; the ancestors appear
 * with {@code wrapper: true} because the user has no DIRECT
 * permission for them.
 */
function buildContentModeratorFixture() {
  return [
    {
      id: "dashboard",
      label: "Bảng điều khiển",
      path: "/admin/dashboard",
      children: [],
      wrapper: false,
    },
    {
      id: "tai-khoan",
      label: "TÀI KHOẢN",
      path: "/admin/accounts",
      children: [],
      wrapper: true,
    },
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      children: [],
      wrapper: true,
    },
    {
      id: "yeu-cau-dong-gop",
      label: "Yêu cầu đóng góp",
      path: "/admin/contributor-requests",
      parentId: "tai-khoan",
      children: [],
      wrapper: false,
    },
    {
      id: "tai-lieu-cho-duyet",
      label: "Tài liệu đang chờ duyệt",
      path: "/admin/documents-pending",
      parentId: "quan-ly",
      children: [],
      wrapper: false,
    },
    {
      id: "lich-su",
      label: "LỊCH SỬ",
      path: "/admin/history",
      children: [],
      wrapper: true,
    },
  ];
}

test("Content Moderator sidebar does not render TÀI KHOẢN, QUẢN LÝ, LỊCH SỬ", () => {
  const fixture = buildContentModeratorFixture();
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);

  assert.ok(
    labels.includes("Bảng điều khiển"),
    "Dashboard must remain for the Content Moderator."
  );
  assert.ok(
    labels.includes("Yêu cầu đóng góp"),
    "Permitted leaves must survive the prune."
  );
  assert.ok(
    labels.includes("Tài liệu đang chờ duyệt"),
    "Permitted leaves must survive the prune."
  );
  assert.ok(
    !labels.includes("TÀI KHOẢN"),
    "Empty parent group TÀI KHOẢN must be removed."
  );
  assert.ok(
    !labels.includes("QUẢN LÝ"),
    "Empty parent group QUẢN LÝ must be removed."
  );
  assert.ok(
    !labels.includes("LỊCH SỬ"),
    "Empty parent group LỊCH SỬ must be removed."
  );
  // At least three navigable items must remain.
  const navigable = tree.filter((n) => n.path && !n.isGroup);
  assert.ok(
    navigable.length >= 3,
    "Sidebar must keep at least three navigable items for the moderator."
  );
});

test("QUẢN LÝ with one authorised child stays and exposes the child", () => {
  // A NON-wrapper group (the user has direct permission for
  // the group itself) keeps the heading and renders the
  // child underneath.
  const fixture = [
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: false,
      children: [
        {
          id: "yeu-cau",
          label: "Yêu cầu đóng góp",
          path: "/admin/contributor-requests",
          parentId: "quan-ly",
          wrapper: false,
          children: [],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, "QUẢN LÝ");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].label, "Yêu cầu đóng góp");
});

test("Wrapper group with one authorised child gets the leaf hoisted to root", () => {
  // The user only has direct permission for the child; the
  // parent heading is just a wrapper. The child must be
  // hoisted to the root and the wrapper heading dropped.
  const fixture = [
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: true,
      children: [
        {
          id: "yeu-cau",
          label: "Yêu cầu đóng góp",
          path: "/admin/contributor-requests",
          parentId: "quan-ly",
          wrapper: false,
          children: [],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, "Yêu cầu đóng góp");
  assert.equal(tree[0].path, "/admin/contributor-requests");
  assert.equal(tree[0].wrapper, null);
});

test("System Admin fixture keeps every parent group because they all have visible children", () => {
  // Real System Admin tree — every parent has direct permission
  // so the helper MUST NOT remove them. The leaves remain
  // nested under their natural parent.
  const fixture = [
    {
      id: "tai-khoan",
      label: "TÀI KHOẢN",
      path: "/admin/accounts",
      wrapper: false,
      children: [
        {
          id: "tai-khoan-list",
          label: "Danh sách tài khoản",
          path: "/admin/accounts/list",
          parentId: "tai-khoan",
          wrapper: false,
          children: [],
        },
      ],
    },
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: false,
      children: [
        {
          id: "ql-tai-lieu",
          label: "Quản lý tài liệu",
          path: "/admin/manage/documents",
          parentId: "quan-ly",
          wrapper: false,
          children: [],
        },
        {
          id: "ql-nguoi-dung",
          label: "Quản lý người dùng",
          path: "/admin/manage/users",
          parentId: "quan-ly",
          wrapper: false,
          children: [],
        },
      ],
    },
    {
      id: "lich-su",
      label: "LỊCH SỬ",
      path: "/admin/history",
      wrapper: false,
      children: [
        {
          id: "ls-thanh-toan",
          label: "Lịch sử thanh toán",
          path: "/admin/history/payments",
          parentId: "lich-su",
          wrapper: false,
          children: [],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);
  assert.deepEqual(labels, ["TÀI KHOẢN", "QUẢN LÝ", "LỊCH SỬ"]);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[1].children.length, 2);
  assert.equal(tree[2].children.length, 1);
});

test("Empty parent groups survive the helper only when they carry an authorised descendant", () => {
  // Two-level wrapper chain. Both QUẢN LÝ and the nested
  // section are wrappers; the only real leaf at the bottom
  // of the chain must be hoisted to the top level.
  const fixture = [
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: true,
      children: [
        {
          id: "section",
          label: "Children section",
          path: "/admin/manage/section",
          parentId: "quan-ly",
          wrapper: true,
          children: [
            {
              id: "leaf",
              label: "Deeply nested leaf",
              path: "/admin/manage/section/leaf",
              parentId: "section",
              wrapper: false,
              children: [],
            },
          ],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, "Deeply nested leaf");
  assert.equal(tree[0].path, "/admin/manage/section/leaf");
  assert.equal(tree[0].wrapper, null);
});

test("Non-wrapper nested groups keep their structure", () => {
  // System Admin has direct permission for every node, so
  // every group stays and the leaves stay nested.
  const fixture = [
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: false,
      children: [
        {
          id: "section",
          label: "Children section",
          path: "/admin/manage/section",
          parentId: "quan-ly",
          wrapper: false,
          children: [
            {
              id: "leaf",
              label: "Deeply nested leaf",
              path: "/admin/manage/section/leaf",
              parentId: "section",
              wrapper: false,
              children: [],
            },
          ],
        },
      ],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, "QUẢN LÝ");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].children.length, 1);
  assert.equal(tree[0].children[0].children[0].label, "Deeply nested leaf");
});

test("A wrapper group whose descendants are all dropped is removed entirely", () => {
  const fixture = [
    {
      id: "phantom",
      label: "Phantom group",
      path: "/admin/phantom",
      wrapper: true,
      children: [],
    },
    {
      id: "inner",
      label: "Unauthorised descendant",
      path: "/admin/phantom/inner",
      parentId: "phantom",
      wrapper: true,
      children: [],
    },
  ];
  // The descendant is also a wrapper (no direct permission) with no
  // path, so it gets dropped. The parent ends up with no surviving
  // children and is itself dropped.
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree.length, 0);
});

test("Empty wrapper group with no permitted descendants is dropped entirely", () => {
  const fixture = [
    {
      id: "tai-khoan",
      label: "Empty Group",
      path: "/admin/empty",
      wrapper: true,
      children: [],
    },
    {
      id: "real-leaf",
      label: "Real Leaf",
      path: "/admin/real-leaf",
      wrapper: false,
      children: [],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);
  assert.equal(labels.length, 1, "only the real leaf should remain");
  assert.equal(labels[0], "Real Leaf");
});

/**
 * User Moderator regression test.
 *
 * <p>Before the correction the sidebar showed the three empty
 * group headings (TÀI KHOẢN / QUẢN LÝ / LỊCH SỬ) with a
 * white-circle icon for each leaf that did not carry a path.
 * This test pins the desired final shape: every authorised
 * leaf must remain, and the three empty group headings must
 * be dropped.</p>
 */
function buildUserModeratorFixture() {
  // User Moderator's tree before the prune. The moderator
  // has direct permission only for the leaves; the parent
  // groups TÀI KHOẢN / QUẢN LÝ / LỊCH SỬ are wrapper
  // headings that exist only as ancestors of the leaves.
  // The backend attaches the leaves under the wrapper so
  // the helper can hoist them.
  return [
    {
      id: "tai-khoan",
      label: "TÀI KHOẢN",
      path: "/admin/accounts",
      wrapper: true,
      children: [
        {
          id: "user-list",
          label: "Danh sách người dùng",
          path: "/admin/accounts/users",
          parentId: "tai-khoan",
          wrapper: false,
          children: [],
        },
      ],
    },
    {
      id: "quan-ly",
      label: "QUẢN LÝ",
      path: "/admin/manage",
      wrapper: true,
      children: [
        {
          id: "roles",
          label: "Vai trò",
          path: "/admin/manage/roles",
          parentId: "quan-ly",
          wrapper: false,
          children: [],
        },
      ],
    },
    {
      id: "lich-su",
      label: "LỊCH SỬ",
      path: "/admin/history",
      wrapper: true,
      children: [
        {
          id: "thanh-toan",
          label: "Lịch sử thanh toán",
          path: "/admin/history/payments",
          parentId: "lich-su",
          wrapper: false,
          children: [],
        },
      ],
    },
  ];
}

test("User Moderator keeps authorised leaves and drops empty group headings", () => {
  const fixture = buildUserModeratorFixture();
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);
  assert.ok(
    labels.includes("Danh sách người dùng"),
    "User Moderator must keep the authorised Users leaf."
  );
  assert.ok(
    labels.includes("Vai trò"),
    "User Moderator must keep the authorised Roles leaf."
  );
  assert.ok(
    labels.includes("Lịch sử thanh toán"),
    "User Moderator must keep the authorised Payments leaf."
  );
  assert.ok(
    !labels.includes("TÀI KHOẢN"),
    "Empty TÀI KHOẢN wrapper must be removed."
  );
  assert.ok(
    !labels.includes("QUẢN LÝ"),
    "Empty QUẢN LÝ wrapper must be removed."
  );
  assert.ok(
    !labels.includes("LỊCH SỬ"),
    "Empty LỊCH SỬ wrapper must be removed."
  );
  // No node in the final tree should still be flagged as a
  // wrapper — they were all dropped or hoisted.
  const stillWrapped = JSON.stringify(tree).includes('"wrapper":true');
  assert.equal(stillWrapped, false,
    "No wrapper flag must survive in the User Moderator final tree.");
});

test("User Moderator leaves keep their route / permission / label", () => {
  const fixture = buildUserModeratorFixture();
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const usersLeaf = tree.find((n) => n.label === "Danh sách người dùng");
  assert.ok(usersLeaf, "Users leaf must survive the prune.");
  assert.equal(usersLeaf.path, "/admin/accounts/users");
  assert.equal(usersLeaf.wrapper, null);
  const rolesLeaf = tree.find((n) => n.label === "Vai trò");
  assert.ok(rolesLeaf, "Roles leaf must survive the prune.");
  assert.equal(rolesLeaf.path, "/admin/manage/roles");
});

test("Vietnamese labels are preserved untouched through the pipeline", () => {
  const fixture = buildContentModeratorFixture();
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);
  for (const expected of [
    "Bảng điều khiển",
    "Yêu cầu đóng góp",
    "Tài liệu đang chờ duyệt",
  ]) {
    assert.ok(
      labels.includes(expected),
      `Vietnamese label "${expected}" must survive the prune.`
    );
  }
  for (const forbidden of [
    "Dashboard",
    "Contributor Requests",
    "Pending Documents",
  ]) {
    assert.ok(
      !labels.includes(forbidden),
      `English label "${forbidden}" must not appear in the sidebar.`
    );
  }
});

/**
 * Sidebar must NOT carry a leaf with no path. Such leaves
 * would otherwise render as disabled items with a white-circle
 * fallback icon.
 */
test("Leaves with no path are removed entirely", () => {
  const fixture = [
    {
      id: "leafless",
      label: "Leaf without path",
      wrapper: false,
      children: [],
    },
    {
      id: "real",
      label: "Real leaf",
      path: "/admin/real",
      wrapper: false,
      children: [],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  const labels = tree.map((node) => node.label);
  assert.deepEqual(labels, ["Real leaf"]);
});

/**
 * The Vietnamese sidebar must not surface English copies as
 * primary labels even if the backend payload happens to be in
 * English. The frontend keeps the helper free of any
 * translation logic so the translation table (if any) lives
 * in {@code AdminLayout.jsx}.
 */
test("Helper leaves labels untouched so AdminLayout translation table drives the language", () => {
  const fixture = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/admin/dashboard",
      wrapper: false,
      children: [],
    },
  ];
  const tree = pruneEmptyMenuGroups(normalizeMenuTree(fixture));
  assert.equal(tree[0].label, "Dashboard");
});