import api from "./client.js";

function commentsBase(projectId, taskId, subtaskId) {
  return subtaskId
    ? `/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}/comments`
    : `/projects/${projectId}/tasks/${taskId}/comments`;
}

export function listComments(projectId, taskId, subtaskId) {
  return api.get(commentsBase(projectId, taskId, subtaskId));
}

export function createComment(projectId, taskId, content, subtaskId) {
  return api.post(commentsBase(projectId, taskId, subtaskId), {
    content,
  });
}

export function deleteComment(projectId, taskId, commentId, subtaskId) {
  return api.delete(
    `${commentsBase(projectId, taskId, subtaskId)}/${commentId}`
  );
}
