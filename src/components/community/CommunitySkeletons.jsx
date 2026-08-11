import React from "react";

export function PostCardSkeleton({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="post-skeleton-card">
          <div className="post-skeleton-header">
            <div className="community-skeleton post-skeleton-avatar" />
            <div className="post-skeleton-meta">
              <div className="community-skeleton post-skeleton-line w-40" />
              <div className="community-skeleton post-skeleton-line w-30" style={{ height: 11 }} />
            </div>
          </div>
          <div className="post-skeleton-body">
            <div className="community-skeleton post-skeleton-line w-100" />
            <div className="community-skeleton post-skeleton-line w-80" />
            <div className="community-skeleton post-skeleton-line w-60" />
          </div>
          <div className="post-skeleton-actions">
            <div className="community-skeleton post-skeleton-btn" />
            <div className="community-skeleton post-skeleton-btn" />
            <div className="community-skeleton post-skeleton-btn" />
          </div>
        </div>
      ))}
    </>
  );
}

export function CommentSkeleton({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="comment-skeleton-item">
          <div className="community-skeleton comment-skeleton-avatar" />
          <div className="comment-skeleton-content">
            <div className="comment-skeleton-bubble">
              <div className="community-skeleton post-skeleton-line w-30" style={{ height: 12 }} />
              <div className="community-skeleton post-skeleton-line w-80" style={{ height: 13 }} />
            </div>
            <div className="comment-skeleton-meta">
              <div className="community-skeleton post-skeleton-line w-30" style={{ height: 10 }} />
              <div className="community-skeleton post-skeleton-line w-30" style={{ height: 10 }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function SidebarLeaderboardSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sidebar-skeleton-item">
          <div className="community-skeleton sidebar-skeleton-rank" />
          <div className="community-skeleton sidebar-skeleton-avatar" />
          <div className="sidebar-skeleton-info">
            <div className="community-skeleton post-skeleton-line w-60" style={{ height: 13 }} />
            <div className="community-skeleton post-skeleton-line w-40" style={{ height: 10 }} />
          </div>
        </div>
      ))}
    </>
  );
}
