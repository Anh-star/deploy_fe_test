import React, { useState, useRef, useEffect } from "react";
import {
  LinkIcon,
  UploadIcon,
  AlertIcon,
  ChevronRightIcon,
  DocumentIcon
} from "../../components/icons";
import { useNavigate } from "react-router-dom";
import "../../styles/contributorRequest.css";
import { uploadContributorFileToSupabase } from "../../utils/uploadDocumentSupabase";
import { useNotification } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import axiosClient from "../../api/axiosClient";

export default function ContributorRequest() {
  const notification = useNotification();
  const { user, contributorStatus, refreshContributorStatus } = useAuth();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    major: "",
    portfolioLink: "",
    experience: "",
    certificates: [], // [{ url, certificateName }]
    agreeTerms: false
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestedFields, setRequestedFields] = useState({});
  const [rejectionReason, setRejectionReason] = useState("");
  const [submissionCount, setSubmissionCount] = useState(0);
  const [serverStatus, setServerStatus] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  useEffect(() => {
    // Chuyển hướng ngay lập tức nếu đã có trạng thái PENDING hoặc APPROVED từ AuthContext
    if (contributorStatus === 'PENDING' || contributorStatus === 'APPROVED') {
      navigate("/contributor-status");
      return;
    }

    const fetchExistingData = async () => {
      try {
        const response = await axiosClient.get("/contributor/registration-status");
        if (response.data.success && response.data.data) {
          const data = response.data.data;
          // Nếu đã duyệt hoặc đang chờ duyệt, chuyển hướng sang trang trạng thái
          if (data.status === 'PENDING' || data.status === 'APPROVED') {
            navigate("/contributor-status");
            return;
          }
          setServerStatus(data.status ? String(data.status).toUpperCase() : null);
          setFormData(prev => ({
            ...prev,
            portfolioLink: data.portfolioLink || "",
            experience: data.experience || "",
            certificates: data.certificates || [],
          }));
          setRequestedFields(data.requestedFields || {});
          setRejectionReason(data.rejectionReason || "");
          setSubmissionCount(Number(data.submissionCount ?? 0));
        } else {
          setServerStatus(null);
          setSubmissionCount(0);
        }
      } catch (error) {
        console.error("Lỗi khi tải thông tin hồ sơ cũ:", error);
      }
    };
    fetchExistingData();
  }, [contributorStatus, navigate]);

  // Handle escape to close preview modal
  useEffect(() => {
    if (!previewImageModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPreviewImageModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewImageModal]);

  const effectiveStatus = String(contributorStatus || serverStatus || "").toUpperCase();
  const isResubmit = (effectiveStatus === 'REJECTED' || effectiveStatus === 'NEED_INFO') && submissionCount >= 1;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleFileUpload = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    // Kiểm tra dung lượng tối đa 25MB / tệp
    const oversized = files.find(f => f.size > 25 * 1024 * 1024);
    if (oversized) {
      notification.error(`Tệp "${oversized.name}" vượt quá dung lượng tối đa 25MB.`);
      return;
    }

    try {
      setIsUploading(true);
      const uploadPromises = files.map(file => uploadContributorFileToSupabase(file, "files"));
      const results = await Promise.all(uploadPromises);

      const newCertificates = results.map(res => ({
        url: res.url,
        certificateName: res.fileName
      }));

      setFormData(prev => ({
        ...prev,
        certificates: [...prev.certificates, ...newCertificates]
      }));

      notification.success(`Tải lên thành công ${files.length} tệp!`);
    } catch (error) {
      notification.error(error.message || "Lỗi khi tải lên tệp.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index)
    }));
  };

  const isImageFile = (fileName = "", url = "") => {
    const ext = (fileName || url).split("?")[0].split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext);
  };

  const imageCertificates = formData.certificates.filter(c => isImageFile(c.certificateName, c.url));
  const docCertificates = formData.certificates.filter(c => !isImageFile(c.certificateName, c.url));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.agreeTerms) {
      notification.error("Bạn phải đồng ý với các điều khoản dành cho Contributor.");
      return;
    }

    if (!formData.experience.trim()) {
      notification.error("Vui lòng mô tả kinh nghiệm chuyên môn của bạn.");
      return;
    }

    if (formData.certificates.length === 0) {
      notification.error("Vui lòng tải lên ít nhất một ảnh minh chứng hoặc chứng chỉ liên quan.");
      return;
    }

    try {
      setIsSubmitting(true);

      let finalExp = formData.experience.trim();
      if (formData.major && !finalExp.toLowerCase().includes(formData.major.toLowerCase())) {
        finalExp = `[Lĩnh vực chuyên môn: ${formData.major}]\n\n${finalExp}`;
      }

      // Backend Jackson rejects unknown properties -> only send portfolioLink, experience, certificates
      await axiosClient.post("/contributor/register", {
        portfolioLink: formData.portfolioLink.trim(),
        experience: finalExp,
        certificates: formData.certificates.map(c => ({
          url: c.url,
          certificateName: c.certificateName
        }))
      });

      notification.success(
        isResubmit
          ? "Đã gửi lại yêu cầu Contributor lần 2 thành công!"
          : "Yêu cầu đăng ký Contributor đã được gửi thành công!"
      );

      navigate("/contributor-status");

      refreshContributorStatus().catch(err => {
        console.error("Background refresh failed after navigation:", err);
      });
    } catch (error) {
      const msg = error?.response?.data?.message || "Gửi yêu cầu thất bại.";
      notification.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contributor-request-container">
      <main className="contributor-request-content">
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={imageInputRef}
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files)}
          accept="image/*,.jpg,.jpeg,.png,.webp"
          multiple
        />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files)}
          accept=".pdf,.doc,.docx"
          multiple
        />

        <header className="request-header">
          {isResubmit ? (
            <>
              <div className="resubmit-badge-wrap">
                <span>⚠️</span> Gửi lại hồ sơ lần 2 (Tối đa 2 lần xét duyệt)
              </div>
              <h1 className="request-title">Gửi lại yêu cầu xét duyệt Contributor</h1>
              <p className="request-subtitle">
                Cập nhật thông tin, bổ sung mô tả và tải lên ảnh chụp minh chứng / chứng chỉ rõ nét để Ban Quản Trị xem xét lại.
              </p>
            </>
          ) : (
            <>
              <h1 className="request-title">Đăng ký trở thành Người đóng góp (Contributor)</h1>
              <p className="request-subtitle">
                Chia sẻ kiến thức và tài liệu của bạn với cộng đồng để cùng nhau phát triển.
              </p>
            </>
          )}
        </header>

        <div className="request-banner">
          <img
            src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2070&auto=format&fit=crop"
            alt="Contributor Banner"
          />
        </div>

        {/* Thông báo Lý do từ chối từ Moderator (Lần 1) */}
        {isResubmit && rejectionReason && (
          <div className="rejection-notice-card">
            <div className="rejection-notice-header">
              <span style={{ fontSize: "20px" }}>📌</span>
              <h3 className="rejection-notice-title">LÝ DO TỪ CHỐI TỪ MODERATOR (LẦN 1)</h3>
            </div>
            <div className="rejection-notice-reason">
              {rejectionReason}
            </div>
            <p className="rejection-notice-guidance">
              💡 <strong>Lưu ý khắc phục:</strong> Vui lòng đọc kỹ lý do trên, chụp lại ảnh minh chứng rõ nét (đủ sáng, không lóa đèn, đọc rõ số và chữ) hoặc bổ sung tài liệu đối chứng chính xác trước khi gửi lại.
            </p>
          </div>
        )}

        {/* Thông báo Yêu cầu bổ sung thông tin nếu có */}
        {isResubmit && Object.keys(requestedFields).length > 0 && (
          <div className="supplement-alert-card">
            <div className="supplement-alert-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3>YÊU CẦU BỔ SUNG / CHỈNH SỬA THÔNG TIN</h3>
            </div>
            <p className="supplement-alert-desc">
              Hồ sơ của bạn cần bổ sung hoặc chỉnh sửa các mục sau đây theo yêu cầu của Moderator:
            </p>
            <ul className="supplement-alert-list">
              {Object.entries(requestedFields).map(([key, reason]) => {
                const fieldLabel = {
                  fullName: 'Họ tên',
                  email: 'Email',
                  portfolioLink: 'Link Portfolio / Website',
                  experience: 'Mô tả kinh nghiệm',
                  certificates: 'Chứng chỉ / Hồ sơ đính kèm'
                }[key] || key;
                return (
                  <li key={key} className="supplement-alert-item">
                    <strong>{fieldLabel}:</strong> {reason}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Khung Thông tin cá nhân của người nộp hồ sơ */}
        <div className="applicant-info-card">
          <div className="applicant-info-item">
            <span className="applicant-info-label">👤 Họ và tên</span>
            <span className="applicant-info-val">{user?.fullName || "Chưa cập nhật"}</span>
          </div>
          <div className="applicant-info-item">
            <span className="applicant-info-label">✉️ Email đăng ký</span>
            <span className="applicant-info-val">{user?.email || "Chưa cập nhật"}</span>
          </div>
          <div className="applicant-info-item">
            <span className="applicant-info-label">📞 Số điện thoại</span>
            <span className="applicant-info-val">{user?.phone || "Chưa cập nhật"}</span>
          </div>
        </div>

        <form className="request-form-card" onSubmit={handleSubmit}>
          {/* Lĩnh vực chuyên môn chính */}
          <div className="form-group">
            <label className="form-label">
              Lĩnh vực / Chuyên môn chính
            </label>
            <div className="input-wrapper" style={{ paddingLeft: "12px" }}>
              <select
                name="major"
                className="form-input"
                style={{ cursor: "pointer", background: "transparent" }}
                value={formData.major}
                onChange={handleInputChange}
              >
                <option value="">-- Chọn lĩnh vực chuyên môn của bạn --</option>
                <option value="Công nghệ thông tin / Kỹ thuật phần mềm">Công nghệ thông tin / Kỹ thuật phần mềm</option>
                <option value="Lập trình Web (Frontend / Backend / Fullstack)">Lập trình Web (Frontend / Backend / Fullstack)</option>
                <option value="Lập trình Di động (iOS / Android / Flutter)">Lập trình Di động (iOS / Android / Flutter)</option>
                <option value="Trí tuệ nhân tạo (AI) & Khoa học dữ liệu">Trí tuệ nhân tạo (AI) & Khoa học dữ liệu</option>
                <option value="An toàn thông tin & An ninh mạng">An toàn thông tin & An ninh mạng</option>
                <option value="Mạng máy tính & Điện toán đám mây (DevOps / Cloud)">Mạng máy tính & Điện toán đám mây (DevOps / Cloud)</option>
                <option value="Khoa học máy tính & Thuật toán">Khoa học máy tính & Thuật toán</option>
                <option value="Thiết kế UI/UX & Sản phẩm">Thiết kế UI/UX & Sản phẩm</option>
                <option value="Khác">Lĩnh vực chuyên môn khác</option>
              </select>
            </div>
          </div>

          {/* Link Portfolio */}
          <div className="form-group">
            <label className="form-label">
              Link Portfolio / Website / GitHub (nếu có)
              {requestedFields.portfolioLink && (
                <span className="field-error-reason"> (Yêu cầu sửa: {requestedFields.portfolioLink})</span>
              )}
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <LinkIcon size={16} />
              </span>
              <input
                type="text"
                name="portfolioLink"
                className={`form-input ${requestedFields.portfolioLink ? 'warning-border' : ''}`}
                placeholder="https://github.com/username hoặc https://linkedin.com/in/username"
                value={formData.portfolioLink}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Mô tả kinh nghiệm */}
          <div className="form-group">
            <label className="form-label">
              Mô tả kinh nghiệm &amp; Kế hoạch đóng góp <span style={{ color: "#EF4444" }}>*</span>
              {requestedFields.experience && (
                <span className="field-error-reason"> (Yêu cầu sửa: {requestedFields.experience})</span>
              )}
            </label>
            <textarea
              name="experience"
              rows={6}
              className={`form-textarea ${requestedFields.experience ? 'warning-border' : ''}`}
              placeholder="Hãy giới thiệu chi tiết về kinh nghiệm chuyên môn, trường lớp/nơi làm việc, các dự án hoặc các loại tài liệu/khóa học bạn dự định chia sẻ trên ITStudy..."
              value={formData.experience}
              onChange={handleInputChange}
              required
            ></textarea>
          </div>

          {/* Khu vực Upload Ảnh & Tài liệu chứng chỉ */}
          <div className="form-group">
            <label className="form-label">
              Ảnh minh chứng / Chứng chỉ / Tài liệu đính kèm <span style={{ color: "#EF4444" }}>*</span>
              {requestedFields.certificates && (
                <span className="field-error-reason"> (Yêu cầu sửa: {requestedFields.certificates})</span>
              )}
            </label>

            {/* Các nút tải lên nhanh theo loại */}
            <div className="upload-buttons-row">
              <button
                type="button"
                className="upload-type-btn primary-upload"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading}
              >
                📷 Tải lên ảnh minh chứng (JPG, PNG)
              </button>
              <button
                type="button"
                className="upload-type-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                📄 Tải lên tệp tài liệu (PDF, Word)
              </button>
            </div>

            {/* Khu vực Drag & Drop */}
            <div
              className={`upload-zone ${requestedFields.certificates ? 'warning-border' : ''}`}
              onClick={() => imageInputRef.current?.click()}
              style={{ cursor: "pointer", opacity: isUploading ? 0.6 : 1 }}
            >
              <div className="upload-info">
                <div className="upload-icon-wrapper">
                  <DocumentIcon size={20} />
                </div>
                <div className="upload-text-wrapper">
                  <div className="upload-text-main">
                    {isUploading ? "Đang tải tệp lên máy chủ..." : "Nhấn để chọn ảnh hoặc kéo thả tệp vào đây"}
                  </div>
                  <div className="upload-text-sub">
                    Hỗ trợ ảnh (.jpg, .jpeg, .png, .webp) và tài liệu (.pdf, .doc, .docx). Tối đa 25MB/tệp.
                  </div>
                </div>
              </div>
              <button type="button" className="upload-btn" disabled={isUploading}>
                {isUploading ? "Đang tải..." : "Thêm ảnh / tệp"}
              </button>
            </div>

            {/* Hiển thị Lưới Ảnh Preview (Image Preview Grid) */}
            {imageCertificates.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🖼️</span> Ảnh minh chứng đã tải lên ({imageCertificates.length}):
                </div>
                <div className="image-preview-grid">
                  {imageCertificates.map((img, idx) => {
                    const realIndex = formData.certificates.indexOf(img);
                    return (
                      <div key={idx} className="image-preview-card">
                        <div className="image-preview-thumb-wrap">
                          <img
                            src={img.url}
                            alt={img.certificateName}
                            className="image-preview-thumb"
                            onClick={() => setPreviewImageModal({ url: img.url, name: img.certificateName })}
                            title="Nhấn để phóng to kiểm tra độ nét"
                          />
                          <div className="image-preview-overlay">
                            <button
                              type="button"
                              className="image-overlay-btn btn-zoom"
                              onClick={() => setPreviewImageModal({ url: img.url, name: img.certificateName })}
                              title="Phóng to ảnh"
                            >
                              🔍
                            </button>
                            <button
                              type="button"
                              className="image-overlay-btn"
                              onClick={() => removeFile(realIndex)}
                              title="Xóa ảnh này"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="image-preview-name" title={img.certificateName}>
                          {img.certificateName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hiển thị Danh sách Tệp Tài liệu đã tải lên (PDF, Word) */}
            {docCertificates.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📑</span> Tệp tài liệu đính kèm ({docCertificates.length}):
                </div>
                <div className="uploaded-files-list">
                  {docCertificates.map((file, idx) => {
                    const realIndex = formData.certificates.indexOf(file);
                    const isWord = file.certificateName?.toLowerCase().endsWith('.doc') || file.certificateName?.toLowerCase().endsWith('.docx');
                    const isPdf = file.certificateName?.toLowerCase().endsWith('.pdf');
                    const viewUrl = isWord
                      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`
                      : file.url;

                    return (
                      <div key={idx} className="uploaded-file-item">
                        <div className="file-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isWord ? '#EFF6FF' : (isPdf ? '#FEF2F2' : '#ECFDF5'),
                              color: isWord ? '#2563EB' : (isPdf ? '#DC2626' : '#059669'),
                              border: `1px solid ${isWord ? '#BFDBFE' : (isPdf ? '#FECACA' : '#A7F3D0')}`
                            }}
                          >
                            {isWord ? 'WORD' : (isPdf ? 'PDF' : 'DOC')}
                          </span>
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-name"
                            title="Nhấn để xem trước tài liệu"
                          >
                            {file.certificateName}
                          </a>
                        </div>
                        <button
                          type="button"
                          className="remove-file-btn"
                          onClick={() => removeFile(realIndex)}
                          title="Xóa tệp này"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Điều khoản cam kết */}
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="terms"
              name="agreeTerms"
              className="custom-checkbox"
              checked={formData.agreeTerms}
              onChange={handleInputChange}
            />
            <label htmlFor="terms" className="checkbox-label">
              Tôi cam kết mọi thông tin và hình ảnh/tài liệu minh chứng cung cấp là chính xác, hợp pháp và tuân thủ các quy chuẩn dành cho Người đóng góp của ITStudy.
            </label>
          </div>

          <div className="form-footer">
            <span className="privacy-note">Mọi thông tin và giấy tờ của bạn được bảo mật tuyệt đối.</span>
            <button
              type="submit"
              className="submit-request-btn"
              disabled={isSubmitting || isUploading}
              style={{
                background: isResubmit ? "#DC2626" : "#007aff",
                minWidth: isResubmit ? "230px" : "180px"
              }}
            >
              {isSubmitting
                ? "Đang gửi hồ sơ..."
                : isResubmit
                ? "Xác nhận & Gửi lại lần 2"
                : "Gửi yêu cầu"}
              {!isSubmitting && <ChevronRightIcon size={14} color="white" />}
            </button>
          </div>
        </form>

        <div className="info-box">
          <span className="info-icon"><AlertIcon size={18} /></span>
          <p className="info-text">
            Yêu cầu của bạn sẽ được Ban Quản Trị xem xét và phản hồi trong vòng 24-48 giờ làm việc. Kết quả sẽ được cập nhật trực tiếp tại trang trạng thái và qua email của bạn.
          </p>
        </div>
      </main>

      {/* Modal Phóng to xem ảnh kiểm tra chất lượng */}
      {previewImageModal && (
        <div
          className="image-lightbox-backdrop"
          onClick={() => setPreviewImageModal(null)}
          role="presentation"
        >
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="image-lightbox-close"
              onClick={() => setPreviewImageModal(null)}
              title="Đóng (Esc)"
            >
              ✕
            </button>
            <img
              src={previewImageModal.url}
              alt={previewImageModal.name}
              className="image-lightbox-img"
            />
            <div className="image-lightbox-caption">
              {previewImageModal.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
