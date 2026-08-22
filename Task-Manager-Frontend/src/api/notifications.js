import api from "./client.js";

export function listNotifications() {
  return api.get("/notifications");
}

export function markNotificationRead(id) {
  return api.patch(`/notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return api.patch("/notifications/read-all");
}