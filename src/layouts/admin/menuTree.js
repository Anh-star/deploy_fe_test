/**
 * Generic menu tree helpers extracted from {@code AdminLayout.jsx} so
 * they can be unit-tested in isolation. There is intentionally no JSX
 * here so the test runner can load this file without a JSX pipeline.
 *
 * <p>The public surface area is:
 * <ul>
 *   <li>{@link normalizeMenuTree} — converts a raw API menu list into
 *       a canonical {@code { id, label, path?, parentId, rawChildren,
 *       wrapper, isGroup, children[] }} shape.</li>
 *   <li>{@link pruneEmptyMenuGroups} — drops GROUP nodes whose visible
 *       children are all stripped. NAVIGABLE leaves (with a path) are
 *       kept verbatim.</li>
 * </ul>
 *
 * <h2>How isGroup is computed</h2>
 * <p>The backend marks every menu node that is present in the
 * response only because it is an ancestor of a permitted menu (i.e.
 * the user has no direct permission for it) with
 * {@code wrapper: true}. Such nodes are STRUCTURAL group headings and
 * must not be rendered as navigable leaves; this is the contract that
 * lets the Content Moderator sidebar drop the empty TÀI KHOẢN /
 * QUẢN LÝ / LỊCH SỬ headings without losing the navigable leaves
 * beneath them. When the wrapper flag is missing (older backend
 * versions) we fall back to the {@code parentId / children}-based
 * heuristic.</p>
 */
/**
 * Normalise a menu payload returned by the backend.
 *
 * <p>Each node becomes:</p>
 * <pre>
 * {
 *   id,
 *   label,
 *   path?,
 *   parentId,
 *   rawChildren: [],
 *   hasChildrenField: boolean,
 *   children: normalised[],
 *   isGroup: boolean,
 *   wrapper: boolean | null,
 * }
 * </pre>
 *
 * <p>{@code isGroup} is set to {@code true} when the node is
 * either flagged by the backend (the {@code wrapper} field) or
 * referenced as a parent by another node in the SAME
 * payload. The fallback heuristic also accepts legacy
 * payloads where the node declared a non-empty
 * {@code children} array.</p>
 */
export function normalizeMenuTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  const cleaned = nodes
    .filter((n) => n && typeof n === "object")
    .map((n) => {
      const originalLabel = n.name ?? n.label ?? "";
      const label = originalLabel;
      const pathRaw = n.route ?? n.path;
      const path = typeof pathRaw === "string" && pathRaw.trim()
        ? pathRaw.trim()
        : undefined;
      const parentRaw = n.parentId ?? n.parent_id ?? null;
      const parentId = typeof parentRaw === "string" && parentRaw.trim()
        ? parentRaw.trim()
        : null;
      const hasChildrenField = Object.prototype.hasOwnProperty.call(
        n,
        "children"
      );
      const rawChildren = Array.isArray(n.children) ? n.children : [];
      const children = normalizeMenuTree(rawChildren);
      const id = typeof n.id === "string" ? n.id : null;
      const wrapperRaw = n.wrapper;
      const wrapper = typeof wrapperRaw === "boolean" ? wrapperRaw : null;
      const displayOrderRaw = n.displayOrder ?? n.display_order;
      const displayOrder =
        typeof displayOrderRaw === "number" && Number.isFinite(displayOrderRaw)
          ? displayOrderRaw
          : null;
      return {
        id,
        label,
        path,
        parentId,
        children,
        isGroup: false,
        rawChildren,
        hasChildrenField,
        wrapper,
        displayOrder,
      };
    })
    .filter((n) => n.label);

  const parentIdSet = new Set();
  cleaned.forEach((n) => {
    if (n.parentId) parentIdSet.add(n.parentId);
  });
  return cleaned.map((n) => {
    let isGroup = false;
    if (n.id && parentIdSet.has(n.id)) {
      isGroup = true;
    } else if (n.hasChildrenField && n.rawChildren.length > 0) {
      isGroup = true;
    }
    return { ...n, isGroup };
  });
}

/**
 * Drop empty GROUP nodes and hoist their surviving LEAF
 * descendants to the top level so the user never loses
 * access to a navigable feature.
 *
 * <h3>Algorithm</h3>
 * <ol>
 *   <li>A node is classified as a GROUP when:
 *     <ul>
 *       <li>the backend flagged it with {@code wrapper: true},</li>
 *       <li>the normalisation step set {@code isGroup: true}
 *           because another node in the same payload declared
 *           it as its parent, or</li>
 *       <li>the legacy heuristic fired because the node carried
 *           a non-empty {@code children} array.</li>
 *     </ul>
 *   </li>
 *   <li>If the GROUP has surviving children, it is kept and
 *       its children are pruned recursively. The
 *       grandchildren may themselves be re-promoted.</li>
 *   <li>If the GROUP ends up empty, the surviving LEAF
 *       descendants are HOISTED to the parent slot instead
 *       of being deleted. This is what makes the Content
 *       Moderator sidebar drop the empty TÀI KHOẢN / QUẢN
 *       LÝ / LỊCH SỬ headings without losing the navigable
 *       leaves beneath them.</li>
 *   <li>LEAVES (nodes without children) without a path are
 *       dropped entirely — they cannot be navigated.</li>
 *   <li>LEAVES with a path are kept verbatim.</li>
 * </ol>
 */
export function pruneEmptyMenuGroups(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const prunedChildren = pruneEmptyMenuGroups(item.children);
    const wrapperFlag = item.wrapper === true;
    const isGroup = wrapperFlag || Boolean(item.isGroup);
    if (isGroup) {
      if (wrapperFlag) {
        // Wrapper group (the user has no direct permission
        // for this node). It MUST NEVER render as a group
        // heading — only the navigable leaves it owns
        // matter. We hoist those leaves to the parent
        // bucket so the user keeps every authorised
        // feature even when the original parent group is
        // hidden. If a child is itself a non-empty group,
        // we recurse and splice its leaves in too so the
        // result stays flat.
        for (const child of prunedChildren) {
          if (child.path) {
            result.push({
              ...child,
              children: [],
              parentId: null,
              wrapper: null,
            });
          } else if (Array.isArray(child.children) && child.children.length > 0) {
            for (const grand of child.children) {
              if (grand.path) {
                result.push({
                  ...grand,
                  children: [],
                  parentId: null,
                  wrapper: null,
                });
              }
            }
          }
        }
        continue;
      }
      if (prunedChildren.length > 0) {
        // Non-wrapper group (System Admin path). Keep it
        // as an expandable heading and surface its
        // surviving children.
        result.push({ ...item, children: prunedChildren });
        continue;
      }
      // Non-wrapper group with no surviving children — we
      // also hoist any leaves that were originally
      // attached, otherwise they would vanish silently.
      for (const child of item.children || []) {
        if (child && child.path) {
          result.push({ ...child, children: [], parentId: null, wrapper: null });
        }
      }
      continue;
    }
    if (prunedChildren.length > 0) {
      // Node with children that the heuristic did NOT mark
      // as a group. Promote it so the children still render
      // underneath.
      result.push({ ...item, children: prunedChildren, isGroup: true });
      continue;
    }
    if (item.path) {
      result.push({ ...item, children: [] });
      continue;
    }
}
    // Leaf without path -> dropped.
  }
  return result;
}

/**
 * Filter a normalized menu tree so that only admin routes (path starting with /admin/)
 * and groups that contain admin routes are kept for the Admin Sidebar.
 */
export function filterOnlyAdminRoutes(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const children = filterOnlyAdminRoutes(item.children);
    const isAdminRoute = typeof item.path === "string" && item.path.startsWith("/admin/");
    if (isAdminRoute || children.length > 0) {
      result.push({ ...item, children });
    }
  }
  return result;
}


/**
 * Whether the given role list qualifies as a "moderator" (i.e. not
 * a system administrator). Moderators in this product are
 * {@code CONTENT_MODERATOR} and {@code USER_MODERATOR}; {@code ADMIN}
 * is intentionally excluded because System Administrators see the
 * full menu tree and do not need the admin-route filter.
 *
 * @param {string[] | undefined | null} roles
 * @returns {boolean}
 */
export function isModeratorRole(roles) {
  if (!Array.isArray(roles)) return false;
  const upper = roles.map((r) => String(r).toUpperCase());
  if (upper.includes("ADMIN")) return false;
  return upper.includes("CONTENT_MODERATOR") || upper.includes("USER_MODERATOR");
}

/**
 * Build the moderator admin sidebar.
 *
 * <p>The verified database shows that moderators receive BOTH admin
 * leaves (e.g. {@code /admin/dashboard}, {@code /admin/categories})
 * AND user-area leaves (e.g. {@code /quiz-history},
 * {@code /view-history}, {@code /favorite-documents}). The DB grants
 * for the user-area menus are intentional (a moderator still uses the
 * public site as a regular user); they MUST NOT be removed from the
 * database.</p>
 *
 * <p>For the {@code /admin/**} sidebar, this helper therefore keeps
 * only the leaves whose route starts with {@code /admin/}. The
 * surviving leaves are:</p>
 *
 * <ul>
 *   <li>deduplicated by {@code menu.id} (the backend already emits
 *       unique ids, but the same id may appear under different
 *       wrapper ancestors);</li>
 *   <li>sorted by {@code displayOrder} ascending (using the raw DB
 *       ordering the backend sends);</li>
 *   <li>flattened to top-level items, because a moderator must never
 *       see an empty parent group heading (TÀI KHOẢN, QUẢN LÝ,
 *       LỊCH SỬ, Access Control, …) when the underlying children
 *       were filtered out.</li>
 * </ul>
 *
 * @param {Array<object>} items  the normalised menu tree
 * @returns {Array<object>}
 */
export function filterAdminSidebarForModerator(items) {
  if (!Array.isArray(items)) return [];

  /**
   * Recursively collect every navigable leaf (i.e. a node with a
   * non-empty {@code path}) whose path starts with
   * {@code /admin/}. Leaves may live at any depth inside wrapper
   * groups; we walk the full tree so a deeply nested admin leaf
   * still surfaces.
   */
  const collected = [];

  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (typeof node.path === "string" && node.path.startsWith("/admin/")) {
        collected.push(node);
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(items);

  // Deduplicate by id (fall back to path when id is missing so a
  // backend change cannot accidentally double-render the same
  // menu).
  const seen = new Set();
  const unique = [];
  for (const leaf of collected) {
    const key = leaf.id ?? leaf.path;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(leaf);
  }

  // Stable sort by displayOrder; null entries go last.
  unique.sort((a, b) => {
    const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return 0;
  });

  // Re-shape each survivor as a top-level leaf (drop children and
  // wrapper flag so renderMenu treats it as a flat link).
  return unique.map((leaf) => ({
    ...leaf,
    children: [],
    wrapper: null,
    isGroup: false,
  }));
}

/**
 * Vietnamese label mapping for admin sidebar presentation.
 *
 * <p>The DB stores the English label in {@code tbl_menus.name}. The
 * frontend maps the route to a hardcoded Vietnamese label so we do
 * NOT need to mutate the database. The keys are case-sensitive
 * {@code /admin/...} routes.</p>
 */
export const ADMIN_VIETNAMESE_LABEL_BY_ROUTE = Object.freeze({
  "/admin/dashboard": "Bảng điều khiển",
  "/admin/contributor-requests": "Yêu cầu đóng góp",
  "/admin/documents/pending": "Tài liệu đang chờ duyệt",
  "/admin/categories": "Danh mục",
  "/admin/tags": "Thẻ",
  "/admin/reports": "Báo cáo người dùng",
});

/**
 * Resolve a Vietnamese label for the admin sidebar from a
 * {@code /admin/...} route. Falls back to the original DB label
 * when no mapping is registered.
 *
 * @param {object} node
 * @returns {string}
 */
export function resolveAdminVietnameseLabel(node) {
  if (!node || typeof node.path !== "string") return node?.label ?? "";
  const mapped = ADMIN_VIETNAMESE_LABEL_BY_ROUTE[node.path];
  return typeof mapped === "string" && mapped.length > 0
    ? mapped
    : node.label ?? "";
}