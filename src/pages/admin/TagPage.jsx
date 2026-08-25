import React, { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import TagDrawer from '../../components/admin/tags/TagDrawer';
import { getApiErrorMessage, listTags, patchTagStatus } from '../../api/tagApi';
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

export default function TagPage() {
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
    queryKey: ['admin-tags', page, size, debouncedSearch],
    queryFn: () => listTags({ page, size, search: debouncedSearch }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const statusMut = useMutation({
    mutationFn: ({ id, active }) => patchTagStatus(id, active),
    onSuccess: async (_, { active }) => {
      notification.success(active ? 'Đã bật thẻ.' : 'Đã tắt thẻ.');
      await queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
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
        title="Thẻ (Tags)"
        description="Quản lý thẻ — chỉ bật/tắt, không xóa cứng."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, slug…"
        actions={
          <button type="button" className="admin-btn-primary" onClick={openCreate}>
            + Tạo thẻ
          </button>
        }
      />

      {/* Metric Cards - Only visible for ADMIN role */}
      {isAdmin && (
        <section className="cmp-stats-grid">
          <div className="cmp-stat-card">
            <div className="cmp-stat-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : total}</h3>
              <p>Tổng số thẻ</p>
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
        emptyTitle="Chưa có thẻ"
        emptyDescription={
          debouncedSearch ? 'Thử đổi từ khóa tìm kiếm.' : 'Tạo thẻ mới để bắt đầu.'
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
            {items.map((tag) => {
              const st = getEntityActiveUi(tag.active);
              return (
              <tr key={tag.id} className="admin-table-row--clickable" onClick={() => openEdit(tag)}>
                <td>{tag.name || '—'}</td>
                <td>
                  <code style={{ fontSize: 13 }}>{tag.slug || '—'}</code>
                </td>
                <td>
                  <span className={st.pillClass}>
                    <span aria-hidden>●</span> {st.label}
                  </span>
                </td>
                <td>{formatDate(tag.createdAt)}</td>
                <td>
                  <div className="admin-table-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="admin-btn-ghost" onClick={() => openEdit(tag)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost danger"
                      onClick={(e) => toggleActive(e, tag)}
                      disabled={statusMut.isPending}
                    >
                      {tag.active ? 'Tắt' : 'Bật'}
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </AdminTableWrapper>

      <TagDrawer
        open={drawerOpen}
        mode={drawerMode}
        tagId={drawerId}
        onClose={closeDrawer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-tags'] })}
      />
    </main>
  );
}
