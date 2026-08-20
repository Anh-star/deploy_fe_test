import React, { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog';
import UserDrawer from '../../components/admin/users/UserDrawer';
import {
  getApiErrorMessage,
  listUsers,
  patchUserStatus,
} from '../../api/userApi';
import { useNotification } from '../../context/NotificationContext';
import { getUserStatusUi } from '../../utils/adminStatusUi';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export default function UsersPage() {
  const notification = useNotification();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('edit');
  const [drawerUserId, setDrawerUserId] = useState(null);

  const [confirmLockUser, setConfirmLockUser] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-users', page, size, debouncedSearch],
    queryFn: () => listUsers({ page, size, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const isLocked = (u) => {
    const s = String(u.status || '').toUpperCase();
    return s === 'LOCKED' || s === 'DISABLED' || s === 'BANNED';
  };

  const filteredItems = useMemo(() => {
    return items.filter((u) => {
      if (statusFilter) {
        const locked = isLocked(u);
        if (statusFilter === 'ACTIVE' && locked) return false;
        if (statusFilter === 'LOCKED' && !locked) return false;
      }
      if (startDate) {
        const itemDate = u.createdAt ? new Date(u.createdAt) : null;
        if (itemDate && itemDate < new Date(`${startDate}T00:00:00`)) return false;
      }
      if (endDate) {
        const itemDate = u.createdAt ? new Date(u.createdAt) : null;
        if (itemDate && itemDate > new Date(`${endDate}T23:59:59.999`)) return false;
      }
      return true;
    });
  }, [items, statusFilter, startDate, endDate]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => patchUserStatus(id, status),
    onSuccess: async (_, { status }) => {
      notification.success(status === 'LOCKED' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmLockUser(null);
    },
    onError: (e) => notification.error(getApiErrorMessage(e)),
  });

  const openCreate = () => {
    setDrawerMode('create');
    setDrawerUserId(null);
    setDrawerOpen(true);
  };

  const openEdit = (user) => {
    setDrawerMode('edit');
    setDrawerUserId(user.id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerUserId(null);
  };

  const handleToggleLock = (e, user) => {
    e.stopPropagation();
    if (isLocked(user)) {
      statusMutation.mutate({ id: user.id, status: 'ACTIVE' });
      return;
    }
    setConfirmLockUser(user);
  };

  const confirmLock = () => {
    if (!confirmLockUser) return;
    statusMutation.mutate({ id: confirmLockUser.id, status: 'LOCKED' });
  };

  const tableLoading = isLoading || isFetching;
  const empty = !tableLoading && filteredItems.length === 0;

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Người dùng"
        description="Quản lý tài khoản, vai trò và trạng thái."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo email, tên…"
        actions={
          <button type="button" className="admin-btn-primary" onClick={openCreate}>
            + Tạo mới
          </button>
        }
      />

      <div className="admin-toolbar-row">
        <div className="admin-tabs-wrapper">
          {[
            { key: '', label: 'Tất cả' },
            { key: 'ACTIVE', label: 'Đang hoạt động' },
            { key: 'LOCKED', label: 'Đã khóa' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`admin-tab-btn ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="admin-date-filters">
          <div className="admin-date-group">
            <span className="admin-date-label">Từ ngày:</span>
            <input
              type="date"
              className="admin-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="admin-date-group">
            <span className="admin-date-label">Đến ngày:</span>
            <input
              type="date"
              className="admin-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(search || statusFilter || startDate || endDate) && (
            <button
              type="button"
              className="admin-reset-btn"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
              }}
              title="Xóa bộ lọc"
            >
              Reset bộ lọc
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <p style={{ color: '#b42318', marginBottom: 16 }}>{getApiErrorMessage(error)}</p>
      ) : null}

      <AdminTableWrapper
        loading={tableLoading}
        empty={empty}
        emptyTitle="Chưa có người dùng"
        emptyDescription={
          debouncedSearch || statusFilter || startDate || endDate
            ? 'Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc.'
            : 'Tạo người dùng mới để bắt đầu.'
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
              <th>Email</th>
              <th>Họ tên</th>
              <th>Trạng thái</th>
              <th>Vai trò</th>
              <th>Ngày tạo</th>
              <th style={{ width: 200 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((u) => {
              const statusUi = getUserStatusUi(u.status);
              return (
              <tr key={u.id} className="admin-table-row--clickable" onClick={() => openEdit(u)}>
                <td>{u.email || '—'}</td>
                <td>{u.fullName || '—'}</td>
                <td>
                  <span className={statusUi.pillClass}>
                    <span aria-hidden>●</span> {statusUi.label}
                  </span>
                </td>
                <td>
                  <div className="admin-role-tags">
                    {u.roles?.length
                      ? u.roles.map((r) => (
                          <span key={r} className="admin-role-tag">
                            {r}
                          </span>
                        ))
                      : '—'}
                  </div>
                </td>
                <td>{formatDate(u.createdAt)}</td>
                <td>
                  <div className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="admin-btn-ghost" onClick={() => openEdit(u)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost danger"
                      onClick={(e) => handleToggleLock(e, u)}
                      disabled={statusMutation.isPending}
                    >
                      {isLocked(u) ? 'Mở khóa' : 'Khóa'}
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </AdminTableWrapper>

      <UserDrawer
        open={drawerOpen}
        mode={drawerMode}
        userId={drawerUserId}
        onClose={closeDrawer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
      />

      <AdminConfirmDialog
        open={Boolean(confirmLockUser)}
        title="Khóa tài khoản?"
        message={
          confirmLockUser
            ? `Người dùng ${confirmLockUser.email || confirmLockUser.fullName || confirmLockUser.id} sẽ không thể đăng nhập cho đến khi được mở khóa.`
            : ''
        }
        confirmLabel="Khóa"
        danger
        loading={statusMutation.isPending}
        onCancel={() => setConfirmLockUser(null)}
        onConfirm={confirmLock}
      />
    </main>
  );
}
