import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import { listPermissions } from '../../api/permissionApi';
import { getApiErrorMessage } from '../../api/roleApi';
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

export default function PermissionsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-permissions', page, size],
    queryFn: () => listPermissions({ page, size }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const tableLoading = isLoading || isFetching;
  const empty = !tableLoading && items.length === 0;

  const moduleCount = useMemo(() => {
    const modules = new Set(
      items
        .map((p) => {
          const name = p.name || '';
          if (name.includes(':')) return name.split(':')[0];
          if (name.includes('_')) return name.split('_')[0];
          return name;
        })
        .filter(Boolean)
    );
    return Math.max(modules.size, 1);
  }, [items]);

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Quyền hệ thống"
        description="Danh sách quyền truy cập và kiểm soát các tính năng trong hệ thống."
        showSearch={false}
        actions={null}
      />

      {/* Metric Cards - Community Style */}
      <section className="cmp-stats-grid">
        <div className="cmp-stat-card">
          <div className="cmp-stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div className="cmp-stat-info">
            <h3>{isLoading ? '—' : total}</h3>
            <p>Tổng quyền hệ thống</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <div className="cmp-stat-info">
            <h3>{isLoading ? '—' : moduleCount}</h3>
            <p>Nhóm module chức năng</p>
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
            <h3 style={{ fontSize: '1.25rem' }}>Đã đồng bộ</h3>
            <p>Trạng thái định danh</p>
          </div>
        </div>
      </section>

      {isError ? (
        <p style={{ color: '#b42318', marginBottom: 16 }}>{getApiErrorMessage(error)}</p>
      ) : null}

      <AdminTableWrapper
        loading={tableLoading}
        empty={empty}
        emptyTitle="Chưa có quyền"
        emptyDescription="Không có dữ liệu từ API."
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
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <code style={{ fontSize: 13 }}>{p.name || '—'}</code>
                </td>
                <td style={{ color: '#667085' }}>{p.description || '—'}</td>
                <td>{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableWrapper>
    </main>
  );
}
