import axiosClient from "./axiosClient";

// Fetch public post feed
export const getPostFeed = async (page = 0, size = 10) => {
  const res = await axiosClient.get("/community/posts", {
    params: { page, size },
  });
  return res.data.data;
};
export const getFeed = getPostFeed;

// Fetch post by ID
export const getPostById = async (postId) => {
  const res = await axiosClient.get(`/community/posts/${postId}`);
  return res.data.data;
};

// Fetch post edit history
export const getPostEditHistory = async (postId) => {
  const res = await axiosClient.get(`/community/posts/${postId}/edit-history`);
  return res.data.data;
};

// Fetch user posts
export const getUserPosts = async (authorId, page = 0, size = 10) => {
  const res = await axiosClient.get(`/community/posts/user/${authorId}`, {
    params: { page, size },
  });
  return res.data.data;
};

// Toggle Pin post (author)
export const togglePinPost = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/pin`);
  return res.data.data;
};

// Create new post
export const createPost = async (postData) => {
  const res = await axiosClient.post("/community/posts", postData);
  return res.data.data;
};

// Delete post (author)
export const deletePost = async (postId) => {
  const res = await axiosClient.delete(`/community/posts/${postId}`);
  return res.data;
};

// Update post (author)
export const updatePost = async (postId, postData) => {
  const res = await axiosClient.put(`/community/posts/${postId}`, postData);
  return res.data.data;
};

// Vote post (UPVOTE / DOWNVOTE)
export const votePost = async (postId, voteType = "UPVOTE") => {
  const res = await axiosClient.post(
    `/community/posts/${postId}/vote`,
    { voteType },
    { params: { voteType } }
  );
  return res.data.data;
};

// Toggle Save post
export const toggleSavePost = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/save`);
  return res.data.data; // returns boolean (true = saved, false = unsaved)
};

// Fetch saved posts list
export const getSavedPosts = async (page = 0, size = 10) => {
  const res = await axiosClient.get("/community/posts/saved", {
    params: { page, size },
  });
  return res.data.data;
};

// Vote poll option
export const votePollOption = async (pollId, optionId) => {
  const res = await axiosClient.post(`/community/posts/polls/${pollId}/options/${optionId}/vote`);
  return res.data.data;
};

// Get poll voters
export const getPollVoters = async (optionId) => {
  const res = await axiosClient.get(`/community/posts/polls/options/${optionId}/voters`);
  return res.data.data;
};

// Add poll option
export const addPollOption = async (pollId, optionText) => {
  const res = await axiosClient.post(`/community/posts/polls/${pollId}/options`, { optionText }, {
    params: { optionText },
  });
  return res.data.data;
};

// Delete poll option
export const deletePollOption = async (optionId) => {
  const res = await axiosClient.delete(`/community/posts/polls/options/${optionId}`);
  return res.data.data;
};

// Fetch comments for a post
export const getPostComments = async (postId, page = 0, size = 10) => {
  const res = await axiosClient.get(`/community/posts/${postId}/comments`, {
    params: { page, size },
  });
  return res.data.data;
};
export const getComments = getPostComments;

// Fetch replies for a comment
export const getCommentReplies = async (commentId) => {
  const res = await axiosClient.get(`/community/posts/comments/${commentId}/replies`);
  return res.data.data;
};
export const getReplies = getCommentReplies;

// Add comment or reply
export const addComment = async (postId, body, parentCommentId = null) => {
  let payloadBody = body;
  let payloadParentId = parentCommentId;
  if (typeof body === "object" && body !== null) {
    payloadBody = body.body;
    payloadParentId = body.parentCommentId || parentCommentId;
  }
  const res = await axiosClient.post(`/community/posts/${postId}/comments`, {
    body: payloadBody,
    parentCommentId: payloadParentId,
  });
  return res.data.data;
};

// Delete comment (author)
export const deleteComment = async (commentId) => {
  const res = await axiosClient.delete(`/community/posts/comments/${commentId}`);
  return res.data;
};

// Vote comment (Upvote / Downvote)
export const voteComment = async (commentId, voteType = "UPVOTE") => {
  const res = await axiosClient.post(`/community/posts/comments/${commentId}/vote?type=${voteType}`);
  return res.data.data;
};

// Toggle Like comment
export const toggleLikeComment = async (commentId) => {
  return voteComment(commentId, "UPVOTE");
};

// Report a post
export const reportPost = async (postId, reasonCodeOrData, detailArg) => {
  let reasonCode;
  let detail;

  if (typeof reasonCodeOrData === "object" && reasonCodeOrData !== null) {
    reasonCode = reasonCodeOrData.reasonCode;
    detail = reasonCodeOrData.detail;
  } else {
    reasonCode = reasonCodeOrData;
    detail = detailArg;
  }

  const res = await axiosClient.post(`/community/posts/${postId}/report`, {
    reasonCode,
    detail,
  });
  return res.data;
};

// Toggle mute notifications for a post
export const togglePostNotifications = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/notifications/mute`);
  return res.data.data; // returns boolean (true = muted, false = unmuted)
};

// Community Moderator APIs
export const getModerationStats = async () => {
  const res = await axiosClient.get("/community/moderation/stats");
  return res.data.data;
};

export const getReportedPosts = async (status, page = 0, size = 10, keyword = "", startDate = "", endDate = "") => {
  const params = { status, page, size };
  if (keyword && keyword.trim()) params.keyword = keyword.trim();
  if (startDate) params.startDate = `${startDate}T00:00:00`;
  if (endDate) params.endDate = `${endDate}T23:59:59`;

  const res = await axiosClient.get("/community/moderation/reports", { params });
  return res.data.data;
};

export const resolveReport = async (reportId) => {
  const res = await axiosClient.put(`/community/moderation/reports/${reportId}/resolve`);
  return res.data;
};

export const dismissReport = async (reportId, reason) => {
  const res = await axiosClient.put(`/community/moderation/reports/${reportId}/dismiss`, null, {
    params: { reason },
  });
  return res.data;
};

export const dismissPostReports = async (postId, reason) => {
  const res = await axiosClient.put(`/community/moderation/posts/${postId}/dismiss-reports`, null, {
    params: { reason },
  });
  return res.data;
};

export const hidePost = async (postId, reason) => {
  const res = await axiosClient.put(`/community/moderation/posts/${postId}/hide`, null, {
    params: { reason },
  });
  return res.data;
};

export const unhidePost = async (postId, reason) => {
  const res = await axiosClient.put(`/community/moderation/posts/${postId}/unhide`, null, {
    params: { reason },
  });
  return res.data;
};

export const moderatorDeletePost = async (postId, reason) => {
  const res = await axiosClient.delete(`/community/moderation/posts/${postId}`, {
    params: { reason },
  });
  return res.data;
};

// Escalate Report to Admin
export const escalateReport = async (reportId, reason) => {
  const res = await axiosClient.put(`/community/moderation/reports/${reportId}/escalate`, null, {
    params: { reason },
  });
  return res.data;
};

// Admin Community Moderation APIs
export const getAdminEscalatedReports = async (page = 0, size = 10, keyword = "", startDate = "", endDate = "", status = "ESCALATED") => {
  const params = { page, size, status };
  if (keyword && keyword.trim()) params.keyword = keyword.trim();
  if (startDate) params.startDate = `${startDate}T00:00:00`;
  if (endDate) params.endDate = `${endDate}T23:59:59`;

  const res = await axiosClient.get("/admin/community-moderation/reports", { params });
  return res.data.data;
};

export const adminBanUserFromReport = async (reportId, reason) => {
  const res = await axiosClient.put(`/admin/community-moderation/reports/${reportId}/ban-user`, null, {
    params: { reason },
  });
  return res.data;
};

export const adminUnbanUserFromReport = async (reportId, reason) => {
  const res = await axiosClient.put(`/admin/community-moderation/reports/${reportId}/unban-user`, null, {
    params: { reason },
  });
  return res.data;
};

export const adminDismissEscalatedReport = async (reportId, reason) => {
  const res = await axiosClient.put(`/admin/community-moderation/reports/${reportId}/dismiss`, null, {
    params: { reason },
  });
  return res.data;
};

