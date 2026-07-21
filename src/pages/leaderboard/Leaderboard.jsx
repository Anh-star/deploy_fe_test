import { useEffect, useState } from "react";
import {
  TrophyIcon,
  EyeIcon,
  DownloadIcon,
  DocumentIcon,
} from "../../components/icons";
import { leaderboardService } from "../../services/api";
import { getAvatarDisplay, userHasAvatar } from "../../utils/avatarDisplay";
import "../../styles/leaderboard.css";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("views"); // "views" or "downloads"

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        // Get top 20 users
        const data = await leaderboardService.getLeaderboard(20, sortBy);
        setLeaderboard(data || []);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Không thể tải bảng xếp hạng. Vui lòng thử lại sau.");
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [sortBy]);

  const renderAvatar = (userItem, sizeClass) => {
    const mockUser = {
      fullName: userItem.fullName,
      avatar: userItem.avatar,
    };
    const isImage = userHasAvatar(mockUser);
    const display = getAvatarDisplay(mockUser);

    if (isImage) {
      return (
        <img
          src={display}
          alt={userItem.fullName}
          className={sizeClass}
        />
      );
    }

    // Return fallback initials
    const bgColors = ["#EFF6FF", "#F0FDF4", "#FDF2F8", "#FEF3C7", "#F5F3FF"];
    const textColors = ["#1D4ED8", "#15803D", "#BE185D", "#B45309", "#6D28D9"];
    const charCode = (userItem.fullName || "?").charCodeAt(0);
    const colorIdx = charCode % bgColors.length;

    return (
      <span
        className={sizeClass}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bgColors[colorIdx],
          color: textColors[colorIdx],
          fontWeight: 700,
          fontSize: sizeClass.includes("small") ? "16px" : "32px",
          borderRadius: "50%",
          border: "4px solid #ffffff",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
        }}
      >
        {display}
      </span>
    );
  };

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  // Re-order top3 to: [Rank 2, Rank 1, Rank 3] for correct podium display
  const podiumUsers = [];
  if (top3.length > 1) podiumUsers.push({ ...top3[1], displayRank: 2 }); // Rank 2
  if (top3.length > 0) podiumUsers.push({ ...top3[0], displayRank: 1 }); // Rank 1
  if (top3.length > 2) podiumUsers.push({ ...top3[2], displayRank: 3 }); // Rank 3

  return (
    <main className="leaderboard-page">
      {/* Hero Section */}
      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        <div className="leaderboard-container">
          <div className="leaderboard-hero-content">
            <span className="leaderboard-eyebrow">Thành viên đóng góp tích cực</span>
            <h1 id="leaderboard-title">Bảng xếp hạng đóng góp tài liệu</h1>
            <p>
              Nơi tôn vinh các thành viên có đóng góp xuất sắc nhất cho cộng đồng StudyIT.
              Bảng xếp hạng được tính dựa trên tổng lượt xem và lượt tải về của các tài liệu đã được duyệt.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="leaderboard-container">
        <div className="leaderboard-tabs-wrapper">
          <div className="leaderboard-tabs">
            <button
              className={`leaderboard-tab ${sortBy === "views" ? "active" : ""}`}
              onClick={() => setSortBy("views")}
            >
              <EyeIcon size={16} style={{ marginRight: "8px" }} />
              Lượt xem nhiều nhất
            </button>
            <button
              className={`leaderboard-tab ${sortBy === "downloads" ? "active" : ""}`}
              onClick={() => setSortBy("downloads")}
            >
              <DownloadIcon size={16} style={{ marginRight: "8px" }} />
              Lượt tải nhiều nhất
            </button>
          </div>
        </div>

        {loading ? (
          // Loading Skeletons
          <div>
            <div className="podium-grid" style={{ pointerEvents: "none" }}>
              <div className="podium-card rank-2 skeleton" style={{ minHeight: "330px" }} />
              <div className="podium-card rank-1 skeleton" style={{ minHeight: "380px" }} />
              <div className="podium-card rank-3 skeleton" style={{ minHeight: "310px" }} />
            </div>
            <div className="list-card skeleton" style={{ height: "400px", marginTop: "40px" }} />
          </div>
        ) : error ? (
          // Error State
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <p style={{ color: "#ef4444", fontSize: "18px", fontWeight: 600 }}>{error}</p>
          </div>
        ) : leaderboard.length === 0 ? (
          // Empty State
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", borderRadius: "24px", marginTop: "20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏆</div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>Chưa có dữ liệu đóng góp</h3>
            <p style={{ color: "#64748b", marginTop: "8px" }}>Hãy là người đầu tiên đóng góp tài liệu hữu ích cho cộng đồng nhé!</p>
          </div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {top3.length > 0 && (
              <section className="podium-section" aria-label="Top 3 đóng góp nhiều nhất">
                <div className="podium-grid">
                  {podiumUsers.map((user) => {
                    const isRank1 = user.displayRank === 1;
                    const isRank2 = user.displayRank === 2;
                    const isRank3 = user.displayRank === 3;

                    return (
                      <article
                        key={user.id}
                        className={`podium-card rank-${user.displayRank}`}
                      >
                        {isRank1 && (
                          <span className="crown-icon" aria-hidden="true">👑</span>
                        )}
                        <div className="podium-avatar-wrapper">
                          {renderAvatar(user, "podium-avatar")}
                          <span className="badge-icon" aria-label={`Hạng ${user.displayRank}`}>
                            {user.displayRank}
                          </span>
                        </div>
                        <h2 className="podium-name" title={user.fullName}>
                          {user.fullName || "Ẩn danh"}
                        </h2>
                        
                        <div className="podium-stats">
                          <div className="podium-stat-row">
                            <span className="podium-stat-label">Tổng lượt xem</span>
                            <span className="podium-stat-val">{(user.totalViews || 0).toLocaleString()}</span>
                          </div>
                          <div className="podium-stat-row">
                            <span className="podium-stat-label">Lượt tải về</span>
                            <span className="podium-stat-val">{(user.totalDownloads || 0).toLocaleString()}</span>
                          </div>
                          <div className="podium-stat-row">
                            <span className="podium-stat-label">Số tài liệu</span>
                            <span className="podium-stat-val">{(user.totalDocuments || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* List for Rank 4+ */}
            {others.length > 0 && (
              <section className="list-section" aria-label="Danh sách xếp hạng tiếp theo">
                <div className="list-card">
                  <div className="table-responsive">
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th className="rank-col" style={{ textAlign: "center" }}>Hạng</th>
                          <th className="user-col">Thành viên</th>
                          <th style={{ textAlign: "center" }}>Số tài liệu</th>
                          <th style={{ textAlign: "center" }}>Tổng lượt xem</th>
                          <th style={{ textAlign: "center" }}>Lượt tải về</th>
                        </tr>
                      </thead>
                      <tbody>
                        {others.map((user) => (
                          <tr key={user.id}>
                            <td className="rank-col" style={{ textAlign: "center" }}>
                              <span className="rank-badge-flat">{user.rank}</span>
                            </td>
                            <td className="user-col">
                              <div className="user-info-cell">
                                {renderAvatar(user, "user-avatar-small")}
                                <span className="user-name-small">{user.fullName || "Ẩn danh"}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }} className="stat-cell">
                              <span className="stat-val-highlight">
                                <DocumentIcon size={16} className="icon-purple" />
                                {(user.totalDocuments || 0).toLocaleString()}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }} className="stat-cell">
                              <span className="stat-val-highlight">
                                <EyeIcon size={16} className="icon-blue" />
                                {(user.totalViews || 0).toLocaleString()}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }} className="stat-cell">
                              <span className="stat-val-highlight">
                                <DownloadIcon size={16} className="icon-green" />
                                {(user.totalDownloads || 0).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
