import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/contributorProfile.css";
import axiosClient from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";
import { hasRole } from "../../utils/permissionUtils";
import { DocumentIcon } from "../../components/icons";

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

function formatViDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function PendingProfileBody({ statusInfo }) {
  return (
    <>
      <div className="avatar-section">
        <div className="avatar-card">
          <div className="avatar-wrapper">
            <div className="avatar-circle">
              <UserIcon />
            </div>
          </div>
        </div>
        <div className="submission-date">
          <span>Bạn đã gửi yêu cầu từ:</span>
          <strong>{formatViDate(statusInfo.createdAt)}</strong>
        </div>
      </div>

      <div className="profile-info-card">
        <div className="info-section">
          <h3 className="section-title">MÔ TẢ KINH NGHIỆM</h3>
          <p className="experience-text profile-placeholder-muted">
            Nội dung bạn đã gửi đang được bảo mật trong hồ sơ xét duyệt. Sau khi duyệt, bạn có thể cập nhật thêm trên hệ thống.
          </p>
        </div>

        <div className="info-section">
          <h3 className="section-title">LINK PORTFOLIO</h3>
          <p className="experience-text profile-placeholder-muted">Đã gửi kèm hồ sơ đăng ký.</p>
        </div>

        <div className="info-section">
          <h3 className="section-title">CHỨNG CHỈ ĐÃ TẢI LÊN</h3>
          <div className="certificate-card">
            <div className="certificate-info">
              <div className="certificate-icon"><DocumentIcon size={22} color="#4F46E5" /></div>
              <div>
                <div className="certificate-name">Tệp chứng chỉ đã nộp</div>
                <div className="certificate-size">Đính kèm theo yêu cầu Contributor</div>
              </div>
            </div>
            <span className="view-btn view-btn-disabled" aria-disabled>
              <EyeIcon /> Xem
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function EditableProfileFields({ draftExperience, setDraftExperience, draftPortfolio, setDraftPortfolio }) {
  return (
    <div className="profile-info-card profile-info-card-spaced">
      <div className="info-section">
        <h3 className="section-title">MÔ TẢ KINH NGHIỆM</h3>
        <textarea
          className="profile-textarea"
          rows={6}
          value={draftExperience}
          onChange={(e) => setDraftExperience(e.target.value)}
          placeholder="Cập nhật mô tả kinh nghiệm..."
        />
      </div>
      <div className="info-section">
        <h3 className="section-title">LINK PORTFOLIO / WEBSITE</h3>
        <input
          type="url"
          className="profile-input"
          value={draftPortfolio}
          onChange={(e) => setDraftPortfolio(e.target.value)}
          placeholder="https://"
        />
      </div>
      <div className="info-section">
        <h3 className="section-title">CHỨNG CHỈ</h3>
        <p className="experience-text profile-placeholder-muted">
          Tải lên chứng chỉ mới tại bước tiếp theo trên trang đăng ký (khi chức năng gửi lại được kích hoạt).
        </p>
      </div>
    </div>
  );
}

export default function ContributorProfile() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draftExperience, setDraftExperience] = useState("");
  const [draftPortfolio, setDraftPortfolio] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const response = await axiosClient.get("/contributor/registration-status");
      if (response.data?.success) {
        setStatusInfo(response.data.data ?? null);
      } else {
        setStatusInfo(null);
      }
    } catch {
      setStatusInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  if (initializing || loading) {
    return (
      <div className="contributor-profile-container">
        <div className="contributor-profile-content">
          <div className="profile-loading">Đang tải hồ sơ...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="contributor-profile-container">
        <div className="contributor-profile-content">
          <div className="profile-empty-card">
            <h1 className="profile-title">Đăng nhập để xem hồ sơ</h1>
            <p className="profile-subtitle">Vui lòng đăng nhập để tiếp tục.</p>
            <button type="button" className="profile-btn-primary" onClick={() => navigate("/login")}>
              Đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isContributor = hasRole(user, "CONTRIBUTOR");

  if (isContributor) {
    const joinedSource =
      statusInfo?.approvedAt ??
      statusInfo?.updatedAt ??
      statusInfo?.createdAt;
    return (
      <div className="contributor-profile-container">
        <div className="contributor-profile-content">
          <div className="profile-header">
            <div className="header-icon">👤</div>
            <div>
              <h1 className="profile-title">Hồ sơ Contributor cá nhân</h1>
              <p className="profile-subtitle">
                Bạn là người đóng góp thuộc cộng đồng StudyIT của chúng tôi
              </p>
              <p className="profile-subtitle profile-join-line">
                Bạn tham gia từ ngày: <strong>{formatViDate(joinedSource)}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!statusInfo) {
    return (
      <div className="contributor-profile-container">
        <div className="contributor-profile-content">
          <div className="profile-empty-card">
            <h1 className="profile-title">Bạn chưa có hồ sơ nào</h1>
            <p className="profile-subtitle">Tạo hồ sơ ngay để trở thành người đóng góp</p>
            <button type="button" className="profile-btn-primary" onClick={() => navigate("/contributor-request")}>
              Tạo hồ sơ ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = String(statusInfo.status ?? "").toUpperCase();
  const submissionCount = Number(statusInfo.submissionCount ?? 0);
  const canResubmit = submissionCount === 1;
  const exhaustedResubmit = submissionCount >= 2;

  switch (status) {
    case "PENDING":
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-header">
              <div className="header-icon">👤</div>
              <div>
                <h1 className="profile-title">Hồ sơ Contributor đang chờ kiểm duyệt</h1>
                <p className="profile-subtitle">
                  Yêu cầu của bạn đang được xét duyệt.
                  <br />
                  Chúng tôi sẽ gửi thông báo kết quả qua email đăng ký của bạn trong vòng 24-48h.
                </p>
              </div>
            </div>
            <div className="main-content">
              <PendingProfileBody statusInfo={statusInfo} />
            </div>
            <div className="profile-actions-footer">
              <button
                type="button"
                className="profile-btn-primary"
                onClick={() => navigate("/contributor-status")}
              >
                Theo dõi trạng thái duyệt
              </button>
            </div>
          </div>
        </div>
      );

    case "REJECTED":
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-header">
              <div className="header-icon">👤</div>
              <div>
                <h1 className="profile-title">Hồ sơ của bạn đã bị từ chối</h1>
                {canResubmit ? (
                  <p className="profile-subtitle">Bạn có quyền gửi lại 1 lần nữa</p>
                ) : (
                  <>
                    <p className="profile-subtitle">Bạn đã sử dụng hết số lần gửi yêu cầu</p>
                    <p className="profile-subtitle">Vui lòng liên hệ qua email: support@studyit.com</p>
                  </>
                )}
              </div>
            </div>
            <div className="profile-actions-inline">
              <button
                type="button"
                className="profile-btn-primary"
                onClick={() => navigate("/contributor-status")}
              >
                Theo dõi trạng thái duyệt
              </button>
            </div>
            {canResubmit && (
              <>
                <div className="profile-warning-banner">
                  Bạn chỉ còn 1 lần gửi yêu cầu xét duyệt lần nữa
                </div>
                <EditableProfileFields
                  draftExperience={draftExperience}
                  setDraftExperience={setDraftExperience}
                  draftPortfolio={draftPortfolio}
                  setDraftPortfolio={setDraftPortfolio}
                />
                <div className="profile-actions-footer">
                  <button type="button" className="profile-btn-primary" onClick={() => {}}>
                    Gửi lại yêu cầu
                  </button>
                </div>
              </>
            )}
            {exhaustedResubmit && (
              <div className="profile-warning-banner">
                Bạn đã dùng hết 2 lần gửi yêu cầu Contributor.
              </div>
            )}
          </div>
        </div>
      );

    case "NEED_INFO":
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-header">
              <div className="header-icon">👤</div>
              <div>
                <h1 className="profile-title">Hồ sơ cần bổ sung thông tin</h1>
                {statusInfo.rejectionReason ? (
                  <p className="profile-subtitle profile-reason-box">{statusInfo.rejectionReason}</p>
                ) : (
                  <p className="profile-subtitle">Vui lòng bổ sung theo hướng dẫn từ moderator.</p>
                )}
              </div>
            </div>
            <EditableProfileFields
              draftExperience={draftExperience}
              setDraftExperience={setDraftExperience}
              draftPortfolio={draftPortfolio}
              setDraftPortfolio={setDraftPortfolio}
            />
            <div className="profile-actions-footer">
              <button
                type="button"
                className="profile-btn-primary"
                onClick={() => navigate("/contributor-request")}
              >
                Bổ sung thông tin
              </button>
            </div>
          </div>
        </div>
      );

    case "APPROVED":
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-empty-card">
              <h1 className="profile-title">Hồ sơ đã được phê duyệt</h1>
              <p className="profile-subtitle">
                Vai trò Contributor có thể cần vài phút để đồng bộ trên tài khoản của bạn.
              </p>
              <button type="button" className="profile-btn-primary" onClick={() => navigate("/contributor-status")}>
                Theo dõi trạng thái duyệt
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-empty-card">
              <h1 className="profile-title">Trạng thái hồ sơ</h1>
              <p className="profile-subtitle">Không xác định trạng thái hiện tại.</p>
              <button type="button" className="profile-btn-primary" onClick={() => navigate("/contributor-status")}>
                Xem trạng thái
              </button>
            </div>
          </div>
        </div>
      );
  }
}
