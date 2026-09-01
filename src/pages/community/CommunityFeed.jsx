import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getFeed, getSavedPosts, getPostById } from "../../api/communityApi";
import { leaderboardService } from "../../services/api";
import { getAvatarDisplay, userHasAvatar } from "../../utils/avatarDisplay";
import CreatePostBox from "../../components/community/CreatePostBox";
import PostCard from "../../components/community/PostCard";
import { DocumentIcon, BookmarkIcon } from "../../components/icons";
import { PostCardSkeleton, SidebarLeaderboardSkeleton } from "../../components/community/CommunitySkeletons";
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

  // URL query params for target post popup modal from notifications
  const [searchParams, setSearchParams] = useSearchParams();
  const targetPostId = searchParams.get("postId");
  const targetCommentId = searchParams.get("commentId");
  const [extraTargetPost, setExtraTargetPost] = useState(null);
  const [deletedPostModalOpen, setDeletedPostModalOpen] = useState(false);

  useEffect(() => {
    if (!targetPostId) {
      setExtraTargetPost(null);
      setDeletedPostModalOpen(false);
      return;
    }
    const matchedPost = posts.find((p) => String(p.id) === String(targetPostId));
    if (matchedPost) {
      if (matchedPost.isDeleted) {
        setDeletedPostModalOpen(true);
      }
      return;
    }

    let isMounted = true;
    getPostById(targetPostId)
      .then((data) => {
        if (isMounted && data) {
          if (data.isDeleted) {
            setDeletedPostModalOpen(true);
            setExtraTargetPost(null);
          } else {
            setExtraTargetPost(data);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setDeletedPostModalOpen(true);
          setExtraTargetPost(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetPostId, posts, notification]);

  const handleCloseTargetPostModal = useCallback(() => {
    setExtraTargetPost(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("postId");
    newParams.delete("commentId");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleCloseDeletedPostModal = useCallback(() => {
    setDeletedPostModalOpen(false);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("postId");
    newParams.delete("commentId");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Leaderboard sidebar state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [sortBy, setSortBy] = useState("views"); // "views" or "downloads"
  const [scrollDirection, setScrollDirection] = useState("idle");
  const sentinelRef = useRef(null);

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

  // Infinite scroll: auto-load next page when sentinel is visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadPosts(page + 1, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, loadPosts]);

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
            <PostCardSkeleton count={3} />
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
              {posts.map((post) => {
                const isTarget = targetPostId && String(post.id) === String(targetPostId);
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    defaultShowComments={isTarget}
                    targetCommentId={isTarget ? targetCommentId : null}
                    onPostDeleted={handlePostDeleted}
                    onPostSavedChange={handlePostSavedChange}
                    onCloseCommentsModal={isTarget ? handleCloseTargetPostModal : null}
                  />
                );
              })}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {loadingMore && (
                <div style={{ marginTop: 16 }}>
                  <PostCardSkeleton count={1} />
                </div>
              )}
            </>
          )}

          {/* Target post modal when opening a post not in current feed list */}
          {extraTargetPost && !posts.some((p) => String(p.id) === String(extraTargetPost.id)) && (
            <PostCard
              key={`extra-${extraTargetPost.id}`}
              post={extraTargetPost}
              defaultShowComments={true}
              targetCommentId={targetCommentId}
              onPostDeleted={handlePostDeleted}
              onPostSavedChange={handlePostSavedChange}
              onCloseCommentsModal={handleCloseTargetPostModal}
            />
          )}

          {/* Modal notification when target post is deleted or does not exist */}
          {deletedPostModalOpen && (
            <div
              className="post-detail-modal-backdrop"
              onClick={handleCloseDeletedPostModal}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "16px",
              }}
            >
              <div
                className="post-detail-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "480px",
                  width: "100%",
                  textAlign: "center",
                  padding: "40px 28px",
                  borderRadius: "20px",
                  background: "#ffffff",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    background: "#fee2e2",
                    color: "#ef4444",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "10px" }}>
                  Bài viết không tồn tại hoặc đã bị xóa
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}>
                  Bài viết bạn đang tìm kiếm hiện không khả dụng, đã bị tác giả hoặc ban quản trị xóa khỏi cộng đồng.
                </p>
                <button
                  type="button"
                  onClick={handleCloseDeletedPostModal}
                  style={{
                    padding: "10px 24px",
                    background: "#007bff",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  Quay lại Bảng tin
                </button>
              </div>
            </div>
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
                className={`widget-tab-btn ${sortBy === "freeDownloads" ? "active" : ""}`}
                onClick={() => setSortBy("freeDownloads")}
              >
                Tải Free
              </button>
              <button
                type="button"
                className={`widget-tab-btn ${sortBy === "paidDownloads" ? "active" : ""}`}
                onClick={() => setSortBy("paidDownloads")}
              >
                Tải Paid
              </button>
            </div>

            {/* Leaderboard List */}
            <div className="sidebar-leaderboard-list">
              {leaderboardLoading ? (
                <SidebarLeaderboardSkeleton count={5} />
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
                        {displayScore || 0} {
                          sortBy === "views" ? "Lượt xem" :
                          sortBy === "freeDownloads" ? "Tải Free" :
                          "Tải Paid"
                        }
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

