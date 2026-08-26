import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import ContributorDetailModal from './components/ContributorDetailModal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import '../../styles/admin/contributorRequests.css';
import '../../styles/admin/adminComponents.css';
import axiosClient from '../../api/axiosClient';
import { ContributorRequestStatus, ContributorStatusLabel } from '../../constants/contributorStatus';
import { parseApiDate } from '../../utils/dateUtils';

const ContributorRequests = () => {
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRequests = async () => {
  try {
    setIsLoading(true);

    const response = await axiosClient.get('/admin/contributor-requests');

    if (response.data && Array.isArray(response.data.data)) {
      const mappedData = response.data.data
        .map(req => {
          const status = (req.status || ContributorRequestStatus.PENDING).toUpperCase();
          const statusLabel =
            status === ContributorRequestStatus.NEED_INFO
              ? 'Chờ xử lý'
              : ContributorStatusLabel[status] || 'Chưa rõ';

          return {
            ...req,
            avatar:
              req.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                req.name || 'User'
              )}&background=random`,

            date: req.createdAt && parseApiDate(req.createdAt)
              ? parseApiDate(req.createdAt).toLocaleDateString('vi-VN')
              : 'N/A',

            status: status.toLowerCase(),
            statusKey: status,
            statusLabel: ContributorStatusLabel[status] || 'Chưa rõ',
            rejectionReason: req.rejectionReason || null,
            supplementCount: req.supplementCount || 0,
            requestedFields: req.requestedFields || [],

            // === Thêm 2 trường hỗ trợ sắp xếp ===
            createdAtDate: req.createdAt && parseApiDate(req.createdAt) ? parseApiDate(req.createdAt) : new Date(0),

            // Giả sử backend có trường updatedAt (thời điểm duyệt/từ chối). Nếu chưa có thì dùng createdAt tạm
            updatedAtDate: req.updatedAt ? new Date(req.updatedAt) : new Date(req.createdAt || 0),
          };
        })
        // ==================== SẮP XẾP THEO YÊU CẦU ====================
        .sort((a, b) => {
          const isPendingA = a.statusKey === ContributorRequestStatus.PENDING || 
                            a.statusKey === ContributorRequestStatus.NEED_INFO;
          const isPendingB = b.statusKey === ContributorRequestStatus.PENDING || 
                            b.statusKey === ContributorRequestStatus.NEED_INFO;

          // 1. Nhóm "Chưa thao tác" luôn ở trên nhóm "Đã thao tác"
          if (isPendingA && !isPendingB) return -1;
          if (!isPendingA && isPendingB) return 1;

          // 2. Trong cùng nhóm
          if (isPendingA && isPendingB) {
            // Yêu cầu chưa thao tác: Mới nhất (createdAt lớn hơn) lên trên
            return b.createdAtDate - a.createdAtDate;
          } else {
            // Yêu cầu đã thao tác: Được xử lý muộn nhất (updatedAt lớn hơn) lên trên
            return b.updatedAtDate - a.updatedAtDate;
          }
        });

      setRequests(mappedData);
    } else {
      console.warn("Response không đúng format:", response.data);
      setRequests([]);
    }
  } catch (error) {
    console.error("❌ Lỗi gọi API:", error);
    setRequests([]);
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter && req.statusKey !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (req.name || '').toLowerCase().includes(q) ||
          (req.email || '').toLowerCase().includes(q) ||
          (req.phone || '').toLowerCase().includes(q) ||
          (req.occupation || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (startDate) {
        const itemDate = req.createdAtDate;
        if (itemDate && itemDate < new Date(`${startDate}T00:00:00`)) return false;
      }
      if (endDate) {
        const itemDate = req.createdAtDate;
        if (itemDate && itemDate > new Date(`${endDate}T23:59:59.999`)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search, startDate, endDate]);

  // This function is now only used to trigger a re-fetch, as the actual update is in the modal
  const handleUpdateStatus = () => {
    fetchRequests(); 
  };

  const handleViewDetails = (contributor) => {
    setSelectedContributor(contributor);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContributor(null);
    fetchRequests(); // Re-fetch requests when the modal closes
  };

  const getStatusClass = (statusKey) => {
    switch (statusKey) {
      case ContributorRequestStatus.PENDING: return 'dot-pending';
      case ContributorRequestStatus.APPROVED: return 'dot-approved';
      case ContributorRequestStatus.REJECTED: return 'dot-rejected';
      case ContributorRequestStatus.NEED_INFO: return 'dot-pending';
      default: return 'dot-pending';
    }
  };

  const getStatusTextClass = (statusKey) => {
    switch (statusKey) {
      case ContributorRequestStatus.PENDING: return 'status-text-pending';
      case ContributorRequestStatus.APPROVED: return 'status-text-approved';
      case ContributorRequestStatus.REJECTED: return 'status-text-rejected';
      case ContributorRequestStatus.NEED_INFO: return 'status-text-pending';
      default: return 'status-text-pending';
    }
  };

  const pendingCount = requests.filter(
    (r) =>
      r.statusKey === ContributorRequestStatus.PENDING ||
      r.statusKey === ContributorRequestStatus.NEED_INFO
  ).length;
  const approvedCount = requests.filter(
    (r) => r.statusKey === ContributorRequestStatus.APPROVED
  ).length;
  const rejectedCount = requests.filter(
    (r) => r.statusKey === ContributorRequestStatus.REJECTED
  ).length;

  const { user } = useAuth();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.map((r) => String(r).toUpperCase()).includes('ADMIN');
  }, [user?.roles]);

  return (
    <>
      <main className="admin-main">
        <AdminPageHeader
          title="Yêu cầu Contributor"
          description="Quản lý và phê duyệt hồ sơ người dùng muốn đóng góp nội dung mới cho nền tảng."
          showSearch={true}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm theo tên, email, SĐT..."
        />

        {/* Metric Cards - Only visible for ADMIN role */}
        {isAdmin && (
          <section className="cmp-stats-grid">
            <div className="cmp-stat-card">
              <div className="cmp-stat-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="cmp-stat-info">
                <h3>{isLoading ? '—' : requests.length}</h3>
                <p>Tổng số yêu cầu</p>
              </div>
            </div>

            <div className="cmp-stat-card">
              <div className="cmp-stat-icon pending">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="cmp-stat-info">
                <h3>{isLoading ? '—' : pendingCount}</h3>
                <p>Hồ sơ chờ xử lý</p>
              </div>
            </div>

            <div className="cmp-stat-card">
              <div className="cmp-stat-icon resolved">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="cmp-stat-info">
                <h3>{isLoading ? '—' : approvedCount}</h3>
                <p>Đã phê duyệt</p>
              </div>
            </div>

            <div className="cmp-stat-card">
              <div className="cmp-stat-icon rejected">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="cmp-stat-info">
                <h3>{isLoading ? '—' : rejectedCount}</h3>
                <p>Đã từ chối</p>
              </div>
            </div>
          </section>
        )}

        <div className="admin-toolbar-row">
          <div className="admin-tabs-wrapper">
            {[
              { key: '', label: 'Tất cả' },
              { key: ContributorRequestStatus.PENDING, label: 'Chờ xử lý' },
              { key: ContributorRequestStatus.APPROVED, label: 'Đã duyệt' },
              { key: ContributorRequestStatus.REJECTED, label: 'Đã từ chối' },
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

        <div className="table-card">
          {isLoading ? (
            <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '10px', color: '#64748b' }}>Đang tải danh sách yêu cầu...</p>
            </div>
          ) : (
            <>
              <table className="contributor-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Ngày gửi</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div className="user-cell">
                            <img src={req.avatar} alt={req.name} className="user-avatar-img" />
                            <div className="user-details">
                              <span className="user-name">{req.name}</span>
                              <span className="user-email">{req.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{req.date}</td>
                        <td>
                          <div className="status-cell">
                            <span className={`status-dot ${getStatusClass(req.statusKey)}`}></span>
                            <span className={getStatusTextClass(req.statusKey)}>{req.statusLabel}</span>
                          </div>
                        </td>
                        <td>
                          <button 
                            onClick={() => handleViewDetails(req)} 
                            className="view-profile-btn"
                          >
                            Xem hồ sơ
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        Không có yêu cầu Contributor nào đang chờ xử lý.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              <div className="pagination-area">
                <span className="results-count">Hiển thị {filteredRequests.length} yêu cầu</span>
                <div className="pagination-controls">
                  <button className="page-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <button className="page-btn active">1</button>
                  <button className="page-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ContributorDetailModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        contributor={selectedContributor}
        onUpdateStatus={handleUpdateStatus}
      />
    </>
  );
};

export default ContributorRequests;