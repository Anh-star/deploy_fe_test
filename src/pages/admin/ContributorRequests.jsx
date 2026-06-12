import React, { useState, useEffect } from 'react';
import ContributorDetailModal from './components/ContributorDetailModal';
import '../../styles/admin/contributorRequests.css';
import axiosClient from '../../api/axiosClient';
import { ContributorRequestStatus, ContributorStatusLabel } from '../../constants/contributorStatus';

const ContributorRequests = () => {
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

            date: req.createdAt
              ? new Date(req.createdAt).toLocaleDateString('vi-VN')
              : 'N/A',

            status: status.toLowerCase(),
            statusKey: status,
            statusLabel: ContributorStatusLabel[status] || 'Chưa rõ',
            rejectionReason: req.rejectionReason || null,
            supplementCount: req.supplementCount || 0,
            requestedFields: req.requestedFields || [],

            // === Thêm 2 trường hỗ trợ sắp xếp ===
            createdAtDate: req.createdAt ? new Date(req.createdAt) : new Date(0),
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

  return (
    <>
      <div className="admin-content">
        <header className="content-header">
          <div className="header-title">
            <h1>Yêu cầu Contributor</h1>
            <p>Quản lý và phê duyệt hồ sơ người dùng muốn đóng góp nội dung mới cho nền tảng.</p>
          </div>
          <div className="header-actions">
            <button className="btn-filter" onClick={fetchRequests}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw-icon lucide-refresh-ccw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              Làm mới
            </button>
            <button className="btn-export">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload-icon lucide-upload"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
              Xuất báo cáo
            </button>
          </div>
        </header>

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
                  {requests.length > 0 ? (
                    requests.map((req) => (
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
                <span className="results-count">Hiển thị {requests.length} yêu cầu từ database</span>
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
      </div>

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