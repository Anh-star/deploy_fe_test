import { useNavigate } from "react-router-dom";
import { GiftIcon, ShieldIcon } from "./icons";
import bannerHome from "../assets/BannerHome.jpg";

export default function ContributeSection() {
  const navigate = useNavigate();

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
          onClick={() => navigate("/documents/upload")}
          className="home-contribute__btn"
        >
          Đóng góp tài liệu ngay
        </button>
      </div>

      <div className="home-contribute__right">
        <img
          className="home-contribute__img"
          src={bannerHome}
          alt="Contribute Illustration"
        />
      </div>
    </div>
  );
}