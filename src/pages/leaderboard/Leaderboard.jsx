import { useEffect, useState } from "react";
import {
  TrophyIcon,
  EyeIcon,
  DownloadIcon,
  DocumentIcon,
} from "../../components/icons";
import { leaderboardService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/leaderboard.css";

export default function Leaderboard() {
  const { user: currentUser, isAuthenticated, contributorStatus } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("views"); // "views" or "freeDownloads" or "paidDownloads"

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        // Get top 100 users so we can find logged-in user ranking
        const data = await leaderboardService.getLeaderboard(100, sortBy);
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

  // Clean avatar rendering
  const renderAvatar = (userItem, customClass = "") => {
    const avatarUrl = userItem?.avatar?.trim();
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={userItem?.fullName || "User"}
          className={`podium-avatar-img ${customClass}`}
        />
      );
    }

    const nameStr = userItem?.fullName?.trim() || "User";
    const initials =
      nameStr
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U";

    const bgColors = ["#3B82F6", "#10B981", "#EC4899", "#F59E0B", "#8B5CF6", "#6366F1"];
    const charCode = (nameStr || "?").charCodeAt(0);
    const colorIdx = charCode % bgColors.length;

    return (
      <div
        className={`podium-avatar-fallback ${customClass}`}
        style={{
          backgroundColor: bgColors[colorIdx],
          color: "#ffffff",
        }}
      >
        {initials}
      </div>
    );
  };

  const top3 = leaderboard.slice(0, 3);
  // Table displays top 10 users from rank 4 to rank 10
  const tableUsers = leaderboard.slice(3, 10);

  // Identify top 3 users
  const userRank1 = top3.length > 0 ? { ...top3[0], displayRank: 1 } : null;
  const userRank2 = top3.length > 1 ? { ...top3[1], displayRank: 2 } : null;
  const userRank3 = top3.length > 2 ? { ...top3[2], displayRank: 3 } : null;

  // Find logged in user in leaderboard
  const currentUserEntry =
    isAuthenticated && currentUser
      ? leaderboard.find(
          (u) =>
            (currentUser.id && String(u.id) === String(currentUser.id)) ||
            (currentUser.fullName &&
              u.fullName?.trim().toLowerCase() === currentUser.fullName?.trim().toLowerCase())
        )
      : null;

  // Check if current user is a Contributor
  const roles = currentUser?.roles || [];
  const isContributor =
    roles.includes("CONTRIBUTOR") ||
    roles.includes("ROLE_CONTRIBUTOR") ||
    contributorStatus === "APPROVED" ||
    (currentUserEntry && currentUserEntry.totalDocuments > 0);

  const isCurrentUserInTop10 = currentUserEntry && currentUserEntry.rank <= 10;

  // Only show the ellipsis + personal rank row if the user is an active Contributor and outside top 10
  const showContributorRowOutsideTop10 =
    isAuthenticated && isContributor && !isCurrentUserInTop10;

  const getScoreInfo = (user) => {
    if (!user) return { score: "0", label: "LƯỢT XEM", docs: "0 tài liệu" };
    let score = (user.totalViews || 0).toLocaleString();
    let label = "LƯỢT XEM";
    if (sortBy === "freeDownloads" || sortBy === "paidDownloads") {
      score = (user.totalDownloads || 0).toLocaleString();
      label = "LƯỢT TẢI";
    }
    const docs = `${(user.totalDocuments || 0).toLocaleString()} tài liệu`;
    return { score, label, docs };
  };

  const score1 = getScoreInfo(userRank1);
  const score2 = getScoreInfo(userRank2);
  const score3 = getScoreInfo(userRank3);

  return (
    <main className="leaderboard-page">
      {/* Hero Section with Blue Gradient, Confetti & Curved Bottom */}
      <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
        {/* Floating Festive Confetti Decorations */}
        <div className="leaderboard-confetti-layer" aria-hidden="true">
          <span className="confetti-item star s-1">★</span>
          <span className="confetti-item sparkle sp-1">✦</span>
          <span className="confetti-item star s-2">★</span>
          <span className="confetti-item sparkle sp-2">✦</span>
          <span className="confetti-item star s-3">★</span>
          <span className="confetti-item sparkle sp-3">✦</span>
          <span className="confetti-item squiggle sq-1"></span>
          <span className="confetti-item squiggle sq-2"></span>
          <span className="confetti-item ring r-1"></span>
          <span className="confetti-item ring r-2"></span>
          <span className="confetti-item ring r-3"></span>
          <span className="confetti-item ring r-4"></span>
          <span className="confetti-item dot d-1"></span>
          <span className="confetti-item dot d-2"></span>
          <span className="confetti-item dot d-3"></span>
          <span className="confetti-item dot d-4"></span>
          <span className="confetti-item dot d-5"></span>
          <span className="confetti-item dot d-6"></span>
          <span className="confetti-item dot d-7"></span>
          <span className="confetti-item dot d-8"></span>
          <span className="confetti-item ribbon rb-1"></span>
          <span className="confetti-item ribbon rb-2"></span>
        </div>

        <div className="leaderboard-container">
          {/* Header Title & Subtitle */}
          <div className="leaderboard-hero-content">
            <span className="leaderboard-eyebrow">
              <TrophyIcon size={14} style={{ marginRight: "6px" }} />
              Bảng xếp hạng đóng góp
            </span>
            <h1 id="leaderboard-title">Vinh Danh Thành Viên Xuất Sắc</h1>
            <p className="leaderboard-hero-subtitle">
              Tôn vinh các thành viên có đóng góp tích cực và chia sẻ tài liệu hữu ích cho cộng đồng StudyIT.
            </p>

            {/* Filter Tabs */}
            <div className="leaderboard-tabs-wrapper">
              <div className="leaderboard-tabs">
                <button
                  type="button"
                  className={`leaderboard-tab ${sortBy === "views" ? "active" : ""}`}
                  onClick={() => setSortBy("views")}
                >
                  <EyeIcon size={16} style={{ marginRight: "8px" }} />
                  Lượt xem
                </button>
                <button
                  type="button"
                  className={`leaderboard-tab ${sortBy === "freeDownloads" ? "active" : ""}`}
                  onClick={() => setSortBy("freeDownloads")}
                >
                  <DownloadIcon size={16} style={{ marginRight: "8px" }} />
                  Tải miễn phí
                </button>
                <button
                  type="button"
                  className={`leaderboard-tab ${sortBy === "paidDownloads" ? "active" : ""}`}
                  onClick={() => setSortBy("paidDownloads")}
                >
                  <DownloadIcon size={16} style={{ marginRight: "8px" }} />
                  Tải trả phí
                </button>
              </div>
            </div>
          </div>

          {/* Loading & Status States */}
          {loading ? (
            <div className="podium-section">
              <div className="podium-grid skeleton-grid">
                <div className="podium-card rank-2 skeleton-card" />
                <div className="podium-card rank-1 skeleton-card" />
                <div className="podium-card rank-3 skeleton-card" />
              </div>
            </div>
          ) : error ? (
            <div className="leaderboard-state-card error-state">
              <div className="state-icon">⚠️</div>
              <p className="state-text-error">{error}</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="leaderboard-state-card empty-state">
              <div className="state-icon">🏆</div>
              <h3 className="state-title">Chưa có dữ liệu đóng góp</h3>
              <p className="state-desc">Hãy là người đầu tiên đóng góp tài liệu hữu ích cho cộng đồng nhé!</p>
            </div>
          ) : (
            /* EXACT 3D ISOMETRIC PODIUM STAND */
            top3.length > 0 && (
              <section className="podium-section" aria-label="Top 3 đóng góp nhiều nhất">
                <div className="podium-3d-layout">
                  {/* Floating User Headers (Crown, Avatars, Names) */}
                  <div className="podium-users-header-row">
                    {/* Rank 2 User (Left) */}
                    <div className="podium-user-cell rank-2-user">
                      {userRank2 && (
                        <>
                          <div className="podium-avatar-wrapper">
                            {renderAvatar(userRank2, "podium-avatar")}
                          </div>
                          <h2 className="podium-name" title={userRank2.fullName}>
                            {userRank2.fullName || "Ẩn danh"}
                          </h2>
                        </>
                      )}
                    </div>

                    {/* Rank 1 User (Center) */}
                    <div className="podium-user-cell rank-1-user">
                      {userRank1 && (
                        <>
                          <div className="crown-wrapper">
                            <span className="crown-icon" aria-hidden="true">👑</span>
                          </div>
                          <div className="podium-avatar-wrapper">
                            {renderAvatar(userRank1, "podium-avatar")}
                          </div>
                          <h2 className="podium-name" title={userRank1.fullName}>
                            {userRank1.fullName || "Ẩn danh"}
                          </h2>
                        </>
                      )}
                    </div>

                    {/* Rank 3 User (Right) */}
                    <div className="podium-user-cell rank-3-user">
                      {userRank3 && (
                        <>
                          <div className="podium-avatar-wrapper">
                            {renderAvatar(userRank3, "podium-avatar")}
                          </div>
                          <h2 className="podium-name" title={userRank3.fullName}>
                            {userRank3.fullName || "Ẩn danh"}
                          </h2>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 3D Geometric Podium SVG Stand */}
                  <div className="podium-stand-svg-wrapper">
                    <svg
                      viewBox="0 0 540 280"
                      className="podium-3d-svg"
                      preserveAspectRatio="xMidYMid meet"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        {/* Gold Gradients (Center - Rank 1) */}
                        <linearGradient id="goldTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#fff59d" />
                          <stop offset="100%" stopColor="#fdd835" />
                        </linearGradient>
                        <linearGradient id="goldFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#fbc02d" />
                          <stop offset="40%" stopColor="#f9a825" />
                          <stop offset="100%" stopColor="#f57f17" />
                        </linearGradient>
                        <linearGradient id="goldRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f57f17" />
                          <stop offset="100%" stopColor="#e65100" />
                        </linearGradient>

                        {/* Orange Gradients (Left - Rank 2) */}
                        <linearGradient id="orangeTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ffcc80" />
                          <stop offset="100%" stopColor="#ffa726" />
                        </linearGradient>
                        <linearGradient id="orangeFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#fb8c00" />
                          <stop offset="40%" stopColor="#f57c00" />
                          <stop offset="100%" stopColor="#e65100" />
                        </linearGradient>

                        {/* Silver/White Gradients (Right - Rank 3) */}
                        <linearGradient id="silverTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="100%" stopColor="#eceff1" />
                        </linearGradient>
                        <linearGradient id="silverFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#eceff1" />
                          <stop offset="50%" stopColor="#cfd8dc" />
                          <stop offset="100%" stopColor="#b0bec5" />
                        </linearGradient>
                        <linearGradient id="silverRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#90a4ae" />
                          <stop offset="100%" stopColor="#607d8b" />
                        </linearGradient>
                      </defs>

                      <g className="podium-geometry-group">
                        {/* ===== RANK 2 PILLAR (LEFT - ORANGE) ===== */}
                        {/* Top Face */}
                        <polygon points="50,90 85,75 190,65 170,80" fill="url(#orangeTopGrad)" />
                        {/* Front Face */}
                        <polygon points="50,90 170,80 170,270 50,270" fill="url(#orangeFrontGrad)" />

                        {/* ===== RANK 3 PILLAR (RIGHT - SILVER/WHITE) ===== */}
                        {/* Top Face */}
                        <polygon points="330,120 355,105 470,125 440,140" fill="url(#silverTopGrad)" />
                        {/* Front Face */}
                        <polygon points="330,120 440,140 440,270 330,270" fill="url(#silverFrontGrad)" />
                        {/* 3D Volumetric Right Shaded Face */}
                        <polygon points="440,140 470,125 485,255 440,270" fill="url(#silverRightGrad)" />

                        {/* ===== RANK 1 PILLAR (CENTER - GOLD) ===== */}
                        {/* Top Face */}
                        <polygon points="170,30 200,10 355,20 330,40" fill="url(#goldTopGrad)" />
                        {/* Front Face */}
                        <polygon points="170,30 330,40 330,270 170,270" fill="url(#goldFrontGrad)" />
                        {/* Right Shaded Step-down Face */}
                        <polygon points="330,40 355,20 355,105 330,120" fill="url(#goldRightGrad)" />
                      </g>
                    </svg>

                    {/* Front Face Typography & Scores Overlays */}
                    {/* Rank 2 Overlay */}
                    {userRank2 && (
                      <div className="podium-overlay-cell rank-2-cell">
                        <span className="podium-rank-num">2</span>
                        <div className="podium-score-val">{score2.score}</div>
                        <div className="podium-score-lbl">{score2.label}</div>
                        <div className="podium-doc-count">{score2.docs}</div>
                      </div>
                    )}

                    {/* Rank 1 Overlay */}
                    {userRank1 && (
                      <div className="podium-overlay-cell rank-1-cell">
                        <span className="podium-rank-num">1</span>
                        <div className="podium-score-val">{score1.score}</div>
                        <div className="podium-score-lbl">{score1.label}</div>
                        <div className="podium-doc-count">{score1.docs}</div>
                      </div>
                    )}

                    {/* Rank 3 Overlay */}
                    {userRank3 && (
                      <div className="podium-overlay-cell rank-3-cell">
                        <span className="podium-rank-num">3</span>
                        <div className="podium-score-val">{score3.score}</div>
                        <div className="podium-score-lbl">{score3.label}</div>
                        <div className="podium-doc-count">{score3.docs}</div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )
          )}
        </div>

        {/* Curved Wave Bottom Divider */}
        <div className="leaderboard-curve-wrapper" aria-hidden="true">
          <svg
            className="leaderboard-curve-svg"
            viewBox="0 0 1440 140"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 0,0 C 380,140 1060,140 1440,0 L 1440,140 L 0,140 Z"
              fill="#f8fafc"
            />
          </svg>
        </div>
      </section>

      {/* List for Rank 4 to 10 + Optional Contributor Row */}
      {!loading && !error && tableUsers.length > 0 && (
        <div className="leaderboard-container leaderboard-list-container">
          <section className="list-section" aria-label="Danh sách xếp hạng Top 10">
            <div className="list-card">
              <div className="list-card-header">
                <div>
                  <h3 className="list-card-title">Bảng xếp hạng chi tiết</h3>
                  <p className="list-card-subtitle">Top 10 thành viên đóng góp nhiều nhất</p>
                </div>
                <span className="list-card-count-badge">Top 10</span>
              </div>
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
                    {/* Top 4 to 10 Users */}
                    {tableUsers.map((user) => {
                      const isMe =
                        currentUser &&
                        ((user.id && String(user.id) === String(currentUser.id)) ||
                          (user.fullName &&
                            user.fullName?.trim().toLowerCase() ===
                              currentUser.fullName?.trim().toLowerCase()));

                      return (
                        <tr
                          key={user.id}
                          className={isMe ? "user-current-row" : ""}
                        >
                          <td className="rank-col" style={{ textAlign: "center" }}>
                            <span
                              className={`rank-badge-flat ${isMe ? "current-user-badge" : ""}`}
                            >
                              {user.rank}
                            </span>
                          </td>
                          <td className="user-col">
                            <div className="user-info-cell">
                              {renderAvatar(
                                user,
                                `user-avatar-small ${isMe ? "current-user-avatar" : ""}`
                              )}
                              <div className="user-name-wrapper">
                                <span className="user-name-small">
                                  {user.fullName || "Ẩn danh"}
                                </span>
                                {isMe && <span className="you-badge">Bạn</span>}
                              </div>
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
                      );
                    })}

                    {/* Ellipsis Row + Logged-in Contributor Row if outside Top 10 */}
                    {showContributorRowOutsideTop10 && (
                      <>
                        {/* Separator Row with Ellipsis */}
                        <tr className="leaderboard-ellipsis-row">
                          <td colSpan="5">
                            <div className="ellipsis-row-content">
                              <span className="ellipsis-dot"></span>
                              <span className="ellipsis-dot"></span>
                              <span className="ellipsis-dot"></span>
                            </div>
                          </td>
                        </tr>

                        {/* Current User Contributor Row */}
                        <tr className="user-current-row my-rank-sticky-row">
                          <td className="rank-col" style={{ textAlign: "center" }}>
                            <span className="rank-badge-flat current-user-badge">
                              {currentUserEntry ? currentUserEntry.rank : "-"}
                            </span>
                          </td>
                          <td className="user-col">
                            <div className="user-info-cell">
                              {renderAvatar(
                                currentUserEntry || currentUser,
                                "user-avatar-small current-user-avatar"
                              )}
                              <div className="user-name-wrapper">
                                <span className="user-name-small font-bold">
                                  {currentUser.fullName || "Bạn"}
                                </span>
                                <span className="you-badge">Bạn</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }} className="stat-cell">
                            <span className="stat-val-highlight">
                              <DocumentIcon size={16} className="icon-purple" />
                              {(currentUserEntry?.totalDocuments || 0).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }} className="stat-cell">
                            <span className="stat-val-highlight">
                              <EyeIcon size={16} className="icon-blue" />
                              {(currentUserEntry?.totalViews || 0).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }} className="stat-cell">
                            <span className="stat-val-highlight">
                              <DownloadIcon size={16} className="icon-green" />
                              {(currentUserEntry?.totalDownloads || 0).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
