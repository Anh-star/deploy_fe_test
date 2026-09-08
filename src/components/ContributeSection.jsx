import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { GiftIcon, ShieldIcon, UploadIcon } from "./icons";
import bannerHome from "../assets/BannerHome.jpg";
import ContributorUploadGateModal from "./common/ContributorUploadGateModal";
import {
  checkContributorAccess,
  ContributorUploadGateVariant,
  getContributorUploadGateModalCopy,
} from "../utils/checkContributorUploadAccess";

export default function ContributeSection() {
  const navigate = useNavigate();
  const { user, isAuthenticated, initializing, loading } = useAuth();
  const notification = useNotification();
  const [uploadGateOpen, setUploadGateOpen] = useState(false);
  const [uploadGateConfig, setUploadGateConfig] = useState(() =>
    getContributorUploadGateModalCopy(ContributorUploadGateVariant.PENDING)
  );

  const handleContributeClick = async () => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để đóng góp tài liệu.");
      navigate("/login", { state: { from: "/upload-document" } });
      return;
    }

    if (initializing || loading || !user) {
      return;
    }

    const access = await checkContributorAccess(user);
    if (access.kind === "ALLOW_UPLOAD") {
      navigate("/upload-document");
      return;
    }
    if (access.kind === "NAVIGATE_CONTRIBUTOR_REGISTRATION") {
      navigate("/contributor-request");
      return;
    }
    setUploadGateConfig(getContributorUploadGateModalCopy(access.variant));
    setUploadGateOpen(true);
  };

  return (
    <div className="home-contribute">
      <div className="home-contribute__left">
        <div className="home-contribute__title">
          Bạn có tài liệu nào muốn chia sẻ không?
        </div>

        <div className="home-contribute__desc">
          Tham gia cộng đồng StudyIT bằng cách chia sẻ kiến thức giá trị của bạn.
          Mỗi tài liệu bạn chia sẻ sẽ giúp hàng ngàn học sinh, sinh viên và người học trên khắp Việt Nam.
        </div>

        <div className="home-contribute__badges">
          <div className="home-contribute__badge">
            <div style={{ color: "#007BFF", display: "flex", alignItems: "center" }}>
              <ShieldIcon size={20} />
            </div>
            <span>Được bảo vệ bản quyền</span>
          </div>

          <div className="home-contribute__badge">
            <div style={{ color: "#007BFF", display: "flex", alignItems: "center" }}>
              <GiftIcon size={18} />
            </div>
            <span>Nhận thưởng khi đóng góp</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleContributeClick}
          className="home-contribute__btn"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <UploadIcon size={18} />
          <span>Đóng góp tài liệu ngay</span>
        </button>
      </div>

      <div className="home-contribute__right">
        <img
          className="home-contribute__img"
          src={bannerHome}
          alt="Contribute Illustration"
        />
      </div>

      {uploadGateOpen && (
        <ContributorUploadGateModal
          isOpen={uploadGateOpen}
          onClose={() => setUploadGateOpen(false)}
          title={uploadGateConfig.title}
          message={uploadGateConfig.message}
          primary={uploadGateConfig.primary}
          closeOnly={uploadGateConfig.closeOnly}
        />
      )}
    </div>
  );
}