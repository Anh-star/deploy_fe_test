import axiosClient from "./axiosClient";

// ========== Posts ==========

export const getFeed = async (page = 0, size = 10) => {
  const res = await axiosClient.get("/community/posts", { params: { page, size } });
  return res.data.data;
};

export const getSavedPosts = async (page = 0, size = 10) => {
  const res = await axiosClient.get("/community/posts/saved", { params: { page, size } });
  return res.data.data;
};

export const getPostById = async (postId) => {
  const res = await axiosClient.get(`/community/posts/${postId}`);
  return res.data.data;
};

export const getPostDetail = getPostById;

export const createPost = async ({ title, content, tags, imageUrls, fileUrls, poll, allowComments }) => {
  const res = await axiosClient.post("/community/posts", { title, content, tags, imageUrls, fileUrls, poll, allowComments });
  return res.data.data;
};

export const deletePost = async (postId) => {
  const res = await axiosClient.delete(`/community/posts/${postId}`);
  return res.data;
};

export const updatePost = async (postId, { content, imageUrls }) => {
  const res = await axiosClient.put(`/community/posts/${postId}`, { content, imageUrls });
  return res.data.data;
};

export const toggleLikePost = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/like`);
  return res.data.data;
};

export const votePost = async (postId, voteType) => {
  const res = await axiosClient.post(`/community/posts/${postId}/vote`, { voteType });
  return res.data.data;
};

export const toggleSavePost = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/save`);
  return res.data.data;
};

export const togglePostNotifications = async (postId) => {
  const res = await axiosClient.post(`/community/posts/${postId}/toggle-notifications`);
  return res.data?.data ?? res.data;
};

export const votePollOption = async (pollId, optionId) => {
  const res = await axiosClient.post(`/community/posts/polls/${pollId}/options/${optionId}/vote`);
  return res.data.data;
};

export const getPollVoters = async (optionId) => {
  const res = await axiosClient.get(`/community/posts/polls/options/${optionId}/voters`);
  return res.data.data;
};

export const addPollOption = async (pollId, optionText) => {
  const res = await axiosClient.post(`/community/posts/polls/${pollId}/options`, { optionText });
  return res.data.data;
};

// ========== Comments ==========

export const getComments = async (postId, page = 0, size = 10) => {
  const res = await axiosClient.get(`/community/posts/${postId}/comments`, { params: { page, size } });
  return res.data.data;
};

export const addComment = async (postId, { body, parentCommentId }) => {
  const payload = { body: body ? body.trim() : "" };
  if (parentCommentId && typeof parentCommentId === "string" && parentCommentId.trim() !== "") {
    payload.parentCommentId = parentCommentId.trim();
  }
  const res = await axiosClient.post(`/community/posts/${postId}/comments`, payload);
  return res.data?.data ?? res.data;
};

export const deleteComment = async (commentId) => {
  const res = await axiosClient.delete(`/community/posts/comments/${commentId}`);
  return res.data;
};

export const getReplies = async (commentId) => {
  const res = await axiosClient.get(`/community/posts/comments/${commentId}/replies`);
  return res.data.data;
};

export const toggleLikeComment = async (commentId) => {
  const res = await axiosClient.post(`/community/posts/comments/${commentId}/like`);
  return res.data.data;
};

// ========== Report & Moderation ==========

export const reportPost = async (postId, { reasonCode, detail }) => {
  const res = await axiosClient.post(`/community/posts/${postId}/report`, { reasonCode, detail });
  return res.data;
};

export const getReportedPosts = async (status, page = 0, size = 10) => {
  const res = await axiosClient.get("/community/moderation/reports", { params: { status, page, size } });
  return res.data.data;
};

export const resolveReport = async (reportId) => {
  const res = await axiosClient.put(`/community/moderation/reports/${reportId}/resolve`);
  return res.data;
};

export const dismissReport = async (reportId) => {
  const res = await axiosClient.put(`/community/moderation/reports/${reportId}/dismiss`);
  return res.data;
};

export const hidePost = async (postId) => {
  const res = await axiosClient.put(`/community/moderation/posts/${postId}/hide`);
  return res.data;
};

export const unhidePost = async (postId) => {
  const res = await axiosClient.put(`/community/moderation/posts/${postId}/unhide`);
  return res.data;
};

export const moderatorDeletePost = async (postId) => {
  const res = await axiosClient.delete(`/community/moderation/posts/${postId}`);
  return res.data;
};
