import React from "react";
import {
  ClockIcon,
  UsersIcon,
  ListIcon,
  EyeIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogoutIcon
} from "../../components/icons";
import "../../styles/viewHistory.css";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";

const historyData = [
  {
    id: 1,
    title: "Hướng dẫn lập trình React Native cho người mới",
    category: "CÔNG NGHỆ",
    categoryColor: "#3b82f6",
    viewTime: "14:30 - 20/10/2023",
    uploader: { fullName: "Nguyễn Văn A" },
    field: "Lập trình di động",
    views: "1.2k",
    downloads: "450",
    thumbText: "JS"
  },
  {
    id: 2,
    title: "Lập trình OOP",
    category: "KINH TẾ",
    categoryColor: "#f59e0b",
    viewTime: "10:15 - 20/10/2023",
    uploader: { fullName: "Trần Thị B" },
    field: "Lập trình web",
    views: "3.8k",
    downloads: "1.1k",
    thumbIcon: "🏛️"
  },
  {
    id: 3,
    title: "Nguyên lý thiết kế UI/UX hiện đại cho Website",
    category: "NGHỆ THUẬT",
    categoryColor: "#10b981",
    viewTime: "09:45 - 19/10/2023",
    uploader: { fullName: "Lê Văn C" },
    field: "Thiết kế đồ họa",
    views: "890",
    downloads: "120",
    thumbIcon: "🎨"
  }
];

export default function ViewHistory() {
  return (
    <div className="view-history-container">
      <main className="view-history-content">
        <header className="history-header">
          <div className="history-title-section">
            <h1>Lịch sử tài liệu đã xem</h1>
            <p className="history-subtitle">Danh sách các tài liệu bạn đã truy cập trong 30 ngày qua.</p>
          </div>
          <div className="history-actions">
            <button className="view-history-action-btn">
              <ListIcon size={16} />
              Lọc
            </button>
            <button className="view-history-action-btn view-history-action-btn--delete">
              <LogoutIcon size={16} />
              Xóa lịch sử
            </button>
          </div>
        </header>

        <div className="view-history-list">
          {historyData.map((item) => (
            <div key={item.id} className="view-history-card">
              <div className="view-history-thumb">
                <div
                  className="view-history-category-badge"
                  style={{ backgroundColor: item.categoryColor }}
                >
                  {item.category}
                </div>
                {item.thumbText ? (
                  <span style={{ fontSize: "24px", fontWeight: 700, color: "#94a3b8" }}>{item.thumbText}</span>
                ) : (
                  <span style={{ fontSize: "40px" }}>{item.thumbIcon}</span>
                )}
              </div>

              <div className="view-history-card-info">
                <div className="view-history-view-time">
                  <ClockIcon size={14} />
                  <span>Xem lúc: {item.viewTime}</span>
                </div>
                <h2 className="view-history-card-title">{item.title}</h2>
                <div className="view-history-card-meta">
                  <div className="view-history-meta-item">
                    <UsersIcon size={14} />
                    <span>Đăng bởi: {getDocumentUploaderDisplayName(item) || "—"}</span>
                  </div>
                  <div className="view-history-meta-item">
                    <ListIcon size={14} />
                    <span>Chuyên mục: {item.field}</span>
                  </div>
                </div>
                <div className="view-history-card-stats">
                  <div className="view-history-stat-item">
                    <EyeIcon size={14} />
                    <span>{item.views}</span>
                  </div>
                  <div className="view-history-stat-item">
                    <DownloadIcon size={14} />
                    <span>{item.downloads}</span>
                  </div>
                </div>
              </div>

              <button className="view-history-view-btn">
                <EyeIcon size={16} color="white" />
                Xem lại
              </button>
            </div>
          ))}
        </div>

        <div className="view-history-pagination">
          <button className="view-history-page-btn">
            <ChevronLeftIcon size={14} />
          </button>
          <button className="view-history-page-btn active">1</button>
          <button className="view-history-page-btn">2</button>
          <button className="view-history-page-btn">3</button>
          <span className="view-history-page-dots">...</span>
          <button className="view-history-page-btn">12</button>
          <button className="view-history-page-btn">
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </main>
    </div>
  );
}
