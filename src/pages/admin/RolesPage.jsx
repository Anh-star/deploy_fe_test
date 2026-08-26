import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import RoleDrawer from '../../components/admin/roles/RoleDrawer';
import RolePermissionsDrawer from '../../components/admin/roles/RolePermissionsDrawer';
import {
  getApiErrorMessage,
  listRoles,
  patchRoleStatus,
} from '../../api/roleApi';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import { parseApiDate } from '../../utils/dateUtils';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = parseApiDate(iso);
    if (!d || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}


function statusPillClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'ENABLED') return 'admin-status-pill admin-status-pill--active';
  if (s === 'INACTIVE' || s === 'DISABLED') return 'admin-status-pill admin-status-pill--locked';
  return 'admin-status-pill admin-status-pill--other';
}

function isRoleActive(r) {
  const s = String(r.status || '').toUpperCase();
  return s === 'ACTIVE' || s === 'ENABLED';
}

export default function RolesPage() {
  const notification = useNotification();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [drawerRoleId, setDrawerRoleId] = useState(null);

  const [permDrawerOpen, setPermDrawerOpen] = useState(false);
  const [permRole, setPermRole] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-roles', page, size, debouncedSearch],
    queryFn: () => listRoles({ page, size, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => patchRoleStatus(id, status),
    onSuccess: async (_, { status }) => {
      notification.success(
        status === 'INACTIVE' || status === 'DISABLED' ? 'Đã tắt vai trò.' : 'Đã kích hoạt vai trò.'
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (e) => notification.error(getApiErrorMessage(e)),
  });

  const openCreate = () => {
    setDrawerMode('create');
    setDrawerRoleId(null);
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    setDrawerMode('edit');
    setDrawerRoleId(row.id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerRoleId(null);
  };

  const openPermissions = (e, row) => {
    e.stopPropagation();
    setPermRole(row);
    setPermDrawerOpen(true);
  };

  const closePermDrawer = () => {
    setPermDrawerOpen(false);
    setPermRole(null);
  };

  const handleToggleActive = (e, row) => {
    e.stopPropagation();
    const next = isRoleActive(row) ? 'INACTIVE' : 'ACTIVE';
    statusMutation.mutate({ id: row.id, status: next });
  };

  const tableLoading = isLoading || isFetching;
  const empty = !tableLoading && items.length === 0;

  const activeCount = items.filter((r) => isRoleActive(r)).length;
  const inactiveCount = items.filter((r) => !isRoleActive(r)).length;

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Vai trò"
        description="Quản lý vai trò, mô tả và phân quyền người dùng trong hệ thống."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mô tả…"
        actions={
          <button type="button" className="admin-btn-primary" onClick={openCreate}>
            + Tạo vai trò
          </button>
        }
      />

      {/* Metric Cards - Community Style */}
      <section className="cmp-stats-grid">
        <div className="cmp-stat-card">
          <div className="cmp-stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="cmp-stat-info">
            <h3>{isLoading ? '—' : total}</h3>
            <p>Tổng số vai trò</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon resolved">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="cmp-stat-info">
            <h3>{isLoading ? '—' : activeCount}</h3>
            <p>Đang kích hoạt</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon pending">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="10" y1="15" x2="10" y2="9"/>
              <line x1="14" y1="15" x2="14" y2="9"/>
            </svg>
          </div>
          <div className="cmp-stat-info">
            <h3>{isLoading ? '—' : inactiveCount}</h3>
            <p>Tạm tắt</p>
          </div>
        </div>
      </section>

      {isError ? (
        <p style={{ color: '#b42318', marginBottom: 16 }}>{getApiErrorMessage(error)}</p>
      ) : null}

      <AdminTableWrapper
        loading={tableLoading}
        empty={empty}
        emptyTitle="Chưa có vai trò"
        emptyDescription={
          debouncedSearch
            ? 'Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc.'
            : 'Tạo vai trò mới để bắt đầu.'
        }
        footer={
          <AdminPagination
            page={page}
            size={size}
            total={total}
            onPageChange={setPage}
            onSizeChange={(next) => {
              setSize(next);
              setPage(0);
            }}
          />
        }
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Ngày tạo</th>
              <th>Trạng thái</th>
              <th style={{ minWidth: 280 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="admin-table-row--clickable" onClick={() => openEdit(r)}>
                <td>{r.name || '—'}</td>
                <td style={{ maxWidth: 280, color: '#667085' }}>{r.description || '—'}</td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  <span className={statusPillClass(r.status)}>
                    <span aria-hidden>●</span> {r.status || '—'}
                  </span>
                </td>
                <td>
                  <div className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="admin-btn-ghost" onClick={() => openEdit(r)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost"
                      onClick={(e) => openPermissions(e, r)}
                      disabled={statusMutation.isPending}
                    >
                      Phân quyền
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost danger"
                      onClick={(e) => handleToggleActive(e, r)}
                      disabled={statusMutation.isPending}
                    >
                      {isRoleActive(r) ? 'Xóa' : 'Kích hoạt'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableWrapper>

      <RoleDrawer
        open={drawerOpen}
        mode={drawerMode}
        roleId={drawerRoleId}
        onClose={closeDrawer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-roles'] })}
      />

      <RolePermissionsDrawer
        key={permDrawerOpen && permRole?.id ? `perm-${permRole.id}` : 'perm-closed'}
        open={permDrawerOpen}
        roleId={permRole?.id ?? null}
        roleName={permRole?.name ?? ''}
        onClose={closePermDrawer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-roles'] })}
      />
    </main>
  );
}
