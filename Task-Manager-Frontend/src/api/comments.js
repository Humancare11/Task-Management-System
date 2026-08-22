import api from "./client.js";

export function listComments(projectId, taskId) {
  return api.get(`/projects/${projectId}/tasks/${taskId}/comments`);
}

export function createComment(projectId, taskId, content) {
  return api.post(`/projects/${projectId}/tasks/${taskId}/comments`, {
    content,
  });
}

export function deleteComment(projectId, taskId, commentId) {
  return api.delete(
    `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
  );
}