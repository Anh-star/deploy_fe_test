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

export const createPost = async ({ content, imageUrls, fileUrls, poll }) => {
  const res = await axiosClient.post("/community/posts", { content, imageUrls, fileUrls, poll });
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

export const votePollOption = async (pollId, optionId) => {
  const res = await axiosClient.post(`/community/posts/polls/${pollId}/options/${optionId}/vote`);
  return res.data.data;
};

// ========== Comments ==========

export const getComments = async (postId, page = 0, size = 10) => {
  const res = await axiosClient.get(`/community/posts/${postId}/comments`, { params: { page, size } });
  return res.data.data;
};

export const addComment = async (postId, { body, parentCommentId }) => {
  const res = await axiosClient.post(`/community/posts/${postId}/comments`, { body, parentCommentId });
  return res.data.data;
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
