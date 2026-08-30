import api from "./client.js";

// Self-service profile — the backend always acts on the authenticated user.

export function getMyProfile() {
  return api.get("/users/me");
}

export function updateMyProfile(payload) {
  return api.patch("/users/me", payload);
}

export function uploadMyAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteMyAvatar() {
  return api.delete("/users/me/avatar");
}
