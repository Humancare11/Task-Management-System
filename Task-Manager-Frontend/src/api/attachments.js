import api from "./client.js";

function attachmentsBase(projectId, taskId, subtaskId) {
  return subtaskId
    ? `/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}/attachments`
    : `/projects/${projectId}/tasks/${taskId}/attachments`;
}

export function listAttachments(projectId, taskId, subtaskId) {
  return api.get(attachmentsBase(projectId, taskId, subtaskId));
}

export function uploadAttachment(projectId, taskId, file, subtaskId) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    attachmentsBase(projectId, taskId, subtaskId),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

export function deleteAttachment(projectId, taskId, attachmentId, subtaskId) {
  return api.delete(
    `${attachmentsBase(projectId, taskId, subtaskId)}/${attachmentId}`,
  );
}

function commentAttachmentsBase(projectId, taskId, commentId) {
  return `/projects/${projectId}/tasks/${taskId}/comments/${commentId}/attachments`;
}

export function listCommentAttachments(projectId, taskId, commentId) {
  return api.get(commentAttachmentsBase(projectId, taskId, commentId));
}

export function uploadCommentAttachment(projectId, taskId, commentId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    commentAttachmentsBase(projectId, taskId, commentId),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}
