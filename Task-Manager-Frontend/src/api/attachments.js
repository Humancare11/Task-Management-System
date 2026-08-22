import api from "./client.js";

export function listAttachments(projectId, taskId) {
  return api.get(`/projects/${projectId}/tasks/${taskId}/attachments`);
}

export function uploadAttachment(projectId, taskId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    `/projects/${projectId}/tasks/${taskId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

export function deleteAttachment(projectId, taskId, attachmentId) {
  return api.delete(
    `/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
  );
}