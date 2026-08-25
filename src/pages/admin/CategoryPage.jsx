import React, { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import CategoryDrawer from '../../components/admin/categories/CategoryDrawer';
import {
  getApiErrorMessage,
  listCategories,
  patchCategoryStatus,
} from '../../api/categoryApi';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getEntityActiveUi } from '../../utils/adminStatusUi';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function CategoryPage() {
  const notification = useNotification();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [drawerId, setDrawerId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-categories', page, size, debouncedSearch],
    queryFn: () => listCategories({ page, size, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const statusMut = useMutation({
    mutationFn: ({ id, active }) => patchCategoryStatus(id, active),
    onSuccess: async (_, { active }) => {
      notification.success(active ? 'Đã bật danh mục.' : 'Đã tắt danh mục.');
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (e) => notification.error(getApiErrorMessage(e)),
  });

  const openCreate = () => {
    setDrawerMode('create');
    setDrawerId(null);
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    setDrawerMode('edit');
    setDrawerId(row.id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerId(null);
  };

  const toggleActive = (e, row) => {
    e.stopPropagation();
    statusMut.mutate({ id: row.id, active: !row.active });
  };

  const tableLoading = isLoading || isFetching;
  const empty = !tableLoading && items.length === 0;

  const { user } = useAuth();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.map((r) => String(r).toUpperCase()).includes('ADMIN');
  }, [user?.roles]);

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Danh mục"
        description="Quản lý danh mục tài liệu — chỉ bật/tắt, không xóa cứng."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, slug…"
        actions={
          <button type="button" className="admin-btn-primary" onClick={openCreate}>
            + Tạo danh mục
          </button>
        }
      />

      {/* Metric Cards - Only visible for ADMIN role */}
      {isAdmin && (
        <section className="cmp-stats-grid">
          <div className="cmp-stat-card">
            <div className="cmp-stat-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : total}</h3>
              <p>Tổng danh mục</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon resolved">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : activeCount}</h3>
              <p>Đang hiển thị</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon pending">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : inactiveCount}</h3>
              <p>Tạm ẩn</p>
            </div>
          </div>
        </section>
      )}

      {isError ? (
        <p style={{ color: '#b42318', marginBottom: 16 }}>{getApiErrorMessage(error)}</p>
      ) : null}

      <AdminTableWrapper
        loading={tableLoading}
        empty={empty}
        emptyTitle="Chưa có danh mục"
        emptyDescription={
          debouncedSearch
            ? 'Thử đổi từ khóa tìm kiếm.'
            : 'Tạo danh mục mới để bắt đầu.'
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
              <th>Slug</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th style={{ minWidth: 160 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const st = getEntityActiveUi(c.active);
              return (
              <tr key={c.id} className="admin-table-row--clickable" onClick={() => openEdit(c)}>
                <td>{c.name || '—'}</td>
                <td>
                  <code style={{ fontSize: 13 }}>{c.slug || '—'}</code>
                </td>
                <td>
                  <span className={st.pillClass}>
                    <span aria-hidden>●</span> {st.label}
                  </span>
                </td>
                <td>{formatDate(c.createdAt)}</td>
                <td>
                  <div className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="admin-btn-ghost" onClick={() => openEdit(c)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost danger"
                      onClick={(e) => toggleActive(e, c)}
                      disabled={statusMut.isPending}
                    >
                      {c.active ? 'Tắt' : 'Bật'}
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </AdminTableWrapper>

      <CategoryDrawer
        open={drawerOpen}
        mode={drawerMode}
        categoryId={drawerId}
        onClose={closeDrawer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })}
      />
    </main>
  );
}
