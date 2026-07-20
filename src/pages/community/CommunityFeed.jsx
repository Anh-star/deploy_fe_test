import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getFeed } from "../../api/communityApi";
import CreatePostBox from "../../components/community/CreatePostBox";
import PostCard from "../../components/community/PostCard";
import "../../styles/community.css";

const PAGE_SIZE = 10;

export default function CommunityFeed() {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  
  // Navigation tab state
  const [activeTab, setActiveTab] = useState("feed"); // "feed" | "saved"

  // Feed posts state
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Saved posts local state
  const [savedPosts, setSavedPosts] = useState([]);

  const loadPosts = useCallback(async (p = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await getFeed(p, PAGE_SIZE);
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
  }, [notification]);

  // Load saved posts from local storage
  const loadSavedPosts = useCallback(() => {
    try {
      const savedLocalStorageKey = user?.id
        ? `community_saved_posts_${user.id}`
        : "community_saved_posts_guest";
      const saved = localStorage.getItem(savedLocalStorageKey);
      setSavedPosts(saved ? JSON.parse(saved) : []);
    } catch {
      setSavedPosts([]);
    }
  }, [user]);

  useEffect(() => {
    loadPosts(0);
    loadSavedPosts();
  }, [loadPosts, loadSavedPosts]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostSavedChange = (postId, isSavedNow) => {
    // Refresh local saved list
    loadSavedPosts();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  const displayedPosts = activeTab === "feed" ? posts : savedPosts;

  return (
    <div className="community-page-wrapper">
      {/* 2-Column Layout */}
      <div className="community-layout">
        
        {/* Left Sidebar */}
        <aside className="community-sidebar">
          <button
            className={`community-sidebar-item ${activeTab === "feed" ? "active" : ""}`}
            onClick={() => setActiveTab("feed")}
          >
            <span className="sidebar-icon">📰</span>
            Bảng tin
          </button>
          
          <button
            className={`community-sidebar-item ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => {
              loadSavedPosts();
              setActiveTab("saved");
            }}
          >
            <span className="sidebar-icon">🔖</span>
            Bài viết đã lưu
          </button>
        </aside>

        {/* Right Main Feed Content */}
        <main className="community-main">
          {/* Header */}
          <h1 className="community-title-heading">
            {activeTab === "feed" ? "📰 Bảng tin cộng đồng" : "🔖 Bài viết đã lưu"}
          </h1>

          {/* Create post box — only show on Feed tab and if authenticated */}
          {activeTab === "feed" && (
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
          {activeTab === "feed" && loading ? (
            <div className="feed-loading">
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Đang tải bài viết...
            </div>
          ) : displayedPosts.length === 0 ? (
            <div className="feed-empty">
              <div className="feed-empty-icon">
                {activeTab === "feed" ? "📝" : "🔖"}
              </div>
              <div className="feed-empty-text">
                {activeTab === "feed" ? "Chưa có bài viết nào" : "Chưa có bài viết đã lưu"}
              </div>
              <div className="feed-empty-sub">
                {activeTab === "feed" 
                  ? "Hãy là người đầu tiên chia sẻ với cộng đồng!" 
                  : "Lưu các bài viết thú vị để đọc lại sau này nhé!"}
              </div>
            </div>
          ) : (
            <>
              {displayedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostDeleted={handlePostDeleted}
                  onPostSavedChange={handlePostSavedChange}
                />
              ))}

              {activeTab === "feed" && hasMore && (
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
