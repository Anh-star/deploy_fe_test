import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/contributorProfile.css";
import axiosClient from "../../api/axiosClient";
import { getApiErrorMessage, getContributorProfile } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { hasRole } from "../../utils/permissionUtils";
import { DocumentIcon, GlobeIcon, MailIcon, PhoneIcon, StarIcon, BriefcaseIcon, AwardIcon } from "../../components/icons";
import { parseApiDate } from "../../utils/dateUtils";

const CheckCircleIcon = ({ size = 18, color = "#22c55e" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 12 15 16 10" />
  </svg>
);

const ExternalLinkIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function formatViDate(value) {
  if (!value) return "—";
  const d = parseApiDate(value);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="profile-info-row">
      <div className="profile-info-row-icon">
        <Icon size={16} />
      </div>
      <div className="profile-info-row-content">
        <span className="profile-info-row-label">{label}</span>
        <span className="profile-info-row-value">{value}</span>
      </div>
    </div>
  );
}

function ContributorProfileView({ profile }) {
  // "Ngày tham gia" = contributorApprovedAt — thời điểm user thực sự trở thành Contributor.
  // KHÔNG fallback sang submittedAt (ngày gửi đơn) hay userCreatedAt (ngày đăng ký tài khoản).
  // Nếu user chưa được phê duyệt → "—".
  const joinedAt = profile.contributorApprovedAt ?? null;

  return (
    <div className="contributor-full-layout">
      {/* Header card */}
      <div className="contributor-header-card">
        <div className="contributor-avatar-section">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="contributor-avatar-img" />
          ) : (
            <div className="contributor-avatar-placeholder">
              {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : "?"}
            </div>
          )}
        </div>
        <div className="contributor-header-info">
          <div className="contributor-name-row">
            <h1 className="contributor-name">
              {profile.fullName || "Người dùng StudyIT"}
            </h1>
            <span className="contributor-badge-label">
              <CheckCircleIcon size={15} />
              Contributor
            </span>
          </div>
          <p className="contributor-join-date">
            Bạn tham gia từ ngày: <strong>{formatViDate(joinedAt)}</strong>
          </p>
          {profile.requestStatus && (
            <p className="contributor-status-line">
              Trạng thái đơn: <span className="contributor-status-value">{profile.requestStatus}</span>
            </p>
          )}
        </div>
      </div>

      {/* Info sections grid */}
      <div className="contributor-sections-grid">
        {/* Personal Info */}
        <div className="contributor-section-card">
          <h3 className="contributor-section-title">
            <StarIcon size={16} color="#64748b" />
            Thông tin cá nhân
          </h3>
          <div className="contributor-section-body">
            <InfoRow icon={MailIcon} label="Email" value={profile.email} />
            <InfoRow icon={PhoneIcon} label="Số điện thoại" value={profile.phone} />
            {profile.bio && (
              <div className="profile-bio-block">
                <span className="profile-bio-label">Giới thiệu</span>
                <p className="profile-bio-text">{profile.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Skills / Experience */}
        <div className="contributor-section-card">
          <h3 className="contributor-section-title">
            <BriefcaseIcon size={16} color="#64748b" />
            Kinh nghiệm &amp; Kỹ năng
          </h3>
          <div className="contributor-section-body">
            {profile.experience ? (
              <p className="profile-experience-text">{profile.experience}</p>
            ) : (
              <p className="profile-empty-hint">Chưa cập nhật kinh nghiệm.</p>
            )}
            {profile.portfolioLink && (
              <a
                href={profile.portfolioLink}
                target="_blank"
                rel="noopener noreferrer"
                className="contributor-portfolio-link"
              >
                <GlobeIcon size={15} />
                {profile.portfolioLink}
                <ExternalLinkIcon size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Contributor Timeline */}
        <div className="contributor-section-card contributor-section-card--timeline">
          <h3 className="contributor-section-title">
            <AwardIcon size={16} color="#64748b" />
            Thông tin Contributor
          </h3>
          <div className="contributor-section-body">
            <div className="contributor-timeline-list">
              <div className="contributor-timeline-item">
                <span className="timeline-label">Ngày tạo tài khoản</span>
                <span className="timeline-value">{formatViDate(profile.userCreatedAt)}</span>
              </div>
              {profile.contributorApprovedAt && (
                <div className="contributor-timeline-item">
                  <span className="timeline-label">Ngày được phê duyệt</span>
                  <span className="timeline-value">{formatViDate(profile.contributorApprovedAt)}</span>
                </div>
              )}
              {profile.latestRequestSubmittedAt && (
                <div className="contributor-timeline-item">
                  <span className="timeline-label">Ngày gửi đơn gần nhất</span>
                  <span className="timeline-value">{formatViDate(profile.latestRequestSubmittedAt)}</span>
                </div>
              )}
              {profile.requestStatus && (
                <div className="contributor-timeline-item">
                  <span className="timeline-label">Trạng thái</span>
                  <span className="timeline-value timeline-value--badge">{profile.requestStatus}</span>
                </div>
              )}
            </div>

            {/* Certificates */}
            {profile.certificates && profile.certificates.length > 0 && (
              <div className="contributor-certificates">
                <span className="contributor-certificates-label">Chứng chỉ đã nộp</span>
                {profile.certificates.map((cert, idx) => (
                  <div key={idx} className="contributor-cert-item">
                    <DocumentIcon size={16} color="#4f46e5" />
                    <span className="cert-name">{cert.certificateName || "Chứng chỉ"}</span>
                    {cert.url && (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cert-view-link"
                        title="Xem chứng chỉ"
                      >
                        Xem chứng chỉ
                        <ExternalLinkIcon size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingProfileBody({ statusInfo }) {
  return (
    <>
      <div className="avatar-section">
        <div className="avatar-card">
          <div className="avatar-wrapper">
            <div className="avatar-circle">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Xem
            </span>
          </div>
        </div>
      </div>
    </>
  );
}



export default function ContributorProfile() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [statusInfo, setStatusInfo] = useState(null);
  const [contributorProfile, setContributorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

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

  // When user is a contributor, fetch the full profile
  useEffect(() => {
    if (!user || !hasRole(user, "CONTRIBUTOR")) return;
    let cancelled = false;
    setLoadingProfile(true);
    setProfileError("");
    (async () => {
      try {
        const data = await getContributorProfile();
        if (!cancelled) setContributorProfile(data ?? null);
      } catch (e) {
        if (!cancelled) setProfileError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  // Full contributor view — use the dedicated profile endpoint
  if (isContributor) {
    if (loadingProfile) {
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-loading">Đang tải hồ sơ...</div>
          </div>
        </div>
      );
    }
    if (profileError) {
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <div className="profile-empty-card">
              <h1 className="profile-title">Hồ sơ Contributor</h1>
              <p className="profile-subtitle">Không tải được hồ sơ: {profileError}</p>
              <button type="button" className="profile-btn-primary" onClick={() => navigate("/contributor-request")}>
                Tạo hồ sơ ngay
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (contributorProfile) {
      return (
        <div className="contributor-profile-container">
          <div className="contributor-profile-content">
            <ContributorProfileView profile={contributorProfile} />
          </div>
        </div>
      );
    }
    // Fallback: profile endpoint returned null — show basic info from user + status
    const joinedSource = statusInfo?.approvedAt ?? statusInfo?.updatedAt ?? statusInfo?.createdAt;
    return (
      <div className="contributor-profile-container">
        <div className="contributor-profile-content">
          <div className="contributor-full-layout">
            <div className="contributor-header-card">
              <div className="contributor-avatar-section">
                <div className="contributor-avatar-placeholder">
                  {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "?"}
                </div>
              </div>
              <div className="contributor-header-info">
                <div className="contributor-name-row">
                  <h1 className="contributor-name">{user?.fullName || "Contributor"}</h1>
                  <span className="contributor-badge-label">
                    <CheckCircleIcon size={15} />
                    Contributor
                  </span>
                </div>
                <p className="contributor-join-date">
                  Bạn tham gia từ ngày: <strong>{formatViDate(joinedSource)}</strong>
                </p>
              </div>
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
                    <p className="profile-subtitle">Vui lòng liên hệ qua email: studyit.support@gmail.com</p>
                  </>
                )}
              </div>
            </div>
            {statusInfo?.rejectionReason && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, color: '#B91C1C', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📌</span> Lý do từ chối từ Moderator:
                </div>
                <div style={{ color: '#1F2937', fontSize: '14px', lineHeight: '1.6' }}>
                  {statusInfo.rejectionReason}
                </div>
              </div>
            )}
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
                <div className="profile-actions-footer">
                  <button
                    type="button"
                    className="profile-btn-primary"
                    onClick={() => navigate("/contributor-request")}
                  >
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
