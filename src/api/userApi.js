import axiosClient from './axiosClient';

/** Trích payload chuẩn { data: T } hoặc trả về body. */
function pickData(res) {
  const b = res?.data;
  if (b && typeof b === 'object' && 'data' in b && b.data !== undefined) return b.data;
  return b;
}

export function getApiErrorMessage(error) {
  const d = error?.response?.data;
  if (typeof d?.message === 'string') return d.message;
  if (Array.isArray(d?.message)) return d.message.join(', ');
  if (typeof error?.message === 'string') return error.message;
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/** Nhãn hiển thị vai trò (bảng danh sách). */
function extractRoleLabels(roles) {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => {
      if (typeof r === 'string') return r;
      return r?.name ?? r?.label ?? r?.code ?? r?.role ?? '';
    })
    .filter(Boolean);
}

/** UUID vai trò từ API (gán role / default select). */
function extractRoleIds(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw.roleIds)) {
    return raw.roleIds.map((id) => String(id)).filter(Boolean);
  }
  if (!Array.isArray(raw.roles)) return [];
  return raw.roles
    .map((r) => (typeof r === 'object' && r != null && r.id != null ? String(r.id) : null))
    .filter(Boolean);
}

/** Chuẩn hóa user từ API (field name linh hoạt). */
export function mapUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: String(raw.id ?? raw.userId ?? ''),
    email: raw.email ?? '',
    fullName: raw.fullName ?? raw.fullname ?? raw.name ?? '',
    status: String(raw.status ?? 'ACTIVE').toUpperCase(),
    roles: extractRoleLabels(raw.roles),
    roleIds: extractRoleIds(raw),
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
}

/**
 * GET /admin/users?page=&size=&search=
 * Hỗ trợ Page Spring (content, totalElements) hoặc { items, total }.
 */
export async function listUsers({ page = 0, size = 10, search = '' } = {}) {
  const params = { page, size };
  const q = search.trim();
  if (q) params.search = q;
  const res = await axiosClient.get('/admin/users', { params });
  const d = pickData(res);

  if (Array.isArray(d)) {
    return {
      items: d.map(mapUser).filter(Boolean),
      total: d.length,
      page: 0,
      size: d.length,
    };
  }

  if (d?.content && Array.isArray(d.content)) {
    return {
      items: d.content.map(mapUser).filter(Boolean),
      total: Number(d.totalElements ?? d.total ?? 0),
      page: Number(d.number ?? page),
      size: Number(d.size ?? size),
    };
  }

  if (Array.isArray(d?.items)) {
    return {
      items: d.items.map(mapUser).filter(Boolean),
      total: Number(d.total ?? d.items.length),
      page: Number(d.page ?? page),
      size: Number(d.size ?? size),
    };
  }

  return { items: [], total: 0, page, size };
}

/** GET /admin/users/{id} */
export async function getUser(id) {
  const res = await axiosClient.get(`/admin/users/${id}`);
  const raw = pickData(res);
  return mapUser(raw);
}

/** POST /admin/users */
export async function createUser({ email, password, fullName }) {
  const res = await axiosClient.post('/admin/users', {
    email,
    password,
    fullName,
  });
  const raw = pickData(res);
  const mapped = mapUser(raw);
  if (mapped?.id) return mapped;
  if (raw && typeof raw === 'object' && raw.id != null) {
    return mapUser({ ...raw, email: raw.email ?? email, fullName: raw.fullName ?? fullName });
  }
  return mapped;
}

/** PUT /admin/users/{id} */
export async function updateUser(id, { fullName, email }) {
  const res = await axiosClient.put(`/admin/users/${id}`, {
    fullName,
    email,
  });
  const raw = pickData(res);
  return mapUser(raw) ?? mapUser({ id, fullName, email });
}

/** PATCH /admin/users/{id}/status */
export async function patchUserStatus(id, status) {
  const res = await axiosClient.patch(`/admin/users/${id}/status`, { status });
  return pickData(res);
}

/** POST /admin/users/{id}/roles — body: { roleId: string } (UUID) */
export async function assignUserRoles(userId, roleId) {
  await axiosClient.post(`/admin/users/${userId}/roles`, { roleId });
}

/** DELETE /admin/users/{id}/roles/{roleId} */
export async function removeUserRole(userId, roleId) {
  await axiosClient.delete(`/admin/users/${userId}/roles/${encodeURIComponent(roleId)}`);
}

/**
 * Danh sách role để gán (GET /admin/roles).
 * Nếu backend chưa có endpoint, trả [].
 */
export async function listAssignableRoles() {
  try {
    const res = await axiosClient.get('/admin/roles');
    const d = pickData(res);
    const arr = Array.isArray(d) ? d : d?.content ?? d?.items ?? [];
    return arr.map(normalizeRoleOption).filter((r) => r && r.id);
  } catch {
    return [];
  }
}

/** Option cho select: id = UUID, label = tên hiển thị */
function normalizeRoleOption(r) {
  if (!r || typeof r !== 'object' || r.id == null) return null;
  const id = String(r.id);
  const label = r.label ?? r.name ?? r.code ?? id;
  return { id, label: label || id };
}

/** Tìm UUID role trong danh sách từ GET /admin/roles (so khớp tên, không phân biệt hoa thường). */
export function findAssignableRoleIdByName(roleOptions, roleName) {
  if (!Array.isArray(roleOptions) || !roleName) return null;
  const target = String(roleName).trim().toUpperCase();
  const match = roleOptions.find((o) => String(o.label).toUpperCase() === target);
  return match?.id ?? null;
}

/** GET /users/dashboard — thống kê bảng điều khiển cá nhân (đã đăng nhập). */
export async function getUserDashboard() {
  const res = await axiosClient.get('/users/dashboard');
  return pickData(res);
}

/** GET /users/{userId}/public-profile — lấy thông tin profile công khai. */
export async function getPublicProfile(userId) {
  const res = await axiosClient.get(`/users/${userId}/public-profile`);
  return pickData(res);
}
