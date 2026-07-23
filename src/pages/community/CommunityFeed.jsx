import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getFeed, getSavedPosts } from "../../api/communityApi";
import CreatePostBox from "../../components/community/CreatePostBox";
import PostCard from "../../components/community/PostCard";
import "../../styles/community.css";

const PAGE_SIZE = 10;

export default function CommunityFeed({ savedMode = false }) {
  const { isAuthenticated } = useAuth();
  const notification = useNotification();

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
    <div className="community-page-wrapper">
      <div className="community-single-layout">
        <main className="community-main">
          {/* Header */}
          <h1 className="community-title-heading">
            {savedMode ? "🔖 Bài viết đã lưu" : "📰 Bảng tin cộng đồng"}
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
              <div className="feed-empty-icon">
                {savedMode ? "🔖" : "📝"}
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
      </div>
    </div>
  );
}
