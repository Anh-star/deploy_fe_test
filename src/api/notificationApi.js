import axiosClient from "./axiosClient";

export const getNotifications = async (page = 0, size = 20) => {
  const res = await axiosClient.get("/notifications", { params: { page, size } });
  return res.data.data;
};

export const getUnreadCount = async () => {
  const res = await axiosClient.get("/notifications/unread-count");
  return res.data.data;
};

export const markAsRead = async (id) => {
  const res = await axiosClient.put(`/notifications/${id}/read`);
  return res.data;
};

export const markAllAsRead = async () => {
  const res = await axiosClient.put("/notifications/read-all");
  return res.data;
};
