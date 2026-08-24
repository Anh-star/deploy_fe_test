import React from "react";
import { Link } from "react-router-dom";
import "../../styles/aboutUs.css";

export default function AboutUs() {
  const values = [
    {
      title: "Transparency",
      subtitle: "Minh bạch",
      desc: "Mọi tài liệu, lộ trình và đánh giá học tập đều rõ ràng, công khai và đặt hiệu quả của người học lên hàng đầu.",
    },
    {
      title: "Flexibility",
      subtitle: "Linh hoạt",
      desc: "Học tập mọi lúc, mọi nơi với lộ trình cá nhân hóa, linh hoạt theo thời gian biểu và tốc độ tiếp thu của bạn.",
    },
    {
      title: "Accuracy",
      subtitle: "Chính xác",
      desc: "Hệ thống kiến thức, tài liệu và câu hỏi trắc nghiệm được biên soạn chuẩn xác và kiểm duyệt định kỳ.",
    },
    {
      title: "Quality",
      subtitle: "Chất lượng",
      desc: "Nội dung bám sát công nghệ thực tế và nhu cầu tuyển dụng của các doanh nghiệp phần mềm hàng đầu.",
    },
  ];

  return (
    <main className="about-us-page">
      <div className="about-wrapper">
        {/* ==================== SECTION 1: ABOUT US ==================== */}
        <section className="about-hero-section">
          <div className="about-hero-left">
            <h1 className="about-main-title">About us</h1>
            <p className="about-hero-subtitle">
              StudyIT là nền tảng EdTech tiên phong về giáo dục công nghệ thông tin, 
              đồng hành cùng bạn trên hành trình làm chủ lập trình và kiến tạo tương lai số.
            </p>
            <p className="about-hero-description">
              Chúng tôi cung cấp hệ sinh thái học tập toàn diện gồm kho tài liệu chuyên sâu, 
              bộ câu hỏi trắc nghiệm thực chiến, bài tập lập trình tương tác và diễn đàn trao đổi sôi nổi. 
              Mỗi nội dung được thiết kế bài bản, giúp người học từ nhập môn đến nâng cao 
              đều có thể tự tin xây dựng sự nghiệp công nghệ vững chắc.
            </p>
            <div className="about-hero-actions">
              <Link to="/documents" className="about-btn-primary">
                Khám phá tài liệu
              </Link>
              <Link to="/contributor-request" className="about-btn-outline">
                Hợp tác đóng góp
              </Link>
            </div>
          </div>

          <div className="about-hero-right">
            <div className="about-hero-img-wrapper">
              <img
                src="/imgs/about_team.jpg"
                alt="Đội ngũ StudyIT làm việc cùng nhau"
                className="about-hero-img"
              />
            </div>
          </div>
        </section>

        {/* ==================== SECTION 2: OUR STORY ==================== */}
        <section className="about-story-section">
          <div className="about-story-card">
            <h2 className="about-story-title">Our Story</h2>
            <p className="about-story-text">
              Khởi đầu từ niềm đam mê công nghệ và khát khao mang tri thức IT chuẩn mực đến với cộng đồng người Việt, 
              StudyIT được sáng lập bởi đội ngũ kỹ sư phần mềm và giảng viên tâm huyết. 
              Chúng tôi thấu hiểu những khó khăn khi tự học lập trình: thiếu tài liệu chất lượng, thiếu môi trường cọ xát và lộ trình mơ hồ. 
              Vì vậy, StudyIT ra đời nhằm thu hẹp khoảng cách giữa giảng đường và doanh nghiệp, 
              mang lại giải pháp học tập trực quan, thực chiến và dễ tiếp cận cho tất cả mọi người.
            </p>
          </div>
        </section>

        {/* ==================== SECTION 3: OUR VALUES ==================== */}
        <section className="about-values-section">
          <div className="about-values-left">
            <h2 className="about-values-title">Our Values</h2>
            
            <div className="about-values-grid">
              {values.map((v) => (
                <div className="about-val-item" key={v.title}>
                  <h3 className="about-val-heading">
                    {v.title}
                    <span className="about-val-sub"> ({v.subtitle})</span>
                  </h3>
                  <p className="about-val-desc">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-values-right">
            <div className="about-values-img-frame">
              <img
                src="/imgs/about_values.jpg"
                alt="Học viên cùng học tập và phát triển tại StudyIT"
                className="about-values-img"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}