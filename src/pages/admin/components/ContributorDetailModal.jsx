import React, { useState, useEffect } from 'react';
import '../../../styles/admin/contributorDetailModal.css';
import { ContributorRequestStatus } from '../../../constants/contributorStatus';
import axiosClient from '../../../api/axiosClient';
import {
  assignUserRoles,
  findAssignableRoleIdByName,
  getApiErrorMessage,
  getUser,
  listAssignableRoles,
  removeUserRole,
} from '../../../api/userApi';
import { useAuth } from '../../../context/AuthContext';

/** Số lần tối đa admin được yêu cầu bổ sung. */
const MAX_SUPPLEMENT_COUNT = 3;

/** Các trường có thể yêu cầu bổ sung. */
const SUPPLEMENT_FIELDS = [
  { key: 'fullName', label: 'HỌ TÊN' },
  { key: 'email', label: 'EMAIL' },
  { key: 'portfolioLink', label: 'LINK PORTFOLIO / WEBSITE' },
  { key: 'experience', label: 'MÔ TẢ KINH NGHIỆM' },
  { key: 'certificates', label: 'CHỨNG CHỈ ĐÍNH KÈM' },
];

const ContributorDetailModal = ({
  isOpen,
  onClose,
  contributor,
  onUpdateStatus,
}) => {
  const { user: currentUser, refreshUserProfile } = useAuth();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSupplementConfirm, setShowSupplementConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveBusy, setApproveBusy] = useState(false);
  const [supplementBusy, setSupplementBusy] = useState(false);

  // === Request Mode State ===
  const [isRequestMode, setIsRequestMode] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    fullName: false,
    email: false,
    portfolioLink: false,
    experience: false,
    certificates: false,
  });
  const [fieldReasons, setFieldReasons] = useState({
    fullName: '',
    email: '',
    portfolioLink: '',
    experience: '',
    certificates: '',
  });

  useEffect(() => {
    if (isOpen && contributor) {
      setRejectReason(contributor.rejectionReason || '');
      // Reset request mode khi mở modal
      setIsRequestMode(false);
      setSelectedFields({
        fullName: false,
        email: false,
        portfolioLink: false,
        experience: false,
        certificates: false,
      });
      setFieldReasons({
        fullName: '',
        email: '',
        portfolioLink: '',
        experience: '',
        certificates: '',
      });
    }
  }, [isOpen, contributor]);

  if (!isOpen || !contributor) return null;

  const supplementCount = contributor.supplementCount || 0;
  const canRequestSupplement = supplementCount < MAX_SUPPLEMENT_COUNT;
  const hasSelectedFields = Object.values(selectedFields).some(Boolean);

  const toggleField = (fieldKey) => {
    setSelectedFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  /**
   * Highlight ô thông tin khi trạng thái NEED_INFO và field nằm trong requestedFields.
   */
  const getFieldClass = (fieldName) => {
    if (contributor.statusKey !== ContributorRequestStatus.NEED_INFO) return '';
    const requestedFields = contributor.requestedFields || {};
    return (fieldName in requestedFields) ? 'requested-field-box' : '';
  };

  const sendUpdateRequest = async (status, reason = null, requestedFieldsList = null) => {
    try {
      const payload = {
        requestId: contributor.id,
        status: status,
        rejectionReason: reason,
        requestedFields: requestedFieldsList,
      };
      await axiosClient.post(`/admin/contributor-requests/${contributor.id}/status`, payload);
      onUpdateStatus();
      handleClose();
    } catch (error) {
      console.error(`❌ Lỗi cập nhật trạng thái yêu cầu Contributor thành ${status}:`, error);
      alert(`Có lỗi xảy ra khi cập nhật trạng thái. Vui lòng thử lại. Lỗi: ${getApiErrorMessage(error)}`);
    }
  };

  const approveContributor = async () => {
    const userId = contributor.userId != null ? String(contributor.userId) : '';
    if (!userId) {
      alert('Thiếu userId trên yêu cầu. Vui lòng làm mới trang hoặc kiểm tra API.');
      return;
    }

    setApproveBusy(true);
    try {
      const roleOptions = await listAssignableRoles();
      const userRoleId = findAssignableRoleIdByName(roleOptions, 'USER');
      const contributorRoleId = findAssignableRoleIdByName(roleOptions, 'CONTRIBUTOR');
      if (!userRoleId || !contributorRoleId) {
        throw new Error('Không tìm thấy role USER hoặc CONTRIBUTOR trong hệ thống.');
      }

      const detail = await getUser(userId);
      const hasUser =
        (Array.isArray(detail?.roleIds) && detail.roleIds.map(String).includes(String(userRoleId))) ||
        (Array.isArray(detail?.roles) &&
          detail.roles.some((r) => String(r).toUpperCase() === 'USER'));
      if (hasUser) {
        await removeUserRole(userId, userRoleId);
      }

      await assignUserRoles(userId, contributorRoleId);

      const payload = {
        requestId: contributor.id,
        status: ContributorRequestStatus.APPROVED,
        rejectionReason: null,
        requestedFields: null,
      };
      await axiosClient.post(`/admin/contributor-requests/${contributor.id}/status`, payload);
      if (currentUser?.id && String(currentUser.id) === userId) {
        await refreshUserProfile();
      }
      onUpdateStatus();
      handleClose();
    } catch (error) {
      console.error('❌ Lỗi phê duyệt contributor:', error);
      alert(`Phê duyệt thất bại: ${getApiErrorMessage(error)}`);
    } finally {
      setApproveBusy(false);
      setShowApproveModal(false);
    }
  };

  const handleOpenReject = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    const reason = rejectReason.trim();
    if (!reason) {
      return;
    }
    sendUpdateRequest(ContributorRequestStatus.REJECTED, reason, null);
    setShowRejectModal(false);
  };

  const handleOpenApprove = () => {
    setShowApproveModal(true);
  };

  const confirmApprove = () => {
    approveContributor();
  };

  // === Request Mode handlers ===
  const enterRequestMode = () => {
    setIsRequestMode(true);
  };

  const exitRequestMode = () => {
    setIsRequestMode(false);
    setSelectedFields({
      fullName: false,
      email: false,
      portfolioLink: false,
      experience: false,
      certificates: false,
    });
    setFieldReasons({
      fullName: '',
      email: '',
      portfolioLink: '',
      experience: '',
      certificates: '',
    });
  };

  const handleSendSupplementRequest = () => {
    if (!hasSelectedFields) return;
    setShowSupplementConfirm(true);
  };

  const confirmSendSupplement = async () => {
    const requestedFieldsMap = {};
    Object.entries(selectedFields).forEach(([key, selected]) => {
      if (selected) {
        requestedFieldsMap[key] = fieldReasons[key]?.trim() || 'Cần bổ sung/chỉnh sửa thông tin này';
      }
    });

    setSupplementBusy(true);
    try {
      await sendUpdateRequest(
        ContributorRequestStatus.NEED_INFO,
        `Yêu cầu bổ sung thông tin: ${Object.keys(requestedFieldsMap).map(k => SUPPLEMENT_FIELDS.find(f => f.key === k)?.label || k).join(', ')}`,
        requestedFieldsMap
      );
    } finally {
      setSupplementBusy(false);
      setShowSupplementConfirm(false);
    }
  };

  const handleClose = () => {
    setShowRejectModal(false);
    setShowApproveModal(false);
    setShowSupplementConfirm(false);
    setRejectReason('');
    setIsRequestMode(false);
    onClose();
  };

  const isActionable = contributor.statusKey === ContributorRequestStatus.PENDING;

  const showReasonInBanner =
    contributor.rejectionReason &&
    (contributor.statusKey === ContributorRequestStatus.REJECTED ||
      contributor.statusKey === ContributorRequestStatus.NEED_INFO);

  /** Render checkbox cho một field */
  const renderFieldCheckbox = (fieldKey) => {
    if (!isRequestMode) return null;
    return (
      <label className="supplement-checkbox-label" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="supplement-checkbox"
          checked={selectedFields[fieldKey] || false}
          onChange={() => toggleField(fieldKey)}
        />
        <span className="supplement-checkmark"></span>
      </label>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <header className="modal-header">
          <div className="modal-title-group">
            <h4 className={isRequestMode ? 'request-mode' : ''}>
              {isRequestMode ? 'YÊU CẦU BỔ SUNG THÔNG TIN' : 'CHI TIẾT YÊU CẦU CONTRIBUTOR'}
            </h4>
            <h2>{contributor.name}</h2>
            {/* Supplement count badge */}
            {isActionable && supplementCount > 0 && (
              <span className="supplement-count-badge">
                Đã yêu cầu bổ sung {supplementCount}/{MAX_SUPPLEMENT_COUNT} lần
              </span>
            )}
          </div>
          <button type="button" className="modal-close-btn" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className="modal-body">
          {/* Instruction banner in request mode */}
          {isRequestMode && (
            <div className="request-mode-banner">
              <div className="request-mode-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <p>Chọn các mục cần người dùng bổ sung hoặc chỉnh sửa bằng cách đánh dấu checkbox bên cạnh và điền lý do chi tiết bên dưới mục đó.</p>
            </div>
          )}

          <section className="profile-section">
            <div className="profile-img-container">
              <img src={contributor.avatar} alt={contributor.name} className="profile-img" />
            </div>
            <div className="info-grid">
              <div className={`info-item ${getFieldClass('fullName')} ${isRequestMode && selectedFields.fullName ? 'supplement-selected' : ''}`}>
                <div className="label-with-dot">
                  {renderFieldCheckbox('fullName')}
                  <label>HỌ TÊN:</label>
                </div>
                <p>{contributor.name}</p>
              </div>
              {isRequestMode && selectedFields.fullName && (
                <div className="supplement-reason-container" style={{ gridColumn: '1 / -1' }}>
                  <textarea
                    className="supplement-reason-textarea"
                    placeholder="Nhập lý do yêu cầu bổ sung họ tên..."
                    value={fieldReasons.fullName}
                    onChange={(e) => setFieldReasons(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
              )}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && 
               contributor.requestedFields.fullName && (
                <div className="field-reason-inline" style={{ gridColumn: '1 / -1' }}>
                  <strong>Lý do bổ sung:</strong> {contributor.requestedFields.fullName}
                </div>
              )}

              <div className={`info-item ${getFieldClass('email')} ${isRequestMode && selectedFields.email ? 'supplement-selected' : ''}`}>
                <div className="label-with-dot">
                  {renderFieldCheckbox('email')}
                  <label>EMAIL:</label>
                </div>
                <p>{contributor.email}</p>
              </div>
              {isRequestMode && selectedFields.email && (
                <div className="supplement-reason-container" style={{ gridColumn: '1 / -1' }}>
                  <textarea
                    className="supplement-reason-textarea"
                    placeholder="Nhập lý do yêu cầu bổ sung email..."
                    value={fieldReasons.email}
                    onChange={(e) => setFieldReasons(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              )}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && 
               contributor.requestedFields.email && (
                <div className="field-reason-inline" style={{ gridColumn: '1 / -1' }}>
                  <strong>Lý do bổ sung:</strong> {contributor.requestedFields.email}
                </div>
              )}

              <div className={`info-item full-width ${getFieldClass('portfolioLink')} ${isRequestMode && selectedFields.portfolioLink ? 'supplement-selected' : ''}`}>
                <div className="label-with-dot">
                  {renderFieldCheckbox('portfolioLink')}
                  <label>LINK PORTFOLIO / WEBSITE:</label>
                </div>
                <p className="bio-text">
                  {contributor.portfolioLink ? (
                    <a
                      href={contributor.portfolioLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#007BFF', textDecoration: 'underline' }}
                    >
                      {contributor.portfolioLink}
                    </a>
                  ) : (
                    'Không cung cấp link portfolio.'
                  )}
                </p>
              </div>
              {isRequestMode && selectedFields.portfolioLink && (
                <div className="supplement-reason-container" style={{ gridColumn: '1 / -1' }}>
                  <textarea
                    className="supplement-reason-textarea"
                    placeholder="Nhập lý do yêu cầu bổ sung link portfolio..."
                    value={fieldReasons.portfolioLink}
                    onChange={(e) => setFieldReasons(prev => ({ ...prev, portfolioLink: e.target.value }))}
                  />
                </div>
              )}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && 
               contributor.requestedFields.portfolioLink && (
                <div className="field-reason-inline" style={{ gridColumn: '1 / -1' }}>
                  <strong>Lý do bổ sung:</strong> {contributor.requestedFields.portfolioLink}
                </div>
              )}
            </div>
          </section>

          <div className="content-split">
            <div className={`experience-col ${isRequestMode && selectedFields.experience ? 'supplement-selected' : ''} ${getFieldClass('experience')}`}>
              <label className="section-label">
                {renderFieldCheckbox('experience')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                MÔ TẢ KINH NGHIỆM
              </label>
              <div className="experience-text">
                {contributor.experience || 'Không có thông tin kinh nghiệm.'}
              </div>
              {isRequestMode && selectedFields.experience && (
                <div className="supplement-reason-container">
                  <textarea
                    className="supplement-reason-textarea"
                    placeholder="Nhập lý do yêu cầu bổ sung mô tả kinh nghiệm..."
                    value={fieldReasons.experience}
                    onChange={(e) => setFieldReasons(prev => ({ ...prev, experience: e.target.value }))}
                  />
                </div>
              )}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && 
               contributor.requestedFields.experience && (
                <div className="field-reason-inline">
                  <strong>Lý do bổ sung:</strong> {contributor.requestedFields.experience}
                </div>
              )}
            </div>
            <div className={`attachments-col ${isRequestMode && selectedFields.certificates ? 'supplement-selected' : ''} ${getFieldClass('certificates')}`}>
              <label className="section-label">
                {renderFieldCheckbox('certificates')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
                HỒ SƠ ĐÍNH KÈM
              </label>
              <div className="attachments-list">
                {contributor.certificates && contributor.certificates.length > 0 ? (
                  contributor.certificates.map((cert, index) => (
                    <a key={index} href={cert.url} target="_blank" rel="noopener noreferrer" className="attachment-card">
                      <div className="attachment-icon pdf">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                      <div className="attachment-info">
                        <span className="attachment-name">{cert.certificateName}</span>
                      </div>
                    </a>
                  ))
                ) : contributor.certificateUrl ? (
                  <a href={contributor.certificateUrl} target="_blank" rel="noopener noreferrer" className="attachment-card">
                    <div className="attachment-icon pdf">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div className="attachment-info">
                      <span className="attachment-name">{contributor.certificateName || 'Chung_chi.pdf'}</span>
                    </div>
                  </a>
                ) : (
                  <p className="no-attachments">Không có tệp đính kèm.</p>
                )}
              </div>
              {isRequestMode && selectedFields.certificates && (
                <div className="supplement-reason-container" style={{ marginTop: '16px' }}>
                  <textarea
                    className="supplement-reason-textarea"
                    placeholder="Nhập lý do yêu cầu bổ sung chứng chỉ đính kèm..."
                    value={fieldReasons.certificates}
                    onChange={(e) => setFieldReasons(prev => ({ ...prev, certificates: e.target.value }))}
                  />
                </div>
              )}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && 
               contributor.requestedFields.certificates && (
                <div className="field-reason-inline" style={{ marginTop: '12px' }}>
                  <strong>Lý do bổ sung:</strong> {contributor.requestedFields.certificates}
                </div>
              )}
            </div>
          </div>

          <div className={`status-banner ${contributor.statusKey?.toLowerCase()}`}>
            <div className="status-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <path d="M9 16l2 2 4-4"></path>
              </svg>
            </div>
            <div className="status-details">
              <label>TRẠNG THÁI HIỆN TẠI</label>
              <p>
                {contributor.statusLabel || 'N/A'} (Gửi ngày {contributor.date || 'N/A'})
              </p>
              {showReasonInBanner && (
                <div className="reject-reason-display">
                  <strong>Lý do chung:</strong> {contributor.rejectionReason}
                </div>
              )}
              {/* Hiển thị các trường đã yêu cầu bổ sung */}
              {contributor.statusKey === ContributorRequestStatus.NEED_INFO && 
               contributor.requestedFields && Object.keys(contributor.requestedFields).length > 0 && (
                <div className="requested-fields-display">
                  <strong>Các mục cần bổ sung & Lý do:</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', listStyleType: 'disc' }}>
                    {Object.entries(contributor.requestedFields).map(([key, reason]) => (
                      <li key={key} style={{ marginTop: '4px', fontSize: '13px' }}>
                        <strong>{SUPPLEMENT_FIELDS.find(f => f.key === key)?.label || key}:</strong> {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          {isRequestMode ? (
            /* === REQUEST MODE FOOTER === */
            <>
              <div className="footer-left">
                <button type="button" className="btn-modal btn-secondary" onClick={exitRequestMode}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  Quay lại
                </button>
              </div>
              <div className="footer-right">
                <span className="selected-count-label">
                  {Object.values(selectedFields).filter(Boolean).length} mục được chọn
                </span>
                <button
                  type="button"
                  className={`btn-modal btn-send-request ${!hasSelectedFields ? 'disabled' : ''}`}
                  onClick={handleSendSupplementRequest}
                  disabled={!hasSelectedFields}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Gửi yêu cầu bổ sung
                </button>
              </div>
            </>
          ) : isActionable ? (
            /* === NORMAL ACTION FOOTER === */
            <>
              <div className="footer-left">
                <button type="button" className="btn-modal btn-outline-danger" onClick={handleOpenReject}>
                  Từ chối
                </button>
                <button
                  type="button"
                  className={`btn-modal btn-supplement ${!canRequestSupplement ? 'disabled' : ''}`}
                  onClick={canRequestSupplement ? enterRequestMode : undefined}
                  disabled={!canRequestSupplement}
                  title={!canRequestSupplement ? `Đã đạt giới hạn ${MAX_SUPPLEMENT_COUNT} lần yêu cầu bổ sung` : 'Yêu cầu người dùng bổ sung thông tin'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Yêu cầu bổ sung
                  {supplementCount > 0 && (
                    <span className="supplement-badge">{supplementCount}/{MAX_SUPPLEMENT_COUNT}</span>
                  )}
                </button>
              </div>
              <button type="button" className="btn-modal btn-primary-action" onClick={handleOpenApprove}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
                Duyệt
              </button>
            </>
          ) : (
            <button type="button" className="btn-modal btn-secondary" onClick={handleClose}>
              Đóng
            </button>
          )}
        </footer>

        {showApproveModal && (
          <div className="mini-modal-overlay">
            <div className="mini-modal">
              <h3>Xác nhận phê duyệt</h3>
              <p>Bạn có chắc chắn muốn phê duyệt người dùng này thành Contributor không?</p>
              <div className="mini-modal-actions">
                <button type="button" className="btn-mini btn-cancel" onClick={() => setShowApproveModal(false)}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-mini btn-confirm"
                  onClick={confirmApprove}
                  disabled={approveBusy}
                >
                  {approveBusy ? 'Đang xử lý...' : 'Duyệt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div className="mini-modal-overlay">
            <div className="mini-modal">
              <h3>Lý do từ chối</h3>
              <p>Vui lòng nhập lý do từ chối hồ sơ này (bắt buộc).</p>
              <textarea
                className="reject-textarea"
                placeholder="Nhập lý do từ chối..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
              <div className="mini-modal-actions">
                <button type="button" className="btn-mini btn-cancel" onClick={() => setShowRejectModal(false)}>
                  Hủy
                </button>
                <button
                  type="button"
                  className={`btn-mini btn-reject ${!rejectReason.trim() ? 'disabled' : ''}`}
                  onClick={confirmReject}
                  disabled={!rejectReason.trim()}
                >
                  Từ chối
                </button>
              </div>
            </div>
          </div>
        )}

        {showSupplementConfirm && (
          <div className="mini-modal-overlay">
            <div className="mini-modal">
              <div className="supplement-confirm-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F79009" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3>Xác nhận yêu cầu bổ sung</h3>
              <p>
                Bạn sẽ yêu cầu người dùng bổ sung{' '}
                <strong>{Object.values(selectedFields).filter(Boolean).length} mục</strong> thông tin.
                {supplementCount >= MAX_SUPPLEMENT_COUNT - 1 && (
                  <span className="supplement-warning"> Đây là lần yêu cầu bổ sung cuối cùng!</span>
                )}
              </p>
              <div className="supplement-fields-preview">
                {Object.entries(selectedFields)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} className="field-tag">
                      {SUPPLEMENT_FIELDS.find(f => f.key === k)?.label || k}
                    </span>
                  ))}
              </div>
              <div className="mini-modal-actions">
                <button type="button" className="btn-mini btn-cancel" onClick={() => setShowSupplementConfirm(false)}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-mini btn-confirm-supplement"
                  onClick={confirmSendSupplement}
                  disabled={supplementBusy}
                >
                  {supplementBusy ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContributorDetailModal;
