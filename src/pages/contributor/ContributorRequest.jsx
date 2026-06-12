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
import { uploadToCloudinary } from "../../utils/uploadCloudinary";
import { useNotification } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import axiosClient from "../../api/axiosClient";

export default function ContributorRequest() {
  const notification = useNotification();
  const { contributorStatus, refreshContributorStatus } = useAuth();
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    portfolioLink: "",
    experience: "",
    certificates: [], // Lưu danh sách các chứng chỉ [{url, certificateName}]
    agreeTerms: false
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestedFields, setRequestedFields] = useState({});

  useEffect(() => {
    // Chuyển hướng ngay lập tức nếu đã có trạng thái từ context
    if (contributorStatus === 'PENDING' || contributorStatus === 'APPROVED') {
       navigate("/contributor-status");
    } else if (contributorStatus === 'NEED_INFO' || contributorStatus === 'REJECTED') {
       const fetchExistingData = async () => {
         try {
           const response = await axiosClient.get("/contributor/registration-status");
           if (response.data.success && response.data.data) {
             const data = response.data.data;
             setFormData(prev => ({
               ...prev,
               portfolioLink: data.portfolioLink || "",
               experience: data.experience || "",
               certificates: data.certificates || [],
             }));
             setRequestedFields(data.requestedFields || {});
           }
         } catch (error) {
           console.error("Lỗi khi tải thông tin hồ sơ cũ:", error);
         }
       };
       fetchExistingData();
    }
  }, [contributorStatus, navigate]);

  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadPromises = files.map(file => uploadToCloudinary(file, "assets/ContributorRequests"));
      const results = await Promise.all(uploadPromises);
      
      const newCertificates = results.map(res => ({
        url: res.url,
        certificateName: res.certificateName
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
    }
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.agreeTerms) {
      notification.error("Bạn phải đồng ý với các điều khoản.");
      return;
    }

    if (!formData.experience) {
      notification.error("Vui lòng mô tả kinh nghiệm của bạn.");
      return;
    }

    if (formData.certificates.length === 0) {
      notification.error("Vui lòng tải lên ít nhất một chứng chỉ liên quan.");
      return;
    }

    try {
      setIsSubmitting(true);
      // Gửi request về backend Spring Boot
      await axiosClient.post("/contributor/register", {
        portfolioLink: formData.portfolioLink,
        experience: formData.experience,
        certificates: formData.certificates
      });

      notification.success("Yêu cầu của bạn đã được gửi thành công!");
      // Điều hướng ngay lập tức nếu việc POST thành công
      navigate("/contributor-status");

      // Sau đó, làm mới trạng thái của AuthContext ở chế độ nền
      // để đảm bảo context được cập nhật cho các lần sử dụng sau.
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
        <header className="request-header">
          <h1 className="request-title">Đăng ký trở thành Người đóng góp (Contributor)</h1>
          <p className="request-subtitle">Chia sẻ kiến thức và tài liệu của bạn với cộng đồng để cùng nhau phát triển.</p>
        </header>

        <div className="request-banner">
          <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2070&auto=format&fit=crop" alt="Contributor Banner" />
        </div>

        {Object.keys(requestedFields).length > 0 && (
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
            <p className="supplement-alert-note">
              * Đối với Họ tên hoặc Email, bạn có thể chỉnh sửa chúng tại trang <strong>Hồ sơ cá nhân</strong> trước khi gửi lại.
            </p>
          </div>
        )}

        <form className="request-form-card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Link Portfolio (nếu có)
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
                placeholder="https://behance.net/username" 
                value={formData.portfolioLink}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Mô tả kinh nghiệm của bạn
              {requestedFields.experience && (
                <span className="field-error-reason"> (Yêu cầu sửa: {requestedFields.experience})</span>
              )}
            </label>
            <textarea 
              name="experience"
              className={`form-textarea ${requestedFields.experience ? 'warning-border' : ''}`} 
              placeholder="Hãy cho chúng tôi biết về kinh nghiệm chuyên môn, các dự án bạn đã thực hiện hoặc các lĩnh vực bạn am hiểu nhất..."
              value={formData.experience}
              onChange={handleInputChange}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">
              Tải lên chứng chỉ liên quan (PDF, JPG, PNG)
              {requestedFields.certificates && (
                <span className="field-error-reason"> (Yêu cầu sửa: {requestedFields.certificates})</span>
              )}
            </label>
            <div 
              className={`upload-zone ${requestedFields.certificates ? 'warning-border' : ''}`} 
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: "pointer", opacity: isUploading ? 0.6 : 1 }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: "none" }} 
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf"
                multiple // Cho phép chọn nhiều file
              />
              <div className="upload-info">
                <div className="upload-icon-wrapper">
                  <DocumentIcon size={20} />
                </div>
                <div className="upload-text-wrapper">
                  <div className="upload-text-main">
                    {isUploading ? "Đang tải lên..." : "Nhấn để tải lên hoặc kéo thả (có thể chọn nhiều file)"}
                  </div>
                  <div className="upload-text-sub">Tối đa 10MB mỗi tệp</div>
                </div>
              </div>
              <button type="button" className="upload-btn" disabled={isUploading}>
                Thêm tệp
              </button>
            </div>

            {/* Hiển thị danh sách file đã tải lên */}
            {formData.certificates.length > 0 && (
              <div className="uploaded-files-list">
                {formData.certificates.map((file, index) => (
                  <div key={index} className="uploaded-file-item">
                    <div className="file-info">
                      <DocumentIcon size={16} color="#64748b" />
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-name">
                        {file.certificateName}
                      </a>
                    </div>
                    <button 
                      type="button" 
                      className="remove-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              Tôi đồng ý với các <a href="#">điều khoản dành cho Contributor</a> và cam kết cung cấp thông tin chính xác.
            </label>
          </div>

          <div className="form-footer">
            <span className="privacy-note">Mọi thông tin của bạn sẽ được bảo mật tuyệt đối.</span>
            <button 
              type="submit" 
              className="submit-request-btn" 
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
              {!isSubmitting && <ChevronRightIcon size={14} color="white" />}
            </button>
          </div>
        </form>

        <div className="info-box">
          <span className="info-icon"><AlertIcon size={18} /></span>
          <p className="info-text">
            Yêu cầu của bạn sẽ được xét duyệt trong vòng 24-48h. Chúng tôi sẽ gửi thông báo kết quả qua email đăng ký của bạn.
          </p>
        </div>
      </main>
    </div>
  );
}
