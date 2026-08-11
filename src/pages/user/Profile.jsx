import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Navigate } from "react-router-dom";
import {
  UserCircleIcon,
  DocumentIcon,
  QuizIcon,
  StarIcon,
  PencilIcon,
  ChartIcon,
  LockIcon,
} from "../../components/icons";
import "../../styles/dashboard.css";
import "../../styles/community.css";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import UserAvatarDisplay from "../../components/UserAvatarDisplay";
import { getProfileRoleBadges } from "../../utils/roleBadges";
import { updateProfile } from "../../api/profileApi";
import { getUserDashboard, getPublicProfile, getApiErrorMessage } from "../../api/userApi";
import { getUserPosts } from "../../api/communityApi";
import CreatePostBox from "../../components/community/CreatePostBox";
import PostCard from "../../components/community/PostCard";
import { supabase, AVATAR_BUCKET } from "../../supabaseClient";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const GridIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const CameraIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const TrendingUpIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

function validateAvatarFile(file) {
  const okType =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    /\.(jpe?g|png)$/i.test(file.name);
  if (!okType) {
    return "Chỉ chấp nhận ảnh JPG hoặc PNG.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Ảnh tối đa 2MB.";
  }
  return null;
}

function avatarPathExtension(file) {
  const name = file.name || "";
  const m = /\.(jpe?g|png)$/i.exec(name);
  if (!m) return "jpg";
  const e = m[1].toLowerCase();
  if (e === "jpeg" || e === "jpg") return "jpg";
  return "png";
}

function formatProgressPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  const s = n.toFixed(1);
  if (n > 0) return `+${s}%`;
  return `${s}%`;
}

function progressVisualClasses(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n) || n === 0) {
    return {
      valueClass: "progress-neutral",
      badgeClass: "progress-badge-flat",
    };
  }
  if (n > 0) {
    return { valueClass: "progress-positive", badgeClass: "progress-badge-up" };
  }
  return { valueClass: "progress-negative", badgeClass: "progress-badge-down" };
}

function sortPostsWithPinned(postsList) {
  if (!Array.isArray(postsList)) return [];
  return [...postsList].sort((a, b) => {
    const aPinned = Boolean(a.isPinned);
    const bPinned = Boolean(b.isPinned);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    if (aPinned && bPinned) {
      const aPinTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bPinTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return bPinTime - aPinTime;
    }
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

// Modal popup để chỉnh sửa thông tin cá nhân
function EditProfileModal({
  open,
  onClose,
  fullName,
  setFullName,
  phone,
  setPhone,
  bio,
  setBio,
  email,
  avatarUrl,
  avatarUploading,
  openFilePicker,
  onSave,
  saving,
}) {
  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <PencilIcon size={18} color="#2563EB" />
            Chỉnh sửa thông tin cá nhân
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "none", fontSize: "20px", color: "#94A3B8", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="info-form">
          {/* Avatar Edit Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
            <div className="avatar-wrapper profile-avatar-wrapper" style={{ width: 72, height: 72 }}>
              <img
                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || "U")}&background=E2E8F0&color=475569&size=128`}
                alt=""
                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
              />
              <button
                type="button"
                className="camera-btn profile-camera-btn"
                onClick={openFilePicker}
                disabled={avatarUploading}
                title={avatarUploading ? "Đang tải ảnh…" : "Đổi ảnh đại diện"}
                aria-label="Đổi ảnh đại diện"
              >
                {avatarUploading ? (
                  <span className="profile-avatar-spinner" aria-hidden />
                ) : (
                  <CameraIcon color="white" size={14} />
                )}
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={openFilePicker}
                disabled={avatarUploading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {avatarUploading ? "Đang tải ảnh lên…" : "Chọn ảnh đại diện mới"}
              </button>
              <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
                Định dạng JPG, PNG. Tối đa 2MB.
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>HỌ VÀ TÊN</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={255}
              required
            />
          </div>

          <div className="form-group">
            <label>SỐ ĐIỆN THOẠI</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={32}
              placeholder="Tùy chọn"
            />
          </div>

          <div className="form-group">
            <label>GIỚI THIỆU</label>
            <textarea
              className="profile-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Một vài dòng về bản thân bạn…"
            />
          </div>

          <div className="form-group">
            <label>ĐỊA CHỈ EMAIL</label>
            <input type="email" value={email || ""} readOnly disabled style={{ background: "#F1F5F9", color: "#64748B" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 22px",
                borderRadius: "8px",
                border: "none",
                background: "#2563EB",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user, isAuthenticated, initializing, refreshUserProfile } = useAuth();
  const notification = useNotification();
  const fileInputRef = useRef(null);

  const isOwnProfile = useMemo(() => {
    if (!userId) return true;
    if (user?.id && String(userId).toLowerCase() === String(user.id).toLowerCase()) return true;
    return false;
  }, [userId, user?.id]);

  const targetUserId = isOwnProfile ? (user?.id || user?.userId) : userId;

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Public user state (if viewing another user's profile)
  const [publicUser, setPublicUser] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(null);

  // Form states (for own profile)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dashboard states
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  // User posts states
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsPage, setPostsPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  // Load public profile if viewing another user
  useEffect(() => {
    if (isOwnProfile || !userId) {
      setPublicUser(null);
      return;
    }
    let cancelled = false;
    setPublicLoading(true);
    setPublicError(null);
    getPublicProfile(userId)
      .then((data) => {
        if (!cancelled) setPublicUser(data);
      })
      .catch((err) => {
        if (!cancelled) setPublicError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, userId]);

  // Sync edit form state with current user
  useEffect(() => {
    if (!user || !isOwnProfile) return;
    setFullName(user.fullName ?? "");
    setPhone(user.phone ?? "");
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatar?.trim() ? user.avatar : "");
  }, [user, isOwnProfile]);

  // Load dashboard data if own profile
  useEffect(() => {
    if (!isOwnProfile || !user?.id) return undefined;
    let cancelled = false;
    setDashboardLoading(true);
    setDashboardError(null);
    getUserDashboard()
      .then((data) => {
        if (!cancelled) setDashboardData(data);
      })
      .catch((err) => {
        if (!cancelled) setDashboardError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user?.id]);

  // Load user posts
  const fetchUserPosts = useCallback(async (p = 0, append = false) => {
    if (!targetUserId || targetUserId === "undefined") return;
    if (append) setLoadingMorePosts(true);
    else setPostsLoading(true);
    try {
      const data = await getUserPosts(targetUserId, p, 10);
      const items = data?.content || [];
      if (append) {
        setUserPosts((prev) => sortPostsWithPinned([...prev, ...items]));
      } else {
        setUserPosts(sortPostsWithPinned(items));
      }
      setHasMorePosts(items.length >= 10);
      setPostsPage(p);
    } catch (err) {
      console.error("Failed to load user posts:", err);
    } finally {
      setPostsLoading(false);
      setLoadingMorePosts(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchUserPosts(0);
  }, [fetchUserPosts]);

  const handlePostCreated = (newPost) => {
    setUserPosts((prev) => sortPostsWithPinned([newPost, ...prev]));
  };

  const handlePostDeleted = (postId) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setUserPosts((prev) => {
      const updatedList = prev.map((p) => (p.id === updatedPost.id ? updatedPost : p));
      return sortPostsWithPinned(updatedList);
    });
  };

  const handleLoadMorePosts = () => {
    if (!loadingMorePosts && hasMorePosts) {
      fetchUserPosts(postsPage + 1, true);
    }
  };

  const displayUser = useMemo(() => {
    const u = isOwnProfile ? user : publicUser;
    if (!u) return null;
    return {
      ...u,
      fullName: isOwnProfile ? (fullName || u.fullName || "") : (u.fullName || ""),
      avatar: isOwnProfile ? (avatarUrl?.trim() ? avatarUrl : u.avatar) : (u.avatar || u.avatarUrl),
    };
  }, [isOwnProfile, user, publicUser, fullName, avatarUrl]);

  const openFilePicker = useCallback(() => {
    if (avatarUploading) return;
    fileInputRef.current?.click();
  }, [avatarUploading]);

  const onAvatarSelected = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const err = validateAvatarFile(file);
      if (err) {
        notification.error(err);
        return;
      }

      const viteUrl = import.meta.env.VITE_SUPABASE_URL;
      const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!viteUrl?.trim() || !viteKey?.trim()) {
        notification.error(
          "Chưa cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY."
        );
        return;
      }

      setAvatarUploading(true);
      try {
        const ext = avatarPathExtension(file);
        const filePath = `${user.id}_${Date.now()}.${ext}`;
        const contentType =
          file.type ||
          (ext === "png" ? "image/png" : "image/jpeg");

        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType,
          });

        if (uploadError) {
          throw new Error(uploadError.message || "Upload thất bại.");
        }

        const { data: pub } = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(filePath);

        const url = pub?.publicUrl;
        if (!url) {
          throw new Error("Không lấy được URL ảnh công khai.");
        }

        setAvatarUrl(url);
        notification.success(
          "Tải ảnh lên thành công. Nhấn Lưu thay đổi để lưu hồ sơ."
        );
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Tải ảnh thất bại.";
        notification.error(msg);
      } finally {
        setAvatarUploading(false);
      }
    },
    [notification, user]
  );

  const onSave = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      await refreshUserProfile();
      notification.success("Đã lưu hồ sơ.");
      setIsEditModalOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Lưu hồ sơ thất bại.";
      notification.error(msg);
    } finally {
      setSaving(false);
    }
  }, [user, saving, fullName, phone, bio, avatarUrl, refreshUserProfile, notification]);

  if (initializing || publicLoading) {
    return (
      <div className="dashboard-container">
        <main className="dashboard-content" style={{ textAlign: "center", padding: "40px 0" }}>
          Đang tải trang cá nhân...
        </main>
      </div>
    );
  }

  if (publicError) {
    return (
      <div className="dashboard-container">
        <main className="dashboard-content" style={{ textAlign: "center", padding: "40px 0" }}>
          <h2>Không tìm thấy người dùng</h2>
          <p>{publicError}</p>
        </main>
      </div>
    );
  }

  if (isOwnProfile && (!isAuthenticated || !user)) {
    return <Navigate to="/login" replace />;
  }

  if (!displayUser) {
    return null;
  }

  const roleBadges = getProfileRoleBadges(displayUser.roles);
  const progressClasses = progressVisualClasses(dashboardData?.progressPercent);

  return (
    <div className="dashboard-container">
      {/* Hidden Avatar File Input */}
      {isOwnProfile && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="profile-avatar-file-input"
          aria-hidden
          tabIndex={-1}
          onChange={onAvatarSelected}
        />
      )}

      <main className="dashboard-content">
        {/* Profile Card / Header */}
        <section className="profile-card">
          <div className="profile-info-main">
            <div className="avatar-wrapper profile-avatar-wrapper">
              <UserAvatarDisplay user={displayUser} size="profile" />
              {isOwnProfile && (
                <button
                  type="button"
                  className="camera-btn profile-camera-btn"
                  onClick={openFilePicker}
                  disabled={avatarUploading}
                  title={avatarUploading ? "Đang tải ảnh…" : "Đổi ảnh đại diện"}
                  aria-label="Đổi ảnh đại diện"
                >
                  {avatarUploading ? (
                    <span className="profile-avatar-spinner" aria-hidden />
                  ) : (
                    <CameraIcon color="white" size={16} />
                  )}
                </button>
              )}
            </div>
            <div className="profile-text">
              <h2>
                {displayUser.fullName || "—"}
                {roleBadges.map(({ role, label }) => (
                  <span key={role} className="role-badge">
                    {label}
                  </span>
                ))}
              </h2>
              {displayUser.email && <p className="profile-email">{displayUser.email}</p>}
              {displayUser.bio && <p className="profile-bio-text" style={{ marginTop: "6px", color: "#475569", fontSize: "14px" }}>{displayUser.bio}</p>}
            </div>
          </div>

          {/* Edit Profile Button (Own Profile) */}
          {isOwnProfile && (
            <button
              type="button"
              className="edit-profile-btn"
              onClick={() => setIsEditModalOpen(true)}
            >
              <PencilIcon size={16} color="white" />
              <span>Chỉnh sửa trang cá nhân</span>
            </button>
          )}
        </section>

        {/* Unified Section: Learning Dashboard Stats (Own Profile) */}
        {isOwnProfile && (
          <section className="dashboard-stats-section">
            <div className="section-header">
              <GridIcon color="#3b82f6" size={20} />
              <h3>Bảng điều khiển học tập</h3>
            </div>

            {dashboardError ? (
              <div className="dashboard-dashboard-error" role="alert">
                {dashboardError}
              </div>
            ) : null}

            <div
              className={`stats-grid${dashboardLoading ? " dashboard-stats-skeleton" : ""}`}
              aria-busy={dashboardLoading}
            >
              <div className="stat-card blue">
                <div>
                  <div className="stat-label">SỐ TÀI LIỆU ĐÃ HỌC</div>
                  {dashboardLoading ? (
                    <div className="stat-value-skel" aria-hidden />
                  ) : (
                    <div className="stat-value">
                      {Number(dashboardData?.totalDocumentsLearned ?? 0)}
                    </div>
                  )}
                </div>
                <div className="stat-icon-bg">
                  <DocumentIcon size={20} />
                </div>
              </div>

              <div className="stat-card orange">
                <div>
                  <div className="stat-label">SỐ BÀI QUIZ ĐÃ LÀM</div>
                  {dashboardLoading ? (
                    <div className="stat-value-skel" aria-hidden />
                  ) : (
                    <div className="stat-value">
                      {Number(dashboardData?.totalQuizzesDone ?? 0)}
                    </div>
                  )}
                </div>
                <div className="stat-icon-bg">
                  <QuizIcon size={20} />
                </div>
              </div>

              <div className="stat-card green">
                <div>
                  <div className="stat-label">ĐIỂM TRUNG BÌNH</div>
                  {dashboardLoading ? (
                    <div className="stat-value-skel" aria-hidden />
                  ) : (
                    <div className="stat-value">
                      {Number(dashboardData?.averageScore ?? 0).toFixed(1)}
                    </div>
                  )}
                </div>
                <div className="stat-icon-bg">
                  <StarIcon size={20} />
                </div>
              </div>

              <div className="stat-card blue-light">
                <div>
                  <div className="stat-label">% TIẾN BỘ</div>
                  {dashboardLoading ? (
                    <div className="stat-value-skel" aria-hidden />
                  ) : (
                    <div
                      className={`stat-value ${progressClasses.valueClass}`}
                    >
                      {formatProgressPercent(dashboardData?.progressPercent)}
                      <span
                        className={`month-badge ${progressClasses.badgeClass}`}
                      >
                        vs tháng trước
                      </span>
                    </div>
                  )}
                </div>
                <div className="stat-icon-bg">
                  <TrendingUpIcon size={20} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Unified Section: User Posts (Replaces Daily Score Chart) */}
        <section className="user-posts-section">
          <div className="section-header" style={{ marginBottom: "16px" }}>
            <PencilIcon size={18} color="#2563eb" />
            <h3>{isOwnProfile ? "Bài viết của bạn" : `Bài viết của ${displayUser.fullName || "người dùng"}`} ({userPosts.length})</h3>
          </div>

          {isOwnProfile && isAuthenticated && (
            <div style={{ marginBottom: "20px" }}>
              <CreatePostBox onPostCreated={handlePostCreated} />
            </div>
          )}

          {postsLoading ? (
            <div className="feed-loading">Đang tải bài viết...</div>
          ) : userPosts.length === 0 ? (
            <div className="feed-empty" style={{ background: "#ffffff", borderRadius: "16px", padding: "40px 20px" }}>
              <div className="feed-empty-text">Chưa có bài viết nào</div>
              <div className="feed-empty-sub">
                {isOwnProfile
                  ? "Hãy chia sẻ bài viết đầu tiên lên trang cá nhân của bạn!"
                  : "Người dùng này chưa có bài viết nào."}
              </div>
            </div>
          ) : (
            <>
              {userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostDeleted={handlePostDeleted}
                  onPostUpdated={handlePostUpdated}
                  showPinnedBadge={true}
                />
              ))}

              {hasMorePosts && (
                <button
                  className="feed-load-more"
                  onClick={handleLoadMorePosts}
                  disabled={loadingMorePosts}
                >
                  {loadingMorePosts ? "Đang tải..." : "Xem thêm bài viết"}
                </button>
              )}
            </>
          )}
        </section>
      </main>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          fullName={fullName}
          setFullName={setFullName}
          phone={phone}
          setPhone={setPhone}
          bio={bio}
          setBio={setBio}
          email={user.email}
          avatarUrl={avatarUrl}
          avatarUploading={avatarUploading}
          openFilePicker={openFilePicker}
          onSave={onSave}
          saving={saving}
        />
      )}
    </div>
  );
}


