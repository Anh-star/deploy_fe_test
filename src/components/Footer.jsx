// src/components/Footer.jsx
import { FacebookIcon, GlobeIcon, LanguageIcon, LinkedinIcon, UsersIcon, YoutubeIcon } from "./icons";
export default function Footer() {
  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        paddingTop: "64px",
        paddingBottom: "32px",
        marginTop: "80px",
        background: "white",
        borderTop: "1px solid #E2E8F0",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        display: "flex",
      }}
    >
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",

          paddingLeft: "32px",
          paddingRight: "32px",
          margin: "0 auto",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          gap: "48px",
          display: "flex",
        }}
      >
        <div
          style={{
            alignSelf: "stretch",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "48px",
            display: "inline-flex",
            flexWrap: "wrap",
          }}
        >
          {/* Cột 1 - About */}
          <div
            style={{
              flex: "1 1 0",
              minWidth: "320px",
              alignSelf: "stretch",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "inline-flex",
            }}
          >
            <img
              style={{ width: "260px", height: "auto", maxHeight: "80px", objectFit: "contain", marginBottom: "8px" }}
              src="/imgs/logo.png"
              alt="StudyIT Logo"
            />

            <div
              style={{
                width: "100%",
                maxWidth: "384px",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                display: "flex",
              }}
            >
              <div
                style={{
                  maxWidth: "368.95px",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#64748B",
                  fontSize: "16px",
                  fontFamily: "Inter",
                  fontWeight: 400,
                  lineHeight: "26px",
                }}
              >
                Nền tảng chia sẻ và quản lý tài liệu học tập CNTT hàng đầu<br />
                dành cho cộng đồng lập trình viên Việt Nam.
              </div>
            </div>

            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "16px",
                display: "inline-flex",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: "#F1F5F9",
                  borderRadius: "9999px",
                  justifyContent: "center",
                  alignItems: "center",
                  display: "flex",
                }}
              >
                <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                  <div style={{ color: "#475569" }}><FacebookIcon size={17} /></div>
                </div>
              </div>

              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: "#F1F5F9",
                  borderRadius: "9999px",
                  justifyContent: "center",
                  alignItems: "center",
                  display: "flex",
                }}
              >
                <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                  <div style={{ color: "#475569" }}><UsersIcon size={17} /></div>
                </div>
              </div>

              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: "#F1F5F9",
                  borderRadius: "9999px",
                  justifyContent: "center",
                  alignItems: "center",
                  display: "flex",
                }}
              >
                <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                  <div style={{ color: "#475569" }}><LinkedinIcon size={14} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 2 - About Us */}
          <div
            style={{
              flex: "0 1 204.80px",
              minWidth: "180px",
              alignSelf: "stretch",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "inline-flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#1E293B",
                  fontSize: "16px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  lineHeight: "24px",
                }}
              >
                Về chúng tôi
              </div>
            </div>

            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "16px",
                display: "flex",
              }}
            >
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Giới thiệu
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Điều khoản dịch vụ
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Chính sách bảo mật
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Liên hệ
              </div>
            </div>
          </div>

          {/* Cột 3 - Resources */}
          <div
            style={{
              flex: "0 1 204.80px",
              minWidth: "180px",
              alignSelf: "stretch",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "inline-flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#1E293B",
                  fontSize: "16px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  lineHeight: "24px",
                }}
              >
                Tài nguyên
              </div>
            </div>

            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "16px",
                display: "flex",
              }}
            >
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Tài liệu học tập
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Khóa học video
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Bài viết chuyên sâu
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Lộ trình học
              </div>
            </div>
          </div>

          {/* Cột 4 - Support */}
          <div
            style={{
              flex: "0 1 204.81px",
              minWidth: "180px",
              alignSelf: "stretch",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "inline-flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#1E293B",
                  fontSize: "16px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  lineHeight: "24px",
                }}
              >
                Hỗ trợ
              </div>
            </div>

            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "16px",
                display: "flex",
              }}
            >
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Trung tâm trợ giúp
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Hướng dẫn sử dụng
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Báo lỗi
              </div>
              <div style={{ alignSelf: "stretch", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                Câu hỏi thường gặp
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div
          style={{
            alignSelf: "stretch",
            paddingTop: "32px",
            borderTop: "1px solid #E2E8F0",
            justifyContent: "space-between",
            alignItems: "center",
            display: "inline-flex",
          }}
        >
          <div
            style={{
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              display: "inline-flex",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: "408.05px",
                height: "20px",
                justifyContent: "center",
                display: "flex",
                flexDirection: "column",
                color: "#64748B",
                fontSize: "14px",
                fontFamily: "Inter",
                fontWeight: 400,
                lineHeight: "20px",
              }}
            >
              © 2026 StudyIT. Bảo lưu mọi quyền.
            </div>
          </div>

          <div style={{ justifyContent: "flex-start", alignItems: "flex-start", gap: "24px", display: "flex" }}>
            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "4px",
                display: "flex",
              }}
            >
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                <div style={{ color: "#94A3B8" }}><LanguageIcon size={12} /></div>
              </div>
              <div
                style={{
                  width: "89px",
                  height: "20px",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#94A3B8",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 500,
                  lineHeight: "20px",
                }}
              >
                Tiếng Việt
              </div>
            </div>

            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "4px",
                display: "flex",
              }}
            >
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                <div style={{ color: "#94A3B8" }}><GlobeIcon size={12} /></div>
              </div>
              <div
                style={{
                  width: "61.20px",
                  height: "20px",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#94A3B8",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 500,
                  lineHeight: "20px",
                }}
              >
                Toàn cầu
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}