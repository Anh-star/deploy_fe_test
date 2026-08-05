import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getFeed, getSavedPosts } from "../../api/communityApi";
import { leaderboardService } from "../../services/api";
import { getAvatarDisplay, userHasAvatar } from "../../utils/avatarDisplay";
import CreatePostBox from "../../components/community/CreatePostBox";
import PostCard from "../../components/community/PostCard";
import { DocumentIcon, BookmarkIcon } from "../../components/icons";
import "../../styles/community.css";

const PAGE_SIZE = 10;

export default function CommunityFeed({ savedMode = false }) {
  const { isAuthenticated, user } = useAuth();
  const notification = useNotification();

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Leaderboard sidebar state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [sortBy, setSortBy] = useState("views"); // "views" or "downloads"
  const [scrollDirection, setScrollDirection] = useState("idle");

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;
      if (Math.abs(scrollY - lastScrollY) < 6) {
        ticking = false;
        return;
      }
      setScrollDirection(scrollY > lastScrollY ? "down" : "up");
      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchApi = savedMode ? getSavedPosts : getFeed;

  const loadPosts = useCallback(async (p = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await fetchApi(p, PAGE_SIZE);
      const items = data?.content || [];
      if (append) {
        setPosts((prev) => [...prev, ...items]);
      } else {
        setPosts(items);
      }
      setHasMore(items.length >= PAGE_SIZE);
      setPage(p);
    } catch {
      notification.error("Không thể tải bài viết.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchApi, notification]);

  useEffect(() => {
    loadPosts(0);
  }, [loadPosts, savedMode]);

  // Fetch leaderboard data for sidebar
  useEffect(() => {
    async function fetchSidebarLeaderboard() {
      try {
        setLeaderboardLoading(true);
        const data = await leaderboardService.getLeaderboard(5, sortBy);
        setLeaderboardData(data || []);
      } catch (err) {
        console.error("Error fetching sidebar leaderboard:", err);
      } finally {
        setLeaderboardLoading(false);
      }
    }
    fetchSidebarLeaderboard();
  }, [sortBy]);

  const handlePostCreated = (newPost) => {
    if (!savedMode) {
      setPosts((prev) => [newPost, ...prev]);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostSavedChange = (postId, isSavedNow) => {
    if (savedMode && !isSavedNow) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  const renderLeaderboardAvatar = (userItem) => {
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
          className="sidebar-user-avatar"
        />
      );
    }

    const bgColors = ["#EFF6FF", "#F0FDF4", "#FDF2F8", "#FEF3C7", "#F5F3FF"];
    const textColors = ["#1D4ED8", "#15803D", "#BE185D", "#B45309", "#6D28D9"];
    const charCode = (userItem.fullName || "?").charCodeAt(0);
    const colorIdx = charCode % bgColors.length;

    return (
      <span
        className="sidebar-user-avatar avatar-initials"
        style={{
          background: bgColors[colorIdx],
          color: textColors[colorIdx],
        }}
      >
        {display}
      </span>
    );
  };

  return (
    <div className="community-page-container">
      <div className="community-layout-grid">
        {/* Main Feed Content */}
        <main className="community-main-feed">
          {/* Header */}
          <h1 className="community-title-heading" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {savedMode ? <BookmarkIcon size={24} color="#007BFF" /> : <DocumentIcon size={24} color="#007BFF" />}
            <span>{savedMode ? "Bài viết đã lưu" : "Bảng tin cộng đồng"}</span>
          </h1>

          {/* Create post box — only show on main Feed tab if authenticated */}
          {!savedMode && (
            isAuthenticated ? (
              <CreatePostBox onPostCreated={handlePostCreated} />
            ) : (
              <div className="community-login-prompt">
                <p>Đăng nhập để chia sẻ bài viết và tương tác với cộng đồng!</p>
                <Link to="/login">Đăng nhập ngay</Link>
              </div>
            )
          )}

          {/* Feed Loader & Empty State */}
          {loading ? (
            <div className="feed-loading">
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Đang tải bài viết...
            </div>
          ) : posts.length === 0 ? (
            <div className="feed-empty">
              <div className="feed-empty-icon" style={{ display: "flex", justifyContent: "center" }}>
                {savedMode ? <BookmarkIcon size={36} color="#94A3B8" /> : <DocumentIcon size={36} color="#94A3B8" />}
              </div>
              <div className="feed-empty-text">
                {savedMode ? "Chưa có bài viết đã lưu" : "Chưa có bài viết nào"}
              </div>
              <div className="feed-empty-sub">
                {savedMode
                  ? "Lưu các bài viết thú vị để đọc lại sau này nhé!"
                  : "Hãy là người đầu tiên chia sẻ với cộng đồng!"}
              </div>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostDeleted={handlePostDeleted}
                  onPostSavedChange={handlePostSavedChange}
                />
              ))}

              {hasMore && (
                <button
                  className="feed-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Đang tải..." : "Xem thêm bài viết"}
                </button>
              )}
            </>
          )}
        </main>

        {/* Right Sidebar - Leaderboard Only */}
        <aside className={`community-sidebar scroll-${scrollDirection}`}>
          <div className="sidebar-widget-card leaderboard-widget">
            <div className="sidebar-widget-header">
              <div className="sidebar-widget-title">
                <span className="widget-icon">🏆</span>
                <span>BẢNG XẾP HẠNG</span>
              </div>
              <Link to="/leaderboard" className="sidebar-widget-more">
                Xem tất cả
              </Link>
            </div>

            {/* Filter Tabs */}
            <div className="leaderboard-widget-tabs">
              <button
                type="button"
                className={`widget-tab-btn ${sortBy === "views" ? "active" : ""}`}
                onClick={() => setSortBy("views")}
              >
                Lượt xem
              </button>
              <button
                type="button"
                className={`widget-tab-btn ${sortBy === "downloads" ? "active" : ""}`}
                onClick={() => setSortBy("downloads")}
              >
                Lượt tải
              </button>
            </div>

            {/* Leaderboard List */}
            <div className="sidebar-leaderboard-list">
              {leaderboardLoading ? (
                <div className="sidebar-loading">Đang tải bảng xếp hạng...</div>
              ) : leaderboardData.length === 0 ? (
                <div className="sidebar-empty">Chưa có dữ liệu đóng góp.</div>
              ) : (
                leaderboardData.map((item, index) => {
                  const currentUserId = user?.id || user?.userId;
                  const itemUserId = item?.id || item?.userId;
                  const isCurrentUser = Boolean(
                    currentUserId &&
                    itemUserId &&
                    String(currentUserId).toLowerCase() === String(itemUserId).toLowerCase()
                  );
                  const displayScore = sortBy === "views" ? item.totalViews : item.totalDownloads;
                  const userName = item?.fullName || item?.name || item?.username || item?.email || "Thành viên";

                  return (
                    <div key={itemUserId || index} className="sidebar-leaderboard-item">
                      <span className={`rank-badge rank-${index + 1}`}>
                        {index + 1}
                      </span>
                      {renderLeaderboardAvatar(item)}
                      <div className="sidebar-user-info">
                        <div className="sidebar-user-name-row">
                          <span className="sidebar-user-name" title={userName}>
                            {userName}
                          </span>
                          {isCurrentUser && <span className="you-badge">You</span>}
                        </div>
                      </div>
                      <div className="sidebar-score-tag">
                        {displayScore || 0} {sortBy === "views" ? "Lượt xem" : "Lượt tải"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
